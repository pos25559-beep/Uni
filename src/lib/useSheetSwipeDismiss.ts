import { useEffect, useRef, type RefObject } from 'react';
import { hapticTap } from './nativeBridge';

interface UseSheetSwipeDismissOptions {
  ref: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  /** Largura máxima (px) em que o componente se comporta como folha inferior arrastável. Omitir para sempre ativo. */
  maxViewportWidth?: number;
}

function hasScrolledAncestor(target: EventTarget | null, boundary: HTMLElement): boolean {
  let node = target instanceof HTMLElement ? target : null;
  while (node && node !== boundary) {
    if (node.scrollHeight > node.clientHeight + 1 && node.scrollTop > 0) {
      return true;
    }
    node = node.parentElement;
  }
  return boundary.scrollHeight > boundary.clientHeight + 1 && boundary.scrollTop > 0;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest('button, a, input, select, textarea, [role="option"]'))
  );
}

/**
 * Permite fechar qualquer folha inferior por swipe para baixo (toque em mobile ou arrasto no puxador),
 * com seguimento tátil ao dedo e proteção contra conflitos de scroll interno.
 */
export function useSheetSwipeDismiss({
  ref,
  open,
  onClose,
  maxViewportWidth,
}: UseSheetSwipeDismissOptions) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;

    el.style.transform = '';
    el.style.transition = '';
    el.style.opacity = '';
    el.style.animation = '';

    let mode: 'idle' | 'drag' | 'scroll' = 'idle';
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let currentDy = 0;
    let fromHandle = false;
    let closing = false;
    let closeTimer: number | undefined;

    const isViewportEligible = () =>
      maxViewportWidth === undefined || window.innerWidth < maxViewportWidth;

    const resetStyles = (animate: boolean) => {
      if (animate) {
        el.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
      } else {
        el.style.transition = '';
      }
      el.style.transform = '';
    };

    const commitOrCancel = () => {
      if (mode !== 'drag') {
        mode = 'idle';
        return;
      }
      const elapsed = Math.max(1, performance.now() - startTime);
      const velocity = currentDy / elapsed;
      const height = el.getBoundingClientRect().height || 300;
      const shouldClose =
        currentDy > Math.min(84, height * 0.25) || (currentDy > 26 && velocity > 0.38);

      mode = 'idle';
      if (shouldClose) {
        closing = true;
        const dy = currentDy;
        currentDy = 0;
        void hapticTap();
        el.style.transition = 'transform 160ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease';
        el.style.transform = `translateY(${Math.max(height, dy + 120)}px)`;
        el.style.opacity = '0';
        closeTimer = window.setTimeout(() => {
          closing = false;
          onCloseRef.current();
        }, 150);
      } else {
        currentDy = 0;
        resetStyles(true);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (closing || !isViewportEligible() || e.touches.length !== 1) return;
      const touch = e.touches[0]!;
      const target = e.target;
      fromHandle = target instanceof HTMLElement && Boolean(target.closest('[data-sheet-handle]'));
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = performance.now();
      currentDy = 0;
      mode = !fromHandle && hasScrolledAncestor(target, el) ? 'scroll' : 'idle';
    };

    const onTouchMove = (e: TouchEvent) => {
      if (closing || mode === 'scroll' || e.touches.length !== 1) return;
      const touch = e.touches[0]!;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (mode === 'idle') {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          mode = 'scroll';
          return;
        }
        if (dy < -6) {
          mode = 'scroll';
          return;
        }
        if (dy > 7) {
          if (!fromHandle && hasScrolledAncestor(e.target, el)) {
            mode = 'scroll';
            return;
          }
          mode = 'drag';
          el.style.animation = 'none';
          el.style.transition = 'none';
        }
      }

      if (mode === 'drag') {
        currentDy = Math.max(0, dy);
        if (e.cancelable) e.preventDefault();
        el.style.transform = `translateY(${currentDy}px)`;
      }
    };

    const onTouchEnd = () => commitOrCancel();

    const onTouchCancel = () => {
      if (mode === 'drag') {
        mode = 'idle';
        currentDy = 0;
        resetStyles(true);
      } else {
        mode = 'idle';
      }
    };

    // Suporte adicional para arrasto com rato no puxador (útil em emuladores e ecrãs táteis desktop)
    let activePointerId: number | null = null;
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || closing || !isViewportEligible()) return;
      if (!(e.target instanceof HTMLElement) || !e.target.closest('[data-sheet-handle]')) return;
      if (isInteractiveTarget(e.target)) return;
      activePointerId = e.pointerId;
      fromHandle = true;
      startX = e.clientX;
      startY = e.clientY;
      startTime = performance.now();
      currentDy = 0;
      mode = 'idle';
    };

    const onPointerMove = (e: PointerEvent) => {
      if (activePointerId === null || e.pointerId !== activePointerId) return;
      const dy = e.clientY - startY;
      if (mode === 'idle' && dy > 5) {
        mode = 'drag';
        el.style.animation = 'none';
        el.style.transition = 'none';
      }
      if (mode === 'drag') {
        currentDy = Math.max(0, dy);
        el.style.transform = `translateY(${currentDy}px)`;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (activePointerId === null || e.pointerId !== activePointerId) return;
      activePointerId = null;
      commitOrCancel();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      if (closeTimer !== undefined) window.clearTimeout(closeTimer);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      el.style.transform = '';
      el.style.transition = '';
      el.style.opacity = '';
      el.style.animation = '';
    };
  }, [open, ref, maxViewportWidth]);
}
