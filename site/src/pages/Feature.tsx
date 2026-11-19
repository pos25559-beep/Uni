import { motion } from 'motion/react';
import { APP_URL, useCopy } from '../i18n';
import { FEATURES, pagePath, useRoute, type FeatureId } from '../routes';
import { PhoneShot, TiltPhone, type ShotId } from '../screens';
import { FinalCta } from '../sections/Closing';
import { Reveal, SectionHead, SPRING } from '../ui';
import { SectionVisual } from '../visuals';

/** Cor de cada área (blocos pastel, sem paredes de cartões). */
const TONE: Record<FeatureId, { band: string; soft: string }> = {
  comecar: { band: 'bg-pastel-sage', soft: 'bg-pastel-sage/45' },
  plano: { band: 'bg-pastel-sky', soft: 'bg-pastel-sky/45' },
  materiais: { band: 'bg-pastel-peach', soft: 'bg-pastel-peach/45' },
  progresso: { band: 'bg-pastel-mint', soft: 'bg-pastel-mint/45' },
  uni: { band: 'bg-pastel-butter', soft: 'bg-pastel-butter/45' },
};

/** Ecrã real da abertura de cada página. */
const HERO_SHOT: Record<FeatureId, ShotId> = {
  comecar: 'onboarding-cadeiras',
  plano: 'plano',
  materiais: 'materiais',
  progresso: 'progresso',
  uni: 'uni-adotar',
};

function FeatureHero({ id }: { id: FeatureId }) {
  const copy = useCopy();
  const { lang } = useRoute();
  const p = copy.pages[id];
  return (
    <section aria-labelledby="feature-title" className="paper-margin relative overflow-hidden pt-[72px]">
      <div className="paper-lines pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-8 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-20">
        <div className="pl-[clamp(8px,4vw,40px)]">
          <nav aria-label="Breadcrumb" className="font-mono text-xs text-muted">
            <a href={pagePath(lang, 'home')} className="inline-flex min-h-11 items-center hover:text-fg">Unipedia</a>
            <span aria-hidden="true" className="mx-2">/</span>
            <span aria-current="page" className="text-fg">{p.kicker}</span>
          </nav>
          <motion.h1
            id="feature-title"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 0.8, 0.26, 1] }}
            className="font-display mt-3 text-[clamp(2.5rem,7vw,4.8rem)] font-extrabold leading-[0.98] text-fg"
          >
            {p.title} <em className="marker font-serif font-normal italic text-accent-ink">{p.titleEm}</em>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl"
          >
            {p.sub}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.2 }} className="mt-8 flex flex-wrap gap-3">
            <a href={APP_URL} className="inline-flex h-13 items-center gap-2 rounded-full bg-ink-cta px-7 text-base font-semibold text-ink-cta-fg shadow-float transition-transform hover:-translate-y-0.5">
              {copy.hero.ctaOpen} <span aria-hidden="true">→</span>
            </a>
            <a href="#detalhes" className="inline-flex h-13 items-center rounded-full border border-line bg-surface px-6 text-base font-semibold hover:bg-surface-2">
              {copy.common.howTo}
            </a>
          </motion.div>
        </div>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="relative flex justify-center py-4">
          <div aria-hidden="true" className={`absolute inset-x-6 bottom-6 top-16 -rotate-3 rounded-[40px] ${TONE[id].band}`} />
          <TiltPhone>
            <PhoneShot id={HERO_SHOT[id]} eager />
          </TiltPhone>
        </motion.div>
      </div>
    </section>
  );
}

function FeatureSections({ id }: { id: FeatureId }) {
  const p = useCopy().pages[id];
  return (
    <section id="detalhes" aria-label={p.kicker} className="mx-auto max-w-6xl space-y-5 px-4 py-16 sm:space-y-6 sm:px-6 sm:py-24">
      {p.sections.map((s, i) => (
        <Reveal key={s.title}>
          <article className={`grid items-center gap-8 rounded-[28px] p-5 sm:p-8 md:grid-cols-2 md:gap-12 md:p-10 ${i % 2 === 0 ? TONE[id].soft : 'bg-surface-2/70'}`}>
            <div className={i % 2 === 1 ? 'md:order-2' : undefined}>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-fg/60">0{i + 1}</p>
              <h2 className="font-display mt-3 text-[clamp(1.6rem,3.4vw,2.3rem)] font-bold leading-[1.05]">{s.title}</h2>
              <p className="mt-3 text-base leading-relaxed text-fg/80 sm:text-lg">{s.body}</p>
              <ul className="mt-5 space-y-2.5">
                {s.points.map((pt) => (
                  <li key={pt} className="flex gap-3 text-base">
                    <span aria-hidden="true" className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-xs text-accent-fg">✓</span>
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
            <div className={i % 2 === 1 ? 'md:order-1' : undefined}>
              <SectionVisual page={id} index={i} />
            </div>
          </article>
        </Reveal>
      ))}
    </section>
  );
}

function FeatureSteps({ id }: { id: FeatureId }) {
  const p = useCopy().pages[id];
  return (
    <section aria-labelledby="steps-title" className="paper-lines border-y border-line bg-surface-2/60">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 id="steps-title" className="font-display text-[clamp(1.8rem,4vw,2.6rem)] font-bold">{p.steps.title}</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {p.steps.items.map((s, i) => (
            <li key={s.title}>
              <Reveal delay={i * 0.08} className="h-full rounded-[24px] bg-surface p-6 shadow-card">
                <span className={`grid size-10 place-items-center rounded-full ${TONE[id].band} font-mono text-sm font-bold`}>{i + 1}</span>
                <h3 className="font-display mt-4 text-xl font-bold">{s.title}</h3>
                <p className="mt-1.5 text-base leading-relaxed text-muted">{s.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FeatureFaq({ id }: { id: FeatureId }) {
  const copy = useCopy();
  const p = copy.pages[id];
  return (
    <section aria-labelledby="ffaq-title" className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.8fr_1.2fr]">
      <SectionHead id="ffaq-title" kicker={copy.faq.kicker} title={`${copy.common.questions} ${p.kicker}`} />
      <div className="divide-y divide-line border-y border-line">
        {p.faq.map((it) => (
          <details key={it.q}>
            <summary className="flex min-h-16 items-center justify-between gap-4 py-4 text-lg font-semibold">
              {it.q}
              <span aria-hidden="true" className="faq-chevron grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-lg transition-transform">+</span>
            </summary>
            <p className="pb-5 pr-12 text-base leading-relaxed text-muted">{it.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Ligações para as outras áreas. */
export function Explore({ current }: { current?: FeatureId }) {
  const copy = useCopy();
  const { lang } = useRoute();
  const others = FEATURES.filter((f) => f !== current);
  return (
    <section aria-labelledby="explore-title" className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 id="explore-title" className="font-display text-2xl font-bold">{copy.common.explore}</h2>
        <ul className={`mt-6 grid gap-3 sm:grid-cols-2 ${others.length > 4 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
          {others.map((f) => (
            <li key={f}>
              <a href={pagePath(lang, f)} className={`group flex h-full min-h-32 flex-col justify-between rounded-[22px] ${TONE[f].band} p-5 transition-transform hover:-translate-y-1`}>
                <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-fg/70">{copy.nav.features[f]}</span>
                <span className="font-display mt-3 text-lg font-bold leading-snug">
                  {copy.pages[f].title} <em className="font-serif font-normal italic">{copy.pages[f].titleEm}</em>
                </span>
                <span aria-hidden="true" className="mt-3 text-lg transition-transform group-hover:translate-x-1">→</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function Feature({ id }: { id: FeatureId }) {
  return (
    <>
      <FeatureHero id={id} />
      <FeatureSections id={id} />
      <FeatureSteps id={id} />
      <FeatureFaq id={id} />
      <Explore current={id} />
      <FinalCta />
    </>
  );
}
