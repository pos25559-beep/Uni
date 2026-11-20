import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export const SPRING = { type: 'spring', stiffness: 380, damping: 24, mass: 0.85 } as const;

/** Entra suavemente quando aparece no ecrã (respeita movimento reduzido). */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: [0.22, 0.8, 0.26, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHead({
  kicker,
  title,
  em,
  sub,
  id,
  align = 'left',
}: {
  kicker: string;
  title: string;
  em?: string;
  sub?: string;
  id?: string;
  align?: 'left' | 'center';
}) {
  return (
    <Reveal className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-muted">{kicker}</p>
      <h2 id={id} className="font-display mt-3 text-[clamp(2rem,5.2vw,3.4rem)] font-bold leading-[1.02] text-fg">
        {title}
        {em && <> <em className="font-serif font-normal italic text-accent-ink">{em}</em></>}
      </h2>
      {sub && <p className="mt-4 text-lg leading-relaxed text-muted">{sub}</p>}
    </Reveal>
  );
}
