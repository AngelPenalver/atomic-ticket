# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Build stage: full dependency set to compile TypeScript
FROM base AS builder
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# Runtime stage: production dependencies only
FROM base AS runtime
ENV NODE_ENV=production
RUN pnpm install --frozen-lockfile --prod && pnpm store prune
COPY --from=builder /app/dist ./dist

# Cloud Run injects PORT (8080 by default)
EXPOSE 8080
USER node

# Pending migrations run automatically on startup (migrationsRun: true)
CMD ["node", "dist/main"]
