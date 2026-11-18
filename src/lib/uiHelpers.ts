import { celebrateStationery } from './motionTokens';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export type ToastTone = 'ok' | 'danger' | 'neutral';
export type ToastEffect = 'default' | 'celebrate' | 'confetti';

export type ToastOptions = {
  tone?: ToastTone;
  effect?: ToastEffect;
  durationMs?: number;
  /** Um único botão de ação (ex.: «Desfazer»). Com ação, a duração por omissão sobe para 6 s. */
  action?: { label: string; onPress: () => void };
};

export type ToastItem = {
  id: number;
  message: string;
  tone?: ToastTone;
  effect?: ToastEffect;
  action?: { label: string; onPress: () => void };
};

let toastListeners: Array<(items: ToastItem[]) => void> = [];
let toastQueue: ToastItem[] = [];
const toastTimers = new Map<number, ReturnType<typeof setTimeout>>();

export function getToastQueue(): ToastItem[] {
  return toastQueue;
}

export function subscribeToasts(listener: (items: ToastItem[]) => void): () => void {
  toastListeners.push(listener);
  return () => {
    toastListeners = toastListeners.filter((fn) => fn !== listener);
  };
}

export function dismissToast(id: number) {
  const timer = toastTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    toastTimers.delete(id);
  }
  toastQueue = toastQueue.filter((t) => t.id !== id);
  toastListeners.forEach((fn) => fn(toastQueue));
}

export function showToast(
  message: string,
  toneOrOptions: ToastTone | ToastOptions = 'ok',
): number {
  const opts: ToastOptions =
    typeof toneOrOptions === 'string' ? { tone: toneOrOptions } : toneOrOptions;
  const tone: ToastTone = opts.tone ?? 'ok';
  const effect: ToastEffect = opts.effect ?? 'default';
  const durationMs = opts.durationMs ?? (opts.action ? 6000 : tone === 'danger' ? 4600 : 3200);

  const id = Date.now() + Math.floor(Math.random() * 1000);
  toastQueue = [...toastQueue.slice(-2), { id, message, tone, effect, action: opts.action }];
  toastListeners.forEach((fn) => fn(toastQueue));

  if (effect === 'confetti') {
    celebrateStationery();
  }

  const timer = setTimeout(() => {
    dismissToast(id);
  }, durationMs);
  toastTimers.set(id, timer);
  return id;
}

