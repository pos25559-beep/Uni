import { describe, expect, it } from 'vitest';
import { startUniLiveVoiceSession } from '../../integrations/geminiLiveVoice';
import { AiConsentRequiredError } from '../../integrations/gemini/models';
import { useStore } from '../../store/useStore';

// ADR-001: a Voz Live não pode abrir o microfone nem ligar à Google sem consentimento e 18+.
describe('Voz Live e consentimento', () => {
  const noop = () => {};
  const args = {
    apiKey: 'AIza-test-key',
    persona: 'amigo' as const,
    accessory: 'none' as never,
    studentName: 'Teste',
    language: 'pt-PT',
    onStatusChange: noop,
    onTranscript: noop,
    onToolProposal: noop,
    onError: noop,
  };

  it('recusa sem consentimento, mesmo com chave própria', async () => {
    useStore.setState((s) => ({ settings: { ...s.settings, aiConsent: false, aiAgeConfirmed18Plus: true } }));
    await expect(startUniLiveVoiceSession(args)).rejects.toBeInstanceOf(AiConsentRequiredError);
  });

  it('recusa sem confirmação de 18 anos', async () => {
    useStore.setState((s) => ({ settings: { ...s.settings, aiConsent: true, aiAgeConfirmed18Plus: false } }));
    await expect(startUniLiveVoiceSession(args)).rejects.toBeInstanceOf(AiConsentRequiredError);
  });
});
