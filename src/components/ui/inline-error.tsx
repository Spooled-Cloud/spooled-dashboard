import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './button';

interface InlineErrorProps {
  /** Error title */
  title?: string;
  /** Error message or Error object */
  error: Error | string | unknown;
  /** Retry callback */
  onRetry?: () => void;
  /** Is retry in progress */
  isRetrying?: boolean;
  /** Compact mode for smaller spaces */
  compact?: boolean;
  className?: string;
}

export function InlineError({
  title = 'Something went wrong',
  error,
  onRetry,
  isRetrying = false,
  compact = false,
  className,
}: InlineErrorProps) {
  const errorMessage = React.useMemo(() => {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    return 'An unexpected error occurred';
  }, [error]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-6 px-4' : 'py-12 px-6',
        className
      )}
    >
      <div 
        className={cn(
          'mb-3 flex items-center justify-center rounded-full bg-destructive/10',
          compact ? 'h-10 w-10' : 'h-14 w-14'
        )}
      >
        <AlertCircle 
          className={cn(
            'text-destructive',
            compact ? 'h-5 w-5' : 'h-7 w-7'
          )} 
        />
      </div>
      
      <h3 className={cn(
        'font-semibold text-foreground',
        compact ? 'text-sm' : 'text-base'
      )}>
        {title}
      </h3>
      
      <p className={cn(
        'mt-1 max-w-md text-muted-foreground',
        compact ? 'text-xs' : 'text-sm'
      )}>
        {errorMessage}
      </p>
      
      {onRetry && (
        <Button
          variant="outline"
          size={compact ? 'sm' : 'default'}
          onClick={onRetry}
          disabled={isRetrying}
          className={compact ? 'mt-3' : 'mt-4'}
        >
          <RefreshCw className={cn('h-4 w-4', isRetrying && 'animate-spin')} />
          {isRetrying ? 'Retrying...' : 'Try again'}
        </Button>
      )}
    </motion.div>
  );
}

