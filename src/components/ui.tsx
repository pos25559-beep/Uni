// Kit de UI partilhado Unipedia v4 ("Estúdio Caderno Vivo Refinado").
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { courseColors } from '../lib/colors';
import { hapticTap } from '../lib/nativeBridge';
import { cx } from '../lib/uiHelpers';
import type { Course } from '../types';

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
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-[210px] flex-1 space-y-1">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{eyebrow}</p>
        )}
        <h1 className="font-display text-[28px] font-bold leading-[1.08] tracking-tight text-fg sm:text-[32px]">
          {title}
          {accentTitle ? (
            <>
              {' '}
              <span className="font-serif font-medium italic text-accent">{accentTitle}</span>
            </>
          ) : null}
        </h1>
        {subtitle && <p className="pt-0.5 text-sm leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 sm:shrink-0">
          {actions}
        </div>
      )}
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
  const { t } = useTranslation('common');
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
          aria-label={t('actions.back')}
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
    <section className={cx('rise min-w-0 rounded-[20px]', surfaceClass, padded && 'p-5', className)}>
      {(title || action) && (
        <div className={cx('mb-3.5 flex flex-wrap items-center justify-between gap-2 sm:gap-3', !padded && 'px-5 pt-5')}>
          <h2 className="min-w-0 font-display text-base font-bold tracking-tight text-fg">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';
const toneStyles: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  accent: 'bg-accent-soft text-accent-ink',
  ok: 'bg-accent-soft text-ok-ink',
  warn: 'bg-[#FCE99F]/85 text-[#6B4800] dark:bg-[#352D14] dark:text-[#FDE68A]',
  danger: 'bg-coral-soft text-coral-ink',
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
  const { t } = useTranslation('common');
  if (!course) return <Badge className={className}>{t('ui.general')}</Badge>;
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

/** Barra de progresso linear animada com mola suave. `value` 0–1. */
export function Progress({
  value,
  color = 'bg-accent',
  className,
  label,
}: {
  value: number;
  color?: string;
  className?: string;
  label?: string;
}) {
  const { t } = useTranslation('common');
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className={cx('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}
      role="progressbar"
      aria-label={label ?? t('ui.progress')}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className={cx('h-full rounded-full', color)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      />
    </div>
  );
}

/** Anel de progresso acessível com animação suave de desenho. `value` 0–1. */
export function Ring({
  value,
  size = 64,
  stroke = 6,
  color = 'var(--accent)',
  label,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation('common');
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  const pct = Math.round(v * 100);
  return (
    <div
      role="progressbar"
      aria-label={label ?? t('ui.progress')}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ type: 'spring', stiffness: 160, damping: 22, delay: 0.12 }}
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
        'inline-flex w-full max-w-full items-center gap-1 overflow-x-auto rounded-full bg-surface-2 p-1 sm:w-auto sm:p-1.5',
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
              'relative min-h-11 min-w-11 flex-1 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors sm:flex-initial sm:px-4',
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

export { Button } from './ui/Button';
export { Modal, ActionSheet, ToastViewport } from './ui/Dialogs';
export { Field, Input, Select, PillSelect, Textarea } from './ui/FormControls';
export type { PillSelectOption } from './ui/FormControls';
export { Skeleton, SkeletonList } from './ui/Skeleton';
export { DateField, DateTimeField, TimeField } from './DateTimeFields';
