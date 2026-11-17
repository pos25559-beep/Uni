import { describe, expect, it } from 'vitest';
import { hasAiAccess, isRetryableAiStatus } from '../aiAccess';
import { SHARED_CONTEXT_TOKEN_BUDGET } from '../materialContent';

describe('acesso à IA (ADR-001)', () => {
  it('exige consentimento e confirmação de 18+ em conjunto', () => {
    expect(hasAiAccess({})).toBe(false);
    expect(hasAiAccess({ aiConsent: true })).toBe(false);
    expect(hasAiAccess({ aiAgeConfirmed18Plus: true })).toBe(false);
    expect(hasAiAccess({ aiConsent: true, aiAgeConfirmed18Plus: false })).toBe(false);
    expect(hasAiAccess({ aiConsent: true, aiAgeConfirmed18Plus: true })).toBe(true);
  });

  it('não repete noutros modelos um pedido inválido (400) nem recusado (403)', () => {
    expect(isRetryableAiStatus(400)).toBe(false);
    expect(isRetryableAiStatus(403)).toBe(false);
    expect(isRetryableAiStatus(401)).toBe(false);
    expect(isRetryableAiStatus(undefined)).toBe(false);
    for (const code of [404, 429, 500, 503, 504]) expect(isRetryableAiStatus(code)).toBe(true);
  });

  it('limita o contexto do Uni partilhado a 60 mil tokens', () => {
    expect(SHARED_CONTEXT_TOKEN_BUDGET).toBe(60_000);
  });
});
