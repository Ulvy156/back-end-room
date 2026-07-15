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
