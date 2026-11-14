// Cliente híbrido da API Gemini: usa Firebase AI Logic de forma nativa (sem chave API manual)
// com App Check e quota conservadora, ou chave pessoal opcional em Definições → Avançado.
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { getGenerativeModel, type Content, type GenerationConfig, type Part } from 'firebase/ai';
import { statusLabel } from '../lib/colors';
import { consumeDailyQuota, refundDailyQuota, type QuotaKind } from '../lib/aiQuota';
import { getNativeAI } from '../lib/firebase';
import { readNormalizedScreenshot } from '../lib/imageUpload';
import {
  collectKnownCourseCandidates,
  getDegreeCurriculum,
  type CourseIdentityCandidate,
} from '../lib/portugalCurriculum';
import {
  daysUntil, fmtGrade, fmtMinutes, gradeSummary, minutesThisWeek, readiness, studyStreak,
  todayStr, upcomingAssessments,
} from '../lib/selectors';
import type { UniAccessoryId, UniPersonaMode } from '../lib/uniAccessories';
import {
  parseHistoryJsonText,
  parseScheduleJsonText,
  type ExtractedHistoryItem,
  type ExtractedScheduleAssessment,
  type ExtractedSchedulePayload,
  type ExtractedScheduleSlot,
} from '../lib/visionParsers';
import { useStore } from '../store/useStore';
import type { AppState } from '../store/useStore';
import type { AppTone, Material } from '../types';

export type {
  ExtractedHistoryItem,
  ExtractedScheduleAssessment,
  ExtractedSchedulePayload,
  ExtractedScheduleSlot,
};
export { parseHistoryJsonText, parseScheduleJsonText };

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  dataBase64: string;
  sizeBytes: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  /** ISO datetime */
  at: string;
  sourceDocTitles?: string[];
  attachmentNames?: string[];
}

interface GenerateResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_CONTEXT_CHARS = 4500;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const DEFAULT_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'] as const;
const PRIMARY_TIMEOUT_MS = 10_000;
const CHAT_ATTACHMENT_PRIMARY_TIMEOUT_MS = 18_000;
const OCR_PRIMARY_TIMEOUT_MS = 8_000;
const FALLBACK_TIMEOUT_MS = 25_000;
const STREAM_IDLE_TIMEOUT_MS = 25_000;
const MODEL_COOLDOWN_MS = 120_000;

/** Guarda modelos temporariamente congestionados/sem resposta para evitar esperas repetidas na sessão. */
const modelCooldownUntil = new Map<string, number>();

class ModelTimeoutError extends Error {
  constructor(model: string, timeoutMs: number) {
    super(`Timeout após ${Math.round(timeoutMs / 1000)}s ao aguardar ${model}.`);
    this.name = 'ModelTimeoutError';
  }
}

class HttpStatusError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class AiConsentRequiredError extends Error {
  constructor() {
    super('Ativa primeiro o Uni com 1 toque para que ele possa responder às tuas perguntas.');
    this.name = 'AiConsentRequiredError';
  }
}

export function getCustomGeminiKey(): string {
  const saved = (useStore.getState().settings.geminiApiKey ?? '').trim();
  if (saved) return saved;
  return import.meta.env.DEV ? String(import.meta.env.VITE_GEMINI_API_KEY ?? '').trim() : '';
}

export function hasCustomGeminiKey(): boolean {
  return Boolean(getCustomGeminiKey());
}

/** Converte uma imagem ou PDF anexado pelo utilizador em parte multimodal pronta e leve para o Gemini. */
export async function fileToChatAttachment(file: File): Promise<ChatAttachment> {
  const isImage =
    file.type.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|heic|heif|bmp)$/i.test(file.name);
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isImage && !isPdf) {
    throw new Error(`Formato não suportado (${file.name}). Anexa imagens (PNG/JPG/WebP) ou PDFs.`);
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`O ficheiro "${file.name}" excede 8 MB. Escolhe uma versão mais leve.`);
  }

  if (isImage) {
    try {
      const normalized = await readNormalizedScreenshot(file);
      return {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        mimeType: normalized.mimeType,
        dataBase64: normalized.base64,
        sizeBytes: Math.round((normalized.base64.length * 3) / 4),
      };
    } catch {
      // fallback abaixo se descodificação canvas falhar
    }
  }

  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error(`Não foi possível ler "${file.name}".`));
    reader.readAsDataURL(file);
  });

  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    mimeType: isPdf ? 'application/pdf' : file.type || 'image/jpeg',
    dataBase64,
    sizeBytes: file.size,
  };
}

function resolveGeminiConfig() {
  const { geminiModel, aiConsent } = useStore.getState().settings;
  if (!aiConsent) {
    throw new AiConsentRequiredError();
  }
  const customKey = getCustomGeminiKey();
  const raw = geminiModel.trim();
  const isLegacyOrInvalid =
    !raw ||
    raw.startsWith('gemini-1.') ||
    raw.startsWith('gemini-2.') ||
    raw === 'gemini-4-hydrogen';
  const model = isLegacyOrInvalid ? DEFAULT_MODEL : raw;
  return { customKey, model };
}

function isFallbackEligible(err: unknown, outerAborted?: boolean): boolean {
  if (outerAborted) return false;
  if (err instanceof ModelTimeoutError) return true;
  const statusCode = err instanceof HttpStatusError ? err.statusCode : undefined;
  if (statusCode === 404 || statusCode === 429 || statusCode === 500 || statusCode === 503 || statusCode === 504) {
    return true;
  }
  const lower = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  if (statusCode === 400 && lower.includes('model')) return true;
  return (
    lower.includes('model not found') ||
    lower.includes('is not found for api version') ||
    lower.includes('is not supported for generatecontent') ||
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

async function runModelChain<T>(args: {
  primaryModel: string;
  primaryTimeoutMs?: number;
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
      : FALLBACK_TIMEOUT_MS;

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
    return new Error('O Uni demorou demasiado tempo a responder agora. Tenta novamente dentro de instantes.');
  }
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (import.meta.env.DEV) {
    console.warn('[Uni IA]', raw);
  }
  const lower = raw.toLowerCase();
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return new Error(
      'O serviço está com muitos pedidos neste momento. Aguarda 1 minuto e tenta novamente ou usa uma chave pessoal em Definições → Tutor.',
    );
  }
  if (
    lower.includes('firebasevertexai') ||
    lower.includes('api has not been used') ||
    lower.includes('permission_denied') ||
    lower.includes('app check') ||
    lower.includes('403')
  ) {
    return new Error(
      'O Tutor Uni está temporariamente indisponível para pedidos sem chave própria. Podes tentar novamente mais tarde ou usar uma chave em Definições → Tutor.',
    );
  }
  return new Error('Não foi possível contactar o Uni agora. Tenta novamente dentro de instantes.');
}

function buildContentsWithAttachments(
  messages: { role: 'user' | 'model'; text: string }[],
  attachments?: ChatAttachment[],
): Content[] {
  const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === 'user');
  const attachIndex = lastUserIdx >= 0 ? messages.length - 1 - lastUserIdx : messages.length - 1;

  return messages.map((m, idx) => {
    const parts: Part[] = [{ type: 'text', text: m.text }];
    if (idx === attachIndex && attachments && attachments.length > 0) {
      for (const att of attachments) {
        parts.push({
          type: 'inlineData',
          inlineData: {
            mimeType: att.mimeType,
            data: att.dataBase64,
          },
        });
      }
    }
    return { role: m.role, parts };
  });
}

function toRestContents(contents: Content[]) {
  return contents.map((c) => ({
    role: c.role,
    parts: c.parts.map((p) =>
      p.type === 'inlineData'
        ? { inlineData: p.inlineData }
        : { text: 'text' in p ? p.text : '' },
    ),
  }));
}

async function callDirectRest(args: {
  key: string;
  model: string;
  contents: Content[];
  system?: string;
  generationConfig?: GenerationConfig;
  signal?: AbortSignal;
  primaryTimeoutMs?: number;
}): Promise<string> {
  return runModelChain({
    primaryModel: args.model,
    primaryTimeoutMs: args.primaryTimeoutMs,
    outerSignal: args.signal,
    attempt: async (targetModel, ctx) => {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(targetModel)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': args.key },
        body: JSON.stringify({
          ...(args.system ? { systemInstruction: { parts: [{ text: args.system }] } } : {}),
          contents: toRestContents(args.contents),
          generationConfig: args.generationConfig,
        }),
        signal: ctx.signal,
      });
      const data = (await res.json().catch(() => null)) as GenerateResponse | null;
      if (!res.ok) {
        throw new HttpStatusError(
          res.status,
          data?.error?.message ?? `Erro ${res.status} ao contactar o Uni.`,
        );
      }

      const candidate = data?.candidates?.[0];
      if (!candidate) {
        const reason = data?.promptFeedback?.blockReason;
        throw new Error(
          reason
            ? `O Uni pediu para reformulares a pergunta (${reason}).`
            : 'O Uni não devolveu resposta agora. Tenta de novo.',
        );
      }
      return (candidate.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
    },
  });
}

async function callDirectRestStream(args: {
  key: string;
  model: string;
  contents: Content[];
  system: string;
  generationConfig?: GenerationConfig;
  signal?: AbortSignal;
  primaryTimeoutMs?: number;
  onToken: (accumulatedText: string) => void;
}): Promise<string> {
  return runModelChain({
    primaryModel: args.model,
    primaryTimeoutMs: args.primaryTimeoutMs,
    outerSignal: args.signal,
    attempt: async (targetModel, ctx) => {
      const res = await fetch(
        `${API_BASE}/${encodeURIComponent(targetModel)}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': args.key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: args.system }] },
            contents: toRestContents(args.contents),
            generationConfig: args.generationConfig,
          }),
          signal: ctx.signal,
        },
      );
      if (!res.ok || !res.body) {
        const errBody = (await res.json().catch(() => null)) as GenerateResponse | null;
        throw new HttpStatusError(
          res.status,
          errBody?.error?.message ?? `Erro ${res.status} ao contactar o Uni.`,
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

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

      return accumulated.trim();
    },
  });
}

async function runNativeGenerate(args: {
  model: string;
  contents: Content[];
  system?: string;
  generationConfig?: GenerationConfig;
  signal?: AbortSignal;
  primaryTimeoutMs?: number;
}): Promise<string> {
  const ai = getNativeAI();
  try {
    return await runModelChain({
      primaryModel: args.model,
      primaryTimeoutMs: args.primaryTimeoutMs,
      outerSignal: args.signal,
      attempt: async (targetModel, ctx) => {
        const gm = getGenerativeModel(ai, {
          model: targetModel,
          ...(args.system ? { systemInstruction: args.system } : {}),
          generationConfig: args.generationConfig,
        });
        const result = await gm.generateContent(
          { contents: args.contents },
          { signal: ctx.signal, timeout: FALLBACK_TIMEOUT_MS },
        );
        return result.response.text().trim();
      },
    });
  } catch (err) {
    if (args.signal?.aborted) throw err;
    throw friendlyNativeAiError(err);
  }
}

async function runNativeStream(args: {
  model: string;
  contents: Content[];
  system: string;
  generationConfig?: GenerationConfig;
  signal?: AbortSignal;
  primaryTimeoutMs?: number;
  onToken: (accumulatedText: string) => void;
}): Promise<string> {
  const ai = getNativeAI();
  try {
    return await runModelChain({
      primaryModel: args.model,
      primaryTimeoutMs: args.primaryTimeoutMs,
      outerSignal: args.signal,
      attempt: async (targetModel, ctx) => {
        const gm = getGenerativeModel(ai, {
          model: targetModel,
          systemInstruction: args.system,
          generationConfig: args.generationConfig,
        });
        const streamRes = await gm.generateContentStream(
          { contents: args.contents },
          { signal: ctx.signal, timeout: FALLBACK_TIMEOUT_MS },
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
        return accumulated.trim();
      },
    });
  } catch (err) {
    if (args.signal?.aborted) throw err;
    throw friendlyNativeAiError(err);
  }
}

async function withQuotaAndFallback<T>(
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

export interface KnownCourseHint {
  code?: string;
  shortName?: string;
  name: string;
}

function buildKnownCoursesPromptSection(explicitHints?: KnownCourseHint[]): string {
  const state = useStore.getState();
  const profile = state.academicProfile;
  const degreeTemplates =
    profile?.universityId && profile?.degreeId
      ? (getDegreeCurriculum(profile.universityId, profile.degreeId)?.courses ?? [])
      : [];

  const merged: CourseIdentityCandidate[] = collectKnownCourseCandidates({
    extraHints: explicitHints,
    courses: state.courses,
    completedCourses: profile?.completedCourses ?? [],
    degreeTemplates,
  }).slice(0, 40);

  if (merged.length === 0) return '';

  const listText = merged
    .map((c) => (c.code ? `- ${c.code}: ${c.name}` : `- ${c.name}`))
    .join('\n');

  return `\n\nCADEIRAS REAIS CONHECIDAS DO ESTUDANTE (usa esta lista como referência prioritária para resolver siglas):
${listText}
REGRA CRÍTICA ANTI-ALUCINAÇÃO:
- Se o print mostrar apenas uma sigla curta (ex.: "MdF", "SNTI", "FabAd", "C3 D", "TEP") e ela corresponder a uma cadeira da lista acima, usa o nome REAL dessa lista (ex.: "Mecânica dos Fluidos") e mantém a sigla visível em "code"/"courseCode".
- Se uma sigla não existir na lista acima e o nome completo não estiver escrito na imagem, NUNCA adivinhes nem inventes um nome completo — devolve apenas a sigla exata que lês na imagem.`;
}

/** Analisa um print/captura do portal académico com Gemini Vision (nativo ou chave própria). */
export async function parseAcademicHistoryFromScreenshot(
  base64Data: string,
  mimeType: string,
  options?: { currentSemester?: 1 | 2; knownCourses?: KnownCourseHint[] },
): Promise<ExtractedHistoryItem[]> {
  const { customKey, model } = resolveGeminiConfig();
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const activeSemHint =
    options?.currentSemester === 2
      ? 'O aluno está atualmente no 2.º Semestre: cadeiras sem nota em "1º Semestre" ou "1º Trimestre" devem vir com "semester": 1 e "status": "por_fazer" (não estão ativas agora).'
      : options?.currentSemester === 1
        ? 'O aluno está atualmente no 1.º Semestre: cadeiras sem nota em "2º Semestre" ou "2º Trimestre" devem vir com "semester": 2 e "status": "por_fazer" (ainda não começaram).'
        : 'Usa "semester": 1 para cadeiras do 1.º Semestre/1.º Trimestre e "semester": 2 para 2.º Semestre/2.º Trimestre.';

  const knownSection = buildKnownCoursesPromptSection(options?.knownCourses);

  const prompt = `Extrai todas as unidades curriculares (cadeiras/disciplinas) visíveis nesta captura de ecrã de um portal académico ou lista de inscrições/pauta em português.
Devolve APENAS um array JSON válido onde cada item segue exatamente o formato:
{"code": "sigla curta ou null", "name": "nome completo da cadeira", "grade": número entre 0 e 20 ou null se ainda não tiver nota, "ects": número ou 6, "semester": 1 | 2 | null, "status": "aprovada" | "a_fazer" | "por_fazer"}
Regras:
- Se tiver nota >= 10 (ou "Aprovado"), status = "aprovada".
- Se houver secções ou cabeçalhos como "1º Semestre", "2º Semestre", "1º Trimestre", "2º Trimestre", preenche sempre "semester": 1 (para 1.º Semestre/1.º Trimestre) ou "semester": 2 (para 2.º Semestre/2.º Trimestre).
- ${activeSemHint}
- Só marques status = "a_fazer" para cadeiras atualmente inscritas no semestre ativo sem nota final.
- Se tiver reprovado ou indicado como falta realizar/em atraso, status = "por_fazer".
- Não dupliques a mesma cadeira com e sem sigla e não inventes cadeiras que não estejam na imagem.${knownSection}`;

  const contents: Content[] = [
    {
      role: 'user',
      parts: [
        { type: 'text', text: prompt },
        { type: 'inlineData', inlineData: { mimeType, data: cleanBase64 } },
      ],
    },
  ];
  const generationConfig: GenerationConfig = {
    temperature: 0.1,
    maxOutputTokens: 4096,
    responseMimeType: 'application/json',
  };

  const rawText = customKey
    ? await callDirectRest({
        key: customKey,
        model,
        contents,
        generationConfig,
        primaryTimeoutMs: OCR_PRIMARY_TIMEOUT_MS,
      })
    : await runNativeGenerate({
        model,
        contents,
        generationConfig,
        primaryTimeoutMs: OCR_PRIMARY_TIMEOUT_MS,
      });

  return parseHistoryJsonText(rawText);
}

export async function askGemini(args: {
  messages: { role: 'user' | 'model'; text: string }[];
  system: string;
  attachments?: ChatAttachment[];
  signal?: AbortSignal;
}): Promise<string> {
  const { customKey, model } = resolveGeminiConfig();
  const contents = buildContentsWithAttachments(args.messages, args.attachments);
  const generationConfig: GenerationConfig = { temperature: 0.65 };

  const text = await withQuotaAndFallback('chat', customKey, () =>
    customKey
      ? callDirectRest({
          key: customKey,
          model,
          contents,
          system: args.system,
          generationConfig,
          signal: args.signal,
        })
      : runNativeGenerate({
          model,
          contents,
          system: args.system,
          generationConfig,
          signal: args.signal,
        }),
  );

  if (!text) throw new Error('O Uni devolveu uma resposta vazia. Tenta de novo.');
  return text;
}

/** Resposta em tempo real (streaming palavra a palavra) para o Tutor com suporte multimodal. */
export async function streamGeminiChat(args: {
  messages: { role: 'user' | 'model'; text: string }[];
  system: string;
  attachments?: ChatAttachment[];
  signal?: AbortSignal;
  onToken: (accumulatedText: string) => void;
}): Promise<string> {
  const { customKey, model } = resolveGeminiConfig();
  const contents = buildContentsWithAttachments(args.messages, args.attachments);
  const generationConfig: GenerationConfig = { temperature: 0.65 };
  const primaryTimeoutMs =
    args.attachments && args.attachments.length > 0
      ? CHAT_ATTACHMENT_PRIMARY_TIMEOUT_MS
      : PRIMARY_TIMEOUT_MS;

  const text = await withQuotaAndFallback('chat', customKey, () =>
    customKey
      ? callDirectRestStream({
          key: customKey,
          model,
          contents,
          system: args.system,
          generationConfig,
          signal: args.signal,
          primaryTimeoutMs,
          onToken: args.onToken,
        })
      : runNativeStream({
          model,
          contents,
          system: args.system,
          generationConfig,
          signal: args.signal,
          primaryTimeoutMs,
          onToken: args.onToken,
        }),
  );

  if (!text) throw new Error('O Uni devolveu uma resposta vazia. Tenta de novo.');
  return text;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Resumo em texto simples do estado da app, enviado ao modelo. */
export function buildStudyContext(state: AppState): string {
  const { courses, assessments, sessions, tasks, settings, academicProfile, weeklyCheckIns } = state;
  const today = todayStr();
  const lines: string[] = [];

  lines.push(`Data de hoje: ${format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })}`);
  lines.push(`Semestre: ${settings.semesterName}`);

  if (academicProfile) {
    lines.push('', 'PERFIL ACADÉMICO DO ESTUDANTE (UNIPEDIA):');
    const schoolLabel = [academicProfile.universityName, academicProfile.degreeName]
      .filter(Boolean)
      .join(' — ');
    if (schoolLabel) {
      lines.push(`- Faculdade/Curso: ${schoolLabel}`);
    }
    const yearDesc =
      academicProfile.activeYears && academicProfile.activeYears.length > 1
        ? `Anos ativos: ${academicProfile.activeYears.map((y) => (y > 3 ? `${y - 3}.º Mestrado` : `${y}.º ano`)).join(', ')}`
        : academicProfile.currentAcademicYear > 3
          ? `Ano atual: ${academicProfile.currentAcademicYear - 3}.º ano Mestrado`
          : typeof academicProfile.currentAcademicYear === 'number'
            ? `Ano atual: ${academicProfile.currentAcademicYear}.º ano`
            : '';
    const entryPart = academicProfile.entryYear ? `Ingresso: ${academicProfile.entryYear}` : '';
    const semPart = academicProfile.currentSemester ? `${academicProfile.currentSemester}.º semestre` : '';
    const termSummary = [entryPart, [yearDesc, semPart].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
    if (termSummary) {
      lines.push(`- ${termSummary}`);
    }
    if (typeof academicProfile.targetTotalEcts === 'number' && academicProfile.targetTotalEcts > 0) {
      const doneEcts = academicProfile.completedEcts ?? 0;
      const pct = Math.min(100, Math.round((doneEcts / academicProfile.targetTotalEcts) * 100));
      lines.push(`- Créditos ECTS: ${doneEcts}/${academicProfile.targetTotalEcts} ECTS (${pct}% concluído)`);
    }
    if (academicProfile.learningChallenges && academicProfile.learningChallenges.length > 0) {
      lines.push(`- Dificuldades declaradas de ritmo/estudo: ${academicProfile.learningChallenges.join(', ')}`);
    }
    if (academicProfile.extraActivities && academicProfile.extraActivities.length > 0) {
      const extraDesc = academicProfile.extraActivities
        .map((a) => `${a.label} (~${a.hoursPerWeek}h/sem)`)
        .join(', ');
      lines.push(`- Atividades extra-curriculares: ${extraDesc}`);
    }
    const difficultIds = academicProfile.difficultCourseIds ?? [];
    const completedList = academicProfile.completedCourses ?? [];
    if (difficultIds.length > 0) {
      const hardNames = difficultIds
        .map(
          (id) =>
            courses.find((c) => c.id === id)?.shortName ??
            completedList.find((c) => c.id === id)?.code ??
            completedList.find((c) => c.id === id)?.name,
        )
        .filter((v): v is string => Boolean(v));
      if (hardNames.length > 0) {
        lines.push(`- Cadeiras onde tem mais dificuldade: ${hardNames.join(', ')}`);
      }
    }
    if (academicProfile.difficultTopicsNotes?.trim()) {
      lines.push(`- Dificuldades declaradas pelo aluno: ${academicProfile.difficultTopicsNotes.trim()}`);
    }
    const approved = completedList.filter((c) => c.status === 'aprovada');
    if (approved.length > 0) {
      const preview = approved
        .slice(0, 12)
        .map((c) => `${c.code}${typeof c.grade === 'number' ? ` (${c.grade}v)` : ''}`)
        .join(', ');
      lines.push(`- Histórico de cadeiras já concluídas (${approved.length}): ${preview}`);
    }
  }

  lines.push('', 'CADEIRAS:');
  if (courses.length === 0) lines.push('- Sem cadeiras registadas.');
  for (const c of courses) {
    const g = gradeSummary(c, assessments);
    const needed = g.needed === null
      ? ''
      : g.needed > 20 ? '; objetivo inatingível nas restantes avaliações' : `; precisa de ${fmtGrade(g.needed)} nas restantes`;
    const current = g.current === null
      ? 'sem notas ainda'
      : `média atual ${fmtGrade(g.current)} (${Math.round(g.gradedWeight)}% avaliado)`;
    const hardTag = academicProfile?.difficultCourseIds?.includes(c.id) ? ' [PRIORIDADE/DIFICULDADE]' : '';
    lines.push(`- ${c.name} (${c.ects} ECTS)${hardTag}: ${current}; objetivo ${fmtGrade(c.targetGrade)}${needed}.`);
    if (c.topics.length > 0) {
      const topics = c.topics.map((t) => `${t.title} [${statusLabel[t.status].toLowerCase()}, confiança ${t.confidence}/5]`);
      lines.push(`  Matéria: ${topics.join('; ')}.`);
    }
  }

  lines.push('', 'PRÓXIMAS AVALIAÇÕES:');
  const upcoming = upcomingAssessments(assessments).slice(0, 8);
  const urgentSoon = upcoming.filter((a) => daysUntil(a.date) <= 10);
  if (urgentSoon.length === 1) {
    const c = courses.find((x) => x.id === urgentSoon[0].courseId);
    lines.push(`- MODO TESTE ATIVO (<10 dias): Foco intensivo em ${c?.shortName ?? urgentSoon[0].title} (${urgentSoon[0].title}).`);
  } else if (urgentSoon.length >= 2) {
    const names = urgentSoon.map((a) => courses.find((c) => c.id === a.courseId)?.shortName ?? a.title);
    lines.push(`- MODO TESTE MÚLTIPLO ATIVO (<10 dias): Equilibrar ${urgentSoon.length} avaliações urgentes (${names.join(' vs ')}).`);
  }
  if (upcoming.length === 0) lines.push('- Nenhuma avaliação futura registada.');
  for (const a of upcoming) {
    const course = courses.find((c) => c.id === a.courseId);
    const days = daysUntil(a.date);
    const when = days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias (${format(parseISO(a.date), 'd MMM', { locale: pt })})`;
    const ready = Math.round(readiness(a, course) * 100);
    lines.push(`- ${course?.shortName ?? 'Geral'} – ${a.title} (${a.kind}) ${when}; peso ${a.weight}%; preparação ${ready}%.`);
  }

  if (weeklyCheckIns && weeklyCheckIns.length > 0) {
    const latest = weeklyCheckIns[0];
    lines.push('', `ÚLTIMO CHECK-IN SEMANAL (${latest.weekOf}):`);
    lines.push(`- Estado do aluno: ${latest.mood}`);
    if (latest.understoodTopics.length > 0) {
      lines.push(`- O que já consolidou: ${latest.understoodTopics.join(', ')}`);
    }
    if (latest.classDifficulties.length > 0) {
      lines.push(`- O que não entendeu na aula: ${latest.classDifficulties.join(', ')}`);
    }
    if (latest.pendingNextWeek.length > 0) {
      lines.push(`- Ficou para a próxima semana: ${latest.pendingNextWeek.join(', ')}`);
    }
    if (latest.notes.trim()) {
      lines.push(`- Notas do aluno: ${latest.notes.trim()}`);
    }
  }

  lines.push('', 'PLANO DE HOJE:');
  const todays = sessions.filter((s) => s.date === today);
  if (todays.length === 0) lines.push('- Sem sessões planeadas hoje.');
  for (const s of todays) {
    const course = courses.find((c) => c.id === s.courseId);
    const topic = course?.topics.find((t) => t.id === s.topicId)?.title;
    const label = `${course?.shortName ?? 'Geral'}${topic ? ` – ${topic}` : ''}`;
    const status = s.done ? `feita (${fmtMinutes(s.actualMinutes ?? s.minutes)})` : `por fazer (${fmtMinutes(s.minutes)})`;
    lines.push(`- ${label}: ${status}.`);
  }

  const weeklyGoal = settings.dailyStudyMinutes * settings.studyDays.length;
  lines.push('', 'ESTUDO:');
  lines.push(`- Esta semana: ${fmtMinutes(minutesThisWeek(sessions))} de ${fmtMinutes(weeklyGoal)} planeados por semana.`);
  lines.push(`- Sequência atual: ${plural(studyStreak(sessions), 'dia seguido', 'dias seguidos')}.`);

  lines.push('', 'TAREFAS PENDENTES:');
  const pending = tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
    .slice(0, 8);
  if (pending.length === 0) lines.push('- Nenhuma tarefa pendente.');
  for (const t of pending) {
    const course = courses.find((c) => c.id === t.courseId);
    const due = t.due
      ? `, prazo ${format(parseISO(t.due), 'd MMM', { locale: pt })}${t.due < today ? ' (atrasada)' : ''}`
      : '';
    lines.push(`- ${t.title}${course ? ` (${course.shortName})` : ''}${due}.`);
  }

  const text = lines.join('\n');
  return text.length > MAX_CONTEXT_CHARS ? `${text.slice(0, MAX_CONTEXT_CHARS - 20)}\n[…resumo truncado]` : text;
}

/** Resumo dos documentos/materiais associados para fornecer contexto de estudo detalhado ao Gemini. */
export function buildDocumentContext(materials: Material[]): string {
  if (!materials || materials.length === 0) return '';
  const lines: string[] = ['DOCUMENTOS E MATERIAIS DE ESTUDO DISPONÍVEIS:'];
  for (const m of materials) {
    const prov = m.provider.toUpperCase();
    lines.push(`- [${prov}] ${m.title}: ${m.url}`);
  }
  return lines.join('\n');
}

const PERSONA_INSTRUCTIONS: Record<UniPersonaMode, string> = {
  amigo:
    'Estilo Amigo: próximo, bem-humorado sem exageros, celebra pequenas vitórias do estudante e explica conceitos com exemplos do dia-a-dia.',
  exigente:
    'Estilo Exigente (Modo Exame): direto ao ponto, rigoroso nas definições e provas, cobra raciocínio ao estudante antes de dar a solução final.',
  calmo:
    'Estilo Anti-Stress: voz tranquila e paciente, parte tarefas grandes em micro-passos de 15 minutos e acalma o ritmo antes de provas difíceis.',
};

const AREA_VOICE_HINTS: Record<UniAccessoryId, string> = {
  default: 'Companheiro versátil do caderno escolar.',
  math: 'Com chapéu π de Matemática: raciocínio lógico passo a passo, intuição geométrica e verificação de contas.',
  tech: 'Com auscultadores de Engenharia & Programação: pensamento estruturado, pseudocódigo limpo e depuração metódica.',
  health: 'Com estetoscópio de Saúde & Biociências: liga conceitos anatómicos/fisiológicos a casos práticos.',
  arts: 'Com boina de Artes & Design: visual, criativo, atento a referências e composição.',
  science: 'Com óculos de laboratório: rigor experimental, unidades, hipóteses e fenómeno físico/químico.',
  humanities: 'Com óculos clássicos de Letras, Direito & Economia: clareza argumentativa, tese-síntese e contexto histórico.',
};

export const SYSTEM_PROMPT = (
  context: string,
  docContext?: string,
  opts?: { persona?: UniPersonaMode; accessory?: UniAccessoryId; studentName?: string; appTone?: AppTone },
): string => {
  const persona = opts?.persona ?? 'amigo';
  const accessory = opts?.accessory ?? 'default';
  const appTone = opts?.appTone ?? 'vibrante';
  const firstName = opts?.studentName?.trim().split(/\s+/)[0] || '';

  const toneDirective =
    appTone === 'serio'
      ? '- Tom selecionado (Sério & Minimalista): responde sempre em português europeu (pt-PT), de forma direta, estruturada, sóbria e profissional, sem exclamações excessivas nem brincadeiras.'
      : '- Responde sempre em português europeu (pt-PT), de forma concisa, concreta e calorosa.';

  return `Tu és o Uni, o companheiro de estudo exclusivo da Unipedia${firstName ? ` a ajudar ${firstName}` : ''}.
Identidade obrigatória:
- Fala sempre como «o Uni» na primeira pessoa. Nunca digas "como modelo de IA", "como assistente virtual" nem "sou o Gemini".
- ${PERSONA_INSTRUCTIONS[persona]}
- Visual e área ativa: ${AREA_VOICE_HINTS[accessory]}
${toneDirective}
- Baseia conselhos nos dados do resumo e nos documentos/fontes anexados abaixo. Se algo não estiver nos dados, assume com naturalidade em vez de inventar.
- Usa Markdown: títulos curtos (###), listas e **negrito** para destacar o essencial.
- Em quizzes: faz UMA pergunta de cada vez e espera pela resposta antes de corrigir e avançar.
- Se a conversa fugir do estudo, brinca brevemente como o Uni e traz o foco de volta às cadeiras.
- SINCRONIZAÇÃO COM O CADERNO (Calendário, Cadeiras e Plano): sempre que o estudante enviar uma imagem/print ou texto com datas de testes, exames, entregas de projetos ou aulas semanais do horário (ou pedir para guardar/atualizar no resto da app), explica claramente o que encontraste e no FINAL da tua resposta inclui exatamente um bloco técnico (que a interface transforma num cartão de 1 toque):
<uni-sync>{"hasSaturdayColumn":false,"slots":[{"courseName":"Nome real da cadeira","courseCode":"SIGLA","dayHeader":"2ª|3ª|4ª|5ª|6ª|Sáb","type":"T|TP|P|OT","weekday":1,"start":"09:00","end":"11:00","room":"Sala opcional"}],"assessments":[{"courseName":"Nome real da cadeira","courseCode":"SIGLA opcional","title":"1.º Teste","date":"2026-11-25T14:00:00","kind":"teste|exame|trabalho|projeto|quiz","location":"Sala opcional"}]}</uni-sync>
(Regra Portugal: "2ª"=1, "3ª"=2, "4ª"=3, "5ª"=4, "6ª"=5 — "6ª" é Sexta-feira, NUNCA 6! Usa os nomes reais das cadeiras do resumo do aluno. Se não houver aulas nem avaliações para guardar na app, NÃO incluas <uni-sync>.)
${docContext ? `\n${docContext}\n` : ''}
Resumo atual do caderno do estudante:
"""
${context}
"""`;
};

export interface NotebookSourceInput {
  title: string;
  content: string;
}

export async function generateNotebookBrief(args: {
  mode: 'guide' | 'quiz' | 'summary';
  sources: NotebookSourceInput[];
  attachments?: ChatAttachment[];
  courseName?: string;
  persona?: UniPersonaMode;
  accessory?: UniAccessoryId;
}): Promise<string> {
  const { customKey, model } = resolveGeminiConfig();
  const formattedSources = args.sources
    .filter((s) => s.content.trim())
    .map((s, i) => `### [Fonte ${i + 1}: ${s.title}]\n${s.content.trim().slice(0, 5000)}`)
    .join('\n\n');

  const hasAttachments = Boolean(args.attachments && args.attachments.length > 0);
  if (!formattedSources && !hasAttachments) {
    throw new Error('Adiciona texto, apontamentos ou um PDF/foto ao teu Caderno antes de gerar.');
  }

  const goalPrompt =
    args.mode === 'guide'
      ? 'Cria um **Guia de Estudo Estruturado** claro com conceitos-chave, armadilhas comuns de teste e plano rápido de revisão, citando sempre as fontes como [Fonte N] ou o nome do ficheiro.'
      : args.mode === 'quiz'
        ? 'Cria **5 perguntas de treino de exame** com resposta e explicação curta escondida em secção final, citando a origem de cada uma como [Fonte N] ou nome do ficheiro.'
        : 'Faz um **Resumo Executivo por Tópicos** direto e memorável, citando de onde veio cada ideia como [Fonte N] ou nome do ficheiro.';

  const system = `És o Uni a organizar um Caderno de Estudo estilo Gemini Notebook${args.courseName ? ` para ${args.courseName}` : ''}.
${PERSONA_INSTRUCTIONS[args.persona ?? 'amigo']}
${AREA_VOICE_HINTS[args.accessory ?? 'default']}
Regras estritas:
- Baseia-te exclusivamente nas fontes e anexos fornecidos pelo estudante.
- Cita sempre as fontes relevantes no texto usando [Fonte 1], [Fonte 2] ou o nome do documento.
- Escreve em português europeu (pt-PT) com Markdown limpo.`;

  const userPrompt = formattedSources
    ? `${goalPrompt}\n\nFONTES DO CADERNO:\n${formattedSources}`
    : `${goalPrompt}\n\nAnalisa os ficheiros anexados como fontes principais do caderno.`;

  const contents = buildContentsWithAttachments([{ role: 'user', text: userPrompt }], args.attachments);
  const generationConfig: GenerationConfig = { temperature: 0.45 };

  const text = await withQuotaAndFallback('notebook', customKey, () =>
    customKey
      ? callDirectRest({ key: customKey, model, contents, system, generationConfig })
      : runNativeGenerate({ model, contents, system, generationConfig }),
  );

  if (!text) throw new Error('Não foi possível gerar o caderno agora. Tenta novamente.');
  return text;
}

export interface RecallChallenge {
  question: string;
  hint: string;
}

/** Gera 1 pergunta curta de recall ativo pós-sessão sobre o tópico estudado. */
export async function generateRecallChallenge(
  topicTitle: string,
  courseName?: string,
): Promise<RecallChallenge> {
  const { customKey, model } = resolveGeminiConfig();
  const prompt = `Cria 1 pergunta curta de recordação ativa (active recall) em português europeu sobre "${topicTitle}"${courseName ? ` (${courseName})` : ''}.
Devolve APENAS JSON válido no formato: {"question": "pergunta objetiva em 1-2 frases para testar compreensão sem consultar apontamentos", "hint": "pista curta ou critério de resposta correta em 1 frase"}`;
  const contents: Content[] = [{ role: 'user', parts: [{ type: 'text', text: prompt }] }];
  const generationConfig: GenerationConfig = {
    temperature: 0.4,
    maxOutputTokens: 320,
    responseMimeType: 'application/json',
  };

  const rawText = await withQuotaAndFallback('chat', customKey, () =>
    customKey
      ? callDirectRest({ key: customKey, model, contents, generationConfig })
      : runNativeGenerate({ model, contents, generationConfig }),
  );

  const match = /\{[\s\S]*\}/.exec(rawText || '{}');
  const parsed = JSON.parse(match ? match[0] : rawText || '{}') as Partial<RecallChallenge>;
  return {
    question:
      parsed.question?.trim() ||
      `Explica por palavras tuas o mecanismo ou ideia central de «${topicTitle}».`,
    hint:
      parsed.hint?.trim() ||
      'Verifica se consegues dar 1 exemplo concreto ou justificar porquê acontece.',
  };
}

/** Extrai disciplinas, aulas semanais e datas de avaliação a partir de uma foto do horário, testes ou agenda. */
export async function parseTimetableFromScreenshot(
  base64Data: string,
  mimeType: string,
  focusOrOptions:
    | 'schedule'
    | 'assessments'
    | { focus?: 'schedule' | 'assessments'; knownCourses?: KnownCourseHint[] } = 'schedule',
): Promise<ExtractedSchedulePayload> {
  const focus =
    typeof focusOrOptions === 'string' ? focusOrOptions : (focusOrOptions.focus ?? 'schedule');
  const knownCourses = typeof focusOrOptions === 'string' ? undefined : focusOrOptions.knownCourses;
  const knownSection = buildKnownCoursesPromptSection(knownCourses);
  const { customKey, model } = resolveGeminiConfig();
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const prompt =
    focus === 'assessments'
      ? `Analisa esta foto ou print de um calendário de testes, pauta de exames, datas de avaliações ou entregas académicas em português.
Devolve APENAS JSON válido no formato exato:
{
  "slots": [],
  "assessments": [
    {"courseName": "Nome ou sigla da cadeira", "title": "1.º Teste", "date": "2026-11-25T14:00:00", "kind": "teste|exame|trabalho|projeto|quiz"}
  ]
}
Regras importantes para leitura de provas e testes:
- Extrai TODAS as datas de testes, frequências, exames (normal/recurso), minitestes, quizzes, apresentações e entregas de projetos visíveis na imagem.
- Formata date em ISO local "YYYY-MM-DDTHH:mm:00" (se não houver hora visível, usa "09:00:00"; se não houver ano visível, infere o ano letivo atual 2026/2027 com meses Set–Dez em 2026 e Jan–Jul em 2027).
- kind deve ser exatamente um de: "teste", "exame", "trabalho", "projeto", "quiz".
- Usa o nome real da cadeira (da lista de cadeiras conhecidas abaixo se existir correspondência) ou a sigla exata visível (ex.: "C3 D", "FabAd", "MdF", "SNTI") sem inventar nomes.
- Só devolvas "slots" se a imagem também contiver claramente uma grelha semanal de aulas. Caso contrário devolve "slots": [].${knownSection}`
      : `Analisa esta foto ou print de um horário escolar/universitário ou agenda académica portuguesa.
Devolve APENAS JSON válido no formato exato:
{
  "hasSaturdayColumn": false,
  "slots": [
    {"courseName": "Nome real da cadeira ou sigla exata visível", "courseCode": "SIGLA opcional", "dayHeader": "2ª|3ª|4ª|5ª|6ª|Sáb|Dom", "type": "T|TP|P|OT", "weekday": 1, "start": "09:00", "end": "11:00", "room": "Sala opcional"}
  ],
  "assessments": [
    {"courseName": "Nome da Cadeira", "title": "Teste 1", "date": "2026-11-25T14:00:00", "kind": "teste|exame|trabalho|projeto|quiz"}
  ]
}
Regras muito importantes para grelhas visuais de horários:
- PORTUGAL DAY RULE (CRÍTICA):
  * "2ª" / "Seg" = dayHeader "2ª", weekday = 1 (Segunda-feira)
  * "3ª" / "Ter" = dayHeader "3ª", weekday = 2 (Terça-feira)
  * "4ª" / "Qua" = dayHeader "4ª", weekday = 3 (Quarta-feira)
  * "5ª" / "Qui" = dayHeader "5ª", weekday = 4 (Quinta-feira)
  * "6ª" / "Sex" = dayHeader "6ª", weekday = 5 (Sexta-feira)
  * CUIDADO: "6ª" é SEXTA-FEIRA (weekday 5), NUNCA uses 6 para "6ª"!
  * Sábado (weekday = 6) e hasSaturdayColumn = true SÓ existem se houver explicitamente uma coluna escrita "Sáb" ou "Sábado" à direita de "6ª"/"Sex". Horários normais de faculdade vão apenas de "2ª" a "6ª" (hasSaturdayColumn: false).
- Para CADA retângulo de aula, verifica com precisão em que coluna vertical ele está alinhado olhando diretamente para o cabeçalho no topo dessa coluna e preenche sempre "dayHeader" com o texto exato do cabeçalho ("2ª", "3ª", "4ª", "5ª", "6ª"...) além do número "weekday".
- Se as horas não estiverem escritas dentro do retângulo colorido, LÊ a hora de início e de fim pela posição vertical do topo e fundo do retângulo relativamente ao eixo de horas à esquerda (ex.: 8:00, 9:00, 10:00... 24:00) e às linhas da grelha (ex.: meio bloco = 30 min).
- Quando o bloco só mostrar sigla curta (ex.: "FabAd tp.1 Ed 7: 3.4/Ed.VII", "MdF l.1 Ed 8: 3.09", "C3 D t.2", "SNTI t.1"):
  * courseCode = sigla principal visível ("FabAd", "MdF", "C3 D", "SNTI")
  * courseName = nome completo real se estiver visível na imagem OU se existir na lista de cadeiras conhecidas abaixo; caso contrário usa APENAS a própria sigla exata visível (NUNCA inventes um nome completo por dedução!)
  * type: "t.*" -> "T", "tp.*" -> "TP", "l.*" / "p.*" -> "P", "s.*" / "ot.*" -> "OT"
  * room = localização/sala (ex.: "Ed 7: 3.4/Ed.VII")
- start e end no formato "HH:mm".
- Se não houver avaliações visíveis na foto, devolve "assessments": [].
- Não inventes blocos que não existam visualmente na grelha.${knownSection}`;

  const contents: Content[] = [
    {
      role: 'user',
      parts: [
        { type: 'text', text: prompt },
        { type: 'inlineData', inlineData: { mimeType, data: cleanBase64 } },
      ],
    },
  ];
  const generationConfig: GenerationConfig = {
    temperature: 0.1,
    maxOutputTokens: 4096,
    responseMimeType: 'application/json',
  };

  const rawText = customKey
    ? await callDirectRest({
        key: customKey,
        model,
        contents,
        generationConfig,
        primaryTimeoutMs: OCR_PRIMARY_TIMEOUT_MS,
      })
    : await runNativeGenerate({
        model,
        contents,
        generationConfig,
        primaryTimeoutMs: OCR_PRIMARY_TIMEOUT_MS,
      });

  return parseScheduleJsonText(rawText);
}
