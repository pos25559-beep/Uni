// Kit de UI partilhado Unipedia v3 ("Estúdio Caderno Vivo").
import { ArrowLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { courseColors } from '../lib/colors';
import { hapticTap } from '../lib/nativeBridge';
import type { Course } from '../types';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export function PageHeader({
  eyebrow,
  title,
  accentTitle,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  accentTitle?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-muted">{eyebrow}</p>
        )}
        <h1 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-[28px]">
          {title}
          {accentTitle ? (
            <>
              {' '}
              <span className="font-serif font-medium italic text-accent">{accentTitle}</span>
            </>
          ) : null}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Cabeçalho minimalista para sub-páginas (Definições internas, Privacidade, /entrar, Cadeira). */
export function SubpageHeader({
  title,
  subtitle,
  backTo,
  onBack,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  backTo?: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  const navigate = useNavigate();
  const handleBack = () => {
    void hapticTap();
    if (onBack) {
      onBack();
      return;
    }
    if (backTo) {
      navigate(backTo);
      return;
    }
    navigate(-1);
  };

  return (
    <header className="mb-5 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Voltar atrás"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-fg shadow-card transition hover:bg-surface-2 active:scale-95"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-bold tracking-tight text-fg sm:text-2xl">
            {title}
          </h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function Card({
  children,
  className,
  title,
  action,
  padded = true,
  tone = 'default',
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
  padded?: boolean;
  tone?: 'default' | 'soft' | 'plain';
}) {
  const surfaceClass =
    tone === 'soft'
      ? 'bg-surface-2/85 border border-line/70'
      : tone === 'plain'
        ? 'bg-surface border border-line/60'
        : 'bg-surface border border-line shadow-card';

  return (
    <section className={cx('rise rounded-[20px]', surfaceClass, padded && 'p-5', className)}>
      {(title || action) && (
        <div className={cx('mb-3.5 flex items-center justify-between gap-3', !padded && 'px-5 pt-5')}>
          <h2 className="font-display text-base font-bold tracking-tight text-fg">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-ink-cta text-ink-cta-fg hover:opacity-90 active:scale-[0.98]',
  accent: 'bg-accent text-accent-fg hover:opacity-90 active:scale-[0.98]',
  secondary: 'border border-line bg-surface text-fg hover:bg-surface-2 active:scale-[0.98]',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg active:scale-[0.98]',
  danger: 'bg-coral-soft text-coral hover:opacity-90 active:scale-[0.98]',
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
      ? 'min-h-[44px] sm:min-h-[38px] px-3.5 text-sm sm:text-xs rounded-full'
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

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';
const toneStyles: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  accent: 'bg-accent-soft text-accent',
  ok: 'bg-accent-soft text-ok',
  warn: 'bg-[#FCE99F]/85 text-[#6B4800] dark:bg-[#352D14] dark:text-[#FDE68A]',
  danger: 'bg-coral-soft text-coral',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
        toneStyles[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Etiqueta colorida de uma cadeira. */
export function CourseChip({ course, className }: { course?: Course; className?: string }) {
  if (!course) return <Badge className={className}>Geral</Badge>;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
        courseColors[course.color].soft,
        className,
      )}
    >
      <span className={cx('size-2 rounded-full', courseColors[course.color].dot)} />
      {course.shortName}
    </span>
  );
}

/** Barra de progresso linear acessível. `value` 0–1. */
export function Progress({
  value,
  color = 'bg-accent',
  className,
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className={cx('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cx('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Anel de progresso acessível (`role="progressbar"`). `value` 0–1. */
export function Ring({
  value,
  size = 64,
  stroke = 6,
  color = 'var(--accent)',
  label = 'Progresso',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  const pct = Math.round(v * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-xs font-bold tabular">{children}</div>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rise rounded-[20px] border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between text-xs font-medium text-muted">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight tabular text-fg">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-line bg-surface/65 px-6 py-10 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <div className="space-y-1">
        <p className="font-display text-base font-bold text-fg">{title}</p>
        {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** Lista agrupada nativa estilo Definições mobile sem paredes repetidas de cartões. */
export function ListGroup({
  title,
  footer,
  children,
  className,
}: {
  title?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('space-y-2', className)}>
      {title && (
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
      )}
      <div className="divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-surface shadow-card">
        {children}
      </div>
      {footer && <p className="px-1 text-xs leading-relaxed text-muted">{footer}</p>}
    </section>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  value,
  badge,
  badgeTone = 'neutral',
  onClick,
  trailing,
  danger = false,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  badge?: ReactNode;
  badgeTone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';
  onClick?: () => void;
  trailing?: ReactNode;
  danger?: boolean;
}) {
  const renderedBadge =
    badge == null ? null : typeof badge === 'string' || typeof badge === 'number' ? (
      <Badge tone={badgeTone}>{badge}</Badge>
    ) : (
      badge
    );
  const inner = (
    <>
      {icon && (
        <span
          className={cx(
            'flex size-10 shrink-0 items-center justify-center rounded-2xl',
            danger ? 'bg-coral-soft text-coral' : 'bg-surface-2 text-fg',
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 text-left">
        <span className={cx('block truncate text-sm font-semibold', danger ? 'text-coral' : 'text-fg')}>
          {title}
        </span>
        {subtitle && <span className="mt-0.5 block truncate text-xs text-muted">{subtitle}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {renderedBadge}
        {value && <span className="text-xs font-medium text-muted tabular">{value}</span>}
        {trailing !== undefined ? (
          trailing
        ) : onClick ? (
          <ChevronRight size={17} className="text-muted" aria-hidden="true" />
        ) : null}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={() => {
          void hapticTap();
          onClick();
        }}
        className="flex min-h-[58px] w-full items-center gap-3.5 px-4 py-3 text-left transition hover:bg-surface-2/60 active:bg-surface-2"
      >
        {inner}
      </button>
    );
  }
  return <div className="flex min-h-[58px] w-full items-center gap-3.5 px-4 py-3">{inner}</div>;
}

/** Interruptor acessível com área tátil de 44px. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        void hapticTap();
        onCheckedChange(!checked);
      }}
      className="inline-flex min-h-[44px] min-w-[52px] shrink-0 items-center justify-center p-1 disabled:opacity-50"
    >
      <span
        className={cx(
          'relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-surface-2 border border-line',
        )}
      >
        <span
          className={cx(
            'inline-block size-5 rounded-full bg-surface shadow-card transition-transform duration-200',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </span>
    </button>
  );
}

/** Controlo segmentado em cápsula tátil com indicador animado `layoutId`. */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  layoutId = 'segmented-control-pill',
  className,
}: {
  items: ReadonlyArray<{ id: T; label: string; icon?: ReactNode; count?: number }>;
  value: T;
  onChange: (id: T) => void;
  layoutId?: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cx(
        'inline-flex w-full items-center gap-1 rounded-full bg-surface-2 p-1.5 sm:w-auto',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              void hapticTap();
              onChange(item.id);
            }}
            className={cx(
              'relative flex-1 rounded-full px-4 py-2 text-xs font-semibold transition-colors sm:flex-initial',
              active ? 'text-fg' : 'text-muted hover:text-fg',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="absolute inset-0 rounded-full bg-surface shadow-card"
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-1.5 whitespace-nowrap">
              {item.icon}
              {item.label}
              {typeof item.count === 'number' && (
                <span className="tabular text-xs opacity-70">{item.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidthClass = 'sm:max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const pressedOutsideRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  const isOutsideDialog = (clientX: number, clientY: number) => {
    const dialog = dialogRef.current;
    if (!dialog) return false;
    const rect = dialog.getBoundingClientRect();
    return (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    );
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => {
        if (!('closedBy' in HTMLDialogElement.prototype)) {
          pressedOutsideRef.current = isOutsideDialog(e.clientX, e.clientY);
        }
      }}
      onPointerUp={(e) => {
        if (
          !('closedBy' in HTMLDialogElement.prototype) &&
          pressedOutsideRef.current &&
          isOutsideDialog(e.clientX, e.clientY)
        ) {
          onClose();
        }
        pressedOutsideRef.current = false;
      }}
      {...({ closedby: 'any' } as Record<string, unknown>)}
      className={cx(
        'rise m-auto mb-0 w-full max-w-none open:flex max-h-[90dvh] flex-col rounded-t-[26px] border border-line bg-surface p-0 text-fg shadow-float backdrop:bg-black/45 backdrop:backdrop-blur-[2px] sm:mb-auto sm:rounded-[24px]',
        maxWidthClass,
      )}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 id={titleId} className="font-display text-base font-bold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="flex size-11 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="space-y-4 overflow-y-auto px-5 py-4">{children}</div>
      {footer && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}

/** Folha de ações móvel para menus compactos sem sobrecarregar ecrãs pequenos. */
export function ActionSheet({
  open,
  onClose,
  title,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  actions: ReadonlyArray<{
    id: string;
    label: string;
    hint?: string;
    icon?: ReactNode;
    danger?: boolean;
    onSelect: () => void;
  }>;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title || 'Ações'}>
          <motion.button
            type="button"
            aria-label="Fechar opções"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="relative z-10 w-full max-w-md rounded-t-[28px] border border-line bg-surface px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-float sm:rounded-[26px] sm:pb-4"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />
            {title && <p className="mb-3 px-2 font-display text-sm font-bold text-fg">{title}</p>}
            <div className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-bg">
              {actions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    void hapticTap();
                    onClose();
                    item.onSelect();
                  }}
                  className="flex min-h-[54px] w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2"
                >
                  {item.icon && (
                    <span className={cx('shrink-0', item.danger ? 'text-coral' : 'text-fg')}>
                      {item.icon}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={cx('block text-sm font-semibold', item.danger ? 'text-coral' : 'text-fg')}>
                      {item.label}
                    </span>
                    {item.hint && <span className="block text-xs text-muted">{item.hint}</span>}
                  </span>
                </button>
              ))}
            </div>
            <Button variant="secondary" className="mt-3 w-full" onClick={onClose}>
              Cancelar
            </Button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

type ToastItem = { id: number; message: string; tone?: 'ok' | 'danger' | 'neutral' };
let toastListeners: Array<(items: ToastItem[]) => void> = [];
let toastQueue: ToastItem[] = [];

export function showToast(message: string, tone: 'ok' | 'danger' | 'neutral' = 'ok') {
  const id = Date.now() + Math.floor(Math.random() * 1000);
  toastQueue = [...toastQueue.slice(-2), { id, message, tone }];
  toastListeners.forEach((fn) => fn(toastQueue));
  setTimeout(() => {
    toastQueue = toastQueue.filter((t) => t.id !== id);
    toastListeners.forEach((fn) => fn(toastQueue));
  }, 3200);
}

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>(toastQueue);

  useEffect(() => {
    toastListeners.push(setItems);
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== setItems);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[70] flex flex-col items-center gap-2 px-4"
    >
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className={cx(
              'pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-semibold shadow-float',
              t.tone === 'danger'
                ? 'border-coral/40 bg-coral-soft text-coral'
                : t.tone === 'ok'
                  ? 'border-accent/35 bg-ink-cta text-ink-cta-fg'
                  : 'border-line bg-surface text-fg',
            )}
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-coral">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-muted">{hint}</span>
      )}
    </label>
  );
}

const control =
  'w-full rounded-[14px] border border-line bg-surface-2/85 px-3.5 text-sm text-fg placeholder:text-muted/75 focus:border-accent focus:bg-surface focus:outline-none disabled:cursor-not-allowed disabled:opacity-55';

export function Input({
  className,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      {...props}
      className={cx(control, 'h-11', error && 'border-coral focus:border-coral', className)}
    />
  );
}

export function Select({
  className,
  error,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select
      {...props}
      className={cx(control, 'h-11', error && 'border-coral focus:border-coral', className)}
    />
  );
}

export function Textarea({
  className,
  error,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      {...props}
      className={cx(control, 'min-h-24 py-2.5', error && 'border-coral focus:border-coral', className)}
    />
  );
}
