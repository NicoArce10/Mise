import { useEffect } from 'react';

export type ShortcutHandlers = {
  onFocusSearch?: () => void;
  onNextDish?: () => void;
  onPrevDish?: () => void;
  onOpenDetail?: () => void;
  onApprove?: () => void;
  onEdit?: () => void;
  onReject?: () => void;
  onToggleDensity?: () => void;
  onShowHelp?: () => void;
  onEscape?: () => void;
};

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    el.isContentEditable === true
  );
}

/**
 * Global keyboard shortcuts for the Cockpit.
 *
 * Disabled whenever focus is inside a text input, textarea, or editable
 * element — a reviewer typing the filter query must not accidentally
 * approve a dish by pressing `a`.
 */
export function useShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Let text inputs consume their keys; exception: Escape always bubbles.
      if (e.key !== 'Escape' && isEditableTarget(e.target)) return;
      // Ignore when modifier combos are in play (except Shift for `?`).
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case '/':
          e.preventDefault();
          handlers.onFocusSearch?.();
          return;
        case 'j':
          e.preventDefault();
          handlers.onNextDish?.();
          return;
        case 'k':
          e.preventDefault();
          handlers.onPrevDish?.();
          return;
        case 'Enter':
          handlers.onOpenDetail?.();
          return;
        case 'Escape':
          handlers.onEscape?.();
          return;
        case 'a':
          handlers.onApprove?.();
          return;
        case 'e':
          handlers.onEdit?.();
          return;
        case 'r':
          handlers.onReject?.();
          return;
        case 'c':
          handlers.onToggleDensity?.();
          return;
        case '?':
          e.preventDefault();
          handlers.onShowHelp?.();
          return;
        default:
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers]);
}
