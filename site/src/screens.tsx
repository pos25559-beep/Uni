import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useCopy } from './i18n';
import { useRoute } from './routes';

/**
 * Ecrãs reais da app: capturas feitas por scripts/site-screens.py com a demonstração da app,
 * em cada língua e em claro/escuro (site/public/screens/<língua>/<tema>/<ecrã>.webp).
 */

export type ShotId =
  | 'hoje'
  | 'plano'
  | 'cadeiras'
  | 'calendario'
  | 'materiais'
  | 'progresso'
  | 'foco'
  | 'tutor'
  | 'uni-adotar'
  | 'cadeira'
  | 'estante'
  | 'onboarding'
  | 'onboarding-cadeiras'
  | 'hub'
  | 'hub-passos';

/** Captura da app, no tema do site (claro ou escuro). */
export function Shot({ id, eager, className }: { id: ShotId; eager?: boolean; className?: string }) {
  const { lang } = useRoute();
  const { shots } = useCopy();
  const src = (theme: 'light' | 'dark') => `/screens/${lang.code}/${theme}/${id}.webp`;
  const common = {
    alt: shots[id],
    width: 600,
    height: 1298,
    decoding: 'async' as const,
    loading: eager ? ('eager' as const) : ('lazy' as const),
  };
  return (
    <>
      <img {...common} src={src('light')} className={`block h-full w-full object-cover object-top dark:hidden ${className ?? ''}`} />
      <img {...common} src={src('dark')} className={`hidden h-full w-full object-cover object-top dark:block ${className ?? ''}`} />
    </>
  );
}

/* ------------------------------------------------------------------ moldura */

export function PhoneFrame({ children, className, size = 'md' }: { children: ReactNode; className?: string; size?: 'sm' | 'md' }) {
  const width = size === 'sm' ? 'w-[min(250px,64vw)]' : 'w-[min(300px,74vw)]';
  return (
    <div
      className={`relative aspect-[390/844] ${width} rounded-[46px] bg-[#141312] p-[9px] shadow-[0_50px_90px_-35px_rgba(20,19,18,0.5)] ring-1 ring-black/5 dark:ring-white/10 ${className ?? ''}`}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[37px] bg-bg">{children}</div>
    </div>
  );
}

/** Telemóvel com uma captura real. */
export function PhoneShot({ id, eager, size, className }: { id: ShotId; eager?: boolean; size?: 'sm' | 'md'; className?: string }) {
  return (
    <PhoneFrame size={size} className={className}>
      <Shot id={id} eager={eager} />
    </PhoneFrame>
  );
}

/** Telemóvel que inclina ligeiramente com o ponteiro (só em ponteiros finos e sem movimento reduzido). */
export function TiltPhone({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [5, -5]), { stiffness: 120, damping: 18 });
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-7, 7]), { stiffness: 120, damping: 18 });

  useEffect(() => {
    if (reduce || !window.matchMedia('(pointer: fine)').matches) return;
    const on = (e: PointerEvent) => {
      x.set(e.clientX / window.innerWidth - 0.5);
      y.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('pointermove', on, { passive: true });
    return () => window.removeEventListener('pointermove', on);
  }, [reduce, x, y]);

  return (
    <div style={{ perspective: 1200 }}>
      <motion.div style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}>{children}</motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ demonstração */

type DemoTab = 'hoje' | 'plano' | 'cadeiras' | 'materiais' | 'tutor' | 'unis';
const DEMO: { tab: DemoTab; shot: ShotId }[] = [
  { tab: 'hoje', shot: 'hoje' },
  { tab: 'plano', shot: 'plano' },
  { tab: 'cadeiras', shot: 'cadeiras' },
  { tab: 'materiais', shot: 'materiais' },
  { tab: 'tutor', shot: 'tutor' },
  { tab: 'unis', shot: 'uni-adotar' },
];
const STEP_MS = 4800;

/** Percorre ecrãs reais da app sozinha; os separadores saltam para um ecrã e o botão pausa. */
export function AppDemo() {
  const { demo } = useCopy();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(true);
  const wrap = useRef<HTMLDivElement>(null);
  const current = DEMO[index];
  const running = playing && inView && !reduce;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % DEMO.length), STEP_MS);
    return () => clearTimeout(t);
  }, [running, index]);

  return (
    <div ref={wrap} className="flex flex-col items-center">
      <div className="relative">
        <span aria-hidden="true" className="absolute -left-10 top-16 size-20 rotate-[-10deg] rounded-md bg-pastel-butter shadow-card ring-1 ring-fg/5 sm:-left-16 sm:size-24" />
        <span aria-hidden="true" className="absolute -right-8 top-8 size-16 rotate-[12deg] rounded-md bg-pastel-mint shadow-card ring-1 ring-fg/5 sm:-right-14 sm:size-20" />
        <span aria-hidden="true" className="absolute -right-10 bottom-24 size-20 rotate-[-6deg] rounded-md bg-pastel-peach shadow-card ring-1 ring-fg/5 sm:-right-16" />
        <span aria-hidden="true" className="absolute -left-8 bottom-12 size-14 rotate-[8deg] rounded-md bg-pastel-sky shadow-card ring-1 ring-fg/5 sm:-left-12 sm:size-16" />
        <TiltPhone>
          <PhoneFrame>
            {/* Todas as capturas ficam montadas (carregam uma vez) e cruzam-se por opacidade. */}
            {DEMO.map((d, i) => (
              <motion.div
                key={d.tab}
                className="absolute inset-0"
                initial={false}
                animate={{ opacity: i === index ? 1 : 0, scale: i === index ? 1 : 1.015 }}
                transition={{ duration: 0.45, ease: [0.22, 0.8, 0.26, 1] }}
                aria-hidden={i !== index}
              >
                <Shot id={d.shot} eager={i === 0} />
              </motion.div>
            ))}
          </PhoneFrame>
        </TiltPhone>
      </div>

      <div className="mt-7 flex w-full max-w-md items-center gap-2">
        <div role="tablist" aria-label={demo.tabsLabel} className="no-scrollbar flex flex-1 gap-1 overflow-x-auto rounded-full bg-surface-2 p-1">
          {DEMO.map((d, i) => (
            <button
              key={d.tab}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => setIndex(i)}
              className={`relative min-h-11 shrink-0 overflow-hidden rounded-full px-3.5 text-xs font-semibold transition-colors ${i === index ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg'}`}
            >
              {demo.tabs[d.tab]}
              {i === index && running && (
                <motion.span
                  key={`p-${index}`}
                  aria-hidden="true"
                  className="absolute inset-x-3 bottom-1.5 h-0.5 origin-left rounded-full bg-accent"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: STEP_MS / 1000, ease: 'linear' }}
                />
              )}
            </button>
          ))}
        </div>
        {!reduce && (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? demo.pause : demo.play}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-fg hover:bg-surface-2"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              {playing ? <path d="M3.5 2.5v9M10.5 2.5v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> : <path d="M4 2.5l7.5 4.5L4 11.5z" fill="currentColor" />}
            </svg>
          </button>
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={current.tab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          aria-live="polite"
          className="mt-3 min-h-12 max-w-sm text-center text-sm leading-snug text-muted"
        >
          {demo.captions[current.tab]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/** Recorte de uma captura real (a partir de `top`, fração da altura do ecrã), para mostrar só uma parte. */
export function ShotCrop({ id, top, className }: { id: ShotId; top: number; className?: string }) {
  return (
    <div className={`relative aspect-[600/560] overflow-hidden rounded-[22px] bg-bg shadow-card ring-1 ring-line ${className ?? ''}`}>
      <div className="absolute inset-x-0 top-0" style={{ transform: `translateY(-${top * 100}%)` }}>
        <Shot id={id} />
      </div>
    </div>
  );
}
