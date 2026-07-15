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
| `common` | Cross-cutting HTTP concerns. `AllExceptionsFilter` (`src/common/filters/`) is a global `APP_FILTER` — for any 5xx/unhandled exception it enqueues `send-error-alert` (Telegram + email to `ADMIN_ALERT_EMAIL`/`ADMIN_TELEGRAM_CHAT_ID`, in-memory 5-min dedupe per route+message) then delegates to Nest's default `BaseExceptionFilter` for the response. `main.ts` also registers `uncaughtException`/`unhandledRejection` handlers that send the same alert job before exiting the process. |
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
| `send-error-alert` | Any 5xx/unhandled exception (`AllExceptionsFilter`) or process-level `uncaughtException`/`unhandledRejection` (`main.ts`) | default |
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
ADMIN_TELEGRAM_CHAT_ID # Comma-separated Telegram chat ID(s) to receive feedback/report/error-alert notifications
ADMIN_ALERT_EMAIL      # Email inbox to receive critical server-error alerts
ADMIN_SEED_EMAIL       # Required by `npx prisma db seed` — email for the seeded ADMIN account
ADMIN_SEED_PASSWORD    # Required by `npx prisma db seed` — plaintext password, hashed before insert
LANDLORD_SEED_EMAIL    # Required by `npx prisma db seed` — email for the seeded LANDLORD account (property.seed.ts looks up this user)
LANDLORD_SEED_PASSWORD # Required by `npx prisma db seed` — plaintext password, hashed before insert
```

### Validation

`ValidationPipe` is global with `whitelist: true`, `transform: true`, `enableImplicitConversion: true`. All DTOs use `class-validator`. Run `sanitizeHtml` on any user-supplied HTML before it is saved.
