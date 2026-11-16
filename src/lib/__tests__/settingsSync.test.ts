import { describe, expect, it, vi } from 'vitest';

vi.mock('../firebase', () => ({ auth: { currentUser: null }, db: {} }));

describe('sincronização de definições', () => {
  it('nunca envia a chave Gemini pessoal para o Firestore', async () => {
    const { sanitizeSettingsPayload } = await import('../firestoreSync');
    const payload = sanitizeSettingsPayload({ geminiApiKey: 'AIza-segredo', theme: 'dark' }, true);
    expect(payload).not.toHaveProperty('geminiApiKey');
    expect(payload).toHaveProperty('theme', 'dark');
  });
});
