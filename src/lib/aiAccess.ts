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

/**
 * Erro de sobrecarga momentânea do Gemini («high demand», 429, 503, tempo esgotado):
 * vale a pena esperar uns segundos e tentar de novo a cadeia de modelos.
 */
export function isOverloadError(err: unknown): boolean {
  const status = (err as { statusCode?: unknown } | null)?.statusCode;
  if (status === 429 || status === 503 || status === 504) return true;
  const name = (err as { name?: unknown } | null)?.name;
  if (name === 'ModelTimeoutError') return true;
  const lower = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return (
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('unavailable') ||
    lower.includes('try again later') ||
    lower.includes('deadline')
  );
}

/** Espera antes da tentativa n (1, 2, …): 3 s, 8 s, 15 s. */
export function overloadBackoffMs(attempt: number): number {
  return [3_000, 8_000, 15_000][Math.min(attempt, 3) - 1] ?? 15_000;
}
