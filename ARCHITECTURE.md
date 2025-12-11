# Architecture

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Astro 4.x (hybrid rendering) |
| UI | React 18.x |
| Language | TypeScript 5.x |
| Styling | Tailwind CSS, Shadcn/ui |
| Server State | TanStack Query |
| Client State | Zustand |
| Forms | React Hook Form + Zod |
| Real-time | WebSocket |

## Project Structure

```
src/
├── components/     # React components
│   ├── ui/         # Base UI (Button, Card, etc.)
│   ├── layout/     # Sidebar, Header
│   ├── dashboard/  # Dashboard views
│   ├── jobs/       # Job management
│   ├── queues/     # Queue management
│   ├── workers/    # Worker monitoring
│   ├── schedules/  # Schedule management
│   ├── workflows/  # Workflow visualization
│   ├── settings/   # Settings pages
│   └── realtime/   # WebSocket components
├── layouts/        # Astro layouts
├── pages/          # File-based routing
├── lib/
│   ├── api/        # API client & modules
│   ├── websocket/  # WebSocket client
│   ├── types/      # TypeScript types
│   ├── utils/      # Utilities
│   └── constants/  # Constants
├── stores/         # Zustand stores
└── styles/         # Global CSS
```

## Data Flow

### API Requests

```
Component → React Query → API Module → API Client → Backend
                                           ↓
                                    (Auto auth headers)
                                    (Token refresh on 401)
                                    (Retry on failure)
```

### Real-time Updates

```
WebSocket → Event Handler → Query Invalidation → Component Re-render
```

## Authentication

- JWT-based with automatic refresh
- Access token in memory only
- Refresh token in persistent store
- Auto-logout on refresh failure

## Security

- All requests include auth headers
- Organization context via headers
- Input validation with Zod
- HTTPS required in production

## Performance

- Astro islands (partial hydration)
- Query caching (5min default)
- Code splitting
- Tree-shaking
