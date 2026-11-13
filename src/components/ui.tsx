// Kit de UI partilhado. Todas as páginas devem compor estes blocos para manter consistência.
import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import type {
  ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes,
} from 'react';
import { courseColors } from '../lib/colors';
import type { Course } from '../types';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ children, className, title, action, padded = true }: {
  children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; padded?: boolean;
}) {
  return (
    <section className={cx('rise rounded-2xl border border-line bg-surface', padded && 'p-5', className)}>
      {(title || action) && (
        <div className={cx('mb-4 flex items-center justify-between gap-3', !padded && 'px-5 pt-5')}>
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90',
  secondary: 'border border-line bg-surface-2 text-fg hover:border-muted/50',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger/12 text-danger hover:bg-danger/20',
};

export function Button({ variant = 'secondary', size = 'md', className, ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
        buttonStyles[variant],
        className,
      )}
    />
  );
}

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';
const toneStyles: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  accent: 'bg-accent-soft text-accent',
  ok: 'bg-ok/12 text-ok',
  warn: 'bg-warn/15 text-warn',
  danger: 'bg-danger/12 text-danger',
};

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', toneStyles[tone], className)}>
      {children}
    </span>
  );
}

/** Etiqueta colorida de uma cadeira. */
export function CourseChip({ course, className }: { course?: Course; className?: string }) {
  if (!course) return <Badge className={className}>Geral</Badge>;
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', courseColors[course.color].soft, className)}>
      <span className={cx('size-1.5 rounded-full', courseColors[course.color].dot)} />
      {course.shortName}
    </span>
  );
}

/** Barra de progresso. `value` 0–1. `color` aceita uma classe bg-* (por omissão a cor de destaque). */
export function Progress({ value, color = 'bg-accent', className }: { value: number; color?: string; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-surface-2', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Anel de progresso. `value` 0–1. `color` é um valor CSS (hex ou var()). */
export function Ring({ value, size = 64, stroke = 6, color = 'var(--accent)', children }: {
  value: number; size?: number; stroke?: number; color?: string; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-xs font-semibold tabular">{children}</div>
    </div>
  );
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rise rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between text-xs font-medium text-muted">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
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
        'rise m-auto mb-0 w-full max-w-none open:flex max-h-[90dvh] flex-col rounded-t-2xl border border-line bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm sm:mb-auto sm:rounded-2xl',
        maxWidthClass,
      )}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id={titleId} className="text-base font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="space-y-4 overflow-y-auto px-5 py-4">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">{footer}</div>}
    </dialog>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const control =
  'w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-muted/70 focus:border-accent focus:outline-none';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(control, 'h-10', className)} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(control, 'h-10', className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(control, 'min-h-24 py-2', className)} />;
}
