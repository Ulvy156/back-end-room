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
