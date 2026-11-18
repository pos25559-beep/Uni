import { afterEach, describe, expect, it, vi } from 'vitest';
import { dismissToast, getToastQueue, showToast } from './uiHelpers';

describe('showToast com ação', () => {
  afterEach(() => {
    getToastQueue().forEach((t) => dismissToast(t.id));
    vi.useRealTimers();
  });

  it('guarda a ação e devolve o id', () => {
    const onPress = vi.fn();
    const id = showToast('Plano atualizado', { action: { label: 'Desfazer', onPress } });
    const item = getToastQueue().find((t) => t.id === id);
    expect(item?.action?.label).toBe('Desfazer');
    item?.action?.onPress();
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('com ação dura 6 s por omissão; sem ação, 3,2 s', () => {
    vi.useFakeTimers();
    const a = showToast('A', { action: { label: 'x', onPress: () => {} } });
    const b = showToast('B', 'ok');
    vi.advanceTimersByTime(3300);
    expect(getToastQueue().some((t) => t.id === a)).toBe(true);
    expect(getToastQueue().some((t) => t.id === b)).toBe(false);
    vi.advanceTimersByTime(2800);
    expect(getToastQueue().some((t) => t.id === a)).toBe(false);
  });
});
