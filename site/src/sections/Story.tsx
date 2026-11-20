import { UNI_SHAPES } from '@app/components/brand/uniShapes';
import { useCopy } from '../i18n';
import { pagePath, useRoute } from '../routes';
import { Reveal, SectionHead } from '../ui';
import { UNI_FILLS, UniLive } from '../uni';

/** Princípios em grelha compacta (o 4.º, «Os dados são teus», cobre a privacidade). */
export function Principles() {
  const { principles } = useCopy();
  const tones = ['bg-pastel-butter', 'bg-pastel-blush', 'bg-pastel-sky', 'bg-pastel-sage'];
  return (
    <section id="dados" aria-labelledby="principles-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <SectionHead id="principles-title" kicker={principles.kicker} title={principles.title} em={principles.titleEm} />
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {principles.items.map((p, i) => (
          <li key={p.title}>
            <Reveal delay={i * 0.06} className="h-full border-t-2 border-fg pt-5">
              <span className={`grid size-9 place-items-center rounded-xl ${tones[i]} font-mono text-sm font-bold text-[#141312]`}>{i + 1}</span>
              <h3 className="font-display mt-4 text-lg font-bold leading-snug">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.body}</p>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Os Unis: companheiro primeiro (formas e estágios, com os traçados da app), tutor depois. */
export function Uni() {
  const { uni, common, nav, app } = useCopy();
  const { lang } = useRoute();
  const stages = [0, 1, 2, 3, 4] as const;
  return (
    <section id="uni" aria-labelledby="uni-title" className="px-4 sm:px-6">
      <div className="mx-auto grid max-w-6xl items-center gap-10 overflow-hidden rounded-[32px] bg-pastel-butter px-5 py-14 sm:px-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:py-16 lg:px-14">
        <div className="min-w-0">
          <SectionHead id="uni-title" kicker={uni.kicker} title={uni.title} em={uni.titleEm} />
          <Reveal delay={0.1}>
            <p className="mt-4 text-lg leading-relaxed text-fg/80">{uni.body}</p>
            <ul className="mt-6 space-y-3">
              {uni.bullets.map((b) => (
                <li key={b} className="flex gap-3 text-base">
                  <span aria-hidden="true" className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-xs text-accent-fg">✓</span>
                  {b}
                </li>
              ))}
            </ul>
            <a href={pagePath(lang, 'uni')} className="mt-7 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink-cta px-5 text-sm font-semibold text-ink-cta-fg transition-transform hover:-translate-y-px">
              {common.learnMore}: {nav.features.uni} <span aria-hidden="true">→</span>
            </a>
          </Reveal>
        </div>

        <Reveal delay={0.15} className="min-w-0 space-y-4">
          {/* As cinco formas. */}
          <figure className="rounded-[24px] bg-bg/70 p-4 sm:p-5">
            <figcaption className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-muted">{uni.formsLabel}</figcaption>
            <ul className="mt-3 grid grid-cols-5 gap-1">
              {UNI_SHAPES.map((shape, i) => (
                <li key={shape} className="flex flex-col items-center gap-1.5">
                  <UniLive shape={shape} fill={UNI_FILLS[shape]} size={72} delay={i * 0.35} className="max-w-full" />
                  <span className="text-center text-xs font-semibold">{app.uni.forms[shape]}</span>
                </li>
              ))}
            </ul>
          </figure>
          {/* Os cinco estágios: só com domínio real. */}
          <figure className="rounded-[24px] bg-bg/70 p-4 sm:p-5">
            <figcaption className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-muted">{uni.stagesLabel}</figcaption>
            <ol className="relative mt-3 grid grid-cols-5 items-end gap-1">
              <span aria-hidden="true" className="absolute inset-x-6 top-[38%] border-t-2 border-dashed border-fg/25" />
              {stages.map((s) => (
                <li key={s} className="relative flex flex-col items-center gap-1.5">
                  <UniLive shape="nuvem" fill={UNI_FILLS.nuvem} stage={s} size={40 + s * 8} delay={s * 0.3} className="max-w-full" />
                  {/* No telemóvel só cabem o primeiro e o último nome; a sequência inteira vai por baixo. */}
                  <span className={`text-center text-xs font-semibold ${s === 0 || s === 4 ? '' : 'hidden sm:block'}`}>{app.uni.stages[s]}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-center text-xs font-semibold text-muted sm:hidden">{app.uni.stages.join(' → ')}</p>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
