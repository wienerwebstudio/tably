# syntax=docker/dockerfile:1
# Ein Dockerfile für alle drei Dienste. Ziel wählen mit --target api | web | dashboard.
#
#   docker build --target api -t tably-api .
#
# Hinweis: NEXT_PUBLIC_*-Variablen werden beim Build in die Next.js-Apps
# eingebettet und müssen deshalb als Build-Argument gesetzt werden.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY packages/database/package.json packages/database/
COPY packages/nfc/package.json packages/nfc/
COPY packages/wallet/package.json packages/wallet/
COPY packages/ui/package.json packages/ui/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
ARG NEXT_PUBLIC_WEB_URL=http://localhost:3000
ARG NEXT_PUBLIC_DASHBOARD_URL=http://localhost:3001
ARG NEXT_PUBLIC_API_DOCS_URL=http://localhost:4000/docs
ARG API_INTERNAL_URL=http://api:4000
ENV NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL NEXT_PUBLIC_DASHBOARD_URL=$NEXT_PUBLIC_DASHBOARD_URL NEXT_PUBLIC_API_DOCS_URL=$NEXT_PUBLIC_API_DOCS_URL API_INTERNAL_URL=$API_INTERNAL_URL
COPY . .
RUN pnpm build:packages

FROM build AS api-build
RUN pnpm --filter @tably/api build

# ── API ──────────────────────────────────────────────────────────────────
FROM api-build AS api
ENV NODE_ENV=production
USER node
EXPOSE 4000
# Migrationen anwenden, Tarife/Super-Admin sicherstellen, dann starten
CMD ["sh", "-c", "pnpm --filter @tably/database migrate:deploy && node apps/api/dist/seed.js && node apps/api/dist/main.js"]

# ── Website (Marketing + Kundenkarte) ────────────────────────────────────
FROM build AS web-build
RUN pnpm --filter @tably/web build

FROM base AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=web-build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# ── Dashboard ────────────────────────────────────────────────────────────
FROM build AS dashboard-build
RUN pnpm --filter @tably/dashboard build

FROM base AS dashboard
ENV NODE_ENV=production PORT=3001 HOSTNAME=0.0.0.0
COPY --from=dashboard-build --chown=node:node /app/apps/dashboard/.next/standalone ./
COPY --from=dashboard-build --chown=node:node /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=dashboard-build --chown=node:node /app/apps/dashboard/public ./apps/dashboard/public
USER node
EXPOSE 3001
CMD ["node", "apps/dashboard/server.js"]
