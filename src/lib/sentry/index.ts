/**
 * Sentry Error Tracking Integration
 *
 * This module provides optional Sentry integration for error tracking.
 * Set PUBLIC_SENTRY_DSN in your environment to enable.
 */

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

// Store for Sentry instance (loaded dynamically)
let sentryInstance: typeof import('@sentry/browser') | null = null;

/**
 * Check if Sentry is enabled (DSN is configured)
 */
export function isSentryEnabled(): boolean {
  return Boolean(import.meta.env.PUBLIC_SENTRY_DSN);
}

/**
 * Initialize Sentry error tracking
 * Call this once at app startup (e.g., in the root layout)
 */
export async function initSentry(): Promise<void> {
  const dsn = import.meta.env.PUBLIC_SENTRY_DSN;

  if (!dsn) {
    // Sentry disabled - no DSN configured (this is normal in development)
    return;
  }

  try {
    // Dynamically import Sentry to avoid bundling if not used
    const Sentry = await import('@sentry/browser');
    sentryInstance = Sentry;

    const config: SentryConfig = {
      dsn,
      environment: import.meta.env.PUBLIC_SENTRY_ENVIRONMENT || 'development',
      release: import.meta.env.PUBLIC_SENTRY_RELEASE,
      tracesSampleRate: 0.1, // Capture 10% of transactions for performance monitoring
      replaysSessionSampleRate: 0.1, // Capture 10% of sessions for replay
      replaysOnErrorSampleRate: 1.0, // Capture 100% of sessions with errors
    };

    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      release: config.release,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      tracesSampleRate: config.tracesSampleRate,
      replaysSessionSampleRate: config.replaysSessionSampleRate,
      replaysOnErrorSampleRate: config.replaysOnErrorSampleRate,
      beforeSend(event) {
        // Filter out certain errors if needed
        // Example: ignore ResizeObserver errors
        if (event.exception?.values?.[0]?.type === 'ResizeObserver loop limit exceeded') {
          return null;
        }
        return event;
      },
    });

    // Make Sentry available globally for ErrorBoundary
    (window as Window).Sentry = Sentry;
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error);
  }
}

/**
 * Set the current user context for error tracking
 */
export function setSentryUser(user: SentryUser | null): void {
  if (!sentryInstance) return;

  if (user) {
    sentryInstance.setUser(user);
  } else {
    sentryInstance.setUser(null);
  }
}

/**
 * Set additional context for error tracking
 */
export function setSentryContext(name: string, context: SentryContext): void {
  if (!sentryInstance) return;
  sentryInstance.setContext(name, context);
}

/**
 * Add a breadcrumb to track user actions
 */
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
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Capture an exception manually
 */
export function captureException(
  error: Error,
  context?: Record<string, unknown>
): string | undefined {
  if (!sentryInstance) {
    console.error('[Error]', error, context);
    return undefined;
  }
  return sentryInstance.captureException(error, { extra: context });
}

/**
 * Capture a message manually
 */
export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info'
): string | undefined {
  if (!sentryInstance) {
    // When Sentry is not available, still log errors/warnings to console
    if (level === 'error') {
      console.error(`[${level.toUpperCase()}]`, message);
    } else if (level === 'warning') {
      console.warn(`[${level.toUpperCase()}]`, message);
    }
    return undefined;
  }
  return sentryInstance.captureMessage(message, level);
}

/**
 * Set a tag for all subsequent events
 */
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
