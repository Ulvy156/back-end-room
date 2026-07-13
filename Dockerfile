# syntax=docker/dockerfile:1

FROM node:22.23.1-bookworm-slim AS base
RUN corepack enable
WORKDIR /app

# ---- deps + build ----
FROM base AS builder
# pnpm-workspace.yaml carries onlyBuiltDependencies — without it here, pnpm's
# untrusted-build-script check has nothing to approve against and hard-fails
# (non-interactively, there's no prompt to fall back on) on bcrypt/sharp/prisma.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# ---- production runtime ----
FROM base AS runner
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --ignore-scripts: skip postinstall's `prisma generate` here — it needs the
# `prisma` CLI, which is a devDependency and therefore absent from a --prod
# install. The already-generated client is copied from the builder stage below.
# That also skips bcrypt/sharp's own native-binding postinstall scripts, so
# rebuild just those two explicitly afterward.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
RUN pnpm rebuild bcrypt sharp
COPY --from=builder /app/prisma/generated ./prisma/generated
COPY --from=builder /app/dist ./dist

EXPOSE 8080
CMD ["node", "dist/src/main.js"]
