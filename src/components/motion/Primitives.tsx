import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { cx } from '../ui';

export const UNIPEDIA_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 32,
  mass: 0.9,
};

export function AnimatedPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function TactileCard({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  if (!onClick) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={UNIPEDIA_SPRING}
        className={cx('rounded-[18px] border border-line bg-surface', className)}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.985 }}
      transition={UNIPEDIA_SPRING}
      className={cx(
        'w-full text-left rounded-[18px] border border-line bg-surface transition-colors',
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

type BentoTone = 'indigo' | 'mint' | 'amber' | 'lilac' | 'neutral';

const BENTO_STYLES: Record<BentoTone, string> = {
  indigo: 'bg-accent-soft border-accent/25 text-fg',
  mint: 'bg-emerald-50/90 border-emerald-200/80 text-fg dark:bg-emerald-950/35 dark:border-emerald-800/45',
  amber: 'bg-amber-50/90 border-amber-200/80 text-fg dark:bg-amber-950/35 dark:border-amber-800/45',
  lilac: 'bg-violet-50/90 border-violet-200/80 text-fg dark:bg-violet-950/35 dark:border-violet-800/45',
  neutral: 'bg-surface border-line text-fg',
};

export function BentoMetricTile({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: BentoTone;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={UNIPEDIA_SPRING}
      className={cx(
        'relative overflow-hidden rounded-[18px] border p-4',
        BENTO_STYLES[tone],
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-5 -bottom-5 size-20 rounded-full bg-current opacity-[0.04]"
      />
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted">
        <span className="truncate">{label}</span>
        {icon && <span className="shrink-0 opacity-80">{icon}</span>}
      </div>
      <div className="mt-2.5 text-2xl font-semibold tracking-tight tabular">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </motion.div>
  );
}

export function SlidingTabs<T extends string>({
  items,
  value,
  onChange,
  layoutId = 'sliding-tab-pill',
  className,
}: {
  items: ReadonlyArray<{ id: T; label: string; count?: number }>;
  value: T;
  onChange: (id: T) => void;
  layoutId?: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cx('inline-flex flex-wrap items-center gap-1 rounded-full border border-line bg-surface-2 p-1', className)}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cx(
              'relative rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
              active ? 'text-accent-fg' : 'text-muted hover:text-fg',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={UNIPEDIA_SPRING}
                className="absolute inset-0 rounded-full bg-ink-cta"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {item.label}
              {typeof item.count === 'number' && (
                <span className={cx('tabular text-[11px]', active ? 'opacity-80' : 'text-muted')}>
                  {item.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
