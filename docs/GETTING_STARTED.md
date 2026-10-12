# Getting Started

## Prerequisites

- Node.js 20.19.0 or newer
- npm
- Spooled Backend running (see [spooled-backend](https://github.com/spooled-cloud/spooled-backend))

## Installation

```bash
git clone https://github.com/spooled-cloud/spooled-dashboard.git
cd spooled-dashboard
npm install
```

## Configuration

The browser gets its API and WebSocket URLs from `GET /api/config`, which reads the environment of the server process. Under `npm run dev` a `.env` file is **not** read by that endpoint, so set the variables in the shell that starts the server (without them the dashboard talks to the hosted API, `https://api.spooled.cloud`):

```bash
# Backend API URL and WebSocket URL (bash)
PUBLIC_API_URL=http://localhost:8080 PUBLIC_WS_URL=ws://localhost:8080 npm run dev
```

```powershell
# PowerShell
$env:PUBLIC_API_URL='http://localhost:8080'; $env:PUBLIC_WS_URL='ws://localhost:8080'; npm run dev
```

Docker Compose does read `.env` (`cp .env.example .env`) and passes the values into the container.

For the admin portal to work, ensure the backend has `ADMIN_API_KEY` configured. The dashboard itself does not need this key as an environment variable; an authorized operator enters it on `/admin/login`.

## Development

```bash
npm run dev
```

Open http://localhost:4321

## First Time Setup

1. **Create Organization**: Navigate to `/onboarding` and create your organization
2. **Save API Key**: The initial API key is shown only once - save it!
3. **Login**: Use the API key at `/` to login
4. **Explore**: Access jobs, queues, workers, and settings from the dashboard

## Admin Portal

If you have access to the `ADMIN_API_KEY`:

1. Navigate to `/admin/login`
2. Enter the admin key
3. Manage all organizations, view platform stats, change plans

## Available Scripts

| Script               | Description              |
| -------------------- | ------------------------ |
| `npm run dev`        | Start development server |
| `npm run build`      | Build for production     |
| `npm run preview`    | Preview production build |
| `npm run test`       | Run tests                |
| `npm run lint`       | Lint code                |
| `npm run format`     | Format code              |
| `npm run type-check` | TypeScript type checking |

## Project Structure

```
src/
├── components/     # React components
│   ├── admin/      # Admin portal components
│   ├── auth/       # Login, onboarding
│   ├── dashboard/  # Dashboard views
│   ├── jobs/       # Jobs management
│   ├── queues/     # Queue management
│   ├── settings/   # Settings pages
│   ├── usage/      # Usage tracking widgets
│   └── ui/         # Reusable UI components
├── layouts/        # Astro layouts
├── pages/          # Routes (file-based)
│   ├── admin/      # Admin portal pages
│   └── settings/   # Settings pages
├── lib/            # API client, utilities
│   └── api/        # API clients (admin, usage, etc.)
├── stores/         # Zustand state
└── styles/         # Global CSS
```

## Next Steps

- [API Integration](./API_INTEGRATION.md)
- [Deployment](./DEPLOYMENT.md)
- [Security](./SECURITY.md)

## Official SDKs

For programmatic access to Spooled from your applications, use one of the official SDKs:

- **Node.js**: `npm install @spooled/sdk`
- **Python**: `pip install spooled`
- **Go**: `go get github.com/spooled-cloud/spooled-sdk-go`
- **PHP**: `composer require spooled-cloud/spooled`

SDK capabilities differ by language and release. Use the linked SDK documentation and each package's release notes for the current client, worker, and transport support.

See the [SDKs documentation](https://github.com/spooled-cloud/spooled-backend/blob/main/docs/guides/sdks.md) for detailed guides.
