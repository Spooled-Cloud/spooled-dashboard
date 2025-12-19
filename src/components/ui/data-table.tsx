import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from './skeleton';
import { EmptyState } from './empty-state';
import { InlineError } from './inline-error';
import { Button } from './button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Copy, Check } from 'lucide-react';

// Re-export base table components
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './table';

interface DataTableContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function DataTableContainer({ children, className }: DataTableContainerProps) {
  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      {children}
    </div>
  );
}

interface DataTableProps {
  children: React.ReactNode;
  className?: string;
  /** Enable sticky header */
  stickyHeader?: boolean;
}

export function DataTable({ children, className, stickyHeader = true }: DataTableProps) {
  return (
    <div className={cn('relative w-full overflow-auto', stickyHeader && 'max-h-[600px]')}>
      <table className={cn('w-full caption-bottom text-sm', className)}>
        {children}
      </table>
    </div>
  );
}

interface DataTableHeaderProps {
  children: React.ReactNode;
  className?: string;
  sticky?: boolean;
}

export function DataTableHeader({ children, className, sticky = true }: DataTableHeaderProps) {
  return (
    <thead 
      className={cn(
        'border-b bg-muted/50 [&_tr]:border-b',
        sticky && 'sticky top-0 z-10 bg-muted/95 backdrop-blur-sm',
        className
      )}
    >
      {children}
    </thead>
  );
}

interface DataTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  className?: string;
  /** Alignment */
  align?: 'left' | 'center' | 'right';
  /** Sortable column */
  sortable?: boolean;
  /** Current sort direction */
  sortDirection?: 'asc' | 'desc' | null;
  /** Sort callback */
  onSort?: () => void;
}

export function DataTableHead({ 
  children, 
  className, 
  align = 'left',
  sortable,
  sortDirection,
  onSort,
  ...props 
}: DataTableHeadProps) {
  const alignmentClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <th
      className={cn(
        'h-11 px-4 font-medium text-muted-foreground',
        alignmentClasses[align],
        sortable && 'cursor-pointer select-none hover:text-foreground',
        className
      )}
      onClick={sortable ? onSort : undefined}
      {...props}
    >
      {children}
      {sortable && sortDirection && (
        <span className="ml-1">
          {sortDirection === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </th>
  );
}

interface DataTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  className?: string;
  /** Highlight row */
  highlighted?: boolean;
  /** Clickable row */
  clickable?: boolean;
}

export function DataTableRow({ 
  children, 
  className, 
  highlighted,
  clickable,
  ...props 
}: DataTableRowProps) {
  return (
    <tr
      className={cn(
        'border-b transition-colors',
        clickable && 'cursor-pointer',
        highlighted ? 'bg-accent/50' : 'hover:bg-muted/30',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

interface DataTableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  className?: string;
  /** Alignment */
  align?: 'left' | 'center' | 'right';
  /** Monospace font */
  mono?: boolean;
  /** Muted text color */
  muted?: boolean;
}

export function DataTableCell({ 
  children, 
  className,
  align = 'left',
  mono,
  muted,
  ...props 
}: DataTableCellProps) {
  const alignmentClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <td
      className={cn(
        'p-4 align-middle',
        alignmentClasses[align],
        mono && 'font-mono text-xs',
        muted && 'text-muted-foreground',
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

interface DataTableLoadingProps {
  rows?: number;
  columns?: number;
}

export function DataTableLoading({ rows = 5, columns = 5 }: DataTableLoadingProps) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton 
              key={j} 
              className={cn(
                'h-10',
                j === 0 ? 'w-32' : 'flex-1'
              )} 
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface DataTableEmptyProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  hasFilters?: boolean;
  onClearFilters?: () => void;
}

export function DataTableEmpty({
  title = 'No results found',
  description,
  action,
  hasFilters,
  onClearFilters,
}: DataTableEmptyProps) {
  return (
    <EmptyState
      title={title}
      description={description || (hasFilters ? 'Try adjusting your filters' : 'Get started by creating your first item')}
      variant={hasFilters ? 'filter' : 'empty'}
      action={action}
      secondaryAction={hasFilters && onClearFilters ? (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          Clear filters
        </Button>
      ) : undefined}
      compact
    />
  );
}

interface DataTableErrorProps {
  error: Error | string | unknown;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function DataTableError({ error, onRetry, isRetrying }: DataTableErrorProps) {
  return (
    <InlineError
      title="Failed to load data"
      error={error}
      onRetry={onRetry}
      isRetrying={isRetrying}
      compact
    />
  );
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
  showFirstLast?: boolean;
}

export function DataTablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className,
  showFirstLast = false,
}: PaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className={cn('flex items-center justify-between border-t px-4 py-3', className)}>
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium">{startItem}</span> to{' '}
        <span className="font-medium">{endItem}</span> of{' '}
        <span className="font-medium">{totalItems}</span> results
      </p>
      <div className="flex items-center gap-1">
        {showFirstLast && (
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <div className="mx-2 text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
        {showFirstLast && (
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

interface CopyButtonProps {
  value: string;
  className?: string;
}

export function CopyButton({ value, className }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className
      )}
      title="Copy to clipboard"
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.span
            key="check"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
          >
            <Check className="h-3.5 w-3.5 text-success" />
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
          >
            <Copy className="h-3.5 w-3.5" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

