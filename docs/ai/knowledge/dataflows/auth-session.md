# Auth session

1. Login: API key → `POST /api/v1/auth/login` or email OTP (`LoginPage`, `src/lib/api`).
2. Zustand persist: access token in localStorage; refresh token memory-only (`src/stores/auth.ts`).
3. `AuthGuard` hydrate/refresh; admin separate `/admin/login` with `X-Admin-Key` (`src/lib/api/admin.ts`).
4. HTTP client attaches Bearer + `X-Organization-ID` (`src/lib/api/client.ts`).
