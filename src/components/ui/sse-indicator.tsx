/**
 * SSE Connection Status Indicator
 *
 * Shows the current status of SSE connection with the ability to reconnect.
 */

import { cn } from '@/lib/utils/cn';
import { Button } from './button';
import { Badge } from './badge';
import { Wifi, WifiOff, Loader2, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

interface SSEIndicatorProps {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  onReconnect?: () => void;
  className?: string;
  /** Compact mode - just show an icon */
  compact?: boolean;
}

export function SSEIndicator({
  isConnected,
  isConnecting,
  error,
  onReconnect,
  className,
  compact = false,
}: SSEIndicatorProps) {
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={error ? onReconnect : undefined}
              className={cn(
                'inline-flex items-center justify-center rounded-full p-1',
                isConnected && 'text-emerald-500',
                isConnecting && 'text-amber-500',
                error && 'text-red-500 hover:bg-red-500/10',
                className
              )}
            >
              {isConnecting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isConnected ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {isConnecting && 'Connecting to realtime updates...'}
            {isConnected && 'Connected - receiving live updates'}
            {error && 'Connection lost. Click to reconnect.'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {isConnecting && (
        <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-600">
          <Loader2 className="h-3 w-3 animate-spin" />
          Connecting...
        </Badge>
      )}

      {isConnected && (
        <Badge variant="outline" className="gap-1 border-emerald-500/50 text-emerald-600">
          <Wifi className="h-3 w-3" />
          Live
        </Badge>
      )}

      {error && !isConnecting && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 border-red-500/50 text-red-600">
            <WifiOff className="h-3 w-3" />
            Disconnected
          </Badge>
          {onReconnect && (
            <Button variant="ghost" size="sm" onClick={onReconnect}>
              <RefreshCw className="mr-1 h-3 w-3" />
              Reconnect
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Live indicator pulse animation
 */
export function LiveIndicator({ className }: { className?: string }) {
  return (
    <span className={cn('relative flex h-2 w-2', className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
    </span>
  );
}
