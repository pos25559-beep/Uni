import type { ReactNode } from 'react';
import { useCopy } from '../i18n';
import { pagePath, useRoute } from '../routes';
import { ShotCrop } from '../screens';
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

/** Cartão compacto: recorte ampliado do ecrã real, número, título, texto e ligação. */
function Step({
  index,
  label,
  title,
  body,
  tone,
  visual,
  href,
  more,
}: {
  index: number;
  label: string;
  title: string;
  body: string;
  tone: string;
  visual: ReactNode;
  href: string;
  more: string;
}) {
  return (
    <Reveal delay={index * 0.05} className="h-full">
      <article className={`flex h-full flex-col overflow-hidden rounded-[28px] ${tone} p-3 sm:p-4`}>
        {visual}
        <div className="flex flex-1 flex-col px-2 pb-2 pt-5 sm:px-3">
          <p className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-fg/75">
            <span className="grid size-7 place-items-center rounded-full bg-fg text-xs text-bg">{index}</span>
            {label}
          </p>
          <h3 className="font-display mt-3 text-[clamp(1.35rem,2.4vw,1.75rem)] font-bold leading-[1.1]">{title}</h3>
          <p className="mt-2 flex-1 text-base leading-relaxed text-fg/80">{body}</p>
          <a href={href} className="mt-4 flex min-h-11 w-fit items-center gap-1.5 rounded-full text-sm font-semibold text-fg underline decoration-fg/30 underline-offset-4 hover:decoration-fg">
            {more} <span aria-hidden="true">→</span>
          </a>
        </div>
      </article>
    </Reveal>
  );
}

export default function How() {
  const { how, common } = useCopy();
  const { lang } = useRoute();
  const s = how.steps;
  const rows = [
    { key: 'start', page: 'comecar', shot: 'onboarding-cadeiras', top: 0.08, tone: 'bg-pastel-sage' },
    { key: 'plan', page: 'plano', shot: 'plano', top: 0.25, tone: 'bg-pastel-sky' },
    { key: 'materials', page: 'materiais', shot: 'materiais', top: 0.2, tone: 'bg-pastel-peach' },
    { key: 'measure', page: 'progresso', shot: 'progresso', top: 0.33, tone: 'bg-pastel-mint' },
  ] as const;
  return (
    <section id="como-funciona" aria-labelledby="how-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <SectionHead id="how-title" kicker={how.kicker} title={how.title} em={how.titleEm} sub={how.sub} />
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5">
        {rows.map((r, i) => (
          <li key={r.key}>
            <Step
              index={i + 1}
              tone={r.tone}
              {...s[r.key]}
              href={pagePath(lang, r.page)}
              more={`${common.learnMore}: ${s[r.key].label}`}
              visual={<ShotCrop id={r.shot} top={r.top} />}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
