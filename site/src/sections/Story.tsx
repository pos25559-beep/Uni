import { useCopy } from '../i18n';
import { pagePath, useRoute } from '../routes';
import { Reveal, SectionHead } from '../ui';
import { Pair } from '../visuals';

export function Principles() {
  const { principles } = useCopy();
  const tones = ['bg-pastel-butter', 'bg-pastel-blush', 'bg-pastel-sky', 'bg-pastel-sage'];
  return (
    <section aria-labelledby="principles-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <SectionHead id="principles-title" kicker={principles.kicker} title={principles.title} em={principles.titleEm} />
      <ul className="mt-12 grid gap-x-10 gap-y-2 md:grid-cols-2">
        {principles.items.map((p, i) => (
          <li key={p.title} className="border-t border-line py-6">
            <Reveal delay={i * 0.06} className="flex gap-4">
              <span className={`mt-1 grid size-10 shrink-0 place-items-center rounded-xl ${tones[i]} font-mono text-sm font-bold`}>{i + 1}</span>
              <div>
                <h3 className="font-display text-xl font-bold">{p.title}</h3>
                <p className="mt-1.5 text-base leading-relaxed text-muted">{p.body}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Uni() {
  const { uni, common, nav } = useCopy();
  const { lang } = useRoute();
  return (
    <section id="uni" aria-labelledby="uni-title" className="px-4 sm:px-6">
      <div className="mx-auto grid max-w-6xl items-center gap-10 overflow-hidden rounded-[32px] bg-pastel-butter px-5 py-14 sm:px-10 md:grid-cols-2 md:py-16 lg:px-14">
        <div>
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
        <Reveal delay={0.15} className="relative">
          <Pair a="uni-adotar" b="tutor" />
        </Reveal>
      </div>
    </section>
  );
}

export function Privacy() {
  const { privacy } = useCopy();
  const icons = [
    <path key="a" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0M4 4l16 16" />,
    <path key="b" d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19h.01M3 3l18 18" />,
    <path key="c" d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Zm-3 9 2 2 4-4" />,
  ];
  return (
    <section id="dados" aria-labelledby="privacy-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="grid gap-10 md:grid-cols-[1fr_1.1fr] md:items-end">
        <div>
          <SectionHead id="privacy-title" kicker={privacy.kicker} title={privacy.title} em={privacy.titleEm} />
          <Reveal delay={0.1}>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">{privacy.body}</p>
          </Reveal>
        </div>
        <ul className="divide-y divide-line rounded-[24px] border border-line bg-surface">
          {privacy.items.map((it, i) => (
            <li key={it.title} className="flex gap-4 p-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-accent" aria-hidden="true">
                {icons[i]}
              </svg>
              <div>
                <h3 className="font-semibold">{it.title}</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-muted">{it.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
