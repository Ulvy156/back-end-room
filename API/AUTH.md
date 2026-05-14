# Auth API

Base URL: `http://localhost:8080`

All protected endpoints require the `Authorization` header:
```
Authorization: Bearer <accessToken>
```

---

## Table of Contents

- [Login with Email](#1-login-with-email)
- [Login with Telegram](#2-login-with-telegram)
- [Register](#3-register)
- [Verify Account](#4-verify-account)
- [Refresh Token](#5-refresh-token)
- [Logout](#6-logout)
- [Get Profile](#7-get-profile)
- [Forgot Password](#8-forgot-password)
- [Reset Password](#9-reset-password)

---

## Token Behavior

| Token | Lifetime | Storage |
|---|---|---|
| Access token | 15 minutes | Memory / `cookie` |
| Refresh token | 7 days | HttpOnly cookie (`refresh_token`) — set automatically by the server |

When an access token expires, call [Refresh Token](#3-refresh-token) to get a new one. The refresh token cookie is sent automatically by the browser on every request to the same origin.

---

## Endpoints

### 1. Login with Email

```
POST /auth/login
```

Authenticates a user with email + password and returns an access token. The refresh token is set as an HttpOnly cookie automatically.

**Rate limit:** 5 requests per 15 minutes per IP.

**Request body**

```json
{
  "email": "user@example.com",
  "password": "YourPassword123!"
}
```

| Field | Type | Rules |
|---|---|---|
| `email` | `string` | Valid email format |
| `password` | `string` | Min 1 character |

**Response `200 OK`**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Error responses**

| Status | Reason |
|---|---|
| `400` | Missing or invalid fields |
| `401` | Wrong email or password |
| `401` | Account is locked |
| `429` | Rate limit exceeded |

---

### 2. Login with Telegram

```
POST /auth/telegram-login
```

Authenticates a user using the [Telegram Login Widget](https://core.telegram.org/widgets/login). The server verifies the Telegram signature before issuing tokens. The refresh token is set as an HttpOnly cookie automatically.

**Rate limit:** 5 requests per 15 minutes per IP.

> The user must have their Telegram account linked to a system account (their Telegram ID stored in their profile). If not linked, login will fail with `401`.

**How to get the payload (frontend)**

Add the Telegram Login Widget to your page. When the user authenticates, Telegram calls your callback with the auth object — forward it directly to this endpoint.

```html
<script
  async
  src="https://telegram.org/js/telegram-widget.js?22"
  data-telegram-login="YOUR_BOT_USERNAME"
  data-size="large"
  data-onauth="onTelegramAuth(user)"
  data-request-access="write">
</script>

<script>
  async function onTelegramAuth(user) {
    const res = await fetch('/auth/telegram-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(user),
    });
    const data = await res.json();
    // store data.accessToken
  }
</script>
```

**Request body** (fields provided by Telegram widget — send as-is)

```json
{
  "id": 123456789,
  "first_name": "John",
  "last_name": "Doe",
  "username": "johndoe",
  "photo_url": "https://t.me/i/userpic/...",
  "auth_date": 1747123456,
  "hash": "abc123def456..."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `number` | Yes | Telegram user ID |
| `first_name` | `string` | Yes | User's first name |
| `last_name` | `string` | No | User's last name |
| `username` | `string` | No | Telegram username |
| `photo_url` | `string` | No | Profile photo URL |
| `auth_date` | `number` | Yes | Unix timestamp of auth — must be within 24 hours |
| `hash` | `string` | Yes | HMAC-SHA256 signature — verified by server |

**Response `200 OK`**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Error responses**

| Status | Reason |
|---|---|
| `400` | Missing or invalid fields |
| `401` | Telegram signature is invalid |
| `401` | `auth_date` is older than 24 hours |
| `401` | No account linked to this Telegram ID |
| `401` | Account is locked |
| `429` | Rate limit exceeded |

---

### 3. Register

```
POST /auth/register
```

Creates a new user account and immediately returns an access token — no separate login step needed. The refresh token is set as an HttpOnly cookie automatically.

**Request body**

```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "YourPassword123!",
  "role": "USER"
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `name` | `string` | Yes | Non-empty |
| `email` | `string` | Yes | Valid email, must be unique |
| `password` | `string` | Yes | Strong password (see [Password Requirements](#password-requirements)) |
| `role` | `string` | No | `"USER"` (default) or `"LANDLORD"` — `"ADMIN"` is not allowed here |

**Response `201 Created`**

```json
{
  "message": "Account created. Please check your email for the OTP to verify your account.",
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

> No tokens are issued yet. The account must be verified via [Verify Account](#4-verify-account) before login is possible.

**Error responses**

| Status | Reason |
|---|---|
| `400` | Missing or invalid fields |
| `400` | Email already in use |
| `400` | Password does not meet strength requirements |

---

### 4. Verify Account

```
POST /auth/verify-account
```

Verifies the account using the 6-digit OTP sent to the user's email during registration. On success, issues tokens and the user is logged in immediately.

**Rate limit:** 5 attempts per 15 minutes per IP.

**Request body**

```json
{
  "email": "user@example.com",
  "otp": "384920"
}
```

| Field | Type | Rules |
|---|---|---|
| `email` | `string` | Valid email format |
| `otp` | `string` | Exactly 6 digits |

**Response `200 OK`**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Error responses**

| Status | Reason |
|---|---|
| `400` | Invalid or expired OTP |
| `400` | Account is already verified |
| `429` | Rate limit exceeded |

---

### 5. Refresh Token 

```
POST /auth/refresh-token
```

Issues a new access token using the refresh token cookie. Also rotates the refresh token (old cookie is replaced with a new one).

> The browser sends the `refresh_token` cookie automatically — no manual token handling needed.

**Request body:** none

**Response `200 OK`**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error responses**

| Status | Reason |
|---|---|
| `401` | Cookie missing, token expired, or token was already used |

**Usage pattern**

```js
// When any API call returns 401, refresh and retry:
async function request(url, options) {
  let res = await fetch(url, { ...options, credentials: 'include' });

  if (res.status === 401) {
    const refresh = await fetch('/auth/refresh-token', {
      method: 'POST',
      credentials: 'include',
    });
    if (!refresh.ok) {
      // Refresh failed — redirect to login
      window.location.href = '/login';
      return;
    }
    const { accessToken } = await refresh.json();
    options.headers = { ...options.headers, Authorization: `Bearer ${accessToken}` };
    res = await fetch(url, { ...options, credentials: 'include' });
  }

  return res;
}
```

---

### 6. Logout

```
POST /auth/logout
```

Invalidates the current refresh token and clears the cookie. The access token expires on its own after 15 minutes.

**Request body:** none

**Response:** `204 No Content`

**Error responses:** none — always succeeds even if no cookie is present.

---

### 7. Get Profile

```
GET /auth/profile
```

Returns the currently authenticated user's data.

**Headers required:** `Authorization: Bearer <accessToken>`

**Response `200 OK`**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "John Doe",
  "email": "user@example.com",
  "imgUrl": "profile/abc123.webp",
  "isLocked": false,
  "role": "USER",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

> `role` is one of: `USER` · `LANDLORD` · `ADMIN`

**Error responses**

| Status | Reason |
|---|---|
| `401` | Missing or expired access token |

---

### 8. Forgot Password

```
POST /auth/forgot-password
```

Sends a 6-digit OTP to the user via the chosen channel. OTP expires in **10 minutes**.

**Rate limit:** 3 requests per 15 minutes per IP.

> Always returns a success message regardless of whether the email exists — this is intentional to prevent account enumeration.

**Request body**

```json
{
  "email": "user@example.com",
  "channel": "email"
}
```

| Field | Type | Rules |
|---|---|---|
| `email` | `string` | Valid email format |
| `channel` | `string` | Must be `"telegram"` or `"email"` |

**Channel behavior**

| `channel` | Delivery |
|---|---|
| `"email"` | OTP sent to the user's registered Gmail address |
| `"telegram"` | OTP sent as a Telegram DM from the bot (requires the user to have a linked Telegram account) |

**Response `200 OK`**

```json
{
  "message": "If an account with that email exists, an OTP has been sent"
}
```

**Error responses**

| Status | Reason |
|---|---|
| `400` | Invalid fields |
| `400` | `channel` is `"telegram"` but user has no linked Telegram account |
| `429` | Rate limit exceeded |

---

### 9. Reset Password

```
POST /auth/reset-password
```

Resets the user's password using the OTP received from [Forgot Password](#8-forgot-password). All active sessions are invalidated on success (all refresh tokens are revoked).

**Rate limit:** 5 attempts per 15 minutes per IP.

**Request body**

```json
{
  "email": "user@example.com",
  "otp": "482931",
  "newPassword": "NewPassword123!"
}
```

| Field | Type | Rules |
|---|---|---|
| `email` | `string` | Valid email format |
| `otp` | `string` | Exactly 6 digits |
| `newPassword` | `string` | Strong password (min 8 chars, uppercase, lowercase, number, symbol) |

**Response `200 OK`**

```json
{
  "message": "Password reset successfully. Please log in again."
}
```

**Error responses**

| Status | Reason |
|---|---|
| `400` | Invalid or expired OTP |
| `400` | Password does not meet strength requirements |
| `429` | Rate limit exceeded |

---

## Password Requirements

`newPassword` and `password` fields must satisfy `IsStrongPassword`:

- Minimum **8 characters**
- At least **1 uppercase** letter
- At least **1 lowercase** letter
- At least **1 number**
- At least **1 symbol** (e.g. `!`, `@`, `#`)

---

## Role-Based Access

Some routes outside of `/auth` require a specific role. The role is embedded in the access token and checked server-side — no extra header is needed.

| Role | Description |
|---|---|
| `USER` | Standard tenant account |
| `LANDLORD` | Can list and manage properties |
| `ADMIN` | Full access — user management, lock/unlock accounts |

---

## Typical Integration Flow

```
Register + verify:
  1. POST /auth/register  { name, email, password, role? }
     → server sends OTP to email
     → returns { message, user_id } — no tokens yet
  2. POST /auth/verify-account  { email, otp }
     → store accessToken
     → refresh_token cookie set automatically
     → user is logged in

Email login:
  1. POST /auth/login  { email, password }
     → store accessToken
     → refresh_token cookie set automatically

Telegram login:
  1. User clicks Telegram Login Widget
     → Telegram calls onTelegramAuth(user)
  2. POST /auth/telegram-login  { ...user }
     → store accessToken
     → refresh_token cookie set automatically

Authenticated requests:
  → Authorization: Bearer <accessToken>
  → On 401: POST /auth/refresh-token → get new accessToken
  → On refresh 401: redirect to login

Logout:
  → POST /auth/logout
  → clear stored accessToken

Forgot password:
  → POST /auth/forgot-password  { email, channel }
  → POST /auth/reset-password   { email, otp, newPassword }
  → redirect to login
```
