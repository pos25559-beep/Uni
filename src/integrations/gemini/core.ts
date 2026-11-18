// Núcleo do cliente Gemini: configuração, cadeia de modelos com tempo limite, chamadas REST e nativas.
import type { Content, GenerationConfig, Part } from 'firebase/ai';
import {
  consumeDailyQuota,
  recordAiTokenUsage,
  refundDailyQuota,
  type QuotaKind,
} from '../../lib/aiQuota';
import { tr } from '../../i18n/tr';
import { friendlyCustomKeyError, HttpStatusError, ModelTimeoutError } from '../../lib/geminiErrors';
import { isOverloadError, overloadBackoffMs } from '../../lib/aiAccess';
import { hasAiAccess } from '../../lib/aiAccess';
import { getNativeAI } from '../../lib/firebase';
import { useStore } from '../../store/useStore';
import {
  AiConsentRequiredError,
  DEFAULT_MODEL,
  FALLBACK_MODELS,
  FALLBACK_TIMEOUT_MS,
  LEGACY_REMOVED_MODELS,
  MODEL_COOLDOWN_MS,
  PRIMARY_TIMEOUT_MS,
  STREAM_IDLE_TIMEOUT_MS,
  isFallbackEligible,
  sanitizeGenerationConfigForModel,
} from './models';

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  dataBase64: string;
  fileUri?: string;
  sizeBytes: number;
  /** Tokens que o ficheiro ocupa no contexto (medidos via countTokens ou estimados). */
  tokenCount?: number;
}

interface GenerateResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string; status?: string };
}

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Guarda modelos temporariamente congestionados/sem resposta para evitar esperas repetidas na sessão. */
const modelCooldownUntil = new Map<string, number>();

export function getCustomGeminiKey(): string {
  const saved = (useStore.getState().settings.geminiApiKey ?? '').trim();
  if (saved) return saved;
  return import.meta.env.DEV ? String(import.meta.env.VITE_GEMINI_API_KEY ?? '').trim() : '';
}

export function resolveGeminiConfig() {
  const settings = useStore.getState().settings;
  const { geminiModel } = settings;
  if (!hasAiAccess(settings)) {
    throw new AiConsentRequiredError();
  }
  const customKey = getCustomGeminiKey();
  const raw = geminiModel.trim();
  const isLegacyOrInvalid =
    !raw ||
    LEGACY_REMOVED_MODELS.has(raw) ||
    raw.startsWith('gemini-1.') ||
    raw.startsWith('gemini-2.0') ||
    (!customKey && raw.startsWith('gemini-2.'));
  const model = isLegacyOrInvalid ? DEFAULT_MODEL : raw;
  return { customKey, model };
}

function getModelCandidates(primary: string): string[] {
  const unique = Array.from(new Set([primary, ...FALLBACK_MODELS]));
  const now = Date.now();
  const ready = unique.filter((m) => (modelCooldownUntil.get(m) ?? 0) <= now);
  const cooling = unique.filter((m) => (modelCooldownUntil.get(m) ?? 0) > now);
  return [...ready, ...cooling];
}

function runWithTimeout<T>(args: {
  model: string;
  timeoutMs: number;
  idleTimeoutMs?: number;
  outerSignal?: AbortSignal;
  fn: (ctx: { signal: AbortSignal; bumpIdle: () => void }) => Promise<T>;
}): Promise<T> {
  if (args.outerSignal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;

  return new Promise<T>((resolve, reject) => {
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      args.outerSignal?.removeEventListener('abort', onOuterAbort);
    };

    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const onOuterAbort = () => {
      controller.abort();
      fail(new DOMException('Aborted', 'AbortError'));
    };

    const armTimer = (ms: number) => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        const timeoutErr = new ModelTimeoutError(args.model, ms);
        controller.abort(timeoutErr);
        fail(timeoutErr);
      }, ms);
    };

    args.outerSignal?.addEventListener('abort', onOuterAbort, { once: true });
    armTimer(args.timeoutMs);

    args.fn({
      signal: controller.signal,
      bumpIdle: () => {
        if (!settled) armTimer(args.idleTimeoutMs ?? STREAM_IDLE_TIMEOUT_MS);
      },
    }).then(
      (res) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(res);
      },
      (err) => fail(err),
    );
  });
}

/** Espera que termina logo (com AbortError) se o pedido for cancelado entretanto. */
function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function runModelChain<T>(args: {
  primaryModel: string;
  primaryTimeoutMs?: number;
  fallbackTimeoutMs?: number;
  /** Quantas vezes repetir a cadeia inteira quando a Google está sobrecarregada (por omissão 0). */
  overloadRetries?: number;
  idleTimeoutMs?: number;
  outerSignal?: AbortSignal;
  attempt: (model: string, ctx: { signal: AbortSignal; bumpIdle: () => void }) => Promise<T>;
}): Promise<T> {
  const retries = Math.max(0, args.overloadRetries ?? 0);
  for (let round = 0; ; round++) {
    try {
      return await runModelChainOnce(args);
    } catch (err) {
      if (round >= retries || args.outerSignal?.aborted || !isOverloadError(err)) throw err;
      // Pedidos longos (guias, cadernos): não desistir à primeira «procura alta».
      // Não se limpa o arrefecimento dos modelos: é partilhado com outros pedidos a correr ao mesmo tempo
      // (a cadeia tenta sempre todos os modelos; o arrefecimento só muda a ordem).
      await abortableDelay(overloadBackoffMs(round + 1), args.outerSignal);
    }
  }
}

async function runModelChainOnce<T>(args: {
  primaryModel: string;
  primaryTimeoutMs?: number;
  fallbackTimeoutMs?: number;
  idleTimeoutMs?: number;
  outerSignal?: AbortSignal;
  attempt: (model: string, ctx: { signal: AbortSignal; bumpIdle: () => void }) => Promise<T>;
}): Promise<T> {
  const candidates = getModelCandidates(args.primaryModel);
  let lastError: unknown;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const hasMore = i < candidates.length - 1;
    const timeoutMs = hasMore
      ? (args.primaryTimeoutMs ?? PRIMARY_TIMEOUT_MS)
      : (args.fallbackTimeoutMs ?? FALLBACK_TIMEOUT_MS);

    try {
      const result = await runWithTimeout({
        model: candidate,
        timeoutMs,
        idleTimeoutMs: args.idleTimeoutMs,
        outerSignal: args.outerSignal,
        fn: (ctx) => args.attempt(candidate, ctx),
      });
      modelCooldownUntil.delete(candidate);
      return result;
    } catch (err) {
      lastError = err;
      if (hasMore && isFallbackEligible(err, args.outerSignal?.aborted)) {
        modelCooldownUntil.set(candidate, Date.now() + MODEL_COOLDOWN_MS);
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

function friendlyNativeAiError(err: unknown): Error {
  if (err instanceof ModelTimeoutError) {
    return new Error(
      tr('common:errors.nativeAiTimeout', { seconds: Math.round(FALLBACK_TIMEOUT_MS / 1000) }),
    );
  }
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (import.meta.env.DEV) {
    console.warn('[Uni IA]', raw);
  }
  const lower = raw.toLowerCase();
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return new Error(tr('common:errors.nativeAiQuota'));
  }
  if (
    lower.includes('firebasevertexai') ||
    lower.includes('api has not been used') ||
    lower.includes('permission_denied') ||
    lower.includes('app check') ||
    lower.includes('403')
  ) {
    return new Error(tr('common:errors.nativeAiUnavailable'));
  }
  return new Error(tr('common:errors.nativeAiGeneric'));
}

export function buildContentsWithAttachments(
  messages: { role: 'user' | 'model'; text: string }[],
  attachments?: ChatAttachment[],
): Content[] {
  const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === 'user');
  const attachIndex = lastUserIdx >= 0 ? messages.length - 1 - lastUserIdx : messages.length - 1;

  return messages.map((m, idx) => {
    const parts: Part[] = [{ type: 'text', text: m.text }];
    if (idx === attachIndex && attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.fileUri) {
          parts.push({
            type: 'fileData',
            fileData: {
              mimeType: att.mimeType,
              fileUri: att.fileUri,
            },
          });
        } else if (att.dataBase64) {
          parts.push({
            type: 'inlineData',
            inlineData: {
              mimeType: att.mimeType,
              data: att.dataBase64,
            },
          });
        }
      }
    }
    return { role: m.role, parts };
  });
}

function toRestContents(contents: Content[]) {
  return contents.map((c) => ({
    role: c.role,
    parts: c.parts.map((p) =>
      p.type === 'fileData'
        ? { fileData: p.fileData }
        : p.type === 'inlineData'
          ? { inlineData: p.inlineData }
          : { text: 'text' in p ? p.text : '' },
    ),
  }));
}

export async function callDirectRest(args: {
  key: string;
  model: string;
  contents: Content[];
  system?: string;
  generationConfig?: GenerationConfig;
  signal?: AbortSignal;
  primaryTimeoutMs?: number;
  fallbackTimeoutMs?: number;
  overloadRetries?: number;
}): Promise<string> {
  try {
    return await runModelChain({
      primaryModel: args.model,
      primaryTimeoutMs: args.primaryTimeoutMs,
      fallbackTimeoutMs: args.fallbackTimeoutMs,
      overloadRetries: args.overloadRetries,
      outerSignal: args.signal,
      attempt: async (targetModel, ctx) => {
        const safeConfig = sanitizeGenerationConfigForModel(targetModel, args.generationConfig);
        const res = await fetch(`${API_BASE}/${encodeURIComponent(targetModel)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': args.key },
          body: JSON.stringify({
            ...(args.system ? { systemInstruction: { parts: [{ text: args.system }] } } : {}),
            contents: toRestContents(args.contents),
            ...(safeConfig ? { generationConfig: safeConfig } : {}),
          }),
          signal: ctx.signal,
        });
        const data = (await res.json().catch(() => null)) as GenerateResponse | null;
        if (!res.ok) {
          throw new HttpStatusError(
            res.status,
            data?.error?.message ?? tr('common:errors.restHttpError', { status: res.status }),
          );
        }

        const candidate = data?.candidates?.[0];
        if (!candidate) {
          const reason = data?.promptFeedback?.blockReason;
          throw new Error(
            reason
              ? tr('common:errors.restBlocked', { reason })
              : tr('common:errors.restEmpty'),
          );
        }
        if (data?.usageMetadata) {
          recordAiTokenUsage(
            data.usageMetadata.promptTokenCount ?? 0,
            data.usageMetadata.candidatesTokenCount ?? 0,
          );
        } else {
          recordAiTokenUsage();
        }
        return (candidate.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
      },
    });
  } catch (err) {
    if (args.signal?.aborted) throw err;
    throw friendlyCustomKeyError(err);
  }
}

export async function callDirectRestStream(args: {
  key: string;
  model: string;
  contents: Content[];
  system: string;
  generationConfig?: GenerationConfig;
  signal?: AbortSignal;
  primaryTimeoutMs?: number;
  fallbackTimeoutMs?: number;
  overloadRetries?: number;
  onToken: (accumulatedText: string) => void;
}): Promise<string> {
  try {
    return await runModelChain({
      primaryModel: args.model,
      primaryTimeoutMs: args.primaryTimeoutMs,
      fallbackTimeoutMs: args.fallbackTimeoutMs,
      overloadRetries: args.overloadRetries,
      outerSignal: args.signal,
      attempt: async (targetModel, ctx) => {
        const safeConfig = sanitizeGenerationConfigForModel(targetModel, args.generationConfig);
        const res = await fetch(
          `${API_BASE}/${encodeURIComponent(targetModel)}:streamGenerateContent?alt=sse`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': args.key },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: args.system }] },
              contents: toRestContents(args.contents),
              ...(safeConfig ? { generationConfig: safeConfig } : {}),
            }),
            signal: ctx.signal,
          },
        );
        if (!res.ok || !res.body) {
          const errBody = (await res.json().catch(() => null)) as GenerateResponse | null;
          throw new HttpStatusError(
            res.status,
            errBody?.error?.message ?? tr('common:errors.restHttpError', { status: res.status }),
          );
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';
        let promptTokens = 0;
        let outputTokens = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          ctx.bumpIdle();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const jsonStr = line.slice(5).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;
            try {
              const chunk = JSON.parse(jsonStr) as GenerateResponse;
              if (chunk.usageMetadata) {
                promptTokens = chunk.usageMetadata.promptTokenCount ?? promptTokens;
                outputTokens = chunk.usageMetadata.candidatesTokenCount ?? outputTokens;
              }
              const delta = (chunk.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
              if (delta) {
                accumulated += delta;
                args.onToken(accumulated);
              }
            } catch {
              // Ignora blocos parciais malformados até próximo evento
            }
          }
        }
        const trailing = buffer + decoder.decode();
        if (trailing.startsWith('data:')) {
          const jsonStr = trailing.slice(5).trim();
          if (jsonStr && jsonStr !== '[DONE]') {
            try {
              const chunk = JSON.parse(jsonStr) as GenerateResponse;
              if (chunk.usageMetadata) {
                promptTokens = chunk.usageMetadata.promptTokenCount ?? promptTokens;
                outputTokens = chunk.usageMetadata.candidatesTokenCount ?? outputTokens;
              }
              const delta = (chunk.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
              if (delta) {
                accumulated += delta;
                args.onToken(accumulated);
              }
            } catch {
              // ignore incomplete trailing line
            }
          }
        }

        recordAiTokenUsage(promptTokens, outputTokens);
        return accumulated.trim();
      },
    });
  } catch (err) {
    if (args.signal?.aborted) throw err;
    throw friendlyCustomKeyError(err);
  }
}

export async function runNativeGenerate(args: {
  model: string;
  contents: Content[];
  system?: string;
  generationConfig?: GenerationConfig;
  signal?: AbortSignal;
  primaryTimeoutMs?: number;
  fallbackTimeoutMs?: number;
  overloadRetries?: number;
}): Promise<string> {
  const [ai, { getGenerativeModel }] = await Promise.all([getNativeAI(), import('firebase/ai')]);
  try {
    return await runModelChain({
      primaryModel: args.model,
      primaryTimeoutMs: args.primaryTimeoutMs,
      fallbackTimeoutMs: args.fallbackTimeoutMs,
      overloadRetries: args.overloadRetries,
      outerSignal: args.signal,
      attempt: async (targetModel, ctx) => {
        const safeConfig = sanitizeGenerationConfigForModel(targetModel, args.generationConfig);
        const gm = getGenerativeModel(ai, {
          model: targetModel,
          ...(args.system ? { systemInstruction: args.system } : {}),
          ...(safeConfig ? { generationConfig: safeConfig } : {}),
        });
        const result = await gm.generateContent(
          { contents: args.contents },
          {
            signal: ctx.signal,
            timeout: Math.max(FALLBACK_TIMEOUT_MS, args.primaryTimeoutMs ?? 0, args.fallbackTimeoutMs ?? 0),
          },
        );
        const usage = (
          result.response as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }
        ).usageMetadata;
        recordAiTokenUsage(usage?.promptTokenCount ?? 0, usage?.candidatesTokenCount ?? 0);
        return result.response.text().trim();
      },
    });
  } catch (err) {
    if (args.signal?.aborted) throw err;
    throw friendlyNativeAiError(err);
  }
}

export async function runNativeStream(args: {
  model: string;
  contents: Content[];
  system: string;
  generationConfig?: GenerationConfig;
  signal?: AbortSignal;
  primaryTimeoutMs?: number;
  fallbackTimeoutMs?: number;
  overloadRetries?: number;
  onToken: (accumulatedText: string) => void;
}): Promise<string> {
  const [ai, { getGenerativeModel }] = await Promise.all([getNativeAI(), import('firebase/ai')]);
  try {
    return await runModelChain({
      primaryModel: args.model,
      primaryTimeoutMs: args.primaryTimeoutMs,
      fallbackTimeoutMs: args.fallbackTimeoutMs,
      overloadRetries: args.overloadRetries,
      outerSignal: args.signal,
      attempt: async (targetModel, ctx) => {
        const safeConfig = sanitizeGenerationConfigForModel(targetModel, args.generationConfig);
        const gm = getGenerativeModel(ai, {
          model: targetModel,
          systemInstruction: args.system,
          ...(safeConfig ? { generationConfig: safeConfig } : {}),
        });
        const streamRes = await gm.generateContentStream(
          { contents: args.contents },
          {
            signal: ctx.signal,
            timeout: Math.max(FALLBACK_TIMEOUT_MS, args.primaryTimeoutMs ?? 0, args.fallbackTimeoutMs ?? 0),
          },
        );
        let accumulated = '';
        for await (const chunk of streamRes.stream) {
          ctx.bumpIdle();
          const piece = chunk.text();
          if (piece) {
            accumulated += piece;
            args.onToken(accumulated);
          }
        }
        try {
          const finalRes = await streamRes.response;
          const usage = (
            finalRes as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }
          ).usageMetadata;
          recordAiTokenUsage(usage?.promptTokenCount ?? 0, usage?.candidatesTokenCount ?? 0);
        } catch {
          recordAiTokenUsage();
        }
        return accumulated.trim();
      },
    });
  } catch (err) {
    if (args.signal?.aborted) throw err;
    throw friendlyNativeAiError(err);
  }
}

export async function withQuotaAndFallback<T>(
  kind: QuotaKind,
  customKey: string,
  fn: () => Promise<T>,
): Promise<T> {
  const bypassed = Boolean(customKey);
  consumeDailyQuota(kind, bypassed);
  try {
    return await fn();
  } catch (err) {
    refundDailyQuota(kind, bypassed);
    throw err;
  }
}
