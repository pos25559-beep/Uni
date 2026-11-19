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

function Chip({ children, tone = 'sky' }: { children: ReactNode; tone?: 'sky' | 'mint' | 'butter' | 'peach' }) {
  const bg = { sky: 'bg-pastel-sky', mint: 'bg-pastel-mint', butter: 'bg-pastel-butter', peach: 'bg-pastel-peach' }[tone];
  const dot = { sky: 'bg-[#1D63D8]', mint: 'bg-accent', butter: 'bg-[#C77700]', peach: 'bg-coral' }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ${bg} px-2.5 py-0.5 text-xs font-semibold text-fg`}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

/** Ecrã «Hoje» da app, desenhado em HTML (nítido em qualquer tamanho, também dentro da cena 3D). */
export function TodayScreen() {
  const m = useCopy().mock;
  const rows = [
    { course: m.course1, tone: 'sky' as const, time: '17:00', topic: m.topic1, min: 25, done: false, active: true },
    { course: m.course2, tone: 'mint' as const, time: '18:30', topic: m.topic2, min: 25, done: false },
    { course: m.course3, tone: 'butter' as const, time: '19:05', topic: m.topic3, min: 25, done: false },
  ];
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-bg px-4 pb-3 pt-9 text-fg">
      <div className="flex items-center gap-2">
        <div className="grid size-8 place-items-center rounded-full bg-pastel-sage">
          <UniFace size={26} />
        </div>
        <span className="truncate text-xs text-muted">{m.today} · {m.week.toLowerCase()}</span>
      </div>
      <p className="font-display mt-3 text-[22px] font-bold leading-tight">
        {m.greeting} <em className="font-serif font-normal italic text-accent-ink">{m.name}</em>
      </p>
      <div className="mt-3 flex rounded-full bg-surface-2 p-1 text-xs font-semibold">
        <span className="flex-1 rounded-full bg-surface py-1.5 text-center shadow-card">{m.today} 3</span>
        <span className="flex-1 py-1.5 text-center text-muted">{m.week}</span>
      </div>
      <div className="mt-3 overflow-hidden rounded-[18px] border border-line bg-surface">
        <div className="flex items-center justify-between bg-pastel-sage px-3 py-2.5">
          <span className="text-sm font-bold">✦ {m.focusToday}</span>
          <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold">{m.openPlan} →</span>
        </div>
        <div className="paper-lines space-y-2 p-2.5">
          {rows.map((r) => (
            <div
              key={r.topic}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${r.active ? 'bg-pastel-butter/60 ring-1 ring-fg/10' : 'bg-surface-2'}`}
            >
              <span className={`size-5 shrink-0 rounded-full border-2 ${r.active ? 'border-accent' : 'border-muted/50'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Chip tone={r.tone}>{r.course}</Chip>
                  <span className="font-mono text-xs text-muted">{r.time}</span>
                </div>
                <p className="mt-0.5 truncate text-[13px] font-medium">{r.topic}</p>
              </div>
              <span className="font-mono text-xs text-muted">{r.min}′</span>
            </div>
          ))}
          <p className="px-1 pt-0.5 text-xs leading-snug text-muted">{m.why}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-around rounded-full bg-ink-cta px-2 py-2 text-ink-cta-fg">
        {m.dock.map((d, i) => (
          <span
            key={d}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${i === 2 ? 'bg-ink-cta-fg text-ink-cta' : 'opacity-70'}`}
          >
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Moldura de telemóvel em CSS (usada quando a cena 3D não corre). */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative aspect-[9/19] w-[min(300px,72vw)] rounded-[44px] bg-[#141312] p-[10px] shadow-[0_40px_80px_-30px_rgba(20,19,18,0.45)] ${className ?? ''}`}
    >
      <div className="absolute left-1/2 top-[18px] z-10 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-[#141312]" />
      <div className="h-full w-full overflow-hidden rounded-[35px]">{children}</div>
    </div>
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
