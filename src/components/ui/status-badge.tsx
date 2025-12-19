import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { Badge } from './badge';
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Pause,
  Calendar,
  Ban,
} from 'lucide-react';
import type { JobStatus } from '@/lib/types';

type StatusVariant = JobStatus | 'paused' | 'active' | 'inactive' | 'healthy' | 'unhealthy';

interface StatusConfig {
  label: string;
  className: string;
  icon: React.ElementType;
  animate?: boolean;
}

const statusConfigs: Record<StatusVariant, StatusConfig> = {
  pending: {
    label: 'Pending',
    className: 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    icon: Clock,
  },
  scheduled: {
    label: 'Scheduled',
    className: 'border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400',
    icon: Calendar,
  },
  processing: {
    label: 'Processing',
    className: 'border-blue-500 bg-blue-500 text-white',
    icon: Loader2,
    animate: true,
  },
  completed: {
    label: 'Completed',
    className: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    className: 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400',
    icon: XCircle,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'border-gray-500/50 bg-gray-500/10 text-gray-600 dark:text-gray-400',
    icon: Ban,
  },
  deadletter: {
    label: 'Dead Letter',
    className: 'border-red-600/50 bg-red-600/20 text-red-700 dark:text-red-300',
    icon: AlertTriangle,
  },
  paused: {
    label: 'Paused',
    className: 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    icon: Pause,
  },
  active: {
    label: 'Active',
    className: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  inactive: {
    label: 'Inactive',
    className: 'border-gray-500/50 bg-gray-500/10 text-gray-600 dark:text-gray-400',
    icon: Pause,
  },
  healthy: {
    label: 'Healthy',
    className: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  unhealthy: {
    label: 'Unhealthy',
    className: 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400',
    icon: AlertTriangle,
  },
};

interface StatusBadgeProps {
  status: StatusVariant;
  /** Show icon */
  showIcon?: boolean;
  /** Custom label override */
  label?: string;
  /** Size variant */
  size?: 'sm' | 'default';
  className?: string;
}

export function StatusBadge({
  status,
  showIcon = true,
  label,
  size = 'default',
  className,
}: StatusBadgeProps) {
  const config = statusConfigs[status] || statusConfigs.pending;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium',
        config.className,
        size === 'sm' && 'px-1.5 py-0 text-xs',
        className
      )}
    >
      {showIcon && (
        <Icon
          className={cn(
            'mr-1',
            size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5',
            config.animate && 'animate-spin'
          )}
        />
      )}
      {label || config.label}
    </Badge>
  );
}

interface JobStatusBadgeProps {
  status: JobStatus;
  showIcon?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

export function JobStatusBadge({ status, ...props }: JobStatusBadgeProps) {
  return <StatusBadge status={status} {...props} />;
}

interface QueueStatusBadgeProps {
  paused: boolean;
  showIcon?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

export function QueueStatusBadge({ paused, ...props }: QueueStatusBadgeProps) {
  return <StatusBadge status={paused ? 'paused' : 'active'} {...props} />;
}
