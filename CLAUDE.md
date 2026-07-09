# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Rent Room** is a Cambodian property rental platform. It is a NestJS REST API that allows landlords to list properties and tenants to search, filter, and favourite them. The platform supports email and Telegram for OTP delivery, Cloudflare R2 for image storage, and a PostgreSQL-backed background job queue for async tasks.

**This is an MVP.** Build only what is needed for the current feature. Do not add abstractions, patterns, or infrastructure for scale that does not exist yet. Prefer simple and direct over flexible and extensible.

---

## Commands

```bash
# Development
pnpm run start:dev        # watch mode (primary dev command)
pnpm run start:debug      # debug + watch mode

# Build & Production
pnpm run build
pnpm run start:prod       # runs dist/main

# Code quality
pnpm run lint             # eslint with auto-fix
pnpm run format           # prettier

# Tests
pnpm run test             # unit tests (jest, rootDir: src, matches *.spec.ts)
pnpm run test:watch
pnpm run test:cov
pnpm run test:e2e         # uses test/jest-e2e.json

# Prisma
pnpm run prisma:generate  # also runs automatically on postinstall
npx prisma migrate dev --name <name>
npx prisma db push
npx prisma db seed        # runs prisma/seed/index.ts via tsx
npx prisma migrate reset
```

Server starts on `PORT` env variable (default `8080`).

---

## Architecture

**Stack:** NestJS 11 · Prisma 7 · PostgreSQL · Cloudflare R2 · pg-boss · nodemailer · grammy (Telegram)

### Global guards (applied in order)

1. **ThrottlerGuard** — 30 req / 60s globally; auth endpoints have tighter per-route limits.
2. **JwtAuthGuard** — every route requires a valid JWT by default. Opt out with `@Public()`.
3. **RolesGuard** — only activates when a route has `@Roles(...)`. Roles: `USER` · `LANDLORD` · `ADMIN`.

### Module layout

| Module | Responsibility |
|---|---|
| `auth` | Login (email/phone, Telegram, Google), register, OTP verify, refresh, logout, forgot/reset password, role selection |
| `user` | User CRUD, profile image upload via R2 |
| `property` | Property CRUD, browse/filter with pagination, homepage data, related properties, view tracking |
| `property-image` | Add/remove/reorder images per property |
| `property-amenity` | Link amenities to a property |
| `property-rules` | House rules (pets, smoking, etc.) linked to a property |
| `property-type` | Reference data — room type definitions |
| `amenity` | Reference data — amenity definitions |
| `location` | Province/district lookup and search suggestions |
| `user-favourite` | Save and unsave favourite properties per user |
| `property-report` | Users report property listings (`POST /property-report/:propertyId`); admins list/filter all reports (`GET /property-report`); owner or admin can delete (`DELETE /property-report/:id`). One report per user per property, self-report blocked. Reports require a `reportTypeId` from the `report-type` reference table. On creation, the property owner is notified async (Telegram if linked, else email) and the admin gets a Telegram alert — no auto-unpublish. |
| `report-type` | Reference data — report type definitions (scam, inappropriate, duplicate, wrong info). Public `GET /report-type`. |
| `feedback` | Users submit bug reports/suggestions (`POST /feedback`); admins list all feedback (`GET /feedback`). New submissions notify the admin via Telegram (async) |
| `admin` | Admin-only dashboard (stats, recent activity, top properties) and per-landlord property listings |
| `landlord` | Landlord dashboard (summary stats, property performance table, recent favourites activity, top properties) |
| `R2` | Cloudflare R2 via AWS S3 SDK. Images are resized (max 2400×3200) and converted to WebP (quality 82) using `sharp` before upload. |
| `cache` | In-memory cache wrapper (NestJS cache-manager). Keys defined in `src/cache/cache.key.ts`. Property mutations clear relevant homepage cache keys. |
| `queue` | Background jobs via pg-boss (PostgreSQL-backed). `QueueService` manages lifecycle and exposes `send()`, `work()`, `schedule()`. `QueueWorker` registers all handlers on startup. Job names and payload types live in `src/queue/queue.jobs.ts`. |
| `notification` | `EmailService` (nodemailer/Gmail) and `TelegramService` (grammy) — called only by `QueueWorker`. |
| `i18n` | Global `TranslationService` wrapping `nestjs-i18n`; locale files in `src/i18n/{en,km}/`. Locale resolved from `Accept-Language` header. |
| `prisma` | Global `PrismaService`; standalone `PrismaClient` in `src/prisma/prisma.client.ts` for seed scripts. |
| `config` | Global `ConfigModule`, CORS config, throttle config. |
| `settings` | Global `SettingsService` backed by a single-row `AppSettings` table (cached via `CacheService`, key `CACHE_KEYS.APP_SETTINGS`). Holds platform toggles: `maintenanceMode`, `registrationEnabled`, `maxPropertiesPerLandlord`, `maxImagesPerProperty`, `minPropertyPrice`/`maxPropertyPrice`, `commissionRate` (stored only, not yet enforced). `MaintenanceGuard` is a global `APP_GUARD` — non-ADMIN requests are rejected with 503 while `maintenanceMode` is on, except routes marked `@BypassMaintenance()` (used on `POST /auth/login` and `POST /auth/refresh-token`). Admin CRUD lives at `GET/PATCH /admin/settings` (`src/admin/settings/`). |
| `legal` | Public `GET /legal/:slug` (`privacy-policy` \| `terms-of-service`) — reads from the `LegalDocument` table (cached via `CacheService`, keys `CACHE_KEYS.LEGAL_PRIVACY_POLICY`/`LEGAL_TERMS_OF_SERVICE`). Seeded from `API/PRIVACY-POLICY.md`/`API/TERMS-OF-SERVICE.md` (`prisma/seed/legal-document.seed.ts`) but editable at runtime. Admin-only `PATCH /admin/legal/:slug` (`src/admin/legal/`) updates the DB content and invalidates the cache — the markdown files are the initial seed, not the source of truth after seeding. |

### Prisma

- Schema: `prisma/schema.prisma`. Generated client: `prisma/generated/`.
- Enums import from `prisma/generated/enums`; `Prisma` namespace types from `prisma/generated/client`.
- Seed order: provinces → districts → property types → property rules → users → amenities → properties → app settings (singleton row, `id: 1`).
- This project uses `npx prisma db push` for the dev database, not migration history — there is no `prisma/migrations/` folder. Use `db push` for schema changes here; `migrate dev` will report drift and offer to reset the database.

### Utilities (`src/utils/`)

- `prismaError(error)` — maps Prisma P2002/P2025 to NestJS HTTP exceptions. Wrap all Prisma writes in `try/catch` and call this.
- `hashingPassword(password)` — bcrypt wrapper.
- `buildOrder(orderType)` — numeric sort enum → Prisma `orderBy` clause.
- `haversineKm(lat1, lng1, lat2, lng2)` — great-circle distance for browse and detail.
- `sanitizeHtml(html)` — sanitize-html wrapper; apply before persisting any user-submitted HTML.

### Background jobs (pg-boss)

pg-boss v12 is pure ESM, so it is loaded with `await import('pg-boss')` inside `QueueService.onModuleInit()` (required because the project compiles to CommonJS). `QueueModule` is `@Global()` — inject `QueueService` anywhere without an explicit module import.

| Job | Trigger | Retry |
|---|---|---|
| `send-verification-otp` | `POST /auth/register` | 3×, 30s exponential backoff |
| `send-otp-email` | `POST /auth/forgot-password` (email) | 3×, 30s exponential backoff |
| `send-otp-telegram` | `POST /auth/forgot-password` (telegram) | 3×, 30s exponential backoff |
| `increment-property-view` | `PATCH /property/increment-view/:id` | default |
| `send-feedback-notification` | `POST /feedback` | default |
| `send-property-reported-telegram` | `POST /property-report/:propertyId` (owner has Telegram linked) | default |
| `send-property-reported-email` | `POST /property-report/:propertyId` (owner has no Telegram linked) | default |
| `send-property-report-admin-alert` | `POST /property-report/:propertyId` | default |
| `purge-expired-tokens` | Cron `0 2 * * *` (02:00 daily) | — |

### Key environment variables

```
DATABASE_URL
JWT_SECRET
JWT_EXPIRES_IN           # access token lifetime, seconds (e.g. 900 for 15 min)
JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRES_IN   # seconds, default 604800
R2_BUCKET
R2_PUB_URL
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
TG_BOT_TOKEN
GMAIL_USER
GMAIL_APP_PASSWORD
FRONT_END_URL
PORT
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL    # e.g. http://localhost:8080/auth/google/callback
ADMIN_TELEGRAM_CHAT_ID # Telegram chat ID to receive feedback notifications
```

### Validation

`ValidationPipe` is global with `whitelist: true`, `transform: true`, `enableImplicitConversion: true`. All DTOs use `class-validator`. Run `sanitizeHtml` on any user-supplied HTML before it is saved.

---

## Code Rules

These rules apply to all new code in this project.

**MVP first — build only what the current feature needs.** No speculative abstractions, no "we might need this later" infrastructure, no over-engineering. Three similar lines of code is better than a premature abstraction.

**DRY — no duplicate logic.** Before writing a helper, check `src/utils/`. If logic is used more than once, extract it to a utility or shared service. Never copy-paste a block of code across services.

**Reusable logic belongs in utils or shared services.** Business logic that spans modules (distance calc, password hashing, Prisma error handling) lives in `src/utils/`. Module-specific helpers stay inside the module.

**Wrap all Prisma writes in `try/catch` and call `prismaError(error)`.** This converts database constraint violations (P2002) and not-found errors (P2025) into the correct NestJS HTTP exceptions so the client gets a clean error response.

**Comments only when the WHY is non-obvious.** Do not comment what the code does — name it well instead. Add a comment only to explain a hidden constraint, a workaround, or behaviour that would surprise a reader.

**Keep services thin.** Controllers handle HTTP concerns (decorators, response shaping). Services handle business logic. No Prisma queries in controllers; no HTTP concepts in services.

**Follow the existing module pattern.** Every feature is a NestJS module with a controller, a service, a `dto/` folder, and an `entities/` folder if needed. Register the module in `app.module.ts`.

**Never trust `userId` from the frontend payload for authorization.** Always use `req.user.id` from the verified JWT. The only two trusted sources for identity are `req.user.id` (JWT) and the DB record. Client-provided IDs are input data only, never identity proof.

**Ownership check pattern — private `assertOwner()` in the service.** When an endpoint requires the requesting user to be the resource owner or an admin, add a private helper to the service:
```ts
private async assertOwner(id: string, requesterId: string, role: UserRole) {
  const record = await this.prisma.<model>.findUnique({ where: { id } });
  if (!record) throw new NotFoundException();
  if (record.userId !== requesterId && role !== UserRole.ADMIN)
    throw new ForbiddenException();
  return record; // reuse in the calling method — no second query needed
}
```
Do not put ownership logic in the controller. Do not create a guard for a single resource — guards are only justified when the same ownership check spans many resources.

**Every mutation endpoint that can be abused needs a `@Throttle()` override.** The global 30 req/60s is a fallback, not protection. Any endpoint that triggers an external call (email, Telegram, R2 upload), creates DB records in bulk, or can be used to inflate counters must have its own tighter `@Throttle` decorator. See `API/RATE-LIMIT.md` for current limits.

**Do not queue a job if the DB write depends on the result.** If the response or the next DB operation needs the outcome of the async work (e.g. an R2 image key that must be stored immediately), keep it synchronous. Queue only when the caller does not need the result — OTP delivery, view count increments, cleanup tasks.

---

## Features

| Feature | Module(s) | Status |
|---|---|---|
| Email + Telegram OTP registration and verification | `auth` | Done |
| JWT access + refresh token auth (HttpOnly cookie) | `auth` | Done |
| Telegram widget login (auto-registers new users) | `auth` | Done |
| Google OAuth login (auto-registers new users) | `auth` | Done |
| Post-OAuth role selection for new users | `auth` | Done |
| Forgot / reset password via OTP (email or Telegram) | `auth` | Done |
| Role-based access control (USER / LANDLORD / ADMIN) | `auth` | Done |
| User profile management and avatar upload | `user` | Done |
| Property listing CRUD with image upload and duplication | `property`, `property-image` | Done |
| Property amenities and house rules | `property-amenity`, `property-rules` | Done |
| Browse and filter properties (price, location, type, bedroom, etc.) | `property` | Done |
| Geo-based filtering and distance calculation (haversine) | `property` | Done |
| Homepage data (featured, latest, popular locations) | `property` | Done |
| Related properties (same price range, type, nearby) | `property` | Done |
| Property view count (async via pg-boss) | `property`, `queue` | Done |
| Save / unsave favourite properties | `user-favourite` | Done |
| Province and district location lookup | `location` | Done |
| Bug report / suggestion feedback with admin Telegram alert | `feedback`, `queue` | Done |
| Admin dashboard and landlord property overview | `admin` | Done |
| Landlord dashboard (stats, performance table, activity, top properties) | `landlord` | Done |
| Public landlord profile (info, contact, published properties) | `landlord` | Done |
| Async OTP delivery via email and Telegram | `queue`, `notification` | Done |
| Property report (flag listings, admin review, owner/admin delete) | `property-report` | Done |
| Nightly cleanup of expired tokens | `queue` | Done |
| Admin platform settings (maintenance mode, registration toggle, listing limits, commission rate) | `settings`, `admin` | Done |
| Public privacy policy / terms of service endpoints | `legal` | Done |

---

## Auth Flow

All auth endpoints are under `/auth`. Most are `@Public()` (no JWT required).

**Tokens**

| Token | Lifetime | Transport |
|---|---|---|
| Access token | 15 min | `Authorization: Bearer <token>` header |
| Refresh token | 7 days | HttpOnly cookie `refresh_token` (set by server, sent automatically by browser) |

Refresh tokens are stored in the `RefreshToken` table keyed by a UUID `jti`. Logout and password-reset atomically delete all tokens for the user.

**Registration flow**

1. `POST /auth/register` — creates the user with `isVerified: false`, enqueues a verification OTP email. Returns `{ message, user_id }` — no tokens yet.
2. `POST /auth/verify-account` — validates the OTP (SHA-256-hashed, expires in 10 min). On success, sets `isVerified: true`, deletes the OTP record, and issues both tokens.

**Login flows**

- Email: `POST /auth/login` — validates credentials (email or phone number + password), checks `isVerified` and `isLocked`, issues both tokens.
- Telegram: `POST /auth/telegram-login` — verifies the HMAC-SHA256 hash from the Telegram widget, rejects `auth_date` older than 24 hours, looks up the user via `Phone` table (`type = TELEGRAM`). If no match, auto-registers a new `USER`-role account (synthetic placeholder email, pre-verified). Issues both tokens; response includes `is_new_user`.
- Google: `GET /auth/google` redirects to Google's consent screen; `GET /auth/google/callback` looks up the user by email, auto-registers a new `USER`-role account if none exists (or marks an existing unverified account as verified), issues both tokens, and redirects to `${FRONT_END_URL}/auth/callback?token=<accessToken>&is_new_user=<bool>` (refresh token set as cookie).

**Role selection**

`PATCH /auth/select-role` — authenticated; lets a user (typically a new Telegram/Google sign-up, defaulted to `USER`) choose `USER` or `LANDLORD`. See `select-role.dto.ts`.

**Token refresh**

`POST /auth/refresh-token` — validates the refresh token cookie, rotates `jti` in the DB, and returns a new access token + new refresh cookie.

**Forgot / reset password**

1. `POST /auth/forgot-password` — generates a 6-digit OTP, stores it hashed in `PasswordResetToken`, sends via the chosen channel (`email` or `telegram`). Always returns success to prevent email enumeration.
2. `POST /auth/reset-password` — validates the OTP, updates the password, and atomically deletes the OTP record and all refresh tokens (invalidates all sessions).

**OTPs** are 6 digits, SHA-256-hashed before storage, and expire in 10 minutes.

---

## API Documentation Convention

Every feature has its own **Postman collection** file inside `API/`. One file per feature, self-contained — no cross-referencing required to understand an endpoint.

**File naming:** `API/<FEATURE>.json` — Postman Collection v2.1.0 format.

| Feature | File |
|---|---|
| Auth | `API/AUTH.json` |
| Property + Property Images | `API/PROPERTY.json` |
| User | `API/USER.json` |
| Favourites | `API/FAVOURITE.json` |
| Feedback | `API/FEEDBACK.json` |
| Admin | `API/ADMIN.json` |
| Landlord | `API/LANDLORD.json` |
| Property Report | `API/PROPERTY-REPORT.json` |
| Admin Settings | `API/SETTINGS.json` |
| Legal (Privacy Policy / Terms of Service) | `API/LEGAL.json` |
| Location | `API/LOCATION.json` _(create when implementing)_ |
| Amenity | `API/AMENITY.json` _(create when implementing)_ |
| Rate limits | `API/RATE-LIMIT.md` _(exception — markdown, not Postman)_ |
| Frontend integration guide | `API/INTEGRATION.md` _(exception — markdown, not Postman)_ |
| Roles & access control | `API/ROLES.md` _(exception — markdown, not Postman)_ |
| Privacy Policy | `API/PRIVACY-POLICY.md` _(exception — markdown, not Postman; seeds `LegalDocument`, served live via `GET /legal/privacy-policy`, editable via `PATCH /admin/legal/privacy-policy`)_ |
| Terms of Service | `API/TERMS-OF-SERVICE.md` _(exception — markdown, not Postman; seeds `LegalDocument`, served live via `GET /legal/terms-of-service`, editable via `PATCH /admin/legal/terms-of-service`)_ |

**Collection structure** (follow `API/AUTH.json` as the reference):
- `info.name` — feature name
- `info.description` — base URL note, auth requirements, any global notes (rate limits, token behavior)
- `variable` — at minimum `baseUrl` (`http://localhost:8080`) and `accessToken` (empty string, user fills after login)
- Each request includes: method, headers, body with example values, `description` field covering rate limits, field rules, and error codes
- Each request has at least one saved `response` example showing the real response shape

**Rule: after completing any feature or modifying an existing endpoint, update the corresponding `API/<FEATURE>.json` and this CLAUDE.md if the architecture or module layout changed.**
