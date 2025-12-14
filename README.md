# Spooled Dashboard

A modern, real-time dashboard for managing job queues, workflows, and workers in the Spooled Cloud system.

![License](https://img.shields.io/badge/license-Apache--2.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![Astro](https://img.shields.io/badge/Astro-4.16-purple)
![React](https://img.shields.io/badge/React-18.3-blue)

## Features

- **📊 Real-time Dashboard** - Live KPIs, job statistics, and system health
- **📋 Jobs Management** - Create, monitor, retry, cancel jobs; set priority levels
- **📦 Queue Management** - Configure queues, pause/resume, view stats, set rate limits
- **👷 Worker Monitoring** - Track worker status, performance, and job distribution
- **🔄 Workflows** - Create DAG workflows with job dependencies (visual dependency graph)
- **📅 Schedules** - Cron-based recurring jobs with timezone support (daily reports, cleanups, renewals)
- **🔑 API Keys** - Manage programmatic access with queue restrictions and rate limits
- **🔔 Outgoing Webhooks** - Configure HTTP notifications from Spooled to your URLs (Slack, Discord, custom endpoints)
- **🌐 WebSocket** - Live updates across the dashboard (job status, queue stats, worker activity)
- **📈 Usage Tracking** - Monitor plan limits, API usage, and resource consumption
- **💀 Dead-Letter Queue** - Review failed jobs, inspect errors, bulk retry or purge
- **👤 Admin Portal** - Create organizations, manage plans, reset usage counters

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

- Node.js 20+
- npm or yarn
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

Create a `.env` file:

```env
# Backend API URL
PUBLIC_API_URL=http://localhost:8080

# WebSocket URL
PUBLIC_WS_URL=ws://localhost:8080
```

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
│   ├── auth/            # Authentication (Login, AuthGuard)
│   ├── dashboard/       # Dashboard views
│   ├── jobs/            # Jobs management
│   ├── queues/          # Queues management
│   ├── workers/         # Workers management
│   ├── workflows/       # Workflows management
│   ├── schedules/       # Schedules management
│   ├── settings/        # Settings pages
│   ├── realtime/        # WebSocket components
│   ├── layout/          # Layout components
│   ├── providers/       # Context providers
│   └── ui/              # Reusable UI components
├── layouts/             # Astro layouts
├── lib/                 # Utilities and APIs
│   ├── api/             # API client modules
│   ├── constants/       # Constants and config
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

# Run the container
docker run -p 4321:4321 \
  -e PUBLIC_API_URL=https://api.spooled.cloud \
  -e PUBLIC_WS_URL=wss://api.spooled.cloud \
  spooled-dashboard
```

### Using Docker Compose

```bash
# Production
docker-compose up -d dashboard

# Development (with hot reload)
docker-compose --profile dev up dashboard-dev
```

### Pull from GitHub Container Registry

```bash
docker pull ghcr.io/spooled-cloud/spooled-dashboard:latest
```

## Pages Overview

| Route | Description |
|-------|-------------|
| `/` | Login page |
| `/onboarding` | New organization registration |
| `/dashboard` | Main dashboard with KPIs |
| `/jobs` | Jobs list and management |
| `/jobs/[id]` | Job details |
| `/jobs/dlq` | Dead-letter queue |
| `/queues` | Queues list and management |
| `/queues/[name]` | Queue details |
| `/workers` | Workers list |
| `/workers/[id]` | Worker details |
| `/workflows` | Workflows list |
| `/workflows/[id]` | Workflow details with dependency graph |
| `/schedules` | Schedules list |
| `/schedules/[id]` | Schedule details |
| `/settings` | Settings navigation |
| `/settings/profile` | User profile |
| `/settings/organization` | Organization settings (with usage) |
| `/settings/api-keys` | API keys management |
| `/settings/webhooks` | Webhooks configuration |

### Admin Routes (requires admin key)

| Route | Description |
|-------|-------------|
| `/admin/login` | Admin key login |
| `/admin` | Admin dashboard with platform stats |
| `/admin/organizations` | List all organizations |
| `/admin/organizations/[id]` | Organization details, API keys, usage reset |
| `/admin/plans` | View all plan tiers with limits |

## Authentication

The dashboard uses API key-based authentication:

1. Create organization via onboarding at `/onboarding` (or with admin key)
2. Login with API key at `/` to exchange for JWT tokens
3. Access token stored in memory (Zustand)
4. Refresh token handles automatic token renewal
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

Current coverage: **84%** (419 tests)

## Documentation

- [Getting Started](docs/GETTING_STARTED.md)
- [API Integration](docs/API_INTEGRATION.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Security](docs/SECURITY.md)
- [Architecture](ARCHITECTURE.md)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint && npm run type-check && npm run test`
5. Submit a pull request

## License

Apache-2.0 - see [LICENSE](LICENSE) for details.
