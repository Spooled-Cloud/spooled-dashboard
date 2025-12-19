import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { FileQuestion, Inbox, Search, FolderOpen, type LucideIcon } from 'lucide-react';

type EmptyStateVariant = 'default' | 'search' | 'filter' | 'empty';

const variantIcons: Record<EmptyStateVariant, LucideIcon> = {
  default: Inbox,
  search: Search,
  filter: FileQuestion,
  empty: FolderOpen,
};

interface EmptyStateProps {
  /** Main heading */
  title: string;
  /** Optional description text */
  description?: string;
  /** Custom icon, or use variant for preset icons */
  icon?: LucideIcon;
  /** Preset icon variant */
  variant?: EmptyStateVariant;
  /** Primary action button/component */
  action?: React.ReactNode;
  /** Secondary action */
  secondaryAction?: React.ReactNode;
  /** Additional content */
  children?: React.ReactNode;
  className?: string;
  /** Smaller variant for inline use */
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  icon,
  variant = 'default',
  action,
  secondaryAction,
  children,
  className,
  compact = false,
}: EmptyStateProps) {
  const Icon = icon || variantIcons[variant];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-8' : 'px-6 py-16',
        className
      )}
    >
      <div
        className={cn(
          'mb-4 flex items-center justify-center rounded-full bg-muted',
          compact ? 'h-12 w-12' : 'h-16 w-16'
        )}
      >
        <Icon className={cn('text-muted-foreground', compact ? 'h-6 w-6' : 'h-8 w-8')} />
      </div>

      <h3 className={cn('font-semibold text-foreground', compact ? 'text-base' : 'text-lg')}>
        {title}
      </h3>

      {description && (
        <p className={cn('mt-1 max-w-sm text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
          {description}
        </p>
      )}

      {children}

      {(action || secondaryAction) && (
        <div className={cn('flex items-center gap-3', compact ? 'mt-4' : 'mt-6')}>
          {action}
          {secondaryAction}
        </div>
      )}
    </motion.div>
  );
}
