import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

/** Vertical padding of the menu shell (`py-1` = 4px × 2). */
export const CONTEXT_MENU_PAD_Y = 10;

/**
 * Fixed row height: `py-1.5` (6+6) + `text-xs` line-height (16).
 * Keep in sync with ContextMenuItem button classes.
 */
export const CONTEXT_MENU_ITEM_HEIGHT = 28;

/** Logical CSS height for a context-menu popup with `itemCount` rows. */
export function contextMenuHeight(itemCount: number): number {
  const n = Math.max(0, itemCount);
  return CONTEXT_MENU_PAD_Y + n * CONTEXT_MENU_ITEM_HEIGHT;
}

export interface ContextMenuProps {
  children: ReactNode;
  className?: string;
}

/**
 * Shared context-menu shell. Fill the popup window; width stretches,
 * height should match `contextMenuHeight(itemCount)`.
 */
export function ContextMenu({ children, className }: ContextMenuProps) {
  return (
    <div
      className={cn(
        'w-screen h-screen bg-transparent overflow-hidden select-none font-sans',
        className,
      )}
    >
      <div className="w-full h-full text-zinc-900 dark:text-zinc-100 overflow-hidden flex flex-col py-1 px-1">
        {children}
      </div>
    </div>
  );
}

export interface ContextMenuItemProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon?: ReactNode;
  children: ReactNode;
  destructive?: boolean;
}

export function ContextMenuItem({
  icon,
  children,
  destructive = false,
  className,
  type = 'button',
  ...props
}: ContextMenuItemProps) {
  return (
    <button
      type={type}
      className={cn(
        'flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-start transition-colors outline-none rounded-md disabled:opacity-40 disabled:pointer-events-none',
        destructive
          ? 'text-red-600 dark:text-red-400 hover:bg-red-500/10'
          : 'hover:bg-zinc-500/10',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span
          className={cn(
            'shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5',
            !destructive && 'text-zinc-500 dark:text-zinc-400',
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}
