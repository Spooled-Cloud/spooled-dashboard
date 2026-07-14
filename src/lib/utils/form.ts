import * as React from 'react';
import type { FieldErrors, FieldValues, Path, UseFormSetFocus } from 'react-hook-form';

/** Focus the first field with a validation error (supports nested / array paths). */
export function focusFirstFormError<T extends FieldValues>(
  errors: FieldErrors<T>,
  setFocus: UseFormSetFocus<T>,
  prefix = ''
): void {
  for (const key of Object.keys(errors)) {
    const value = errors[key as keyof typeof errors];
    const path = prefix ? `${prefix}.${key}` : key;

    if (!value || typeof value !== 'object') continue;

    if ('message' in value && value.message) {
      setFocus(path as Path<T>);
      return;
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (value[i]) {
          focusFirstFormError({ [`${i}`]: value[i] } as FieldErrors<T>, setFocus, path);
          return;
        }
      }
      continue;
    }

    focusFirstFormError(value as FieldErrors<T>, setFocus, path);
  }
}

/** Remember the element that opened a dialog and restore focus when it closes. */
export function useDialogFocusRestore() {
  const triggerRef = React.useRef<HTMLElement | null>(null);

  const captureTrigger = (event: React.PointerEvent | React.MouseEvent) => {
    const target = event.currentTarget;
    if (target instanceof HTMLElement) {
      triggerRef.current = target;
    }
  };

  const wrapTrigger = (node: React.ReactNode): React.ReactNode => {
    if (!node || !React.isValidElement(node)) return node;

    const props = node.props as {
      onPointerDown?: (e: React.PointerEvent) => void;
      onClick?: (e: React.MouseEvent) => void;
    };

    return React.cloneElement(node, {
      onPointerDown: (e: React.PointerEvent) => {
        captureTrigger(e);
        props.onPointerDown?.(e);
      },
      onClick: (e: React.MouseEvent) => {
        captureTrigger(e);
        props.onClick?.(e);
      },
    } as Partial<typeof props>);
  };

  const onCloseAutoFocus = (event: Event) => {
    if (triggerRef.current) {
      event.preventDefault();
      triggerRef.current.focus();
    }
  };

  return { wrapTrigger, onCloseAutoFocus };
}
