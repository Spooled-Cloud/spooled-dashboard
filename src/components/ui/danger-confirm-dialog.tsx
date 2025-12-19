import * as React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface DangerConfirmDialogProps {
  /** Dialog open state */
  open: boolean;
  /** Close callback */
  onOpenChange: (open: boolean) => void;
  /** Confirm callback */
  onConfirm: () => void | Promise<void>;
  /** Dialog title */
  title: string;
  /** Description of what will happen */
  description: React.ReactNode;
  /** Text user must type to confirm (if provided, shows input field) */
  confirmText?: string;
  /** Confirm button label */
  confirmLabel?: string;
  /** Cancel button label */
  cancelLabel?: string;
  /** Is action in progress */
  isLoading?: boolean;
  /** Additional warning items to display */
  warnings?: string[];
}

export function DangerConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isLoading = false,
  warnings,
}: DangerConfirmDialogProps) {
  const [inputValue, setInputValue] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const canConfirm = confirmText ? inputValue === confirmText : true;

  // Reset input when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setInputValue('');
      // Focus input after a small delay for animation
      if (confirmText) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [open, confirmText]);

  const handleConfirm = async () => {
    if (!canConfirm || isLoading) return;
    await onConfirm();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canConfirm && !isLoading) {
      handleConfirm();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-center">{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {warnings && warnings.length > 0 && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <ul className="space-y-1 text-sm text-destructive">
              {warnings.map((warning, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-0.5 text-xs">•</span>
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {confirmText && (
          <div className="space-y-2">
            <Label htmlFor="confirm-input" className="text-sm text-muted-foreground">
              Type <span className="font-mono font-semibold text-foreground">{confirmText}</span> to
              confirm
            </Label>
            <Input
              id="confirm-input"
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={confirmText}
              className={cn(
                'font-mono',
                inputValue &&
                  inputValue !== confirmText &&
                  'border-destructive focus-visible:ring-destructive'
              )}
              disabled={isLoading}
            />
          </div>
        )}

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!canConfirm || isLoading}>
            {isLoading ? 'Processing...' : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
