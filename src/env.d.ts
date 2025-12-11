// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  // API Configuration
  readonly PUBLIC_API_URL: string;
  readonly PUBLIC_WS_URL: string;

  // Feature Flags
  readonly PUBLIC_ENABLE_WORKFLOWS?: string;
  readonly PUBLIC_ENABLE_SCHEDULES?: string;

  // Error Tracking (Sentry)
  readonly PUBLIC_SENTRY_DSN?: string;
  readonly PUBLIC_SENTRY_ENVIRONMENT?: string;
  readonly PUBLIC_SENTRY_RELEASE?: string;

  // Analytics
  readonly PUBLIC_ENABLE_ANALYTICS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
