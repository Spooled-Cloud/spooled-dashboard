# Security Configuration

This document outlines security best practices and configurations for deploying the Spooled Dashboard in production.

## Security Headers

Configure these security headers in your reverse proxy (Nginx, Caddy, Cloudflare, etc.):

### Required Headers

```nginx
# Nginx configuration example
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

### Content Security Policy (CSP)

```nginx
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://browser.sentry-cdn.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self' https://api.spooled.cloud wss://api.spooled.cloud https://*.sentry.io;
  frame-ancestors 'self';
  base-uri 'self';
  form-action 'self';
" always;
```

### HTTPS Configuration

Always use HTTPS in production:

```nginx
# Force HTTPS redirect
server {
    listen 80;
    server_name dashboard.spooled.cloud;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name dashboard.spooled.cloud;
    
    # TLS configuration
    ssl_certificate /etc/ssl/certs/dashboard.crt;
    ssl_certificate_key /etc/ssl/private/dashboard.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    # HSTS (6 months)
    add_header Strict-Transport-Security "max-age=15768000; includeSubDomains" always;
}
```

## Authentication Security

### JWT Token Handling

- Access tokens are stored in memory (Zustand store), not localStorage
- Tokens are never logged or exposed in URLs
- Token refresh happens automatically before expiration
- Logout clears all tokens from memory

### API Security

- All API requests include authentication headers
- 401 responses trigger automatic token refresh
- Failed refresh triggers logout and redirect to login

## Kubernetes Security

The provided Kubernetes manifests include:

### Pod Security

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL
```

### Network Policies

Consider adding network policies to restrict traffic:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: spooled-dashboard
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: spooled-dashboard
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - port: 4321
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: spooled-backend
      ports:
        - port: 3000
    - to:  # Allow DNS
        - namespaceSelector: {}
      ports:
        - port: 53
          protocol: UDP
```

## Secrets Management

### Best Practices

1. **Never commit secrets** to version control
2. Use Kubernetes Secrets or external secrets management:
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault
   - Google Secret Manager

3. **Rotate secrets regularly**:
   - API keys: every 90 days
   - Sentry DSN: when compromised

### Environment Variables

Sensitive variables that should be in secrets:

| Variable | Description |
|----------|-------------|
| `PUBLIC_SENTRY_DSN` | Sentry error tracking DSN |

## Error Tracking Security (Sentry)

When using Sentry:

1. **Data scrubbing** is enabled by default
2. **Session replay** masks all text and blocks media
3. **PII filtering** should be configured in Sentry dashboard
4. Consider setting up **inbound data filters**

## Vulnerability Scanning

The CI pipeline includes Trivy security scanning:

```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
    severity: 'CRITICAL,HIGH'
```

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** open a public issue
2. Email security@spooled.cloud with details
3. Allow 90 days for a fix before public disclosure
