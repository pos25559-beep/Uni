import type { ReactNode } from 'react';
import { useCopy } from '../i18n';
import { pagePath, useRoute } from '../routes';
import { PhoneShot } from '../screens';
import { Reveal, SectionHead } from '../ui';

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
  const { how, common } = useCopy();
  const { lang } = useRoute();
  const s = how.steps;
  const rows = [
    { key: 'start', page: 'comecar', shot: 'onboarding-cadeiras', tone: 'bg-pastel-sage' },
    { key: 'plan', page: 'plano', shot: 'plano', tone: 'bg-pastel-sky' },
    { key: 'materials', page: 'materiais', shot: 'materiais', tone: 'bg-pastel-peach' },
    { key: 'measure', page: 'progresso', shot: 'progresso', tone: 'bg-pastel-mint' },
  ] as const;
  return (
    <section id="como-funciona" aria-labelledby="how-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <SectionHead id="how-title" kicker={how.kicker} title={how.title} em={how.titleEm} sub={how.sub} />
      <div className="mt-12 space-y-5 sm:space-y-6">
        {rows.map((r, i) => (
          <Step
            key={r.key}
            index={i + 1}
            tone={r.tone}
            flip={i % 2 === 1}
            {...s[r.key]}
            href={pagePath(lang, r.page)}
            more={`${common.learnMore}: ${s[r.key].label}`}
            visual={
              <div className="flex justify-center">
                <PhoneShot id={r.shot} size="sm" />
              </div>
            }
          />
        ))}
      </div>
    </section>
  );
}
