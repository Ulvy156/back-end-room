# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**SabayRent** is a Cambodian property rental platform. It is a NestJS REST API that allows landlords to list properties and tenants to search, filter, and favourite them. The platform supports email and Telegram for OTP delivery, Cloudflare R2 for image storage, and a PostgreSQL-backed background job queue for async tasks.

**This is an MVP.** Build only what is needed for the current feature. Do not add abstractions, patterns, or infrastructure for scale that does not exist yet. Prefer simple and direct over flexible and extensible.

---

## Commands

```bash
# Development
pnpm run start:dev        # watch mode (primary dev command)
pnpm run start:debug      # debug + watch mode

# Build & Production
pnpm run build
pnpm run start:prod       # runs dist/main

# Code quality
pnpm run lint             # eslint with auto-fix
pnpm run format           # prettier

# Tests
pnpm run test             # unit tests (jest, rootDir: src, matches *.spec.ts)
pnpm run test:watch
pnpm run test:cov
pnpm run test:e2e         # uses test/jest-e2e.json

# Prisma
pnpm run prisma:generate  # also runs automatically on postinstall
npx prisma migrate dev --name <name>
npx prisma db push
npx prisma db seed        # runs prisma/seed/index.ts via tsx
npx prisma migrate reset
```

Server starts on `PORT` env variable (default `8080`).

---

## Reference Docs

Not auto-loaded — read the relevant file when a task touches that area.

| Doc | Read when the task involves... |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | module layout, guards, Prisma, background jobs, env vars, validation |
| [docs/CODE-RULES.md](docs/CODE-RULES.md) | writing or reviewing any new code in this repo |
| [docs/FEATURES.md](docs/FEATURES.md) | checking what's already built vs. planned |
| [docs/AUTH-FLOW.md](docs/AUTH-FLOW.md) | login, registration, tokens, OTP, password reset |
| [docs/API-CONVENTION.md](docs/API-CONVENTION.md) | adding/updating a Postman collection in `API/` |
| [docs/AI-PIPELINE.md](docs/AI-PIPELINE.md) | the (not-yet-built) AI pipeline feature |
