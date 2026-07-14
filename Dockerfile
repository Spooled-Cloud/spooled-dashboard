# Build stage
# Use BUILDPLATFORM for the build to avoid running npm under QEMU when producing multi-arch images.
ARG BUILDPLATFORM
ARG TARGETPLATFORM

FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

WORKDIR /app

# Build identity (injected by CI; local builds fall back to unknown/dev)
ARG SOURCE_COMMIT=unknown
ARG APP_VERSION=0.0.0-dev
ENV SOURCE_COMMIT=$SOURCE_COMMIT
ENV APP_VERSION=$APP_VERSION

# Install dependencies
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Copy source code
COPY . .

# Build the application
# Note: PUBLIC_* API/WS URLs are loaded at runtime from /api/config.
# SOURCE_COMMIT / APP_VERSION are baked into the image for /api/config build identity.
RUN npm run build

# Prune devDependencies for runtime (still safe for Astro server runtime)
RUN npm prune --omit=dev --no-audit --no-fund

# Production stage
FROM --platform=$TARGETPLATFORM node:20-alpine AS production

ARG SOURCE_COMMIT=unknown
ARG APP_VERSION=0.0.0-dev

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S astro -u 1001 -G nodejs

# Copy built assets and dependencies
COPY --from=builder --chown=astro:nodejs /app/dist ./dist
COPY --from=builder --chown=astro:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=astro:nodejs /app/package.json ./package.json

# Switch to non-root user
USER astro

# Expose port
EXPOSE 4321

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production
ENV SOURCE_COMMIT=$SOURCE_COMMIT
ENV APP_VERSION=$APP_VERSION

# Runtime configuration (can be overridden via docker-compose or -e flags)
# These are read by the /api/config endpoint at runtime
ENV PUBLIC_API_URL=https://api.spooled.cloud
ENV PUBLIC_WS_URL=wss://api.spooled.cloud
ENV PUBLIC_SENTRY_ENVIRONMENT=production
# Optional: PUBLIC_SENTRY_DSN, PUBLIC_ENABLE_WORKFLOWS, PUBLIC_ENABLE_SCHEDULES, PUBLIC_ENABLE_ANALYTICS

# OCI labels for deployment provenance
LABEL org.opencontainers.image.source="https://github.com/spooled-cloud/spooled-dashboard"
LABEL org.opencontainers.image.revision=$SOURCE_COMMIT
LABEL org.opencontainers.image.version=$APP_VERSION

# Health check: explicit IPv4 (Alpine localhost may resolve to ::1 while Node binds 0.0.0.0 IPv4)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:4321/api/config', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "./dist/server/entry.mjs"]