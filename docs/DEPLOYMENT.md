# Deployment Guide

This guide covers the deployment paths that are maintained in this repository.

## Requirements

- Node.js `20.19.0` or newer when building outside Docker
- Docker with Compose v2 for container deployment
- `kubectl` for Kubernetes deployment
- `kustomize` only when using `kustomize edit`; `kubectl apply -k` has built-in Kustomize support

The dashboard is an Astro application served by the Node adapter. The server exposes `GET /api/config`, but the current browser startup path does not call `loadRuntimeConfig()`. API/WebSocket URLs and feature flags therefore use build-time/static fallbacks, and Sentry reads build-time `import.meta.env` directly. Do not assume changing container runtime variables reconfigures the shipped browser bundle until startup wiring is implemented and tested.

## Runtime configuration

| Variable                    | Required | Default                     | Purpose                                                      |
| --------------------------- | -------: | --------------------------- | ------------------------------------------------------------ |
| `PUBLIC_API_URL`            |       No | `https://api.spooled.cloud` | Backend HTTP API base URL                                    |
| `PUBLIC_WS_URL`             |       No | `wss://api.spooled.cloud`   | Backend WebSocket base URL                                   |
| `PUBLIC_SENTRY_DSN`         |       No | unset                       | Enables Sentry browser reporting at build time               |
| `PUBLIC_SENTRY_ENVIRONMENT` |       No | `production`                | Sentry environment label                                     |
| `PUBLIC_SENTRY_RELEASE`     |       No | unset                       | Optional Sentry release label                                |
| `PUBLIC_ENABLE_WORKFLOWS`   |       No | `true`                      | Workflow UI feature flag                                     |
| `PUBLIC_ENABLE_SCHEDULES`   |       No | `true`                      | Schedule UI feature flag                                     |
| `PUBLIC_ENABLE_ANALYTICS`   |       No | `false`                     | Analytics feature flag                                       |
| `PUBLIC_ENABLE_QUEUE_PURGE` |       No | `false`                     | Queue purge UI; keep disabled unless the backend supports it |
| `HOST`                      |       No | `0.0.0.0` in the image      | Node server bind address                                     |
| `PORT`                      |       No | `4321`                      | Node server port                                             |

These values are returned by `/api/config` and are not secrets. `PUBLIC_SENTRY_DSN` is intentionally public, but server credentials, API keys, and admin keys must never be placed in `PUBLIC_*` variables. The endpoint currently provides configuration data without guaranteeing that the browser consumes it.

When testing future runtime-config wiring behind a CDN, note that `/api/config` allows a five-minute browser cache and a one-hour shared cache.

## Docker Compose

### Local or single-host build

```bash
git clone https://github.com/spooled-cloud/spooled-dashboard.git
cd spooled-dashboard
cp .env.example .env
# Edit .env as needed.
docker compose up -d --build
```

`docker-compose.yml` builds the local image and publishes the dashboard at `http://localhost:4321` by default.

### Production image with Cloudflare Tunnel

`docker-compose.prod.yml` runs the published dashboard image and a `cloudflared` sidecar. It requires `CLOUDFLARE_TUNNEL_TOKEN` and does not publish the dashboard port to the host.

```bash
cp .env.example .env
# Set CLOUDFLARE_TUNNEL_TOKEN and any runtime overrides.
docker compose -f docker-compose.prod.yml up -d
```

Configure the tunnel route to send the public hostname to `http://dashboard:4321`.

## Docker without Compose

```bash
docker build -t spooled-dashboard:latest .

# The current browser bundle uses build-time/static API and WebSocket defaults;
# runtime PUBLIC_* overrides are not yet wired at startup.
docker run -d \
  --name spooled-dashboard \
  -p 4321:4321 \
  spooled-dashboard:latest
```

Published images are available from GitHub Container Registry:

```bash
docker pull ghcr.io/spooled-cloud/spooled-dashboard:latest
```

`main` publishes `latest` and a commit-SHA tag. A pushed `v*` Git tag publishes that version tag and refreshes `latest`.

## Kubernetes

The maintained Kustomize bases and overlays are under `k8s/`.

```bash
# Development overlay
kubectl apply -k k8s/overlays/development

# Production overlay
kubectl apply -k k8s/overlays/production
```

The production overlay currently configures:

- 3 initial replicas
- HPA range of 3–20 replicas
- CPU target of 70% and memory target of 80%
- requests of 200m CPU / 256Mi memory
- limits of 1000m CPU / 1Gi memory
- non-root user `1001`, dropped Linux capabilities, and a read-only root filesystem

To deploy an immutable image tag without permanently editing the checked-in overlay, copy the entire `k8s/` tree so the overlay's `../../base` reference remains valid. Set `RELEASE_TAG` to an existing GHCR tag; `v0.1.59` is an example:

```bash
RELEASE_TAG=v0.1.59
rm -rf /tmp/spooled-dashboard-k8s
cp -R k8s /tmp/spooled-dashboard-k8s
cd /tmp/spooled-dashboard-k8s/overlays/production
kustomize edit set image ghcr.io/spooled-cloud/spooled-dashboard=ghcr.io/spooled-cloud/spooled-dashboard:${RELEASE_TAG}
kubectl apply -k .
```

The Deployment optionally reads `spooled-dashboard-secrets`. If Sentry is enabled, create the Secret from your secret manager or use `k8s/base/secrets.yaml.template` as a local template. Never commit the populated file.

## Direct Node deployment

```bash
npm ci
npm run build
HOST=0.0.0.0 PORT=4321 NODE_ENV=production node ./dist/server/entry.mjs
```

Use a process supervisor and reverse proxy in production.

## Reverse proxy

Proxy HTTP traffic to port `4321`. The dashboard's WebSocket connection goes directly to `PUBLIC_WS_URL`, not through the dashboard server, unless both services intentionally share a proxy hostname.

Example Caddy configuration:

```caddyfile
dashboard.example.com {
    reverse_proxy 127.0.0.1:4321

    header {
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

See [Security Configuration](SECURITY.md) before setting CSP or framing policy; allowed API, WebSocket, and Sentry origins must match the deployment.

## Health checks

Use the runtime configuration endpoint for an application-level check:

```bash
curl --fail http://localhost:4321/api/config
```

The Dockerfile health check uses `/api/config`. The current Compose and Kubernetes manifests probe `/`, which verifies that the Node server can return the dashboard HTML.

## CI and releases

`.github/workflows/ci.yml` currently performs:

1. format check, ESLint, Astro type checking, and Vitest
2. production build and `dist/` artifact upload
3. a non-blocking Trivy filesystem scan (`exit-code: 0`)
4. multi-architecture GHCR publishing on `main`
5. versioned GHCR publishing for `v*` tags

A tag does not deploy the image to a host or Kubernetes cluster; it only builds and publishes the image.

Choose an unused release version explicitly and use the same value in both commands; `v0.1.60` is an example next tag:

```bash
RELEASE_TAG=v0.1.60
git tag "${RELEASE_TAG}"
git push origin "${RELEASE_TAG}"
```

## Rollback

For Docker, recreate the container with a known immutable version tag. For Kubernetes:

```bash
kubectl rollout history deployment/spooled-dashboard -n spooled-dashboard
kubectl rollout undo deployment/spooled-dashboard -n spooled-dashboard
```

If the overlay changed the Deployment name or namespace, use the rendered name shown by `kubectl get deployments -A`.

## Troubleshooting

```bash
# Container logs
docker logs spooled-dashboard

# Runtime configuration (contains public values only)
curl --fail http://localhost:4321/api/config

# Kubernetes status
kubectl get pods -n spooled-dashboard
kubectl describe deployment spooled-dashboard -n spooled-dashboard
```

If the UI cannot reach the API, verify the browser-visible value from `/api/config`, backend CORS settings, HTTPS/WSS origin compatibility, and network access from the user's browser. Kubernetes-internal service names are not reachable from an external browser.
