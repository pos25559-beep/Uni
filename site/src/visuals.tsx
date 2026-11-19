import { motion, useReducedMotion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { useCopy } from './i18n';
import type { FeatureId } from './routes';
import { PracticeCard } from './sections/How';
import { Chip, FocusRing, PlanWeek, RetentionBars, SPRING, UniFace } from './ui';

/** Recortes da app usados nas secções das páginas de cada área (um por secção, pela ordem do texto). */

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[22px] bg-surface p-4 shadow-card ring-1 ring-line sm:p-5 ${className ?? ''}`}>{children}</div>;
}

function Pill({ children, active, tone = 'accent' }: { children: ReactNode; active?: boolean; tone?: 'accent' | 'ink' }) {
  const on = tone === 'ink' ? 'bg-ink-cta text-ink-cta-fg' : 'bg-accent-soft text-accent-ink ring-1 ring-accent';
  return <span className={`inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-semibold ${active ? on : 'bg-surface-2 text-fg'}`}>{children}</span>;
}

/* ------------------------------------------------------------------ Plano */

function PlanBehind() {
  const { mock: m, app } = useCopy();
  const [choice, setChoice] = useState<number | null>(null);
  const options = [app.plan.fit, app.plan.moveToday, app.plan.discard];
  return (
    <Panel>
      <div className="rounded-2xl bg-coral-soft p-4">
        <p className="text-sm font-semibold text-coral-ink">{app.plan.behind}</p>
        <div className="mt-2 flex items-center gap-2">
          <Chip tone="sky">{m.course1}</Chip>
          <span className="font-mono text-xs text-muted">40 min</span>
        </div>
        <p className="mt-1 font-medium">{m.topic1}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((o, i) => (
            <button key={o} type="button" onClick={() => setChoice(i)} aria-pressed={choice === i} className="min-h-11 rounded-full">
              <Pill active={choice === i} tone="ink">{o}</Pill>
            </button>
          ))}
        </div>
      </div>
      <motion.div
        initial={false}
        animate={{ opacity: choice === null ? 0.35 : 1, y: choice === null ? 4 : 0 }}
        className="mt-3 flex items-center justify-between rounded-full bg-ink-cta px-4 py-2.5 text-sm text-ink-cta-fg"
      >
        <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#4ADE80]" />{app.plan.replanned}</span>
        <span className="font-semibold underline underline-offset-4">{app.plan.undo}</span>
      </motion.div>
    </Panel>
  );
}

function PlanModes() {
  const { app } = useCopy();
  const [auto, setAuto] = useState(true);
  return (
    <Panel>
      <div className="flex rounded-full bg-surface-2 p-1 text-sm font-semibold">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={auto === v}
            onClick={() => setAuto(v)}
            className={`min-h-11 flex-1 rounded-full transition-colors ${auto === v ? 'bg-surface shadow-card' : 'text-muted'}`}
          >
            {v ? app.plan.auto : app.plan.manual}
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {['10', '25', '50'].map((n, i) => (
          <span key={n} className={`rounded-2xl py-4 text-center font-mono text-lg font-semibold ${i === 1 ? 'bg-pastel-butter ring-1 ring-fg/10' : 'bg-surface-2'}`}>
            ⚡ {n}′
          </span>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-muted">
        <span className={`size-2 rounded-full ${auto ? 'bg-accent' : 'bg-muted'}`} />
        {auto ? app.plan.replanned : app.plan.manual}
      </p>
    </Panel>
  );
}

function DiaryTabs({ example }: { example: string }) {
  const { app } = useCopy();
  const tabs = [app.uni.tabClass, app.uni.tabDay, app.uni.tabWeek, app.uni.tabExam];
  const [tab, setTab] = useState(3);
  return (
    <Panel>
      <div role="tablist" className="flex gap-1 rounded-full bg-surface-2 p-1">
        {tabs.map((t, i) => (
          <button key={t} type="button" role="tab" aria-selected={tab === i} onClick={() => setTab(i)} className={`min-h-11 flex-1 rounded-full text-sm font-semibold ${tab === i ? 'bg-surface shadow-card' : 'text-muted'}`}>
            {t}
          </button>
        ))}
      </div>
      <p className="ml-auto mt-4 w-fit max-w-[90%] rounded-2xl rounded-br-md bg-ink-cta px-4 py-3 text-sm leading-relaxed text-ink-cta-fg">
        {example.replace(/^«|»$/g, '')}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-pastel-sage">
          <UniFace size={34} />
        </div>
        <span className="flex gap-1 rounded-2xl rounded-tl-md bg-surface-2 px-4 py-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <motion.span key={i} className="size-1.5 rounded-full bg-fg/50" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </span>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ Foco */

function FocusPanel() {
  const { app } = useCopy();
  return (
    <Panel className="py-6">
      <FocusRing progress={0.68} label="08:00" />
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Pill tone="ink" active>▷ {app.focus.start}</Pill>
        <Pill>+ 5 min</Pill>
        <Pill>✓ {app.focus.finish}</Pill>
      </div>
    </Panel>
  );
}

function ShieldPanel() {
  const { app } = useCopy();
  const [on, setOn] = useState<boolean[]>([true, true]);
  const items = [
    { label: app.focus.fullscreen, icon: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' },
    { label: app.focus.awake, icon: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 15h2' },
  ];
  return (
    <Panel>
      <p className="flex items-center justify-between font-semibold">
        <span className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" /></svg>
          {app.focus.shield}
        </span>
        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted">{app.focus.optional}</span>
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {items.map((it, i) => (
          <button
            key={it.label}
            type="button"
            aria-pressed={on[i]}
            onClick={() => setOn((v) => v.map((x, j) => (j === i ? !x : x)))}
            className={`flex min-h-20 flex-col items-start justify-between rounded-2xl p-3 text-left text-sm font-semibold transition-colors ${on[i] ? 'bg-accent-soft text-accent-ink ring-1 ring-accent' : 'bg-surface-2 text-fg'}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d={it.icon} /></svg>
            {it.label}
          </button>
        ))}
      </div>
    </Panel>
  );
}

function SoundPanel() {
  const { app } = useCopy();
  const reduce = useReducedMotion();
  const [sel, setSel] = useState(1);
  const opts = [app.focus.silence, app.focus.rain, app.focus.white];
  return (
    <Panel>
      <p className="font-semibold">{app.focus.sound}</p>
      <div className="mt-4 flex h-16 items-center justify-center gap-1" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <motion.span
            key={i}
            className="w-1.5 rounded-full bg-accent"
            animate={sel === 0 || reduce ? { height: 4 } : { height: [8, 18 + ((i * 7) % 30), 8] }}
            transition={{ duration: sel === 2 ? 0.5 : 1.4, repeat: Infinity, delay: (i % 6) * 0.08, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {opts.map((o, i) => (
          <button key={o} type="button" aria-pressed={sel === i} onClick={() => setSel(i)} className="min-h-11 rounded-full">
            <Pill active={sel === i}>{o}</Pill>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function HonestPanel() {
  const { app } = useCopy();
  return (
    <Panel className="space-y-3">
      <p className="rounded-2xl bg-accent-soft px-4 py-3 text-center font-semibold text-accent-ink">✓ {app.focus.clean}</p>
      <div className="rounded-2xl border border-line p-4">
        <p className="font-semibold">{app.focus.early}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill tone="ink" active>18 min</Pill>
          <Pill>{app.focus.keep}</Pill>
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ Prática */

function ExplainPanel() {
  const { mock: m, app } = useCopy();
  const [shown, setShown] = useState(false);
  return (
    <Panel>
      <p className="font-display text-lg font-bold">{m.question}</p>
      <div className="mt-3 min-h-20 rounded-2xl border border-dashed border-line bg-bg p-3 font-mono text-sm text-muted">
        (uv)′ = u′v + uv′ …
        <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-fg/50 align-middle" />
      </div>
      <button type="button" onClick={() => setShown((v) => !v)} aria-expanded={shown} className="mt-3 min-h-11 rounded-full">
        <Pill tone="ink" active>{app.practice.reveal}</Pill>
      </button>
      {shown && (
        <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="mt-3 font-mono">
          2x · sin x + x² · cos x
        </motion.p>
      )}
    </Panel>
  );
}

function RatingPanel() {
  const { mock: m, app } = useCopy();
  const rows = [
    { label: m.again, hint: app.practice.againHint, days: '1d', tone: 'bg-coral-soft' },
    { label: m.effort, hint: app.practice.effortHint, days: '3d', tone: 'bg-pastel-butter' },
    { label: m.mastered, hint: app.practice.masteredHint, days: '7d+', tone: 'bg-accent-soft' },
  ];
  return (
    <Panel className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className={`flex items-center gap-3 rounded-2xl ${r.tone} px-4 py-3`}>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{r.label}</p>
            <p className="text-sm text-fg/75">{r.hint}</p>
          </div>
          <span className="font-mono text-sm font-semibold">{r.days}</span>
        </div>
      ))}
    </Panel>
  );
}

function QueuePanel() {
  const { mock: m, app } = useCopy();
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-pastel-mint p-4">
        <div>
          <p className="font-semibold">{app.practice.quickReview}</p>
          <p className="font-mono text-sm text-fg/75">{m.cards}</p>
        </div>
        <Pill tone="ink" active>{m.review}</Pill>
      </div>
      <div className="relative mt-3 h-24">
        {[2, 1, 0].map((i) => (
          <div
            key={i}
            className="absolute inset-x-0 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card"
            style={{ top: i * 10, transform: `scale(${1 - i * 0.04})`, zIndex: 3 - i }}
          >
            <p className="truncate text-sm font-medium">{[m.question, m.topic2, m.topic3][i]}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm font-semibold text-accent-ink">+ {app.practice.newCard}</p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ Progresso */

function OverallPanel() {
  const { app } = useCopy();
  return (
    <Panel className="bg-pastel-sky ring-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-fg/70">{app.progress.overall}</p>
      <div className="mt-2 flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-5xl font-bold tabular">62%</p>
          <p className="mt-2 font-mono text-sm leading-relaxed">
            {app.progress.streak}: 4d · {app.progress.retention}: 71%<br />
            {app.progress.reviews}: <span className="underline">6</span>
          </p>
        </div>
        <FocusRingMini value={0.62} />
      </div>
      <div className="mt-4 flex gap-1.5">
        {[app.progress.sevenDays, app.progress.thirtyDays, app.progress.semester].map((t, i) => (
          <span key={t} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${i === 1 ? 'bg-surface' : 'bg-surface/40'}`}>{t}</span>
        ))}
      </div>
    </Panel>
  );
}

function FocusRingMini({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg width="92" height="92" viewBox="0 0 80 80" className="-rotate-90" aria-hidden="true">
      <circle cx="40" cy="40" r={r} stroke="var(--surface)" strokeWidth="7" fill="none" />
      <motion.circle
        cx="40"
        cy="40"
        r={r}
        stroke="var(--accent)"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        whileInView={{ strokeDashoffset: c * (1 - value) }}
        viewport={{ once: true }}
        transition={{ duration: 1.4 }}
      />
    </svg>
  );
}

function DailyPanel() {
  const { app, mock } = useCopy();
  const bars = [0.4, 0.75, 0.55, 1.05, 0.3, 0.65, 0.2];
  return (
    <Panel className="bg-pastel-mint ring-0">
      <p className="font-semibold">{app.progress.perDay}</p>
      <div className="relative mt-4 flex h-36 items-end gap-2">
        <div className="absolute inset-x-0 border-t-2 border-dashed border-fg/30" style={{ bottom: `${(1 / 1.1) * 100}%` }} />
        {bars.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <motion.span
              className="w-full rounded-t-lg bg-accent"
              initial={{ height: 0 }}
              whileInView={{ height: `${(v / 1.1) * 128}px` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: i * 0.06 }}
            />
            <span className="font-mono text-xs text-fg/70">{mock.days[i].slice(0, 1)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PrioritiesPanel({ items }: { items: string[] }) {
  return (
    <Panel>
      <ol className="space-y-2">
        {items.map((t, i) => (
          <li key={t} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-coral font-mono text-sm font-bold text-white">{i + 1}</span>
            <span className="flex-1 font-medium">{t}</span>
            <span aria-hidden="true">→</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/* ------------------------------------------------------------------ Uni */

function SuggestionsPanel() {
  const { uni, app } = useCopy();
  const chips = [uni.chatQ, app.uni.starter2, app.uni.weakL, app.uni.starter3];
  return (
    <Panel>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <span key={c} className="rounded-full border border-line bg-bg px-3.5 py-2 text-sm">{c}</span>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-full border border-line bg-bg p-1.5 pl-4">
        <span className="flex-1 truncate text-sm text-muted">{app.uni.askUni}</span>
        <span className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold">📎 {app.uni.photoPdf}</span>
        <span className="grid size-9 place-items-center rounded-full bg-ink-cta text-ink-cta-fg" aria-hidden="true">↑</span>
      </div>
    </Panel>
  );
}

function ProposalPanel() {
  const { app, mock } = useCopy();
  const [state, setState] = useState<'open' | 'yes' | 'no'>('open');
  return (
    <Panel>
      <p className="text-sm font-semibold text-accent-ink">✦ {app.uni.proposal}</p>
      <div className="mt-3 space-y-2">
        {[
          `${app.uni.createSession} · ${mock.course1} · 25 min`,
          `${app.uni.createFlashcards} · 3`,
          `${app.uni.markDoubt} · ${mock.topic2}`,
        ].map((t, i) => (
          <p key={t} className={`rounded-2xl px-4 py-3 text-sm font-medium ${i === 0 ? 'bg-pastel-butter' : 'bg-surface-2'}`}>{t}</p>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setState('yes')} className="min-h-11 rounded-full">
          <Pill tone="ink" active>{state === 'yes' ? '✓ ' : ''}{app.uni.confirm}</Pill>
        </button>
        <button type="button" onClick={() => setState('no')} className="min-h-11 rounded-full">
          <Pill active={state === 'no'}>{app.uni.cancel}</Pill>
        </button>
      </div>
    </Panel>
  );
}

function NotebookPanel() {
  const { app } = useCopy();
  const modes = [
    { label: app.uni.guide, tone: 'bg-pastel-sky', icon: 'M5 4h10l4 4v12H5zM9 12h6M9 16h6' },
    { label: app.uni.quiz, tone: 'bg-pastel-peach', icon: 'M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.6V14M12 18h.01' },
    { label: app.uni.summary, tone: 'bg-pastel-butter', icon: 'M5 6h14M5 12h10M5 18h7' },
    { label: app.uni.podcast, tone: 'bg-pastel-mint', icon: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3ZM6 11a6 6 0 0 0 12 0M12 17v4' },
  ];
  return (
    <Panel>
      <p className="font-semibold">{app.uni.notebook}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {modes.map((md) => (
          <div key={md.label} className={`flex min-h-24 flex-col justify-between rounded-2xl ${md.tone} p-3`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={md.icon} /></svg>
            <span className="text-sm font-semibold">{md.label}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Visual de cada secção, pela mesma ordem de copy.pages[id].sections. */
export function SectionVisual({ page, index }: { page: FeatureId; index: number }) {
  const copy = useCopy();
  const p = copy.pages[page];
  const visuals: Record<FeatureId, ReactNode[]> = {
    plano: [<Panel key="w"><PlanWeek /></Panel>, <PlanBehind key="b" />, <PlanModes key="m" />, <DiaryTabs key="d" example={p.sections[3].points[0]} />],
    foco: [<FocusPanel key="f" />, <ShieldPanel key="s" />, <SoundPanel key="o" />, <HonestPanel key="h" />],
    pratica: [<PracticeCard key="c" />, <ExplainPanel key="e" />, <RatingPanel key="r" />, <QueuePanel key="q" />],
    progresso: [<OverallPanel key="o" />, <Panel key="r"><RetentionBars /></Panel>, <DailyPanel key="d" />, <PrioritiesPanel key="p" items={[copy.mock.topic2, copy.mock.course2, copy.mock.due]} />],
    uni: [<SuggestionsPanel key="s" />, <ProposalPanel key="p" />, <NotebookPanel key="n" />, <DiaryTabs key="d" example={copy.pages.plano.sections[3].points[0]} />],
  };
  return <>{visuals[page][index]}</>;
}
