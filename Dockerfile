# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
RUN corepack enable
WORKDIR /app

# ---- deps + build ----
FROM base AS builder
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# ---- production runtime ----
FROM base AS runner
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
# --ignore-scripts: skip postinstall's `prisma generate` here — it needs the
# `prisma` CLI, which is a devDependency and therefore absent from a --prod
# install. The already-generated client is copied from the builder stage below.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=builder /app/prisma/generated ./prisma/generated
COPY --from=builder /app/dist ./dist

EXPOSE 8080
CMD ["node", "dist/src/main.js"]
