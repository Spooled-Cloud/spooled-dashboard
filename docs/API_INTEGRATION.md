# API Integration

## Configuration

Set the API URL in `.env`:

```env
PUBLIC_API_URL=https://api.spooled.cloud
PUBLIC_WS_URL=wss://api.spooled.cloud
```

## API Client

```typescript
import { apiClient } from '@/lib/api/client';

// GET request
const data = await apiClient.get('/api/v1/jobs');

// POST request
const result = await apiClient.post('/api/v1/jobs', { queue_name: 'emails', payload: {...} });

// With query params
const jobs = await apiClient.get('/api/v1/jobs', { status: 'pending' });
```

## API Modules

```typescript
import { jobsAPI } from '@/lib/api/jobs';
import { queuesAPI } from '@/lib/api/queues';
import { workersAPI } from '@/lib/api/workers';

// Jobs
await jobsAPI.list({ status: 'failed' });
await jobsAPI.get('job_123');
await jobsAPI.retry('job_123');

// Queues
await queuesAPI.list();
await queuesAPI.pause('email');

// Workers
await workersAPI.list();
```

## React Query Hooks

```typescript
import { useQuery } from '@tanstack/react-query';
import { jobsAPI } from '@/lib/api/jobs';

function JobsList() {
  const { data, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsAPI.list(),
  });

  if (isLoading) return <Skeleton />;
  return <div>{data?.data.map(job => ...)}</div>;
}
```

## Authentication

JWT authentication is automatic:

1. Login stores tokens in Zustand
2. API client injects token in headers
3. 401 responses trigger token refresh
4. Failed refresh redirects to login

```typescript
import { useAuthStore } from '@/stores/auth';

const { login, logout, isAuthenticated } = useAuthStore();
```

## Error Handling

```typescript
import { APIError } from '@/lib/api/client';

try {
  await jobsAPI.create(data);
} catch (error) {
  if (error instanceof APIError) {
    if (error.isUnauthorized()) { /* 401 */ }
    if (error.isNotFound()) { /* 404 */ }
    if (error.isValidationError()) { /* 422 */ }
  }
}
```

## Toast Notifications

```typescript
import { toast } from 'sonner';

toast.success('Job created');
toast.error('Failed to create job');
```

## Official SDKs

For programmatic access from your backend applications, use one of the official SDKs instead of the dashboard's internal API client:

| SDK | Installation | Docs |
|-----|--------------|------|
| **Node.js** | `npm install @spooled/sdk` | [npm](https://www.npmjs.com/package/@spooled/sdk) |
| **Python** | `pip install spooled` | [PyPI](https://pypi.org/project/spooled/) |
| **Go** | `go get github.com/spooled-cloud/spooled-sdk-go` | [pkg.go.dev](https://pkg.go.dev/github.com/spooled-cloud/spooled-sdk-go) |
| **PHP** | `composer require spooled-cloud/spooled` | [Packagist](https://packagist.org/packages/spooled-cloud/spooled) |

The dashboard's internal API client (`@/lib/api/*`) is designed specifically for the dashboard UI and includes React Query integration, auth state management, and UI-specific error handling.
