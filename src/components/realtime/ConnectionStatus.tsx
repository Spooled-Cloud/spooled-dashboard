/**
 * WebSocket Connection Status Indicator
 */

import { useWebSocketConnection } from '@/lib/websocket';
import { cn } from '@/lib/utils/cn';

function formatSyncAge(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  if (ms < 5000) return 'just now';
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3600_000)}h ago`;
}

export function ConnectionStatus() {
  const { isConnected, state, lastEventAt, retry } = useWebSocketConnection();

  const statusConfig =
    state === 'live' || isConnected
      ? {
          label: 'Live',
          dotClass: 'bg-status-completed',
          pingClass: 'bg-status-completed/75',
          textClass: 'text-status-completed-foreground',
          showPing: true,
          showRetry: false,
        }
      : state === 'connecting' || state === 'reconnecting'
        ? {
            label: state === 'reconnecting' ? 'Reconnecting' : 'Connecting',
            dotClass: 'bg-status-retrying',
            pingClass: 'bg-status-retrying/75',
            textClass: 'text-status-retrying-foreground',
            showPing: true,
            showRetry: false,
          }
        : state === 'degraded'
          ? {
              label: 'Degraded',
              dotClass: 'bg-status-warning',
              pingClass: '',
              textClass: 'text-status-warning-foreground',
              showPing: false,
              showRetry: true,
            }
          : state === 'auth_failed'
            ? {
                label: 'Auth lost',
                dotClass: 'bg-status-failed',
                pingClass: '',
                textClass: 'text-status-failed-foreground',
                showPing: false,
                showRetry: false,
              }
            : {
                label: state === 'offline' ? 'Offline' : 'Stopped',
                dotClass: 'bg-status-offline',
                pingClass: '',
                textClass: 'text-status-offline-foreground',
                showPing: false,
                showRetry: state === 'offline' || state === 'stopped',
              };

  const syncAge = formatSyncAge(lastEventAt);

  return (
    <div
      className={cn('flex items-center gap-2 text-xs font-medium', statusConfig.textClass)}
      title={syncAge ? `Last event ${syncAge}` : undefined}
      aria-label={`Realtime ${statusConfig.label}${syncAge ? `, last event ${syncAge}` : ''}`}
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        {statusConfig.showPing ? (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 motion-reduce:animate-none',
              statusConfig.pingClass
            )}
          />
        ) : null}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', statusConfig.dotClass)} />
      </span>
      <span className="hidden sm:inline">{statusConfig.label}</span>
      {syncAge && (state === 'live' || isConnected) ? (
        <span className="hidden text-muted-foreground md:inline">· {syncAge}</span>
      ) : null}
      {statusConfig.showRetry ? (
        <button
          type="button"
          onClick={() => retry()}
          className="hidden rounded px-1.5 py-0.5 text-[11px] font-semibold underline-offset-2 hover:underline sm:inline"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
