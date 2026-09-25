# syntax=docker/dockerfile:1

# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.6.0 --activate

# Copy root configs
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY services/engine/package.json services/engine/

# Install all dependencies for build
RUN pnpm install

# Copy source codes
COPY packages/shared packages/shared
COPY services/engine services/engine

# Build packages
RUN pnpm --filter @workflow/shared build
RUN pnpm --filter @workflow/engine build

# Stage 2: Runner
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

RUN corepack enable && corepack prepare pnpm@12.6.0 --activate

# Copy monorepo manifests and built packages
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/engine/package.json ./services/engine/
COPY --from=builder /app/services/engine/dist ./services/engine/dist

# Install production dependencies only
RUN pnpm install --prod

# Non-root user
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/healthz || exit 1

CMD ["node", "services/engine/dist/server.js"]
