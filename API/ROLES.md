# Roles & Access Control

This document defines what each role can do and how the frontend should use it to show or hide UI elements.

---

## The Three Roles

| Role | Who is it |
|---|---|
| `USER` | Tenant — browses properties and saves favourites |
| `LANDLORD` | Property owner — lists and manages their own properties |
| `ADMIN` | Platform manager — full access to everything |

A user's role is set at registration and can only be changed by an ADMIN. A LANDLORD cannot act as a tenant and vice versa.

---

## How to Get the Role

After any login (email, Google, Telegram), call `GET /auth/profile`:

```ts
const { data } = await $axios.get('/auth/profile')
// data.role → 'USER' | 'LANDLORD' | 'ADMIN'
authStore.setUser(data)
```

Store the role in `useAuthStore` and use it throughout the app. Do not decode the JWT on the frontend — always use the profile endpoint as the source of truth.

---

## Access Matrix

### Public (no login required)

| Feature | Endpoint |
|---|---|
| Homepage data | `GET /property/home-page` |
| Browse / filter properties | `POST /property/browse-properties` |
| Property detail | `POST /property/property-details` |
| Related properties | `GET /property/related-properties/:id` |
| Increment view count | `PATCH /property/increment-view/:id` |
| Location suggestions | `GET /location` |
| Provinces / districts | `GET /location/province`, `/location/district/:id` |
| Property types | `GET /property-type`, `/property-type/:id` |
| Amenities | `GET /amenity`, `/amenity/:id` |
| Property amenities | `GET /property-amenity` |
| Property rules | `GET /property-rules` |

---

### USER only

| Feature | Endpoint |
|---|---|
| Save a property | `POST /user-favourite` |
| Remove a saved property | `DELETE /user-favourite/:id` |
| View own favourites | `GET /user-favourite/all/user-id/:id` |

> LANDLORD calling these endpoints receives `403 Forbidden`.

---

### LANDLORD only

| Feature | Endpoint |
|---|---|
| Create property listing | `POST /property` |
| View own listings | `GET /property/my-properties` |
| Update a listing | `PATCH /property/:id` |
| Delete a listing | `DELETE /property/:id` |
| Publish / unpublish listing | `PATCH /property/toggle-publish/:id` |
| Mark as available / unavailable | `PATCH /property/toggle-availability/:id` |
| Upload image to listing | `POST /property-image/:propertyId` |
| Set cover image | `PATCH /property-image/:imageId/set-cover` |
| Delete image from listing | `DELETE /property-image/:imageId` |

> USER calling these endpoints receives `403 Forbidden`.

---

### ADMIN only

| Feature | Endpoint |
|---|---|
| Feature / unfeature a property | `PATCH /property/set-feature/:id` |
| View all properties | `GET /property` |
| Create user manually | `POST /user` |
| View all users | `GET /user` |
| Get any user by ID | `GET /user/:id` |
| Update any user | `PATCH /user/:id` |
| Lock user | `PATCH /user/lock-user/:id` |
| Unlock user | `PATCH /user/unlock-user/:id` |
| Delete user | `DELETE /user/:id` |
| View all feedback | `GET /feedback` |

---

### All authenticated roles (USER + LANDLORD + ADMIN)

| Feature | Endpoint |
|---|---|
| Get own profile | `GET /auth/profile` |
| Get own full profile | `GET /user/me` |
| Update own display name | `PATCH /user/me` |
| Update own avatar | `PATCH /user/me/profile-image` |
| Delete own avatar | `DELETE /user/me/profile-image` |
| Change own password | `PATCH /auth/change-password` |
| Submit feedback / bug report | `POST /feedback` |
| Logout | `POST /auth/logout` |
| Refresh token | `POST /auth/refresh-token` |

---

## HTTP Error Codes

| Code | Meaning | When |
|---|---|---|
| `401` | Not authenticated | Missing or expired access token, wrong credentials |
| `403` | Not authorized | Correct role required but user has a different role, or account not verified / locked |

The key distinction: `401` means the server does not know who you are. `403` means the server knows who you are but you are not allowed.

---

## Frontend Implementation

### 1 — Read the role after login

```ts
// composables/useAuth.ts
const authStore = useAuthStore()

async function loadProfile() {
  const { data } = await $axios.get('/auth/profile')
  authStore.setUser(data) // stores data.role
}
```

### 2 — Role helpers

```ts
// composables/useRole.ts
export function useRole() {
  const authStore = useAuthStore()
  const role = computed(() => authStore.user?.role)

  return {
    isUser:     computed(() => role.value === 'USER'),
    isLandlord: computed(() => role.value === 'LANDLORD'),
    isAdmin:    computed(() => role.value === 'ADMIN'),
    isAuth:     computed(() => !!role.value),
  }
}
```

### 3 — Use in templates

```vue
<script setup>
const { isUser, isLandlord, isAdmin } = useRole()
</script>

<template>
  <!-- Only tenants see the favourites button -->
  <FavouriteButton v-if="isUser" :propertyId="property.id" />

  <!-- Only landlords see listing management -->
  <LandlordDashboard v-if="isLandlord" />

  <!-- Only admins see the admin panel -->
  <AdminPanel v-if="isAdmin" />

  <!-- Everyone sees property cards -->
  <PropertyCard :property="property" />
</template>
```

### 4 — Redirect based on role after login

```ts
// After successful login, redirect to the right page
function redirectAfterLogin(role: string) {
  if (role === 'LANDLORD') return router.replace('/dashboard')
  if (role === 'ADMIN')    return router.replace('/admin')
  return router.replace('/')                // USER → home
}
```

### 5 — Handle 403 in the axios plugin

A `403` on a protected endpoint means the user's role is wrong — show an error, not a login redirect (they ARE logged in):

```ts
// In your axios response interceptor (in addition to 401 handling)
if (status === 403) {
  // Don't redirect to login — they are authenticated
  // Show an "Access denied" toast or navigate to a not-allowed page
  showError('You do not have permission to perform this action')
  return Promise.reject(error)
}
```

---

## Registration — Choosing a Role

At registration the user chooses their role:

```ts
// USER registration (default)
await $axios.post('/auth/register', {
  name, email, password,
  role: 'USER'      // or omit — defaults to USER
})

// LANDLORD registration
await $axios.post('/auth/register', {
  name, email, password,
  role: 'LANDLORD'
})
```

`ADMIN` cannot be set at registration — only an existing admin can grant that role via `PATCH /user/:id`.
