import { describe, expect, it } from 'vitest';
import { isDailyQuotaError, isOverloadError, overloadBackoffMs } from '../aiAccess';

// Novas tentativas do Gemini: repetir só quando a sobrecarga é momentânea.
describe('novas tentativas da IA', () => {
  const withStatus = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

  it('repete «procura alta», 503 e tempo esgotado', () => {
    expect(isOverloadError(withStatus('The model is overloaded', 503))).toBe(true);
    expect(isOverloadError(new Error('This model is currently experiencing high demand'))).toBe(true);
    expect(isOverloadError(Object.assign(new Error('x'), { name: 'ModelTimeoutError' }))).toBe(true);
    expect(isOverloadError(withStatus('Resource has been exhausted (e.g. check quota).', 429))).toBe(true);
  });

  it('não repete quando a quota diária acabou', () => {
    const daily = withStatus(
      'Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 250, quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier',
      429,
    );
    expect(isDailyQuotaError(daily)).toBe(true);
    expect(isOverloadError(daily)).toBe(false);
  });

  it('não repete pedidos inválidos ou sem permissão', () => {
    expect(isOverloadError(withStatus('API key not valid', 400))).toBe(false);
    expect(isOverloadError(withStatus('Permission denied', 403))).toBe(false);
  });

  it('espera cada vez mais, com teto', () => {
    expect(overloadBackoffMs(1)).toBeLessThan(overloadBackoffMs(2));
    expect(overloadBackoffMs(9)).toBe(overloadBackoffMs(3));
  });
});
