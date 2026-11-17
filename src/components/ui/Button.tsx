import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../../lib/uiHelpers';

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-ink-cta text-ink-cta-fg hover:opacity-90 active:scale-[0.98]',
  accent: 'bg-accent text-accent-fg hover:opacity-90 active:scale-[0.98]',
  secondary: 'border border-line bg-surface text-fg hover:bg-surface-2 active:scale-[0.98]',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg active:scale-[0.98]',
  danger: 'bg-coral-soft text-coral-ink hover:opacity-90 active:scale-[0.98]',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  iconOnly = false,
  disabled,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  loading?: boolean;
  iconOnly?: boolean;
}) {
  const sizeClass = iconOnly
    ? size === 'sm'
      ? 'size-11 rounded-full p-0'
      : 'size-11 rounded-full p-0'
    : size === 'sm'
      ? 'min-h-[44px] px-3.5 text-sm sm:text-xs rounded-full'
      : 'min-h-[44px] px-4.5 text-sm rounded-full';

  return (
    <button
      type="button"
      disabled={disabled || loading}
      {...props}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-2 font-semibold transition duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        sizeClass,
        buttonStyles[variant],
        className,
      )}
    >
      {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
