import { motion, useReducedMotion } from 'motion/react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { APP_URL, useCopy } from '../i18n';
import { PhoneFrame, SPRING, TodayScreen } from '../ui';

const HeroScene = lazy(() => import('../three/HeroScene'));

/**
 * Só liga o 3D quando faz sentido: ecrã ≥ 768 px (no telemóvel o estático lê-se melhor e poupa dados),
 * WebGL, sem movimento reduzido, sem poupança de dados e aparelho com fôlego.
 */
function can3D(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.matchMedia('(min-width: 768px)').matches) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (nav.connection?.saveData) return false;
  if ((nav.hardwareConcurrency ?? 4) < 4 || (nav.deviceMemory ?? 4) < 3) return false;
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Versão estática (pré-render, movimento reduzido ou sem WebGL): telemóvel em CSS e post-its. */
function StaticStage({ label }: { label: string }) {
  const reduce = useReducedMotion();
  const notes = [
    'left-[4%] top-[12%] rotate-[-8deg] bg-pastel-butter',
    'right-[2%] top-[6%] rotate-[10deg] bg-pastel-mint',
    'left-[8%] bottom-[14%] rotate-[6deg] bg-pastel-sky',
    'right-[6%] bottom-[20%] rotate-[-12deg] bg-pastel-peach',
  ];
  return (
    <div role="img" aria-label={label} className="absolute inset-0 grid place-items-center">
      {notes.map((n, i) => (
        <motion.span
          key={n}
          aria-hidden="true"
          className={`absolute size-16 rounded-md shadow-card ring-1 ring-fg/5 sm:size-20 ${n}`}
          animate={reduce ? undefined : { y: [0, -8, 0] }}
          transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <div className="rotate-[-4deg]">
        <PhoneFrame>
          <TodayScreen />
        </PhoneFrame>
      </div>
    </div>
  );
}

export default function Hero() {
  const { hero } = useCopy();
  const [use3D, setUse3D] = useState(false);
  const [ready3D, setReady3D] = useState(false);
  useEffect(() => setUse3D(can3D()), []);

  return (
    <section aria-labelledby="hero-title" className="paper-margin relative overflow-hidden pt-[72px]">
      <div className="paper-lines pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-6 px-4 pb-10 pt-8 sm:px-6 lg:min-h-[calc(100svh-72px)] lg:grid-cols-[1.05fr_1fr] lg:pb-16">
        <div className="relative z-10 pl-[clamp(8px,4vw,40px)]">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3.5 py-1.5 text-xs font-semibold text-accent-ink"
          >
            <span className="size-1.5 rounded-full bg-accent" />
            {hero.kicker}
          </motion.p>
          <motion.h1
            id="hero-title"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 0.8, 0.26, 1] }}
            className="font-display mt-5 text-[clamp(2.7rem,8.4vw,5.6rem)] font-extrabold leading-[0.95] text-fg"
          >
            {hero.titleA}{' '}
            <em className="marker font-serif font-normal italic text-accent-ink">{hero.titleEm}</em>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl"
          >
            {hero.sub}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.25 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <a
              href={APP_URL}
              className="inline-flex h-13 items-center gap-2 rounded-full bg-ink-cta px-7 text-base font-semibold text-ink-cta-fg shadow-float transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
            >
              {hero.ctaOpen}
              <span aria-hidden="true">→</span>
            </a>
            <a
              href="#como-funciona"
              className="inline-flex h-13 items-center rounded-full border border-line bg-surface px-6 text-base font-semibold text-fg transition-colors hover:bg-surface-2"
            >
              {hero.ctaHow}
            </a>
          </motion.div>
          <p className="mt-5 font-mono text-xs text-muted">{hero.note}</p>
        </div>

        <div className="relative h-[min(560px,118vw)] lg:h-[640px]">
          {/* O telemóvel estático fica por baixo até a cena 3D pintar o primeiro frame. */}
          <div className={`absolute inset-0 transition-opacity duration-500 ${ready3D ? 'opacity-0' : 'opacity-100'}`} aria-hidden={ready3D}>
            <StaticStage label={hero.sceneLabel} />
          </div>
          {use3D && (
            <div className={`absolute inset-0 transition-opacity duration-700 ${ready3D ? 'opacity-100' : 'opacity-0'}`}>
              <Suspense fallback={null}>
                <HeroScene label={hero.sceneLabel} onReady={() => setReady3D(true)} />
              </Suspense>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
