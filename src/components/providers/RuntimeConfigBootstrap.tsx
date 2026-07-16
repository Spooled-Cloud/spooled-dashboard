/**
 * Runtime Config Bootstrap
 *
 * Loads /api/config before children mount authenticated queries, WebSocket, or Sentry.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { loadRuntimeConfig, getRuntimeConfigError, type RuntimeConfig } from '@/lib/config/runtime';
import { initSentry } from '@/lib/sentry';

type BootstrapState = 'loading' | 'ready' | 'error';

interface RuntimeConfigBootstrapProps {
  children: ReactNode;
  /** Optional: show a compact inline status instead of full-page gate */
  compact?: boolean;
}

export function RuntimeConfigBootstrap({ children, compact = false }: RuntimeConfigBootstrapProps) {
  const isTest = import.meta.env.MODE === 'test';
  const [state, setState] = useState<BootstrapState>(isTest ? 'ready' : 'loading');
  const [config, setConfig] = useState<RuntimeConfig | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const loaded = await loadRuntimeConfig();
        if (cancelled) return;
        setConfig(loaded);
        if (!isTest) {
          await initSentry(loaded);
        }
        if (cancelled) return;
        setState('ready');
      } catch {
        if (cancelled) return;
        const err = getRuntimeConfigError();
        setConfig(null);
        setState(err && !isTest ? 'error' : 'ready');
        if (!err && !isTest) {
          await initSentry();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isTest]);

  if (state === 'loading') {
    if (compact) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" aria-hidden />
          Loading configuration…
        </div>
      );
    }

    return (
      <div
        className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center"
        role="status"
        aria-live="polite"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-foreground">Loading runtime configuration</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Connecting to the dashboard configuration endpoint before contacting the API.
        </p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-semibold text-destructive">Configuration unavailable</p>
        <p className="max-w-md text-xs text-muted-foreground">
          Could not load <code className="font-mono">/api/config</code>. The dashboard is blocked so
          it does not contact the wrong API. Check network connectivity and reload.
        </p>
        <button
          type="button"
          className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {config?.commit && config.commit !== 'unknown' ? (
        <span
          className="sr-only"
          data-build-commit={config.commit}
          data-build-version={config.version}
        >
          Build {config.version} ({config.commit.slice(0, 7)})
        </span>
      ) : null}
      {children}
    </>
  );
}
