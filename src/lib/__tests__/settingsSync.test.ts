import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
  writeBatch: vi.fn(),
}));
vi.mock('../firebase', () => ({ auth: { currentUser: null }, db: {} }));
vi.mock('../../store/useStore', () => ({
  useStore: {
    getState: () => ({ settings: {} }),
    setState: vi.fn(),
  },
}));

describe('sincronização de definições', () => {
  it('nunca envia a chave Gemini pessoal para o Firestore', async () => {
    const { sanitizeSettingsPayload } = await import('../firestoreSync');
    const payload = sanitizeSettingsPayload({ geminiApiKey: 'AIza-segredo', theme: 'dark' }, true);
    expect(payload).not.toHaveProperty('geminiApiKey');
    expect(payload).toHaveProperty('theme', 'dark');
  });
});
