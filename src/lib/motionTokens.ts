import confetti from 'canvas-confetti';
import { hapticSuccess } from './nativeBridge';

export const UNIPEDIA_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 24,
  mass: 0.85,
};

export const UNIPEDIA_BOUNCE_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 20,
};

/** Celebração leve com cores de papelaria Unipedia (respeita reduced-motion). */
export function celebrateStationery() {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  void hapticSuccess();
  try {
    void confetti({
      particleCount: 28,
      spread: 58,
      origin: { y: 0.72 },
      colors: ['#157F58', '#FCE99F', '#E04F33', '#C9DC9F', '#C4E0FD'],
      disableForReducedMotion: true,
    });
  } catch {
    // WebView sem suporte a canvas.
  }
}
