import confetti from 'canvas-confetti';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { courseColors } from '../../lib/colors';
import { hapticSuccess, hapticTap } from '../../lib/nativeBridge';
import { useStore } from '../../store/useStore';
import type { Course } from '../../types';
import { cx } from '../ui';

export const UNIPEDIA_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 24,
  mass: 0.85,
};

export const UNIPEDIA_BOUNCE_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 20,
};

/** Celebração leve com cores de papelaria Unipedia (respeita reduced-motion). */
export function celebrateStationery() {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  void hapticSuccess();
  try {
    void confetti({
      particleCount: 28,
      spread: 58,
      origin: { y: 0.72 },
      colors: ['#157F58', '#FCE99F', '#E04F33', '#C9DC9F', '#C4E0FD'],
      disableForReducedMotion: true,
    });
  } catch {
    // WebView sem suporte a canvas.
  }
}

export function AnimatedPage({ children, className }: { children: ReactNode; className?: string }) {
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');
  if (isMinimal) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={UNIPEDIA_SPRING}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Contentor que cria entrada escalonada fluida dos blocos do ecrã. */
export function StaggerContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');
  if (isMinimal) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.06,
            delayChildren: 0.04,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');
  if (isMinimal) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 14, scale: 0.97 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: UNIPEDIA_SPRING,
        },
      }}
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
        className={cx('rounded-[20px] border border-line bg-surface shadow-card', className)}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <motion.button
      type="button"
      onClick={() => {
        void hapticTap();
        onClick();
      }}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.985 }}
      transition={UNIPEDIA_SPRING}
      className={cx(
        'w-full text-left rounded-[20px] border border-line bg-surface shadow-card transition-colors',
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

/** Pílula/sticker ligeiramente inclinado ao estilo "Ready to Plant?". */
export function StickerBadge({
  children,
  tone = 'butter',
  tilt = -3,
  className,
}: {
  children: ReactNode;
  tone?: 'butter' | 'sage' | 'mint' | 'sky' | 'peach' | 'blush';
  tilt?: number;
  className?: string;
}) {
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');
  const toneClass = isMinimal
    ? 'bg-surface-2 text-fg border-line'
    : {
        butter: 'bg-pastel-butter text-[#141312]',
        sage: 'bg-pastel-sage text-[#141312]',
        mint: 'bg-pastel-mint text-[#141312]',
        sky: 'bg-pastel-sky text-[#141312]',
        peach: 'bg-pastel-peach text-[#141312]',
        blush: 'bg-pastel-blush text-[#141312]',
      }[tone];

  return (
    <span
      style={isMinimal ? undefined : { transform: `rotate(${tilt}deg)` }}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
        isMinimal ? 'shadow-none' : 'border-[#141312]/15 font-bold shadow-card',
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  );
}

export type BentoTone = 'sage' | 'butter' | 'mint' | 'sky' | 'peach' | 'blush' | 'neutral';

const BENTO_STYLES: Record<BentoTone, string> = {
  sage: 'bg-pastel-sage/90 text-[#141312] dark:bg-[#23311B] dark:text-[#FAF6EC]',
  butter: 'bg-pastel-butter/90 text-[#141312] dark:bg-[#352D14] dark:text-[#FAF6EC]',
  mint: 'bg-pastel-mint/90 text-[#141312] dark:bg-[#17312B] dark:text-[#FAF6EC]',
  sky: 'bg-pastel-sky/90 text-[#141312] dark:bg-[#192A3D] dark:text-[#FAF6EC]',
  peach: 'bg-pastel-peach/90 text-[#141312] dark:bg-[#382317] dark:text-[#FAF6EC]',
  blush: 'bg-pastel-blush/90 text-[#141312] dark:bg-[#381E21] dark:text-[#FAF6EC]',
  neutral: 'bg-surface border border-line text-fg shadow-card',
};

/**
 * Cartão Bento em bloco pastel inspirado nas colagens de referência:
 * ícone circular no canto superior direito, valor tabular grande e rodapé "Ver ->".
 */
export function BentoMetricTile({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  actionLabel,
  onClick,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: BentoTone;
  actionLabel?: string;
  onClick?: () => void;
  className?: string;
}) {
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');
  const resolvedTone: BentoTone = isMinimal ? 'neutral' : tone;
  const Tag = onClick ? motion.button : motion.div;
  return (
    <Tag
      {...(onClick
        ? {
            type: 'button' as const,
            onClick: () => {
              void hapticTap();
              onClick();
            },
            whileTap: isMinimal ? undefined : { scale: 0.98 },
          }
        : {})}
      initial={isMinimal ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={isMinimal ? { duration: 0 } : UNIPEDIA_SPRING}
      className={cx(
        'relative flex flex-col justify-between overflow-hidden p-4 text-left',
        isMinimal ? 'rounded-2xl' : 'rounded-[22px]',
        BENTO_STYLES[resolvedTone],
        onClick && !isMinimal && 'w-full cursor-pointer transition-transform hover:-translate-y-0.5',
        onClick && isMinimal && 'w-full cursor-pointer transition-colors hover:border-muted/60',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold">{label}</p>
          {hint && <p className="mt-0.5 line-clamp-2 text-xs opacity-75">{hint}</p>}
        </div>
        {icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface/80 text-fg dark:bg-black/25 dark:text-[#FAF6EC]">
            {icon}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-2">
        <div className="text-2xl font-bold tracking-tight tabular">{value}</div>
        {(actionLabel || onClick) && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold opacity-85">
            {actionLabel || 'Ver'}
            <ArrowRight size={13} aria-hidden="true" />
          </span>
        )}
      </div>
    </Tag>
  );
}

/** Tira semanal interativa em pílulas (`SEG TER QUA ...`) estilo "Sun 24 / Mon 25". */
export function WeekDayPills({
  days,
  selectedKey,
  onSelect,
  className,
}: {
  days: ReadonlyArray<{
    key: string;
    shortLabel: string;
    dayNumber: string;
    isToday?: boolean;
    dotTone?: 'accent' | 'coral' | 'none';
    count?: number;
  }>;
  selectedKey: string;
  onSelect: (key: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'grid grid-cols-7 gap-1.5 rounded-[22px] bg-surface-2/75 p-1.5',
        className,
      )}
      role="tablist"
      aria-label="Dias da semana"
    >
      {days.map((d) => {
        const active = d.key === selectedKey;
        return (
          <button
            key={d.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              void hapticTap();
              onSelect(d.key);
            }}
            className={cx(
              'relative flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-[16px] px-1 py-1.5 transition-colors',
              active
                ? 'bg-ink-cta text-ink-cta-fg shadow-card'
                : 'text-muted hover:bg-surface/70 hover:text-fg',
            )}
          >
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">
              {d.shortLabel}
            </span>
            <span className="font-mono text-sm font-bold tabular">{d.dayNumber}</span>
            <span
              className={cx(
                'size-1.5 rounded-full',
                d.dotTone === 'coral'
                  ? 'bg-coral'
                  : d.dotTone === 'accent'
                    ? active
                      ? 'bg-accent'
                      : 'bg-accent'
                    : d.isToday && !active
                      ? 'bg-fg/40'
                      : 'bg-transparent',
              )}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Baralho empilhado de pastas coloridas das cadeiras ("Improve English" + "Events stack"):
 * permite ver todas as pastas com abas escalonadas e destacar/abrir a cadeira escolhida.
 */
export function FolderCardDeck({
  courses,
  selectedId,
  onSelect,
  onOpenCourse,
}: {
  courses: Course[];
  selectedId?: string;
  onSelect?: (courseId: string) => void;
  onOpenCourse: (courseId: string) => void;
}) {
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');
  const [internalId, setInternalId] = useState<string>(courses[0]?.id ?? '');
  const activeId = selectedId ?? internalId;

  if (courses.length === 0) return null;

  if (isMinimal) {
    return (
      <div className="space-y-2">
        {courses.map((course) => {
          const doneTopics = course.topics.filter((t) => t.status === 'done' || t.status === 'review').length;
          const totalTopics = course.topics.length;
          const pct = totalTopics > 0 ? Math.round((doneTopics / totalTopics) * 100) : 0;
          const scheme = courseColors[course.color];
          return (
            <button
              key={course.id}
              type="button"
              onClick={() => onOpenCourse(course.id)}
              className="flex min-h-[54px] w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-muted/60"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cx('size-2 shrink-0 rounded-full', scheme.dot)} aria-hidden="true" />
                  <span className="font-mono text-xs font-semibold text-muted">{course.shortName}</span>
                  <span className="text-xs text-muted tabular">· {course.ects} ECTS</span>
                </div>
                <p className="mt-0.5 truncate font-display text-sm font-bold text-fg">{course.name}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-xs font-semibold text-muted tabular">{pct}%</span>
                <ArrowRight size={14} className="text-muted" aria-hidden="true" />
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  const choose = (id: string) => {
    void hapticTap();
    setInternalId(id);
    onSelect?.(id);
  };

  return (
    <div className="space-y-2">
      <div className="relative pt-1">
        {courses.map((course, idx) => {
          const isActive = course.id === activeId || (!activeId && idx === 0);
          const doneTopics = course.topics.filter((t) => t.status === 'done' || t.status === 'review').length;
          const totalTopics = course.topics.length;
          const pct = totalTopics > 0 ? Math.round((doneTopics / totalTopics) * 100) : 0;
          const scheme = courseColors[course.color];

          return (
            <motion.div
              key={course.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: isActive ? 1 : 0.985,
              }}
              transition={UNIPEDIA_SPRING}
              className={cx(
                'relative overflow-hidden rounded-[22px] border border-[#141312]/10 transition-shadow dark:border-white/10',
                idx > 0 && '-mt-3',
                scheme.block,
                isActive ? 'z-20 shadow-float ring-1 ring-[#141312]/15 dark:ring-white/15' : 'z-10 opacity-95',
              )}
            >
              {/* Rabisco orgânico discreto de caderno — à esquerda do % para nunca sobrepor números */}
              <svg
                aria-hidden="true"
                viewBox="0 0 120 60"
                className="pointer-events-none absolute right-14 bottom-1 h-14 w-24 opacity-15"
                fill="none"
              >
                <path
                  d="M8 46C24 22 44 50 62 24C74 7 92 38 112 18"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>

              <button
                type="button"
                onClick={() => (isActive ? onOpenCourse(course.id) : choose(course.id))}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/65 px-2 py-0.5 font-mono text-xs font-bold text-[#141312] dark:bg-black/30 dark:text-[#FAF6EC]">
                      {course.shortName}
                    </span>
                    <span className="text-xs font-semibold opacity-75 tabular">{course.ects} ECTS</span>
                  </div>
                  <p className="mt-1.5 truncate font-display text-base font-bold">{course.name}</p>
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-medium opacity-80">
                        {totalTopics > 0
                          ? `${doneTopics}/${totalTopics} tópicos estudados (${pct}%)`
                          : 'Pronta para organizar tópicos e apontamentos'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#141312] px-3 py-1 font-semibold text-[#FAF8F2] dark:bg-[#FAF6EC] dark:text-[#141312]">
                        Abrir pasta
                        <ArrowRight size={13} aria-hidden="true" />
                      </span>
                    </motion.div>
                  )}
                </div>
                <span className="min-w-10 shrink-0 text-right font-mono text-sm font-bold tabular">
                  {pct}%
                </span>
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
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
      className={cx('inline-flex flex-wrap items-center gap-1 rounded-full bg-surface-2 p-1', className)}
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
              'relative rounded-full px-3.5 py-2 text-xs font-semibold transition-colors',
              active ? 'text-ink-cta-fg' : 'text-muted hover:text-fg',
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
                <span className={cx('tabular text-xs', active ? 'opacity-85' : 'text-muted')}>
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
