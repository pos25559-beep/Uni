import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useCopy } from './i18n';
import { Chip, UniFace } from './ui';

/**
 * Ecrãs da app desenhados em HTML com os textos reais da app (copy.app) e uma demonstração
 * que os percorre. Substitui a cena 3D: é nítido, leve e lê-se bem em qualquer ecrã.
 */

export type ScreenId = 'hoje' | 'plano' | 'foco' | 'pratica' | 'progresso' | 'uni';
export const SCREENS: ScreenId[] = ['hoje', 'plano', 'foco', 'pratica', 'progresso', 'uni'];

/* ------------------------------------------------------------------ moldura */

export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative aspect-[9/19] w-[min(300px,74vw)] rounded-[46px] bg-[#141312] p-[10px] shadow-[0_50px_90px_-35px_rgba(20,19,18,0.5)] ring-1 ring-black/5 dark:ring-white/10 ${className ?? ''}`}
    >
      <div className="absolute left-1/2 top-[17px] z-20 h-[24px] w-[88px] -translate-x-1/2 rounded-full bg-[#141312]" />
      <div className="relative h-full w-full overflow-hidden rounded-[36px] bg-bg">{children}</div>
    </div>
  );
}

function Shell({ children, dockIndex }: { children: ReactNode; dockIndex?: number }) {
  const m = useCopy().mock;
  return (
    <div className="flex h-full w-full flex-col px-4 pb-3 pt-11 text-fg">
      <div className="min-h-0 flex-1">{children}</div>
      {dockIndex !== undefined && (
        <div className="mt-2 grid grid-cols-5 items-center gap-0.5 rounded-full bg-ink-cta p-1 text-ink-cta-fg">
          {m.dock.map((d, i) => (
            <span key={d} className={`truncate rounded-full py-1.5 text-center text-xs font-medium tracking-tight ${i === dockIndex ? 'bg-ink-cta-fg text-ink-cta' : 'opacity-70'}`}>
              {d}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Title({ lead, em }: { lead: string; em: string }) {
  return (
    <p className="font-display text-[22px] font-bold leading-tight">
      {lead} <em className="font-serif font-normal italic text-accent-ink">{em}</em>
    </p>
  );
}

/* ------------------------------------------------------------------ ecrãs */

export function TodayScreen({ active = true }: { active?: boolean }) {
  const m = useCopy().mock;
  const rows = [
    { course: m.course1, tone: 'sky' as const, time: '17:00', topic: m.topic1 },
    { course: m.course2, tone: 'mint' as const, time: '18:30', topic: m.topic2 },
    { course: m.course3, tone: 'butter' as const, time: '19:05', topic: m.topic3 },
  ];
  return (
    <Shell dockIndex={2}>
      <div className="flex items-center gap-2">
        <div className="grid size-8 place-items-center rounded-full bg-pastel-sage">
          <UniFace size={26} />
        </div>
        <span className="truncate text-xs text-muted">{m.today} · {m.week.toLowerCase()}</span>
      </div>
      <div className="mt-2.5">
        <Title lead={m.greeting} em={m.name} />
      </div>
      <div className="mt-3 flex gap-1.5">
        {['10', '25', '50'].map((n, i) => (
          <span key={n} className={`flex-1 rounded-full border py-1.5 text-center text-xs font-semibold ${i === 1 ? 'border-fg bg-surface' : 'border-line bg-surface/70'}`}>
            ⚡ {n} min
          </span>
        ))}
      </div>
      <div className="mt-3 overflow-hidden rounded-[18px] border border-line bg-surface">
        <div className="flex items-center justify-between bg-pastel-sage px-3 py-2.5">
          <span className="text-sm font-bold">✦ {m.focusToday}</span>
          <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold">{m.openPlan} →</span>
        </div>
        <div className="paper-lines space-y-2 p-2.5">
          {rows.map((r, i) => (
            <motion.div
              key={r.topic}
              initial={false}
              animate={active ? { opacity: 1, y: 0 } : { opacity: 0.6, y: 4 }}
              transition={{ delay: active ? 0.12 * i : 0, duration: 0.4 }}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${i === 0 ? 'bg-pastel-butter ring-1 ring-fg/10' : 'bg-surface-2'}`}
            >
              <span className={`size-5 shrink-0 rounded-full border-2 ${i === 0 ? 'border-accent' : 'border-muted/50'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Chip tone={r.tone}>{r.course}</Chip>
                  <span className="font-mono text-xs text-muted">{r.time}</span>
                </div>
                <p className="mt-0.5 truncate text-[13px] font-medium">{r.topic}</p>
              </div>
              <span className="font-mono text-xs text-muted">25′</span>
            </motion.div>
          ))}
          <p className="px-1 pt-0.5 text-xs leading-snug text-muted">{m.why}</p>
        </div>
      </div>
    </Shell>
  );
}

export function PlanScreen({ active = true }: { active?: boolean }) {
  const { mock: m, app } = useCopy();
  const load = [2, 3, 1, 3, 2, 1, 0];
  const tones = ['bg-pastel-sky', 'bg-pastel-mint', 'bg-pastel-butter', 'bg-pastel-peach'];
  const [replanned, setReplanned] = useState(false);
  useEffect(() => {
    if (!active) return setReplanned(false);
    const t = setTimeout(() => setReplanned(true), 1800);
    return () => clearTimeout(t);
  }, [active]);
  return (
    <Shell dockIndex={1}>
      <Title lead={app.plan.title} em={app.plan.titleEm} />
      <div className="mt-3 flex rounded-full bg-surface-2 p-1 text-xs font-semibold">
        <span className="flex-1 rounded-full bg-surface py-1.5 text-center shadow-card">{app.plan.auto}</span>
        <span className="flex-1 py-1.5 text-center text-muted">{app.plan.manual}</span>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {m.days.map((d, i) => (
          <div key={d} className="flex flex-col items-center gap-1">
            <span className={`font-mono text-xs ${i === 3 ? 'font-bold' : 'text-muted'}`}>{d.slice(0, 1)}</span>
            <div className={`flex h-28 w-full flex-col justify-end gap-1 rounded-lg p-0.5 ${i === 3 ? 'bg-accent-soft' : 'bg-surface-2/70'}`}>
              {Array.from({ length: load[i] + (replanned && (i === 3 || i === 5) ? 1 : 0) }).map((_, j) => (
                <motion.span
                  key={j}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: active ? 1 : 0.9 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 24, delay: active ? 0.04 * (i + j) : 0 }}
                  style={{ transformOrigin: 'bottom' }}
                  className={`block h-4 rounded ${tones[(i + j) % tones.length]} ring-1 ring-fg/10`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl bg-coral-soft p-3">
        <p className="text-xs font-semibold text-coral-ink">{app.plan.behind}</p>
        <p className="mt-1 truncate text-[13px] font-medium">{m.course1} · {m.topic1}</p>
        <div className="mt-2 flex gap-1.5">
          <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold">{app.plan.fit}</span>
          <span className="truncate rounded-full px-2 py-1 text-xs text-muted">{app.plan.moveToday}</span>
        </div>
      </div>
      <AnimatePresence>
        {replanned && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 flex items-center justify-between rounded-full bg-ink-cta px-3 py-2 text-xs text-ink-cta-fg"
          >
            <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[#4ADE80]" />{app.plan.replanned}</span>
            <span className="font-semibold underline underline-offset-2">{app.plan.undo}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}

export function FocusScreen({ active = true }: { active?: boolean }) {
  const { mock: m, app } = useCopy();
  const reduce = useReducedMotion();
  const [secs, setSecs] = useState(8 * 60 + 12);
  useEffect(() => {
    if (!active || reduce) return;
    const t = setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [active, reduce]);
  const total = 25 * 60;
  const r = 70;
  const c = 2 * Math.PI * r;
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  return (
    <Shell>
      <div className="flex justify-center">
        <Chip tone="sky">{m.course1}</Chip>
      </div>
      <p className="mt-2 text-center text-[15px] font-semibold leading-snug">{m.topic1}</p>
      <div className="relative mx-auto mt-4 grid size-48 place-items-center">
        <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="80" cy="80" r={r} stroke="var(--surface-2)" strokeWidth="8" fill="none" />
          <circle
            cx="80"
            cy="80"
            r={r}
            stroke="var(--accent)"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={c * (secs / total)}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <span className="font-mono text-[40px] font-semibold tabular">{mm}:{ss}</span>
      </div>
      <div className="mt-4 flex items-center justify-center gap-2">
        <span className="rounded-full bg-ink-cta px-4 py-2 text-xs font-semibold text-ink-cta-fg">❚❚ {app.focus.pause}</span>
        <span className="rounded-full border border-line px-3 py-2 text-xs font-semibold">+ 5 min</span>
        <span className="px-2 py-2 text-xs font-semibold">✓ {app.focus.finish}</span>
      </div>
      <div className="mt-4 rounded-2xl border border-line bg-surface p-3">
        <p className="flex items-center justify-between text-xs font-semibold">
          {app.focus.shield}
          <span className="rounded-full bg-surface-2 px-2 py-0.5 font-normal text-muted">{app.focus.optional}</span>
        </p>
        <div className="mt-2 flex gap-1.5">
          {[app.focus.silence, app.focus.rain, app.focus.white].map((s, i) => (
            <span key={s} className={`flex-1 truncate rounded-full px-2 py-1.5 text-center text-xs ${i === 1 ? 'bg-accent-soft font-semibold text-accent-ink ring-1 ring-accent' : 'bg-surface-2'}`}>
              {s}
            </span>
          ))}
        </div>
      </div>
    </Shell>
  );
}

export function PracticeScreen({ active = true }: { active?: boolean }) {
  const { mock: m, app } = useCopy();
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!active) return setStage(0);
    const a = setTimeout(() => setStage(1), 1500);
    const b = setTimeout(() => setStage(2), 3200);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [active]);
  return (
    <Shell>
      <p className="font-mono text-xs uppercase tracking-wider text-muted">{app.focus.done}</p>
      <p className="mt-1 text-[15px] font-semibold">{m.topic1}</p>
      <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
        <p className="font-display text-lg font-bold leading-snug">{m.question}</p>
        <AnimatePresence mode="wait" initial={false}>
          {stage >= 1 ? (
            <motion.div key="a" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="mt-3 font-mono text-[15px]">2x · sin x + x² · cos x</p>
              <p className="mt-1 text-xs text-muted">📎 {m.source}</p>
            </motion.div>
          ) : (
            <motion.span key="b" exit={{ opacity: 0 }} className="mt-3 inline-block rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold">
              {app.practice.reveal}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-3 space-y-1.5">
        {[
          { label: m.again, hint: app.practice.againHint, on: 'bg-coral-soft ring-coral' },
          { label: m.effort, hint: app.practice.effortHint, on: 'bg-accent-soft ring-accent' },
          { label: m.mastered, hint: app.practice.masteredHint, on: 'bg-accent-soft ring-accent' },
        ].map((b, i) => (
          <div key={b.label} className={`rounded-xl px-3 py-2 transition-colors ${stage === 2 && i === 2 ? `${b.on} ring-1` : 'bg-surface-2'}`}>
            <p className="text-[13px] font-semibold">{b.label}</p>
            <p className="truncate text-xs text-muted">{b.hint}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted">+ {app.practice.newCard}</p>
    </Shell>
  );
}

export function ProgressScreen({ active = true }: { active?: boolean }) {
  const { mock: m, app } = useCopy();
  const bars = [0.4, 0.75, 0.55, 0.9, 0.3, 0.65, 0.2];
  const rows = [
    { name: m.course1, v: 0.78, tone: 'bg-accent' },
    { name: m.course2, v: 0.46, tone: 'bg-coral' },
    { name: m.course3, v: 0.64, tone: 'bg-accent' },
  ];
  return (
    <Shell dockIndex={4}>
      <div className="rounded-2xl bg-pastel-sky p-3.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-fg/70">{app.progress.overall}</p>
        <div className="mt-1 flex items-end justify-between">
          <span className="font-mono text-4xl font-bold tabular">62%</span>
          <span className="text-right font-mono text-xs leading-relaxed">
            {app.progress.streak}: 4d<br />
            {app.progress.reviews}: 6
          </span>
        </div>
      </div>
      <div className="mt-3 rounded-2xl bg-pastel-mint p-3">
        <p className="text-xs font-semibold">{app.progress.perDay}</p>
        <div className="mt-2 flex h-20 items-end gap-1.5">
          {bars.map((v, i) => (
            <motion.span
              key={i}
              className="flex-1 rounded-t-md bg-accent"
              initial={{ height: 0 }}
              animate={{ height: active ? `${v * 100}%` : '10%' }}
              transition={{ duration: 0.8, delay: active ? i * 0.06 : 0, ease: [0.22, 0.8, 0.26, 1] }}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 space-y-2 rounded-2xl border border-line bg-surface p-3">
        <p className="text-xs font-semibold">{app.progress.retention} · <span className="font-normal text-muted">{m.estimate}</span></p>
        {rows.map((r, i) => (
          <div key={r.name}>
            <div className="flex justify-between text-xs">
              <span className="font-medium">{r.name}</span>
              <span className="font-mono text-muted">≈ {Math.round(r.v * 100)}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
              <motion.div
                className={`h-full rounded-full ${r.tone}`}
                initial={{ width: 0 }}
                animate={{ width: active ? `${r.v * 100}%` : '5%' }}
                transition={{ duration: 0.9, delay: active ? 0.3 + i * 0.12 : 0 }}
              />
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function UniScreen({ active = true }: { active?: boolean }) {
  const { uni, app } = useCopy();
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState(reduce ? uni.chatA.length : 0);
  const [asked, setAsked] = useState(Boolean(reduce));
  useEffect(() => {
    if (reduce) return;
    if (!active) {
      setTyped(0);
      setAsked(false);
      return;
    }
    let i = 0;
    const start = setTimeout(() => setAsked(true), 500);
    const t = setInterval(() => {
      i += 3;
      setTyped(Math.min(i, uni.chatA.length));
      if (i >= uni.chatA.length) clearInterval(t);
    }, 40);
    return () => {
      clearTimeout(start);
      clearInterval(t);
    };
  }, [active, reduce, uni.chatA]);
  return (
    <Shell dockIndex={3}>
      <div className="flex items-center gap-2 border-b border-line pb-2.5">
        <div className="grid size-9 place-items-center rounded-full bg-pastel-butter">
          <UniFace size={30} />
        </div>
        <span className="font-display text-base font-bold">Uni</span>
      </div>
      <div className="mt-3 space-y-2.5">
        {asked && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink-cta px-3 py-2 text-[13px] text-ink-cta-fg">
            {uni.chatQ}
          </motion.p>
        )}
        {typed > 0 && (
          <div className="max-w-[94%] rounded-2xl rounded-bl-md bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed">
            {uni.chatA.slice(0, typed)}
            {typed < uni.chatA.length && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-fg/60 align-middle" />}
          </div>
        )}
        {typed >= uni.chatA.length && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line bg-surface p-3">
            <p className="text-xs font-semibold text-accent-ink">✦ {app.uni.proposal}</p>
            <p className="mt-1 text-[13px] font-medium">{app.uni.createSession} · 25 min</p>
            <div className="mt-2 flex gap-1.5">
              <span className="rounded-full bg-ink-cta px-3 py-1.5 text-xs font-semibold text-ink-cta-fg">{app.uni.confirm}</span>
              <span className="px-2 py-1.5 text-xs text-muted">{app.uni.cancel}</span>
            </div>
          </motion.div>
        )}
      </div>
    </Shell>
  );
}

export const SCREEN_COMPONENTS: Record<ScreenId, (p: { active?: boolean }) => ReactNode> = {
  hoje: TodayScreen,
  plano: PlanScreen,
  foco: FocusScreen,
  pratica: PracticeScreen,
  progresso: ProgressScreen,
  uni: UniScreen,
};

/* ------------------------------------------------------------------ telemóvel com inclinação suave */

/** Telemóvel que inclina ligeiramente com o ponteiro (só em ponteiros finos e sem movimento reduzido). */
export function TiltPhone({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), { stiffness: 120, damping: 18 });
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 120, damping: 18 });

  useEffect(() => {
    if (reduce || !window.matchMedia('(pointer: fine)').matches) return;
    const on = (e: PointerEvent) => {
      x.set(e.clientX / window.innerWidth - 0.5);
      y.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('pointermove', on, { passive: true });
    return () => window.removeEventListener('pointermove', on);
  }, [reduce, x, y]);

  return (
    <div ref={ref} style={{ perspective: 1200 }}>
      <motion.div style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}>{children}</motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ demonstração */

const STEP_MS = 5200;

/** Percorre os ecrãs da app sozinha; os separadores saltam para um ecrã e o botão pausa. */
export function AppDemo({ start = 'hoje', screens = SCREENS }: { start?: ScreenId; screens?: ScreenId[] }) {
  const { demo } = useCopy();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(Math.max(0, screens.indexOf(start)));
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(true);
  const wrap = useRef<HTMLDivElement>(null);
  const current = screens[index];
  const running = playing && inView && !reduce;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % screens.length), STEP_MS);
    return () => clearTimeout(t);
  }, [running, index, screens.length]);

  const Screen = SCREEN_COMPONENTS[current];

  return (
    <div ref={wrap} className="flex flex-col items-center">
      <div className="relative">
        {/* Post-its de papel atrás do telemóvel. */}
        <span aria-hidden="true" className="absolute -left-10 top-16 size-20 rotate-[-10deg] rounded-md bg-pastel-butter shadow-card ring-1 ring-fg/5 sm:-left-16 sm:size-24" />
        <span aria-hidden="true" className="absolute -right-8 top-8 size-16 rotate-[12deg] rounded-md bg-pastel-mint shadow-card ring-1 ring-fg/5 sm:-right-14 sm:size-20" />
        <span aria-hidden="true" className="absolute -right-10 bottom-24 size-20 rotate-[-6deg] rounded-md bg-pastel-peach shadow-card ring-1 ring-fg/5 sm:-right-16" />
        <span aria-hidden="true" className="absolute -left-8 bottom-12 size-14 rotate-[8deg] rounded-md bg-pastel-sky shadow-card ring-1 ring-fg/5 sm:-left-12 sm:size-16" />
        <TiltPhone>
          <PhoneFrame>
            <div role="img" aria-label={`${demo.label}: ${demo.tabs[current]}. ${demo.captions[current]}`} className="h-full w-full">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current}
                  className="h-full w-full"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.32, ease: [0.22, 0.8, 0.26, 1] }}
                >
                  <Screen active />
                </motion.div>
              </AnimatePresence>
            </div>
          </PhoneFrame>
        </TiltPhone>
      </div>

      <div className="mt-7 flex w-full max-w-md items-center gap-2">
        <div role="tablist" aria-label={demo.tabsLabel} className="no-scrollbar flex flex-1 gap-1 overflow-x-auto rounded-full bg-surface-2 p-1">
          {screens.map((id, i) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => setIndex(i)}
              className={`relative min-h-11 shrink-0 overflow-hidden rounded-full px-3.5 text-xs font-semibold transition-colors ${i === index ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg'}`}
            >
              {demo.tabs[id]}
              {i === index && running && (
                <motion.span
                  key={`p-${index}`}
                  aria-hidden="true"
                  className="absolute inset-x-3 bottom-1.5 h-0.5 origin-left rounded-full bg-accent"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: STEP_MS / 1000, ease: 'linear' }}
                />
              )}
            </button>
          ))}
        </div>
        {!reduce && (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? demo.pause : demo.play}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-fg hover:bg-surface-2"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              {playing ? <path d="M3.5 2.5v9M10.5 2.5v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> : <path d="M4 2.5l7.5 4.5L4 11.5z" fill="currentColor" />}
            </svg>
          </button>
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={current}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          aria-live="polite"
          className="mt-3 min-h-12 max-w-sm text-center text-sm leading-snug text-muted"
        >
          {demo.captions[current]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
