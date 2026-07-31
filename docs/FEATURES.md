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
| Admin platform settings (maintenance mode, registration toggle, listing limits) | `settings`, `admin` | Done |
| Public privacy policy / terms of service endpoints | `legal` | Done |
| Server error alerting — 5xx/unhandled exceptions and process crashes notify admin via Telegram + email | `common`, `queue`, `notification` | Done |
| Admin Telegram alert on new user registration (OTP verify, Telegram widget, Google OAuth) | `auth`, `queue`, `notification` | Done |
