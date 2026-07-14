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
    className: 'border-status-pending/50 bg-status-pending/10 text-status-pending-foreground',
    icon: Clock,
  },
  scheduled: {
    label: 'Scheduled',
    className: 'border-status-scheduled/50 bg-status-scheduled/10 text-status-scheduled-foreground',
    icon: Calendar,
  },
  processing: {
    label: 'Processing',
    className: 'border-status-processing bg-status-processing text-status-processing-foreground',
    icon: Loader2,
    animate: true,
  },
  completed: {
    label: 'Completed',
    className: 'border-status-completed/50 bg-status-completed/10 text-status-completed-foreground',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    className: 'border-status-failed/50 bg-status-failed/10 text-status-failed-foreground',
    icon: XCircle,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'border-status-canceled/50 bg-status-canceled/10 text-status-canceled-foreground',
    icon: Ban,
  },
  deadletter: {
    label: 'Dead Letter',
    className: 'border-status-failed/50 bg-status-failed/20 text-status-failed-foreground',
    icon: AlertTriangle,
  },
  paused: {
    label: 'Paused',
    className: 'border-status-paused/50 bg-status-paused/10 text-status-paused-foreground',
    icon: Pause,
  },
  active: {
    label: 'Active',
    className: 'border-status-completed/50 bg-status-completed/10 text-status-completed-foreground',
    icon: CheckCircle2,
  },
  inactive: {
    label: 'Inactive',
    className: 'border-status-offline/50 bg-status-offline/10 text-status-offline-foreground',
    icon: Pause,
  },
  healthy: {
    label: 'Healthy',
    className: 'border-status-completed/50 bg-status-completed/10 text-status-completed-foreground',
    icon: CheckCircle2,
  },
  unhealthy: {
    label: 'Unhealthy',
    className: 'border-status-degraded/50 bg-status-degraded/10 text-status-degraded-foreground',
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
