# Technical Specification

**Version:** 1.0.0  
**Stack:** Astro + React + TypeScript

## Features

| Feature | Description |
|---------|-------------|
| Dashboard | KPIs, system info, recent activity |
| Jobs | List, details, create, retry, cancel |
| Queues | List, details, create, pause/resume |
| Workers | List, details, deregister |
| Schedules | List, details, create with cron |
| Workflows | List, details, dependency visualization |
| API Keys | Create, list, revoke |
| Webhooks | Create, list, test, delete |
| Settings | Organization, profile management |
| Real-time | WebSocket with auto-reconnect |

## Components

### UI Components (Shadcn/ui)
- Button, Card, Badge, Input
- Skeleton, Toast, Alert, Dialog
- Label, Select, Textarea

### Layout Components
- BaseLayout, DashboardLayout
- Sidebar, Header

### Page Components
- LoginPage, AuthGuard
- DashboardHome
- JobsListPage, JobDetailsPage
- QueuesListPage, QueueDetailsPage
- WorkersListPage, WorkerDetailsPage
- SchedulesListPage, ScheduleDetailsPage
- WorkflowsListPage, WorkflowDetailsPage
- SettingsPage, ApiKeysListPage, WebhooksListPage

## API Modules

| Module | Endpoints |
|--------|-----------|
| `dashboard.ts` | Overview stats |
| `jobs.ts` | CRUD, retry, cancel |
| `queues.ts` | CRUD, pause, resume, purge |
| `workers.ts` | List, details, deregister |
| `schedules.ts` | CRUD, trigger |
| `workflows.ts` | CRUD, cancel |
| `api-keys.ts` | Create, list, revoke |
| `webhooks.ts` | CRUD, test |
| `organizations.ts` | Get, update |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLIC_API_URL` | Yes | Backend API URL |
| `PUBLIC_WS_URL` | Yes | WebSocket URL |
| `PUBLIC_SENTRY_DSN` | No | Sentry error tracking |
| `PUBLIC_ENABLE_WORKFLOWS` | No | Feature flag |
| `PUBLIC_ENABLE_SCHEDULES` | No | Feature flag |

## Deployment

```bash
# Development
npm run dev

# Production
npm run build
node dist/server/entry.mjs

# Docker
docker compose up -d
```
