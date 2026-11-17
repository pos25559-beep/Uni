// Modelos, tempos limite e erros do cliente Gemini. Funções puras, sem rede nem estado.
import type { GenerationConfig } from 'firebase/ai';
import { isRetryableAiStatus } from '../../lib/aiAccess';
import { HttpStatusError, ModelTimeoutError } from '../../lib/geminiErrors';

export const DEFAULT_MODEL = 'gemini-4-hydrogen';
export const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'] as const;
export const PRIMARY_TIMEOUT_MS = 10_000;
export const CHAT_ATTACHMENT_PRIMARY_TIMEOUT_MS = 18_000;
export const OCR_PRIMARY_TIMEOUT_MS = 8_000;
export const FALLBACK_TIMEOUT_MS = 25_000;
export const STREAM_IDLE_TIMEOUT_MS = 25_000;
export const MODEL_COOLDOWN_MS = 120_000;

export class AiConsentRequiredError extends Error {
  constructor() {
    super('Ativa primeiro o Uni com 1 toque para que ele possa responder às tuas perguntas.');
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
  const isFlashLite35 = model.startsWith('gemini-3.5-flash-lite');
  if (!isGemini4 && !isFlashLite35) {
    return config;
  }
  const next: GenerationConfig = { ...config };
  delete next.temperature;
  delete next.topP;
  delete next.topK;
  if (isGemini4 && next.maxOutputTokens !== undefined && next.maxOutputTokens < 32768) {
    next.maxOutputTokens = 32768;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}
