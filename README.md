# Spooled Dashboard

A modern, real-time dashboard for managing job queues, workflows, and workers in the Spooled Cloud system.

![License](https://img.shields.io/badge/license-Apache--2.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Astro](https://img.shields.io/badge/Astro-5.18-purple)
![React](https://img.shields.io/badge/React-19.2-blue)

## Features

- **Real-time Dashboard** - Live KPIs, job statistics, and system health
- **Jobs Management** - Create, monitor, retry, cancel jobs; set priority levels; search and filter by status, type, tag and date; per-job event timeline
- **Queue Management** - Create and edit queues (description, max retries, job timeout), pause/resume, delete, view stats. Per-queue rate limits, concurrency and backoff are not configurable here
- **Worker Monitoring** - Track worker status, current load, jobs processed and failed, and deregister workers
- **Workflows** - Create workflows whose jobs each depend on one earlier job, follow progress, and see the dependencies in a layered diagram
- **Schedules** - Cron-based recurring jobs with timezone support (daily reports, cleanups, renewals)
- **API Keys** - Create, rename, activate and revoke API keys, with queue restrictions and a per-key rate limit
- **Outgoing Webhooks** - Configure HTTP notifications from Spooled to your URLs (JSON, Slack, Discord, Microsoft Teams), retry failed deliveries, and read the incoming webhook log
- **Live updates** - WebSocket updates across the dashboard (job status, queue stats, worker activity) and server-sent events on job and queue detail pages
- **Usage Tracking** - Monitor plan limits, API usage, and resource consumption
- **Dead-Letter Queue** - Review dead-lettered jobs, inspect errors, bulk retry, or purge all (typed confirmation)
- **Admin Portal** - Create organizations, change an organization's plan and custom limits, reset usage counters, and view the plan tiers (needs the backend admin key)

## Official SDKs

This dashboard connects to the Spooled Backend. For programmatic access, use one of the official SDKs:

| SDK         | Package                                   | Status              |
| ----------- | ----------------------------------------- | ------------------- |
| **Node.js** | `@spooled/sdk`                            | ✅ Production Ready |
| **Python**  | `spooled`                                 | ✅ Production Ready |
| **Go**      | `github.com/spooled-cloud/spooled-sdk-go` | ✅ Production Ready |
| **PHP**     | `spooled-cloud/spooled`                   | ✅ Production Ready |

See the [SDKs documentation](https://github.com/spooled-cloud/spooled-backend/blob/main/docs/guides/sdks.md) for installation and usage guides.

## Real-world examples (beginner friendly)

For 5 copy/paste “real life” setups (Stripe → jobs, GitHub Actions → jobs, cron schedules, CSV import, website signup), see:

- `https://github.com/spooled-cloud/spooled-backend/blob/main/docs/guides/real-world-examples.md`

## Tech Stack

- **[Astro](https://astro.build/)** - Fast, content-focused framework
- **[React](https://react.dev/)** - UI components
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[Tailwind CSS](https://tailwindcss.com/)** - Styling
- **[Radix UI](https://www.radix-ui.com/)** - Accessible components
- **[TanStack Query](https://tanstack.com/query)** - Server state management
- **[Zustand](https://zustand-demo.pmnd.rs/)** - Client state management

## Quick Start

### Prerequisites

- Node.js 20.19.0 or newer
- npm (the repository uses `package-lock.json`)
- Spooled Backend running (see [spooled-backend](https://github.com/spooled-cloud/spooled-backend))

### Installation

```bash
# Clone the repository
git clone https://github.com/spooled-cloud/spooled-dashboard.git
cd spooled-dashboard

# Install dependencies
npm install

# Start development server
npm run dev
```

The dashboard will be available at `http://localhost:4321`

### Environment Variables

The browser gets its API and WebSocket URLs from `GET /api/config`, which reads the environment of the server process. Under `npm run dev` a `.env` file is **not** read by that endpoint, so set the variables in the shell that starts the server (without them the dashboard talks to the hosted API, `https://api.spooled.cloud`):

```bash
# Backend API URL and WebSocket URL (bash)
PUBLIC_API_URL=http://localhost:8080 PUBLIC_WS_URL=ws://localhost:8080 npm run dev

# PowerShell
$env:PUBLIC_API_URL='http://localhost:8080'; $env:PUBLIC_WS_URL='ws://localhost:8080'; npm run dev
```

Docker Compose does read `.env` (copy `.env.example`) and passes the values into the container. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for every variable.

## Development

```bash
# Start dev server with hot reload
npm run dev

# Type check
npm run type-check

# Lint code
npm run lint

# Format code
npm run format

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Preview production build
npm run preview

# Analyze bundle size
npm run analyze
```

## Project Structure

```
src/
├── components/           # React components
│   ├── admin/           # Admin portal
│   ├── auth/            # Authentication (Login, AuthGuard)
│   ├── dashboard/       # Dashboard views
│   ├── error/           # Error boundary
│   ├── jobs/            # Jobs management
│   ├── queues/          # Queues management
│   ├── workers/         # Workers management
│   ├── workflows/       # Workflows management
│   ├── schedules/       # Schedules management
│   ├── settings/        # Settings pages
│   ├── usage/           # Plan usage widget
│   ├── realtime/        # WebSocket components
│   ├── layout/          # Layout components
│   ├── providers/       # Context providers
│   └── ui/              # Reusable UI components
├── layouts/             # Astro layouts
├── lib/                 # Utilities and APIs
│   ├── api/             # API client modules
│   ├── config/          # Runtime configuration (/api/config bootstrap)
│   ├── constants/       # Constants and config
│   ├── hooks/           # Data and SSE hooks
│   ├── sentry/          # Optional error reporting
│   ├── types/           # TypeScript types
│   ├── utils/           # Utility functions
│   └── websocket/       # WebSocket client
├── pages/               # Astro pages (routes)
└── stores/              # Zustand stores
```

## Docker

### Build and Run

```bash
# Build the image
docker build -t spooled-dashboard .

# Run the container. PUBLIC_API_URL / PUBLIC_WS_URL (and the other PUBLIC_* values) are
# read when the container starts and served to the browser by GET /api/config, so no
# rebuild is needed. Without them the hosted API (https://api.spooled.cloud) is used.
docker run -p 4321:4321 -e PUBLIC_API_URL=http://localhost:8080 spooled-dashboard
```

### Using Docker Compose

```bash
# Production image and production Compose settings. First copy `.env.example`
# to `.env`, set `CLOUDFLARE_TUNNEL_TOKEN`, and review docs/DEPLOYMENT.md.
docker compose -f docker-compose.prod.yml up -d

# Local container build (serves the production Node build; no hot reload)
docker compose up -d --build dashboard

# For hot reload, use the Node.js development command instead:
npm run dev
```

### Pull from GitHub Container Registry

```bash
docker pull ghcr.io/spooled-cloud/spooled-dashboard:latest
```

## Pages Overview

| Route                    | Description                            |
| ------------------------ | -------------------------------------- |
| `/`                      | Login page                             |
| `/onboarding`            | New organization registration          |
| `/dashboard`             | Main dashboard with KPIs               |
| `/jobs`                  | Jobs list and management               |
| `/jobs/[id]`             | Job details                            |
| `/jobs/dlq`              | Dead-letter queue                      |
| `/queues`                | Queues list and management             |
| `/queues/[name]`         | Queue details                          |
| `/workers`               | Workers list                           |
| `/workers/[id]`          | Worker details                         |
| `/workflows`             | Workflows list                         |
| `/workflows/[id]`        | Workflow details with dependency graph |
| `/schedules`             | Schedules list                         |
| `/schedules/[id]`        | Schedule details                       |
| `/settings`              | Settings navigation                    |
| `/settings/profile`      | Session details (read-only)            |
| `/settings/organization` | Organization settings (with usage)     |
| `/settings/api-keys`     | API keys management                    |
| `/settings/billing`      | Subscription status and billing portal |
| `/settings/webhooks`     | Outgoing webhooks and incoming log     |

### Admin Routes (requires admin key)

| Route                       | Description                                 |
| --------------------------- | ------------------------------------------- |
| `/admin/login`              | Admin key login                             |
| `/admin`                    | Admin dashboard with platform stats         |
| `/admin/organizations`      | List all organizations                      |
| `/admin/organizations/[id]` | Organization details, API keys, usage reset |
| `/admin/plans`              | View all plan tiers with limits             |

## Authentication

The dashboard uses API key-based authentication:

1. Create organization via onboarding at `/onboarding` (or with admin key)
2. Login with API key at `/` to exchange for JWT tokens
3. The short-lived access token is persisted in `localStorage` by Zustand
4. The refresh token remains memory-only and can renew the access token during the current page session
5. Protected routes redirect to login if unauthenticated

### Admin Portal

The admin portal requires an `ADMIN_API_KEY` environment variable on the backend:

1. Navigate to `/admin/login`
2. Enter the admin key configured on the backend
3. Access platform-wide management features

## Real-time Updates

WebSocket connection provides live updates:

- Job status changes
- Queue statistics
- Worker heartbeats
- Workflow progress

The connection indicator shows status in the header.

## Testing

The dashboard includes comprehensive tests:

- **Unit tests** for utilities and API clients
- **Component tests** for React components
- **Integration tests** for page behavior

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# UI mode
npm run test:ui
```

Current baseline (2026-10-12): **1284 passing tests across 92 test files**. Run `npm run test:coverage` for the current coverage report rather than relying on a checked-in percentage.

## Documentation

- [Getting Started](docs/GETTING_STARTED.md)
- [API Integration](docs/API_INTEGRATION.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Security](docs/SECURITY.md)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint && npm run type-check && npm run test`
5. Submit a pull request

## License

Apache-2.0 - see [LICENSE](LICENSE) for details.
