export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export type ToastItem = { id: number; message: string; tone?: 'ok' | 'danger' | 'neutral' };

let toastListeners: Array<(items: ToastItem[]) => void> = [];
let toastQueue: ToastItem[] = [];

export function getToastQueue(): ToastItem[] {
  return toastQueue;
}

export function subscribeToasts(listener: (items: ToastItem[]) => void): () => void {
  toastListeners.push(listener);
  return () => {
    toastListeners = toastListeners.filter((fn) => fn !== listener);
  };
}

export function showToast(message: string, tone: 'ok' | 'danger' | 'neutral' = 'ok') {
  const id = Date.now() + Math.floor(Math.random() * 1000);
  toastQueue = [...toastQueue.slice(-2), { id, message, tone }];
  toastListeners.forEach((fn) => fn(toastQueue));
  setTimeout(() => {
    toastQueue = toastQueue.filter((t) => t.id !== id);
    toastListeners.forEach((fn) => fn(toastQueue));
  }, 3200);
}
