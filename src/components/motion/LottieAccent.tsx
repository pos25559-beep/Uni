import { useEffect, useRef } from 'react';
import { UNI_LOTTIE_ASSETS, type UniLottieKind } from '../../lib/uniLottieAssets';
import { cx } from '../../lib/uiHelpers';

interface Props {
  kind: UniLottieKind;
  loop?: boolean;
  className?: string;
}

/**
 * Renderiza animações vetoriais Lottie usando apenas o player SVG leve em lazy-load,
 * mantendo 0 pedidos externos e respeitando prefers-reduced-motion.
 */
export default function LottieAccent({ kind, loop = true, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    let destroyFn: (() => void) | undefined;

    const prefersReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    void import('lottie-web/build/player/lottie_light').then((mod) => {
      if (cancelled || !containerRef.current) return;
      const lottie = mod.default ?? mod;
      const anim = lottie.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop: prefersReduced ? false : loop,
        autoplay: !prefersReduced,
        animationData: UNI_LOTTIE_ASSETS[kind],
      });
      if (prefersReduced) {
        const restFrame = Math.max(0, Math.round(anim.totalFrames * 0.5));
        anim.goToAndStop(restFrame, true);
      }
      destroyFn = () => anim.destroy();
    });

    return () => {
      cancelled = true;
      destroyFn?.();
    };
  }, [kind, loop]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cx('pointer-events-none shrink-0', className)}
    />
  );
}
