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
3. `POST /auth/resend-otp` — re-sends a fresh verification OTP (overwrites the stored hash via the same `PasswordResetToken` upsert). Used when `POST /auth/login` returns 403 `not_verified`, since login itself never sends an OTP. Enumeration-safe: always returns success, silently no-ops if the email doesn't exist, is already verified, or is locked.

**Login flows**

- Email: `POST /auth/login` — validates credentials (email or phone number + password), checks `isVerified` and `isLocked`, issues both tokens.
- Telegram: `POST /auth/telegram-login` — verifies the HMAC-SHA256 hash from the Telegram widget, rejects `auth_date` older than 24 hours, looks up the user via `Phone` table (`type = TELEGRAM`). If no match, auto-registers a new `USER`-role account with `email: null` (pre-verified). Issues both tokens; response includes `is_new_user`.
- Google: `GET /auth/google` redirects to Google's consent screen; `GET /auth/google/callback` looks up the user by email, auto-registers a new `USER`-role account if none exists (or marks an existing unverified account as verified), issues both tokens, and redirects to `${FRONT_END_URL}/auth/callback?token=<accessToken>&is_new_user=<bool>` (refresh token set as cookie).

**Nullable identity fields**

`User.email` is nullable — Telegram-only sign-ups never get one. `Phone` is a separate relation table, not a column on `User`, so Google-only sign-ups simply have no `Phone` row (`type = TELEGRAM` or `type = PHONE`). Code that emails or SMS/Telegrams a user must handle the corresponding field being absent (see `property-report.service.ts`, which falls back from Telegram to email and skips notifying entirely if neither is available).

**Telegram sign in / sign up**

Popup-based: the widget opens an `oauth.telegram.org` popup and reports back via `window.opener.postMessage`, so the page's `Cross-Origin-Opener-Policy` must be `same-origin-allow-popups` (plain `same-origin` silently breaks the callback).

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant TG as Telegram
    participant BE as Backend

    User->>FE: Click "Continue with Telegram"
    FE->>TG: Widget opens oauth.telegram.org popup
    User->>TG: Confirm phone / approve in Telegram app
    TG-->>FE: window.opener.postMessage -> onTelegramAuth(user)
    FE->>BE: POST /auth/telegram-login (widget payload)
    BE->>BE: Verify HMAC-SHA256 hash, reject auth_date > 24h
    BE->>BE: Look up Phone (type=TELEGRAM, phoneNumber=id)
    alt phone match found
        BE->>BE: Use linked user
    else no match
        BE->>BE: Auto-register USER role, email=null, isVerified=true
    end
    BE-->>FE: 200 { accessToken, user_id, is_new_user } + refresh_token cookie
    alt is_new_user
        FE->>User: Navigate to /auth/role-select
    else returning user
        FE->>BE: Fetch profile with accessToken
        FE->>User: Navigate to role-based home
    end
```

**Google sign in / sign up**

Redirect-based, not a popup — no `window.opener` involved, so it's unaffected by COOP.

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant G as Google
    participant BE as Backend

    User->>FE: Click "Continue with Google"
    FE->>BE: Full-page redirect to GET /auth/google
    BE->>G: Redirect to consent screen
    User->>G: Approve
    G->>BE: GET /auth/google/callback
    BE->>BE: Look up user by email
    alt no match
        BE->>BE: Auto-register USER role
    else match, unverified
        BE->>BE: Mark existing account verified
    end
    BE-->>FE: Redirect to /auth/callback?token=...&is_new_user=... + refresh_token cookie
    alt is_new_user
        FE->>User: Navigate to /auth/role-select
    else returning user
        FE->>BE: Fetch profile with token
        FE->>User: Navigate to role-based home
    end
```

**Role selection**

`PATCH /auth/select-role` — authenticated; lets a user (typically a new Telegram/Google sign-up, defaulted to `USER`) choose `USER` or `LANDLORD`. See `select-role.dto.ts`.

**Token refresh**

`POST /auth/refresh-token` — validates the refresh token cookie, rotates `jti` in the DB, and returns a new access token + new refresh cookie.

**Forgot / reset password**

1. `POST /auth/forgot-password` — generates a 6-digit OTP, stores it hashed in `PasswordResetToken`, sends via the chosen channel (`email` or `telegram`). Always returns success to prevent email enumeration.
2. `POST /auth/reset-password` — validates the OTP, updates the password, and atomically deletes the OTP record and all refresh tokens (invalidates all sessions).

**OTPs** are 6 digits, SHA-256-hashed before storage, and expire in 10 minutes.
