# Privacy Policy — Rent Room

**Last updated:** 2026-07-09

This Privacy Policy explains what information Rent Room ("we", "our", "the platform") collects from users ("you"), how we use it, and the choices you have. It applies to the Rent Room mobile/web application and its backend API.

> **Note:** This draft is generated from the actual data structures and integrations implemented in the codebase. Before publishing it publicly or in an app store listing, have it reviewed by someone with legal authority to confirm compliance with applicable law (e.g. Cambodian data protection rules, or GDPR if you serve EU users).

---

## 1. Information We Collect

### 1.1 Account Information
When you register or sign in, we collect:
- Name, email address, and password (stored as a bcrypt hash — we never store or can retrieve your plaintext password)
- Phone number(s), including whether a number is a regular phone or linked via Telegram
- Profile picture (if you upload one), stored on Cloudflare R2
- Account role (Tenant/User, Landlord, or Admin)
- Your visibility preferences (whether your phone, Telegram, or email are shown to others on your listings)

If you sign in with **Google** or **Telegram**, we receive your email/name (Google) or your Telegram user ID, name, and username (Telegram) from those providers to create or match your account. We do not receive your Google or Telegram password.

### 1.2 Property Listings (Landlords)
If you list a property, we collect and publish: address, approximate location (province/district, and optionally exact latitude/longitude and a location link), price, deposit, room details (bedrooms, bathrooms, size, floor), amenities, house rules, parking details, availability, and photos of the property.

### 1.3 Usage & Activity Data
- Properties you favourite/save
- Property view counts (aggregated, not tied to your identity in reporting)
- Location search views (province/district search popularity, aggregated)
- Reports you file against a listing (report type and description)
- Feedback/bug reports you submit
- Basic request metadata for security purposes: IP address, user agent, the action taken, and HTTP status code, recorded in an internal audit log

### 1.4 Authentication Data
- One-time passwords (OTPs) for registration and password reset — stored only as a SHA-256 hash, and expire after 10 minutes
- Session/refresh tokens (a random identifier, not your password) used to keep you signed in, valid for up to 7 days
- Login timestamps and token expiry data

---

## 2. How We Use Your Information

We use your information to:
- Create and secure your account (authentication, OTP verification, password reset)
- Let you list, browse, search, and favourite properties
- Show landlords aggregate statistics about their listings (views, favourites)
- Notify landlords and admins when a listing is reported, and notify admins of feedback submissions
- Send you OTP codes via email or Telegram
- Detect abuse, investigate reports, and maintain platform security (audit logs, rate limiting)
- Enforce platform rules (e.g. maintenance mode, listing limits) set by administrators

We do **not** sell your personal information to third parties, and we do not use your data for third-party advertising.

---

## 3. Who We Share Information With

We share data only as needed to operate the platform:

| Recipient | What is shared | Purpose |
|---|---|---|
| **Other users** | Your name, and — if you allow it — phone, Telegram username, or email, plus your published listings | So tenants and landlords can contact each other |
| **Cloudflare R2** | Property photos and profile images | Image storage/hosting |
| **Telegram (via Bot API)** | Messages containing OTPs, report/feedback alerts | Delivering notifications you or admins trigger |
| **Google** | OAuth login handshake | Sign-in with Google |
| **Gmail/SMTP** | OTP emails, notification emails | Delivering notifications by email |
| **Platform Admins** | Reports, feedback, audit logs, account status | Content moderation and platform administration |

We do not share your data with data brokers or advertising networks.

---

## 4. Data Retention

- **Account data** is retained as long as your account is active.
- **OTPs** are deleted immediately after use, or once they expire (10 minutes).
- **Refresh tokens** are deleted on logout, password reset, or automatically purged nightly once expired (02:00 daily cleanup job).
- **Audit logs** are retained for security and abuse-investigation purposes.
- If you delete your account, associated personal records (listings, favourites, phones, tokens, reports, feedback) are removed or disassociated, in line with the underlying database's cascade rules.

---

## 5. Your Choices & Rights

- **Visibility controls:** you can hide your phone number, Telegram, or email from your public listings at any time via your profile settings.
- **Access & correction:** you can view and update your profile information directly in the app.
- **Account deletion:** contact us to request deletion of your account and associated data.
- **OTP/session security:** you can log out at any time, which invalidates your active refresh token; resetting your password invalidates all active sessions.

---

## 6. Security

- Passwords are hashed with bcrypt; OTPs are hashed with SHA-256 and short-lived.
- All traffic to the API should occur over HTTPS in production.
- Access to admin functions requires a verified account with the Admin role.
- We rate-limit sensitive endpoints (login, registration, OTP requests, reporting) to reduce abuse.

No system is 100% secure, and we cannot guarantee absolute security of information transmitted to the platform.

---

## 7. Children's Privacy

Rent Room is not directed at children, and we do not knowingly collect data from children under the age required by local law to enter into a rental agreement.

---

## 8. Changes to This Policy

We may update this Privacy Policy as the platform evolves. Material changes will be reflected in the "Last updated" date above.

---

## 9. Contact Us

If you have questions about this Privacy Policy or how your data is handled, contact the platform administrator through the in-app feedback form or the support channel listed on the Rent Room website.
