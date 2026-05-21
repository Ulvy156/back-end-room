# Rate Limit

All limits are **per IP address**. Exceeding a limit returns `429 Too Many Requests`.

---

## Global

Applies to every endpoint that does not have a per-route override.

| Limit | Window |
|---|---|
| 30 requests | 60 seconds |

---

## Per-Route Overrides

### Auth

| Endpoint | Limit | Window | Reason |
|---|---|---|---|
| `POST /auth/register` | 3 | 15 min | Prevents OTP email queue flooding |
| `POST /auth/login` | 5 | 15 min | Brute force protection |
| `POST /auth/telegram-login` | 5 | 15 min | Brute force protection |
| `POST /auth/verify-account` | 5 | 15 min | OTP guessing protection |
| `POST /auth/forgot-password` | 3 | 15 min | Prevents OTP delivery spam |
| `POST /auth/reset-password` | 5 | 15 min | OTP guessing protection |

### Property

| Endpoint | Limit | Window | Reason |
|---|---|---|---|
| `POST /property` | 5 | 10 min | Prevents fake listing spam and R2 upload abuse |
| `PATCH /property/increment-view/:id` | 10 | 1 min | Prevents view count manipulation |
| `DELETE /property/:id` | 10 | 1 min | Prevents spam delete attempts |

### User Favourite

| Endpoint | Limit | Window | Reason |
|---|---|---|---|
| `POST /user-favourite` | 20 | 1 min | Prevents favourite spam |

---

## Notes

- Limits are IP-based only — users behind a shared IP (corporate NAT, mobile carrier) share the same quota.
- Per-route limits take priority over the global limit.
- The `429` response includes a `Retry-After` header indicating when the window resets.
