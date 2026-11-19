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

/** O Uni (mesmo desenho do logótipo), com respiração e piscar. */
export function UniFace({ size = 120, mood = 'happy', className }: { size?: number; mood?: 'happy' | 'calm'; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="4 4 56 56"
      fill="none"
      aria-hidden="true"
      className={className}
      animate={reduce ? undefined : { y: [0, -3, 0], scaleY: [1, 1.025, 1] }}
      transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <path d="M29 14.5V7.5L32.5 10.5L36 7.5V14.5" fill="#E04F33" stroke="#141312" strokeWidth="1.6" strokeLinejoin="round" />
      <path
        d="M32 13.5C36.4 13.5 39.6 16.3 42.1 17.7C45.1 19.3 48.7 19.9 50.5 23.1C52.3 26.2 51.1 30 51.9 33.5C52.7 37 55.2 40.2 53.7 43.9C52.2 47.4 48.2 48.7 45.2 50.9C42.2 53.1 39.7 56.8 35.7 57C31.8 57.1 28.9 53.9 25.3 53C21.7 52.1 17.2 53.4 14.5 50.6C11.9 47.7 13 43.2 12 39.4C11 35.7 8.4 32.3 9.9 28.5C11.3 24.8 15.6 24.2 18.3 21.3C21 18.4 22.1 14.5 26 13.7C28.1 13.3 30.1 13.5 32 13.5Z"
        fill={mood === 'calm' ? '#BCEEE0' : '#C9DC9F'}
        stroke="#141312"
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
      <circle cx="22.8" cy="37.6" r="2.6" fill="#E04F33" fillOpacity="0.45" />
      <circle cx="41.2" cy="37.6" r="2.6" fill="#E04F33" fillOpacity="0.45" />
      <motion.g
        animate={reduce ? undefined : { scaleY: [1, 1, 0.1, 1, 1] }}
        transition={{ duration: 4.2, repeat: Infinity, times: [0, 0.9, 0.93, 0.96, 1] }}
        style={{ transformOrigin: '32px 32.4px' }}
      >
        <circle cx="25.2" cy="32.4" r="2.4" fill="#141312" />
        <circle cx="38.8" cy="32.4" r="2.4" fill="#141312" />
        <circle cx="26" cy="31.5" r="0.8" fill="#FFFFFF" />
        <circle cx="39.6" cy="31.5" r="0.8" fill="#FFFFFF" />
      </motion.g>
      <path d="M27.4 38.4C29.1 41.7 34.9 41.7 36.6 38.4" stroke="#141312" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="51" cy="13.5" r="4" fill="#FCE99F" stroke="#141312" strokeWidth="1.5" />
    </motion.svg>
  );
}
