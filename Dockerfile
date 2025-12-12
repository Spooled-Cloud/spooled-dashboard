# Build stage
# Use BUILDPLATFORM for the build to avoid running npm under QEMU when producing multi-arch images.
ARG BUILDPLATFORM
ARG TARGETPLATFORM

FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Copy source code
COPY . .

# Build the application
# Note: PUBLIC_* variables are now loaded at runtime from /api/config endpoint
# No build-time environment variables needed for API URLs
RUN npm run build

# Prune devDependencies for runtime (still safe for Astro server runtime)
RUN npm prune --omit=dev --no-audit --no-fund

# Production stage
FROM --platform=$TARGETPLATFORM node:20-alpine AS production

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

# Runtime configuration (can be overridden via docker-compose or -e flags)
# These are read by the /api/config endpoint at runtime
ENV PUBLIC_API_URL=https://api.spooled.cloud
ENV PUBLIC_WS_URL=wss://api.spooled.cloud
ENV PUBLIC_SENTRY_ENVIRONMENT=production
# Optional: PUBLIC_SENTRY_DSN, PUBLIC_ENABLE_WORKFLOWS, PUBLIC_ENABLE_SCHEDULES, PUBLIC_ENABLE_ANALYTICS

# Health check using /api/config endpoint (always returns 200)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4321/api/config', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "./dist/server/entry.mjs"]
