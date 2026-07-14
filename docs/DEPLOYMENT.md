# Deployment Guide

This guide covers the deployment paths that are maintained in this repository.

## Requirements

- Node.js `20.19.0` or newer when building outside Docker
- Docker with Compose v2 for container deployment
- `kubectl` for Kubernetes deployment
- `kustomize` only when using `kustomize edit`; `kubectl apply -k` has built-in Kustomize support

The dashboard is an Astro application served by the Node adapter (`output: 'server'`). The browser loads runtime configuration via `loadRuntimeConfig()` before authenticated API calls, WebSocket connections, and Sentry initialization (`RuntimeConfigBootstrap`). `GET /api/config` returns public API/WS URLs, feature flags, and build identity (`version`, `commit`). Changing container `PUBLIC_*` variables reconfigures the browser after the next config fetch (short private cache). Do not place secrets in `PUBLIC_*` variables.

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

These values are returned by `/api/config` and are not secrets. `PUBLIC_SENTRY_DSN` is intentionally public, but server credentials, API keys, and admin keys must never be placed in `PUBLIC_*` variables. The browser bootstrap loads this endpoint before using API/WebSocket URLs.

`/api/config` uses `Cache-Control: private, max-age=60, must-revalidate` so deployment overrides are not stuck behind a long CDN cache. The response also includes non-secret build identity: `version`, `commit`, and `environment`.

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

#### Current production host layout (2026-07-14)

On the production host the stack is managed from a durable path (not `/tmp`):

- Directory: `/opt/spooled/dashboard`
- Compose file: `docker-compose.prod.yml`
- Image pin: `.env.image` with immutable digest `ghcr.io/spooled-cloud/spooled-dashboard:v0.1.62@sha256:5659074a8cb78b03da2505b090d03e4d0fe4bc1c6753bd34b6e8d95039ec19b6`
- Secrets: `.env` mode `600` (includes tunnel token). Never commit or paste this file.
- Recreate: `cd /opt/spooled/dashboard && sudo docker compose -p spooled-dashboard --env-file .env -f docker-compose.prod.yml up -d`
- Health probe: explicit IPv4 `127.0.0.1:4321/api/config` (container must report `healthy`)

Portainer Agent is present on the host; if a Portainer UI stack entry exists, point it at this directory / image digest so the UI matches the live containers. Do not redeploy from an ephemeral `/tmp` path.

## Docker without Compose

```bash
docker build -t spooled-dashboard:latest .

# Runtime PUBLIC_* values are served by GET /api/config and loaded by
# RuntimeConfigBootstrap on every page. Rebuild is still required for client
# bundle changes; env alone updates API/WS URLs and feature flags.
docker run -d \
  --name spooled-dashboard \
  -p 4321:4321 \
  -e PUBLIC_API_URL=https://api.spooled.cloud \
  -e PUBLIC_WS_URL=wss://api.spooled.cloud \
  spooled-dashboard:latest
```

Published images are available from GitHub Container Registry:

```bash
docker pull ghcr.io/spooled-cloud/spooled-dashboard:latest
```

`main` publishes `latest` and a commit-SHA tag. A pushed `v*` Git tag publishes that version tag and refreshes `latest` only after the repository checks and production build pass. The tag workflow also requires the tag without its `v` prefix to match `package.json`, top-level `package-lock.json.version`, and `package-lock.json.packages[""].version`.

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

The Dockerfile and Compose health checks probe `http://127.0.0.1:4321/api/config` with Node's HTTP client (explicit IPv4). Do not use `localhost` — Alpine `wget` may resolve it to IPv6 `::1` while the server binds IPv4 `0.0.0.0`, which falsely marks a healthy container unhealthy. Kubernetes liveness/readiness probes use path `/api/config`.

## CI and releases

`.github/workflows/ci.yml` currently performs:

1. format check, ESLint, Astro type checking, and Vitest
2. a tag-only consistency check across all release version fields
3. production build and `dist/` artifact upload
4. a non-blocking Trivy filesystem scan (`exit-code: 0`)
5. multi-architecture GHCR publishing on `main`
6. versioned GHCR publishing for `v*` tags only after checks and the build pass

Main-branch publishing remains independent of the tag-only version assertion. A tag does not deploy the image to a host or Kubernetes cluster; it only builds and publishes the image.

### Release and deployment evidence checklist

This checklist is advisory evidence tracking. Items may be marked `N/A`, or an exception may be recorded with an owner and rationale; completing it is not release or deployment authorization. A mismatch among values that identify the **same artifact** is not an advisory exception: it is a release error and must be corrected before image publication.

#### Select and synchronize the release

- [ ] Record `RELEASE_VERSION`, `RELEASE_TAG=v${RELEASE_VERSION}`, the intended branch, and release commit; confirm the tag is unused and the tree is clean and synced.
- [ ] Set `package.json.version` to `RELEASE_VERSION`.
- [ ] Regenerate `package-lock.json` and confirm both root metadata fields match: top-level `version` and `packages[""].version`.
- [ ] Search documentation, deployment examples, and release labels for stale versions.
- [ ] Confirm `RELEASE_TAG` without `v` and all three manifest/lock values are identical. CI enforces this on tag pushes.

#### Validate and publish

- [ ] Run `npm run format:check`, `npm run lint`, `npm run type-check`, `npm run test`, and `npm run build`; record the local commands and CI run.
- [ ] Confirm no secrets, populated `.env` files, or generated local artifacts are staged.
- [ ] Create the tag on the validated commit and confirm `git rev-parse "${RELEASE_TAG}^{}"` resolves to that commit.
- [ ] Record the successful release workflow and the immutable multi-architecture GHCR digest for `ghcr.io/spooled-cloud/spooled-dashboard:${RELEASE_TAG}`.
- [ ] Confirm tag, source commit, image tag, and image digest identify the same artifact. Do not use `latest` as release identity.

Example preparation for the next release (`v0.1.60` is illustrative; select an unused value):

```bash
npm version 0.1.60 --no-git-tag-version
npm run format:check
npm run lint
npm run type-check
npm run test
npm run build
git add package.json package-lock.json
git commit -m "chore(release): v0.1.60"
RELEASE_TAG=v0.1.60
git tag "${RELEASE_TAG}"
git push origin "${RELEASE_TAG}"
```

#### Deploy separately

- [ ] Record the target environment, operator/provider deployment ID, deployment time, selected immutable tag or digest, and previous rollback digest.
- [ ] Confirm the host or Kubernetes workload resolves to the recorded digest. Publishing a tag/image is not deployment proof.
- [ ] Record rollout status and deployment history from the actual target.

#### Verify live production

- [ ] Verify deployment-provider or cluster provenance connects the live workload to the intended commit and image digest.
- [ ] Check `/` and `/api/config` as application-health/configuration checks, not as version proof.
- [ ] Verify at least one release-specific live behavior or content marker in a clean browser session.
- [ ] Confirm the browser-visible API/WebSocket configuration and relevant security headers match the target environment.
- [ ] Record observation time and keep source, tag, artifact, deployment, and live-production claims separate.
- [ ] Record unresolved checks as explicit exceptions; do not describe an unproven deployment as live.

#### Close out

- [ ] Confirm rollback can select the previous immutable digest or tag.
- [ ] Update dated operational documentation only from recorded deployment and live evidence.

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
