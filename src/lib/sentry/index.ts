/**
 * Sentry Error Tracking Integration
 *
 * Optional Sentry integration. Prefer runtime config DSN over build-time env.
 * Never send tokens, API keys, or Authorization headers to Sentry.
 */

import type { RuntimeConfig } from '@/lib/config/runtime';

interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate?: number;
  replaysSessionSampleRate?: number;
  replaysOnErrorSampleRate?: number;
}

interface SentryUser {
  id?: string;
  email?: string;
  username?: string;
}

interface SentryContext {
  [key: string]: unknown;
}

let sentryInstance: typeof import('@sentry/browser') | null = null;
let initialized = false;

const SENSITIVE_KEY = /token|authorization|api[_-]?key|password|secret|cookie|admin/i;

function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('eyJ') || value.startsWith('sp_live_') || value.startsWith('sp_test_')) {
      return '[redacted]';
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(scrubValue);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : scrubValue(v);
    }
    return out;
  }
  return value;
}

/**
 * Check if Sentry is enabled (DSN is configured)
 */
export function isSentryEnabled(config?: RuntimeConfig | null): boolean {
  if (config?.sentryDsn) return Boolean(config.sentryDsn);
  return Boolean(import.meta.env.PUBLIC_SENTRY_DSN);
}

/**
 * Initialize Sentry error tracking after runtime config is available.
 */
export async function initSentry(config?: RuntimeConfig | null): Promise<void> {
  if (initialized) return;

  const dsn = config?.sentryDsn || import.meta.env.PUBLIC_SENTRY_DSN;

  if (!dsn) {
    return;
  }

  try {
    const Sentry = await import('@sentry/browser');
    sentryInstance = Sentry;

    const sentryConfig: SentryConfig = {
      dsn,
      environment:
        config?.sentryEnvironment || import.meta.env.PUBLIC_SENTRY_ENVIRONMENT || 'development',
      release:
        config?.sentryRelease ||
        import.meta.env.PUBLIC_SENTRY_RELEASE ||
        (config?.version && config?.commit
          ? `${config.version}+${config.commit.slice(0, 12)}`
          : undefined),
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.1,
    };

    Sentry.init({
      dsn: sentryConfig.dsn,
      environment: sentryConfig.environment,
      release: sentryConfig.release,
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate: sentryConfig.tracesSampleRate,
      beforeSend(event) {
        if (event.exception?.values?.[0]?.type === 'ResizeObserver loop limit exceeded') {
          return null;
        }
        if (event.request?.headers) {
          event.request.headers = scrubValue(event.request.headers) as Record<string, string>;
        }
        if (event.extra) {
          event.extra = scrubValue(event.extra) as Record<string, unknown>;
        }
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map((b) => ({
            ...b,
            data: b.data ? (scrubValue(b.data) as Record<string, unknown>) : b.data,
          }));
        }
        return event;
      },
    });

    initialized = true;
    (window as Window).Sentry = Sentry;
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error);
  }
}

export function setSentryUser(user: SentryUser | null): void {
  if (!sentryInstance) return;

  if (user) {
    sentryInstance.setUser(user);
  } else {
    sentryInstance.setUser(null);
  }
}

export function setSentryContext(name: string, context: SentryContext): void {
  if (!sentryInstance) return;
  sentryInstance.setContext(name, scrubValue(context) as SentryContext);
}

export function addSentryBreadcrumb(
  message: string,
  category: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, unknown>
): void {
  if (!sentryInstance) return;
  sentryInstance.addBreadcrumb({
    message,
    category,
    level,
    data: data ? (scrubValue(data) as Record<string, unknown>) : undefined,
    timestamp: Date.now() / 1000,
  });
}

export function captureException(
  error: Error,
  context?: Record<string, unknown>
): string | undefined {
  if (!sentryInstance) {
    console.error('[Error]', error, context);
    return undefined;
  }
  return sentryInstance.captureException(error, {
    extra: context ? (scrubValue(context) as Record<string, unknown>) : undefined,
  });
}

export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info'
): string | undefined {
  if (!sentryInstance) {
    if (level === 'error') {
      console.error(`[${level.toUpperCase()}]`, message);
    } else if (level === 'warning') {
      console.warn(`[${level.toUpperCase()}]`, message);
    }
    return undefined;
  }
  return sentryInstance.captureMessage(message, level);
}

export function setSentryTag(key: string, value: string): void {
  if (!sentryInstance) return;
  sentryInstance.setTag(key, value);
}

export default {
  init: initSentry,
  isEnabled: isSentryEnabled,
  setUser: setSentryUser,
  setContext: setSentryContext,
  addBreadcrumb: addSentryBreadcrumb,
  captureException,
  captureMessage,
  setTag: setSentryTag,
};
