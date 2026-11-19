import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { useCopy } from './i18n';

export const SPRING = { type: 'spring', stiffness: 380, damping: 24, mass: 0.85 } as const;

/** Entra suavemente quando aparece no ecrã (respeita movimento reduzido). */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: [0.22, 0.8, 0.26, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHead({
  kicker,
  title,
  em,
  sub,
  id,
  align = 'left',
}: {
  kicker: string;
  title: string;
  em?: string;
  sub?: string;
  id?: string;
  align?: 'left' | 'center';
}) {
  return (
    <Reveal className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-muted">{kicker}</p>
      <h2 id={id} className="font-display mt-3 text-[clamp(2rem,5.2vw,3.4rem)] font-bold leading-[1.02] text-fg">
        {title}
        {em && <> <em className="font-serif font-normal italic text-accent-ink">{em}</em></>}
      </h2>
      {sub && <p className="mt-4 text-lg leading-relaxed text-muted">{sub}</p>}
    </Reveal>
  );
}

/** O Uni (mesmo desenho do logótipo), com respiração e piscar. */
export function UniFace({ size = 120, mood = 'happy', className }: { size?: number; mood?: 'happy' | 'calm'; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="4 4 56 56"
      fill="none"
      aria-hidden="true"
      className={className}
      animate={reduce ? undefined : { y: [0, -3, 0], scaleY: [1, 1.025, 1] }}
      transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <path d="M29 14.5V7.5L32.5 10.5L36 7.5V14.5" fill="#E04F33" stroke="#141312" strokeWidth="1.6" strokeLinejoin="round" />
      <path
        d="M32 13.5C36.4 13.5 39.6 16.3 42.1 17.7C45.1 19.3 48.7 19.9 50.5 23.1C52.3 26.2 51.1 30 51.9 33.5C52.7 37 55.2 40.2 53.7 43.9C52.2 47.4 48.2 48.7 45.2 50.9C42.2 53.1 39.7 56.8 35.7 57C31.8 57.1 28.9 53.9 25.3 53C21.7 52.1 17.2 53.4 14.5 50.6C11.9 47.7 13 43.2 12 39.4C11 35.7 8.4 32.3 9.9 28.5C11.3 24.8 15.6 24.2 18.3 21.3C21 18.4 22.1 14.5 26 13.7C28.1 13.3 30.1 13.5 32 13.5Z"
        fill={mood === 'calm' ? '#BCEEE0' : '#C9DC9F'}
        stroke="#141312"
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
      <circle cx="22.8" cy="37.6" r="2.6" fill="#E04F33" fillOpacity="0.45" />
      <circle cx="41.2" cy="37.6" r="2.6" fill="#E04F33" fillOpacity="0.45" />
      <motion.g
        animate={reduce ? undefined : { scaleY: [1, 1, 0.1, 1, 1] }}
        transition={{ duration: 4.2, repeat: Infinity, times: [0, 0.9, 0.93, 0.96, 1] }}
        style={{ transformOrigin: '32px 32.4px' }}
      >
        <circle cx="25.2" cy="32.4" r="2.4" fill="#141312" />
        <circle cx="38.8" cy="32.4" r="2.4" fill="#141312" />
        <circle cx="26" cy="31.5" r="0.8" fill="#FFFFFF" />
        <circle cx="39.6" cy="31.5" r="0.8" fill="#FFFFFF" />
      </motion.g>
      <path d="M27.4 38.4C29.1 41.7 34.9 41.7 36.6 38.4" stroke="#141312" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="51" cy="13.5" r="4" fill="#FCE99F" stroke="#141312" strokeWidth="1.5" />
    </motion.svg>
  );
}

/* ------------------------------------------------------------------ recortes da app */

export function Chip({ children, tone = 'sky' }: { children: ReactNode; tone?: 'sky' | 'mint' | 'butter' | 'peach' }) {
  const bg = { sky: 'bg-pastel-sky', mint: 'bg-pastel-mint', butter: 'bg-pastel-butter', peach: 'bg-pastel-peach' }[tone];
  const dot = { sky: 'bg-[#1D63D8]', mint: 'bg-accent', butter: 'bg-[#C77700]', peach: 'bg-coral' }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ${bg} px-2.5 py-0.5 text-xs font-semibold text-fg`}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

export function PlanWeek() {
  const m = useCopy().mock;
  const load = [2, 3, 2, 3, 1, 1, 0];
  const tones = ['bg-pastel-sky', 'bg-pastel-mint', 'bg-pastel-butter', 'bg-pastel-peach'];
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {m.days.map((d, i) => (
        <div key={d} className="flex flex-col items-center gap-1.5">
          <span className={`font-mono text-xs ${i === 3 ? 'font-bold text-fg' : 'text-muted'}`}>{d}</span>
          <div className="flex h-24 w-full flex-col justify-end gap-1 rounded-xl bg-surface/70 p-1">
            {Array.from({ length: load[i] }).map((_, j) => (
              <motion.span
                key={j}
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true }}
                transition={{ ...SPRING, delay: 0.05 * (i + j) }}
                style={{ transformOrigin: 'bottom' }}
                className={`block h-5 rounded-md ${tones[(i + j) % tones.length]} ring-1 ring-fg/10`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FocusRing({ progress = 0.68, label = '08:00' }: { progress?: number; label?: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto grid size-44 place-items-center">
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} stroke="var(--surface-2)" strokeWidth="7" fill="none" />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          stroke="var(--accent)"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - progress) }}
          viewport={{ once: true }}
          transition={{ duration: 1.8, ease: [0.22, 0.8, 0.26, 1] }}
        />
      </svg>
      <span className="font-mono text-4xl font-semibold tabular">{label}</span>
    </div>
  );
}

export function RetentionBars() {
  const m = useCopy().mock;
  const rows = [
    { name: m.course1, v: 0.78, tone: 'bg-accent' },
    { name: m.course2, v: 0.46, tone: 'bg-coral' },
    { name: m.course3, v: 0.64, tone: 'bg-accent' },
  ];
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.name}>
          <div className="flex justify-between text-sm">
            <span className="font-medium">{r.name}</span>
            <span className="font-mono tabular text-muted">≈ {Math.round(r.v * 100)} %</span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface/80">
            <motion.div
              className={`h-full rounded-full ${r.tone}`}
              initial={{ width: 0 }}
              whileInView={{ width: `${r.v * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.1, delay: 0.15 * i, ease: [0.22, 0.8, 0.26, 1] }}
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-muted">
        {m.retention} · {m.estimate}
      </p>
    </div>
  );
}
