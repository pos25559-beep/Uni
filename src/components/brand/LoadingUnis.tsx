import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { UNIPEDIA_SPRING } from '../../lib/motionTokens';
import { cx } from '../../lib/uiHelpers';
import {
  UNI_DUO_LOTTIE_ASSETS,
  type LoadingUnisVariant,
} from '../../lib/uniDuoLottieAssets';
import { Progress } from '../ui';

export type { LoadingUnisVariant };

export interface LoadingUnisProps {
  /** Adapta a animação Lottie e texto padrão ao contexto: cadeiras, notas ou materiais. */
  variant?: LoadingUnisVariant;
  label?: string;
  sublabel?: string;
  compact?: boolean;
  /** Percentagem opcional (0–100) exibida com barra de progresso em importações em lote. */
  progress?: number;
  className?: string;
}

const DEFAULT_LABEL_KEY: Record<LoadingUnisVariant, string> = {
  courses: 'courses:loadingUnis.courses',
  grades: 'courses:loadingUnis.grades',
  materials: 'courses:loadingUnis.materials',
};

/**
 * Componente de carregamento com dois Unis vivos em Lottie (100% offline/SVG),
 * adaptado especificamente para Cadeiras, Notas e Materiais.
 */
export function LoadingUnis({
  variant = 'courses',
  label,
  sublabel,
  compact = false,
  progress,
  className,
}: LoadingUnisProps) {
  const { t } = useTranslation('courses');
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    let destroyFn: (() => void) | undefined;

    const prefersReduced =
      Boolean(reducedMotion) ||
      (typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    void import('lottie-web/build/player/lottie_light')
      .then((mod) => {
        if (cancelled || !containerRef.current) return;
        const lottie = mod.default ?? mod;
        if (typeof lottie?.loadAnimation !== 'function') return;
        const anim = lottie.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop: !prefersReduced,
          autoplay: !prefersReduced,
          animationData: structuredClone(UNI_DUO_LOTTIE_ASSETS[variant]),
        });
        if (prefersReduced) {
          const restFrame = Math.max(0, Math.round(anim.totalFrames * 0.5));
          anim.goToAndStop(restFrame, true);
        }
        destroyFn = () => anim.destroy();
      })
      .catch(() => {
        // Fallback silencioso caso o player SVG não esteja disponível neste ambiente
      });

    return () => {
      cancelled = true;
      destroyFn?.();
    };
  }, [variant, reducedMotion]);

  const resolvedLabel = label ?? t(DEFAULT_LABEL_KEY[variant]);
  const hasProgress = typeof progress === 'number' && Number.isFinite(progress);
  const clampedPct = hasProgress ? Math.round(Math.min(100, Math.max(0, progress))) : 0;

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={reducedMotion ? undefined : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={UNIPEDIA_SPRING}
      className={cx(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-1.5 py-2' : 'gap-2.5 py-5',
        className,
      )}
    >
      <div
        ref={containerRef}
        aria-hidden="true"
        className={cx(
          'pointer-events-none shrink-0 select-none [&>svg]:block [&>svg]:size-full',
          compact ? 'h-16 w-32' : 'h-[88px] w-[176px]',
        )}
      />

      <div className="space-y-0.5">
        <p className={cx('font-medium text-fg', compact ? 'text-xs' : 'text-sm')}>
          {resolvedLabel}
          {hasProgress && (
            <span className="ml-1.5 font-mono text-xs text-muted tabular">
              {clampedPct}%
            </span>
          )}
        </p>
        {sublabel && <p className="text-xs text-muted">{sublabel}</p>}
      </div>

      {hasProgress && (
        <div className="w-full max-w-xs pt-0.5">
          <Progress value={clampedPct / 100} label={resolvedLabel} />
        </div>
      )}
    </motion.div>
  );
}

export default LoadingUnis;
