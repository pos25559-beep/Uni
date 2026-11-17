// Modelos, tempos limite e erros do cliente Gemini. Funções puras, sem rede nem estado.
import { ThinkingLevel, type GenerationConfig, type ThinkingConfig } from 'firebase/ai';
import { tr } from '../../i18n/tr';
import { isRetryableAiStatus } from '../../lib/aiAccess';
import { HttpStatusError, ModelTimeoutError } from '../../lib/geminiErrors';

export const DEFAULT_MODEL = 'gemini-4-hydrogen';
export const FALLBACK_MODELS = ['gemini-3.1-flash-lite'] as const;
export const LEGACY_REMOVED_MODELS = new Set(['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
export const PRIMARY_TIMEOUT_MS = 25_000;
export const CHAT_ATTACHMENT_PRIMARY_TIMEOUT_MS = 60_000;
export const CHAT_ATTACHMENT_FALLBACK_TIMEOUT_MS = 90_000;
export const OCR_PRIMARY_TIMEOUT_MS = 12_000;
export const FALLBACK_TIMEOUT_MS = 75_000;
export const STREAM_IDLE_TIMEOUT_MS = 45_000;
export const MODEL_COOLDOWN_MS = 120_000;

/** Perfis de raciocínio interno (ThinkingLevel) aplicados a modelos Gemini 4. */
export const THINKING_FAST: ThinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
export const THINKING_BALANCED: ThinkingConfig = { thinkingLevel: ThinkingLevel.MEDIUM };
export const THINKING_DEEP: ThinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };

export function resolveChatThinkingConfig(model: string): ThinkingConfig {
  return model.startsWith('gemini-4-argon') ? THINKING_DEEP : THINKING_BALANCED;
}

export class AiConsentRequiredError extends Error {
  constructor() {
    super(tr('common:errors.aiConsentRequired'));
    this.name = 'AiConsentRequiredError';
  }
}

export function isFallbackEligible(err: unknown, outerAborted?: boolean): boolean {
  if (outerAborted) return false;
  if (err instanceof ModelTimeoutError) return true;
  const statusCode = err instanceof HttpStatusError ? err.statusCode : undefined;
  if (isRetryableAiStatus(statusCode)) return true;
  const lower = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return (
    lower.includes('model not found') ||
    lower.includes('is not found for api version') ||
    lower.includes('is not supported for generatecontent') ||
    lower.includes('not supported') ||
    lower.includes('invalid argument') ||
    lower.includes('billing') ||
    lower.includes('free tier') ||
    lower.includes('no longer available') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota exceeded') ||
    lower.includes('rate limit') ||
    lower.includes('overloaded') ||
    lower.includes('high demand') ||
    lower.includes('temporarily unavailable') ||
    lower.includes('timed out') ||
    lower.includes('timeout')
  );
}

export function sanitizeGenerationConfigForModel(
  model: string,
  config?: GenerationConfig,
): GenerationConfig | undefined {
  if (!config) return undefined;
  const isGemini4 = model.startsWith('gemini-4');
  const next: GenerationConfig = { ...config };

  if (!isGemini4) {
    // Modelos de fallback fora da série 4 (ex.: gemini-3.1-flash-lite) não recebem thinkingLevel 4.x
    delete next.thinkingConfig;
    return Object.keys(next).length > 0 ? next : undefined;
  }

  delete next.temperature;
  delete next.topP;
  delete next.topK;
  if (next.maxOutputTokens !== undefined && next.maxOutputTokens < 32768) {
    next.maxOutputTokens = 32768;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}
