import { motion } from 'motion/react';
import { APP_URL, useCopy } from '../i18n';
import { AppDemo } from '../screens';
import { SPRING } from '../ui';

export default function Hero() {
  const { hero } = useCopy();

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

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 0.8, 0.26, 1] }}
          className="relative py-4"
        >
          <AppDemo />
        </motion.div>
      </div>
    </section>
  );
}
