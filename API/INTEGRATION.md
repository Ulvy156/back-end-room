# Frontend Integration Guide

This guide is written for the Nuxt frontend (`front-end-room`). It assumes the Axios plugin at `app/plugins/axios.ts` is already set up.

---

## Base URL

Configured via Nuxt runtime config:

```ts
// nuxt.config.ts
runtimeConfig: {
  public: {
    apiBaseUrl: 'http://localhost:8080', // development
  }
}
```

---

## Language

Send `accept-language` on every request to receive error messages in the correct language.

```ts
// Set globally in the axios plugin or per-request
api.defaults.headers.common['accept-language'] = 'km' // or 'en'
```

---

## Token Management

| Token | Lifetime | Storage |
|---|---|---|
| Access token | 15 min | `useCookie('access_token', { sameSite: 'lax' })` — frontend manages |
| Refresh token | 7 days | HttpOnly cookie — set by server, browser sends automatically |

The axios plugin reads `access_token` cookie on every request and injects `Authorization: Bearer <token>` automatically. You only need to **write** the access token after a successful login or refresh — the plugin handles everything else.

```ts
const accessToken = useCookie<string | null>('access_token', { sameSite: 'lax' })

// After any successful login:
accessToken.value = data.accessToken
```

---

## How to Make Requests

Use the provided `$axios` instance — never create a raw `axios` instance for API calls.

```ts
// In a composable or component
const { $axios } = useNuxtApp()

const { data } = await $axios.get('/property/home-page')
```

The plugin automatically:
- Adds `Authorization: Bearer <token>` from the cookie
- On 401 → silently refreshes and retries once
- On failed refresh → clears session and redirects to `/auth/login`
- Deduplicates concurrent refresh calls (one refresh for multiple parallel requests)

---

## How to Handle Auth State

Use `useAuthStore` to track the logged-in user. Call `authStore.clear()` on logout — the plugin calls it automatically on session expiry.

```ts
const authStore = useAuthStore()

// After login
authStore.setUser(data.user)

// On logout
accessToken.value = null
authStore.clear()
await $axios.post('/auth/logout')
router.replace('/auth/login')
```

---

## Flow 1 — Email Registration

```ts
// Step 1: Register
const { data } = await $axios.post('/auth/register', {
  name: 'John Doe',
  email: 'john@example.com',
  password: 'Password123!',
  role: 'USER', // optional, defaults to USER
})
// → { message, user_id } — no tokens yet, OTP sent to email

// Step 2: User enters OTP from email

// Step 3: Verify account
const { data } = await $axios.post('/auth/verify-account', {
  email: 'john@example.com',
  otp: '384920',
})
// → { accessToken, user_id }

accessToken.value = data.accessToken // save to cookie
```

**If OTP expires:** call register again with the same email — a new OTP is sent (account exists but unverified).

**Errors:**
- `400` — email already in use, weak password
- `400` — invalid or expired OTP
- `429` — too many attempts (5 per 15 min on verify)

---

## Flow 2 — Email Login

```ts
const { data } = await $axios.post('/auth/login', {
  email: 'john@example.com',
  password: 'Password123!',
})
// → { accessToken, user_id }

accessToken.value = data.accessToken // save to cookie
```

**Errors:**
- `401` — wrong credentials (invalid email or password)
- `403` — account not verified → redirect to OTP screen
- `403` — account is locked → show locked message

```ts
try {
  await $axios.post('/auth/login', credentials)
} catch (err) {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 403) {
      // Check message to distinguish not-verified vs locked
      const msg: string = err.response.data?.message ?? ''
      if (msg.includes('not verified') || msg.includes('ផ្ទៀងផ្ទាត់')) {
        router.push('/auth/verify') // redirect to OTP screen
      } else {
        showError(msg) // account is locked
      }
    } else {
      showError(err.response?.data?.message) // 401 wrong credentials
    }
  }
}
```

---

## Flow 3 — Google Login / Sign Up

Google OAuth requires a browser redirect — you cannot use `$axios` for this.

```ts
// Redirect the user to Google consent screen
window.location.href = `${config.public.apiBaseUrl}/auth/google`
```

After the user approves, Google calls the server callback, which redirects to:
```
FRONT_END_URL/auth/callback?token=<accessToken>
```
The refresh cookie is set automatically by the server.

**Handle the callback page:**

```ts
// pages/auth/callback.vue
onMounted(() => {
  const token = useRoute().query.token as string | undefined
  if (token) {
    accessToken.value = token     // save to cookie
    router.replace('/')           // remove token from URL and go home
  } else {
    router.replace('/auth/login') // something went wrong
  }
})
```

**New user via Google:** account created with role `USER`, email verified. No OTP needed.

**Existing email account:** if the same Gmail was used to register via email + password, accounts are linked silently — both login methods work.

---

## Flow 4 — Telegram Login

Requires the [Telegram Login Widget](https://core.telegram.org/widgets/login) on the page.

```vue
<script setup>
// Declare the callback before the widget loads
window.onTelegramAuth = async (user) => {
  const { data } = await $axios.post('/auth/telegram-login', user)
  // → { accessToken, user_id }
  accessToken.value = data.accessToken
  router.replace('/')
}
</script>

<template>
  <!-- The widget calls window.onTelegramAuth(user) when the user authenticates -->
  <script
    src="https://telegram.org/js/telegram-widget.js?22"
    data-telegram-login="YOUR_BOT_USERNAME"
    data-size="large"
    data-onauth="onTelegramAuth(user)"
    data-request-access="write"
  />
</template>
```

**Errors:**
- `401` — invalid Telegram hash, expired (>24 h), or no linked account

---

## Flow 5 — Token Refresh

Handled **automatically** by the axios plugin — you do not call this manually.

The plugin:
1. Catches any `401` response (except from `/auth/refresh-token` itself and requests with no token)
2. Calls `POST /auth/refresh-token` using `withCredentials: true` (sends the HttpOnly refresh cookie)
3. Saves the new access token to the cookie
4. Retries the original request with the new token
5. Deduplicates — if multiple requests get 401 simultaneously, only one refresh call is made

If the refresh fails (refresh token expired), `clearSession()` is called automatically → redirects to `/auth/login`.

---

## Flow 6 — Logout

```ts
await $axios.post('/auth/logout') // server clears the refresh cookie
accessToken.value = null          // clear access token cookie
authStore.clear()                 // clear local user state
router.replace('/auth/login')
```

---

## Flow 7 — Forgot / Reset Password

```ts
// Step 1: Request OTP
await $axios.post('/auth/forgot-password', {
  email: 'john@example.com',
  channel: 'email', // or 'telegram'
})
// Always returns 200 — never reveals if email exists

// Step 2: User enters OTP

// Step 3: Reset password
await $axios.post('/auth/reset-password', {
  email: 'john@example.com',
  otp: '482931',
  newPassword: 'NewPassword123!',
})
// All active sessions invalidated — redirect to login
```

**Errors:**
- `400` — invalid or expired OTP
- `400` — weak password
- `429` — too many attempts (3 per 15 min on forgot, 5 per 15 min on reset)

---

## Flow 8 — Change Password (logged-in user)

```ts
await $axios.patch('/auth/change-password', {
  currentPassword: 'OldPassword123!',
  newPassword: 'NewPassword456!',
})
// → 204: session stays active, no token change needed
```

**Errors:**
- `400` — current password is incorrect
- `400` — weak new password
- `429` — too many attempts (5 per 15 min)

---

## Error Response Shape

```ts
// Single message
{
  statusCode: 400,
  message: 'Current password is incorrect',
  error: 'Bad Request'
}

// Validation errors — message is an array
{
  statusCode: 400,
  message: ['password must be a strong password', 'email must be an email'],
  error: 'Bad Request'
}
```

Handle in your axios error interceptor or per-request:

```ts
try {
  await $axios.post('/auth/login', credentials)
} catch (err) {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message
    const text = Array.isArray(msg) ? msg.join(', ') : msg
    showError(text)
  }
}
```

---

## Role-Based UI

After login, fetch the user's role from `GET /auth/profile` and store it in `useAuthStore`. Use it to show or hide UI:

```ts
const { data } = await $axios.get('/auth/profile')
authStore.setUser(data)

// In template
<LandlordDashboard v-if="authStore.user?.role === 'LANDLORD'" />
<AdminPanel v-if="authStore.user?.role === 'ADMIN'" />
```

| Role | Can do |
|---|---|
| `USER` | Browse, favourite, submit feedback |
| `LANDLORD` | USER + create and manage properties |
| `ADMIN` | Full access |
