import { AnimatePresence, motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { useCopy } from '../i18n';
import { pagePath, useRoute } from '../routes';
import { FocusRing, PlanWeek, Reveal, RetentionBars, SectionHead, SPRING } from '../ui';

export function PromiseStrip() {
  const { promise } = useCopy();
  return (
    <section aria-label={promise.map((p) => `${p.lead} ${p.text}`).join(' ')} className="border-y border-line bg-surface">
      <ol className="mx-auto grid max-w-6xl divide-y divide-line px-4 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0">
        {promise.map((p, i) => (
          <li key={p.lead} className="flex items-baseline gap-4 py-7 md:px-7 md:first:pl-0">
            <span className="font-mono text-sm font-semibold text-coral">0{i + 1}</span>
            <Reveal delay={i * 0.08}>
              <p className="font-display text-xl font-bold leading-snug">
                {p.lead} <span className="font-serif text-[1.15em] font-normal italic text-muted">{p.text}</span>
              </p>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Cartão de prática: toca para revelar, avalia com os 3 botões da app. */
export function PracticeCard() {
  const m = useCopy().mock;
  const [revealed, setRevealed] = useState(false);
  const [rated, setRated] = useState<number | null>(null);
  return (
    <div className="rounded-[20px] bg-surface p-4 shadow-card">
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        aria-expanded={revealed}
        className="block min-h-28 w-full rounded-2xl bg-bg p-4 text-left ring-1 ring-line transition-colors hover:ring-fg/20"
      >
        <p className="font-display text-lg font-bold">{m.question}</p>
        <AnimatePresence initial={false} mode="wait">
          {revealed ? (
            <motion.div key="a" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING}>
              <p className="mt-2 font-mono text-base">2x · sin x + x² · cos x</p>
              <p className="mt-1.5 text-xs text-muted">{m.source}</p>
            </motion.div>
          ) : (
            <motion.p key="h" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2 text-sm text-muted">
              {m.answerHint} · ↻
            </motion.p>
          )}
        </AnimatePresence>
      </button>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[m.again, m.effort, m.mastered].map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setRated(i)}
            aria-pressed={rated === i}
            className={`min-h-11 rounded-xl px-2 text-sm font-semibold transition-colors ${
              rated === i ? (i === 0 ? 'bg-coral-soft text-coral-ink ring-1 ring-coral' : 'bg-accent-soft text-accent-ink ring-1 ring-accent') : 'bg-surface-2 text-fg hover:bg-line'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Step({
  index,
  label,
  title,
  body,
  detail,
  tone,
  visual,
  flip,
  href,
  more,
}: {
  index: number;
  label: string;
  title: string;
  body: string;
  detail: string;
  tone: string;
  visual: ReactNode;
  flip?: boolean;
  href: string;
  more: string;
}) {
  return (
    <Reveal>
      <article className={`grid items-center gap-6 overflow-hidden rounded-[28px] ${tone} p-5 sm:p-8 md:grid-cols-2 md:gap-10 md:p-10`}>
        <div className={flip ? 'md:order-2' : undefined}>
          <p className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-fg/70">
            <span className="grid size-7 place-items-center rounded-full bg-fg text-xs text-bg">{index}</span>
            {label}
          </p>
          <h3 className="font-display mt-4 text-[clamp(1.6rem,3.6vw,2.3rem)] font-bold leading-[1.05]">{title}</h3>
          <p className="mt-3 text-base leading-relaxed text-fg/80 sm:text-lg">{body}</p>
          <p className="mt-5 inline-flex items-start gap-2 rounded-2xl bg-surface/70 px-3.5 py-2.5 text-sm font-medium text-fg">
            <span aria-hidden="true">✦</span>
            {detail}
          </p>
          <a href={href} className="mt-5 flex min-h-11 w-fit items-center gap-1.5 rounded-full text-sm font-semibold text-fg underline decoration-fg/30 underline-offset-4 hover:decoration-fg">
            {more} <span aria-hidden="true">→</span>
          </a>
        </div>
        <div className={flip ? 'md:order-1' : undefined}>{visual}</div>
      </article>
    </Reveal>
  );
}

export default function How() {
  const { how, mock, common } = useCopy();
  const { lang } = useRoute();
  const s = how.steps;
  const link = (id: 'plano' | 'foco' | 'pratica' | 'progresso') => ({ href: pagePath(lang, id), more: `${common.learnMore}: ${s[({ plano: 'plan', foco: 'focus', pratica: 'practice', progresso: 'measure' } as const)[id]].label}` });
  return (
    <section id="como-funciona" aria-labelledby="how-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <SectionHead id="how-title" kicker={how.kicker} title={how.title} em={how.titleEm} sub={how.sub} />
      <div className="mt-12 space-y-5 sm:space-y-6">
        <Step index={1} tone="bg-pastel-sky" {...s.plan} {...link('plano')} visual={<div className="rounded-[20px] bg-surface/60 p-3 sm:p-4"><PlanWeek /></div>} />
        <Step
          index={2}
          tone="bg-pastel-sage"
          flip
          {...s.focus}
          {...link('foco')}
          visual={
            <div className="rounded-[20px] bg-surface/60 p-6">
              <FocusRing />
              <div className="mt-4 flex justify-center">
                <span className="rounded-full bg-ink-cta px-6 py-2.5 text-sm font-semibold text-ink-cta-fg">▷ {mock.start}</span>
              </div>
            </div>
          }
        />
        <Step index={3} tone="bg-pastel-peach" {...s.practice} {...link('pratica')} visual={<PracticeCard />} />
        <Step index={4} tone="bg-pastel-mint" flip {...s.measure} {...link('progresso')} visual={<div className="rounded-[20px] bg-surface/60 p-5"><RetentionBars /></div>} />
      </div>
    </section>
  );
}
