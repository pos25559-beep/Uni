// Regras puras de acesso à IA (ADR-001), separadas do cliente Gemini para serem testáveis.
import type { Settings } from '../types';

/** A IA só pode ser chamada com consentimento E confirmação de 18 anos ou mais. */
export function hasAiAccess(settings: Pick<Settings, 'aiConsent' | 'aiAgeConfirmed18Plus'>): boolean {
  return Boolean(settings.aiConsent) && Boolean(settings.aiAgeConfirmed18Plus);
}

/**
 * Estados HTTP em que vale a pena tentar o modelo seguinte.
 * 400 (pedido inválido) e 403 (App Check/permissões) falham igual em todos os modelos.
 */
export function isRetryableAiStatus(statusCode: number | undefined): boolean {
  return (
    statusCode === 404 ||
    statusCode === 429 ||
    statusCode === 500 ||
    statusCode === 503 ||
    statusCode === 504
  );
}
