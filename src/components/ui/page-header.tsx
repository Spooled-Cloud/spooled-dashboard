import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Show back button if provided */
  backHref?: string;
  backLabel?: string;
}

export function PageHeader({
  title,
  description,
  children,
  actions,
  className,
  backHref,
  backLabel = 'Back',
}: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="space-y-1">
        {backHref && (
          <a
            href={backHref}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
            {backLabel}
          </a>
        )}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && (
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p>
        )}
        {children}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </motion.div>
  );
}

interface PageHeaderActionsProps {
  children: React.ReactNode;
}

export function PageHeaderActions({ children }: PageHeaderActionsProps) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

