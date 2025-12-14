# Deployment Guide

This guide covers deploying the Spooled Dashboard to production.

## Prerequisites

- Node.js 20+
- Docker (for container deployment)
- kubectl (for Kubernetes deployment)
- Access to a container registry (GitHub Container Registry, Docker Hub, etc.)

## Deployment Options

### Option 1: Docker Compose (Simplest)

Best for single-server deployments.

```bash
# Clone the repository
git clone https://github.com/spooled-cloud/spooled-dashboard.git
cd spooled-dashboard

# Create environment file
cp .env.example .env
# Edit .env with your production values

# Build and run
docker-compose up -d
```

### Option 2: Docker (Manual)

```bash
# Build the image
docker build \
  --build-arg PUBLIC_API_URL=https://api.spooled.cloud \
  --build-arg PUBLIC_WS_URL=wss://api.spooled.cloud \
  -t spooled-dashboard:latest .

# Run the container
docker run -d \
  --name spooled-dashboard \
  -p 4321:4321 \
  -e NODE_ENV=production \
  spooled-dashboard:latest
```

### Option 3: Kubernetes (Production)

Best for scalable, production deployments.

#### Using Kustomize

```bash
# Development environment
kubectl apply -k k8s/overlays/development

# Production environment
kubectl apply -k k8s/overlays/production
```

#### With Custom Image Tag

```bash
# Deploy specific version
cd k8s/overlays/production
kustomize edit set image ghcr.io/spooled-cloud/spooled-dashboard:v1.2.3
kubectl apply -k .
```

#### With Secrets

```bash
# Create secrets from template
cp k8s/base/secrets.yaml.template k8s/base/secrets.yaml
# Edit secrets.yaml with actual values

# Apply with secrets
kubectl apply -f k8s/base/secrets.yaml
kubectl apply -k k8s/overlays/production
```

### Option 4: Node.js Direct

For deployments without containers:

```bash
# Install dependencies
npm ci

# Build for production
npm run build

# Start the server
NODE_ENV=production node ./dist/server/entry.mjs
```

## Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PUBLIC_API_URL` | Backend API URL | `https://api.spooled.cloud` |
| `PUBLIC_WS_URL` | WebSocket URL | `wss://api.spooled.cloud` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PUBLIC_SENTRY_DSN` | Sentry error tracking | (disabled) |
| `PUBLIC_SENTRY_ENVIRONMENT` | Sentry environment | `development` |
| `PUBLIC_ENABLE_WORKFLOWS` | Enable workflows | `true` |
| `PUBLIC_ENABLE_SCHEDULES` | Enable schedules | `true` |
| `HOST` | Server bind address | `0.0.0.0` |
| `PORT` | Server port | `4321` |

## Reverse Proxy Configuration

### Nginx

```nginx
upstream dashboard {
    server 127.0.0.1:4321;
}

server {
    listen 443 ssl http2;
    server_name dashboard.spooled.cloud;
    
    ssl_certificate /etc/ssl/certs/dashboard.crt;
    ssl_certificate_key /etc/ssl/private/dashboard.key;
    
    # Security headers (see SECURITY.md)
    include /etc/nginx/security-headers.conf;
    
    location / {
        proxy_pass http://dashboard;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Caddy

```caddyfile
dashboard.spooled.cloud {
    reverse_proxy localhost:4321
    
    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

## Health Checks

The dashboard exposes health endpoints:

- `GET /` - Basic health check (returns HTML)
- Container health check: `wget -qO- http://localhost:4321/`

## Monitoring

### Metrics

Consider adding:
- Prometheus metrics exporter
- Custom application metrics

### Logging

Logs are written to stdout/stderr. Use a log aggregator like:
- Loki
- Elasticsearch
- CloudWatch Logs

### Error Tracking

Configure Sentry for production error tracking:

1. Create a Sentry project at https://sentry.io
2. Get the DSN from Project Settings → Client Keys
3. Set `PUBLIC_SENTRY_DSN` environment variable

## Scaling

### Horizontal Scaling

The Kubernetes manifests include HPA configuration:

- Min replicas: 3 (production)
- Max replicas: 20
- Scale on CPU > 70%
- Scale on Memory > 80%

### Resource Recommendations

| Environment | CPU Request | CPU Limit | Memory Request | Memory Limit |
|-------------|-------------|-----------|----------------|--------------|
| Development | 50m | 200m | 64Mi | 256Mi |
| Production | 200m | 1000m | 256Mi | 1Gi |

## CI/CD Integration

### GitHub Actions

The included CI workflow:

1. **Lint & Format** - ESLint, Prettier
2. **Test** - Vitest with coverage
3. **Build** - Production build
4. **Security Scan** - Trivy vulnerability scanner
5. **Docker Build** - Build and push to GHCR
6. **Release** - Tag-based releases

### Manual Deployment

```bash
# Tag a release
git tag v1.0.0
git push origin v1.0.0

# The CI will automatically build and push the tagged image
```

## Troubleshooting

### Common Issues

**Container won't start:**
- Check logs: `docker logs spooled-dashboard`
- Verify environment variables are set
- Ensure port 4321 is available

**Can't connect to API:**
- Verify `PUBLIC_API_URL` is correct
- Check network connectivity
- Ensure backend is running

**WebSocket disconnecting:**
- Verify `PUBLIC_WS_URL` is correct
- Check reverse proxy WebSocket configuration
- Look for firewall blocking WebSocket connections

### Debug Mode

Run with debug logging:

```bash
docker run -e DEBUG=* spooled-dashboard:latest
```

## Rollback

### Docker

```bash
# Pull previous version
docker pull ghcr.io/spooled-cloud/spooled-dashboard:v1.0.0

# Stop current
docker stop spooled-dashboard

# Start previous
docker run -d --name spooled-dashboard ghcr.io/spooled-cloud/spooled-dashboard:v1.0.0
```

### Kubernetes

```bash
# View rollout history
kubectl rollout history deployment/spooled-dashboard

# Rollback to previous
kubectl rollout undo deployment/spooled-dashboard

# Rollback to specific revision
kubectl rollout undo deployment/spooled-dashboard --to-revision=2
```
