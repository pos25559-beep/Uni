import type { ReactNode } from 'react';
import { useCopy } from '../i18n';
import { Reveal, SectionHead } from '../ui';

function Snippet({ children }: { children: ReactNode }) {
  return <div className="mt-4 rounded-2xl border border-line bg-surface p-3.5 shadow-card">{children}</div>;
}

export default function Moments() {
  const { moments, mock } = useCopy();
  const snippets: ReactNode[] = [
    <Snippet key="block">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-pastel-sky px-2.5 py-0.5 text-xs font-semibold">{mock.course1}</span>
        <span className="font-mono text-xs text-muted">25 min</span>
      </div>
      <p className="mt-1.5 font-semibold">{mock.topic1}</p>
      <p className="mt-1 text-sm text-muted">{mock.why}</p>
      <span className="mt-3 inline-flex min-h-10 items-center rounded-full bg-ink-cta px-5 text-sm font-semibold text-ink-cta-fg">▷ {mock.start}</span>
    </Snippet>,
    <Snippet key="q">
      <p className="font-semibold">{mock.question}</p>
      <p className="mt-1.5 font-mono text-sm">2x · sin x + x² · cos x</p>
      <p className="mt-1 text-xs text-muted">📎 {mock.source}</p>
    </Snippet>,
    <Snippet key="toast">
      <div className="flex items-start gap-3 rounded-xl bg-ink-cta p-3 text-ink-cta-fg">
        <span className="mt-1 size-2 shrink-0 rounded-full bg-[#4ADE80]" />
        <p className="flex-1 text-sm leading-snug">{mock.toast}</p>
        <span className="text-sm font-semibold underline underline-offset-4">{mock.undo}</span>
      </div>
    </Snippet>,
    <Snippet key="due">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{mock.due}</p>
          <p className="font-mono text-sm text-muted">{mock.cards}</p>
        </div>
        <span className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg">{mock.review}</span>
      </div>
    </Snippet>,
  ];
  const dots = ['bg-pastel-sky', 'bg-pastel-butter', 'bg-pastel-blush', 'bg-pastel-mint'];

  return (
    <section aria-labelledby="moments-title" className="paper-lines border-y border-line bg-surface-2/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHead id="moments-title" kicker={moments.kicker} title={moments.title} em={moments.titleEm} />
        </div>
        <ol className="relative space-y-8 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-[2px] before:bg-line">
          {moments.items.map((it, i) => (
            <li key={it.when} className="relative pl-12">
              <span aria-hidden="true" className={`absolute left-0 top-0.5 grid size-8 place-items-center rounded-full ${dots[i]} font-mono text-xs font-bold ring-4 ring-bg`}>
                {i + 1}
              </span>
              <Reveal delay={0.05}>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-coral-ink">{it.when}</p>
                <h3 className="font-display mt-1.5 text-2xl font-bold">{it.title}</h3>
                <p className="mt-2 max-w-lg text-base leading-relaxed text-muted">{it.body}</p>
                <div className="max-w-md">{snippets[i]}</div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
