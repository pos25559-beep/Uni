// Cliente híbrido da API Gemini: usa Firebase AI Logic de forma nativa (sem chave API manual)
// com App Check e quota conservadora, ou chave pessoal opcional em Definições → Avançado.
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { Content, GenerationConfig, Part } from 'firebase/ai';
import { statusLabel } from '../lib/colors';
import {
  consumeDailyQuota,
  recordAiTokenUsage,
  refundDailyQuota,
  type QuotaKind,
} from '../lib/aiQuota';
import type {
  TopicSheetRecord,
  UniAgentExpedition,
  UniAgentRecord,
  UniExpeditionQuestion,
} from '../lib/localDb';
import type { NotebookDeltaProposal } from '../lib/uniMastery';
import {
  CustomKeyError,
  HttpStatusError,
  ModelTimeoutError,
  friendlyCustomKeyError,
} from '../lib/geminiErrors';
import { getNativeAI } from '../lib/firebase';

export { CustomKeyError, friendlyCustomKeyError };
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
  extractUniCheckInSyncBlock,
  mergeParsedUnderstandingWithAi,
  type ParsedCheckInUnderstanding,
} from '../lib/uniCheckInNlu';
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
  fileUri?: string;
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
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
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

async function callDirectRest(args: {
  key: string;
  model: string;
  contents: Content[];
  system?: string;
  generationConfig?: GenerationConfig;
  signal?: AbortSignal;
  primaryTimeoutMs?: number;
}): Promise<string> {
  try {
    return await runModelChain({
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
  try {
    return await runModelChain({
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

        recordAiTokenUsage(promptTokens, outputTokens);
        return accumulated.trim();
      },
    });
  } catch (err) {
    if (args.signal?.aborted) throw err;
    throw friendlyCustomKeyError(err);
  }
}

async function runNativeGenerate(args: {
  model: string;
  contents: Content[];
  system?: string;
  generationConfig?: GenerationConfig;
  signal?: AbortSignal;
  primaryTimeoutMs?: number;
}): Promise<string> {
  const [ai, { getGenerativeModel }] = await Promise.all([getNativeAI(), import('firebase/ai')]);
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

async function runNativeStream(args: {
  model: string;
  contents: Content[];
  system: string;
  generationConfig?: GenerationConfig;
  signal?: AbortSignal;
  primaryTimeoutMs?: number;
  onToken: (accumulatedText: string) => void;
}): Promise<string> {
  const [ai, { getGenerativeModel }] = await Promise.all([getNativeAI(), import('firebase/ai')]);
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
  const { courses, assessments, sessions, tasks, settings, academicProfile, weeklyCheckIns, studyLogs } = state;
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
    const coveredTitles =
      course && a.topicIds.length > 0
        ? course.topics
            .filter((t) => a.topicIds.includes(t.id))
            .map((t) => t.title)
        : [];
    const scopeInfo =
      coveredTitles.length > 0
        ? `; matéria que sai: ${coveredTitles.join(', ')}`
        : '';
    lines.push(`- ${course?.shortName ?? 'Geral'} – ${a.title} (${a.kind}) ${when}; peso ${a.weight}%; preparação ${ready}%${scopeInfo}.`);
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

  if (studyLogs && studyLogs.length > 0) {
    const kindTag = {
      class: 'Pós-aula',
      day: 'Fim do dia',
      week: 'Domingo',
      exam_prep: 'Modo Teste',
    } as const;
    lines.push('', 'DIÁRIO RECENTE (AULAS, ESTUDO DIÁRIO & MODO TESTE):');
    for (const log of studyLogs.slice(0, 8)) {
      const course = log.courseId ? courses.find((c) => c.id === log.courseId) : undefined;
      const resolvedTopics =
        course && log.topicIds && log.topicIds.length > 0
          ? course.topics.filter((t) => log.topicIds!.includes(t.id)).map((t) => t.title)
          : [];
      const parts = [
        `[${kindTag[log.kind]} · ${log.date}${course ? ` · ${course.shortName}` : ''}]`,
        `estado=${log.feeling}${log.rating ? ` (${log.rating}/5)` : ''}`,
      ];
      if (log.topicTitle) parts.push(`matéria dada="${log.topicTitle}"`);
      if (resolvedTopics.length > 0) parts.push(`tópicos marcados=[${resolvedTopics.join(', ')}]`);
      if (log.studiedSummary) parts.push(`já estudou="${log.studiedSummary}"`);
      if (log.difficulties) parts.push(`dificuldades="${log.difficulties}"`);
      if (log.notes) parts.push(`nota="${log.notes}"`);
      lines.push(`- ${parts.join(' · ')}`);
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

export interface DocumentContextOptions {
  activeCourseName?: string;
  courseMaterials?: Material[];
  resolvedExcerpts?: Array<{ title: string; provider: string; content: string }>;
  notebookNotes?: string;
  maxFiles?: number;
}

/** Resumo dos documentos/materiais associados e excertos extraídos para personalizar o ensino do Uni. */
export function buildDocumentContext(
  materials: Material[],
  options?: DocumentContextOptions,
): string {
  const sections: string[] = [];

  if (options?.resolvedExcerpts && options.resolvedExcerpts.length > 0) {
    sections.push('CONTEÚDO REAL EXTRAÍDO DOS DOCUMENTOS E APONTAMENTOS:');
    for (const ex of options.resolvedExcerpts) {
      sections.push(`### [Fonte: ${ex.title}] (${ex.provider.toUpperCase()})\n${ex.content.slice(0, 8000)}`);
    }
  }

  if (options?.notebookNotes?.trim()) {
    sections.push(
      'NOTAS / RESUMO DO GEMINI NOTEBOOK FORNECIDO PELO ESTUDANTE:',
      options.notebookNotes.trim().slice(0, 8000),
    );
  }

  if (materials && materials.length > 0) {
    sections.push('DOCUMENTOS E REFERÊNCIAS SELECIONADOS NESTA CONVERSA:');
    for (const m of materials) {
      const flags = [
        m.provider.toUpperCase(),
        m.category,
        m.hasSolution ? 'com resolução' : '',
        m.pinned ? 'fixado' : '',
      ]
        .filter(Boolean)
        .join(' · ');
      sections.push(`- [${flags}] ${m.title}${m.url ? ` (${m.url})` : ''}`);
    }
  }

  if (options?.courseMaterials && options.courseMaterials.length > 0) {
    const selectedIds = new Set(materials.map((m) => m.id));
    const libraryPreview = [...options.courseMaterials]
      .filter((m) => !selectedIds.has(m.id))
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
      .slice(0, 15);
    if (libraryPreview.length > 0) {
      const limitLabel = options?.maxFiles ?? (hasCustomGeminiKey() ? 12 : 3);
      sections.push(
        `BIBLIOTECA DISPONÍVEL EM ${options.activeCourseName?.toUpperCase() ?? 'CADEIRA'} (${options.courseMaterials.length} itens no total — podes sugerir ao estudante selecionar até ${limitLabel} PDFs em «Apontamentos» caso queira que os analises em detalhe):`,
      );
      for (const m of libraryPreview) {
        const meta = [m.category, m.year, m.hasSolution ? 'c/ resolução' : '', m.pinned ? 'fixado' : '']
          .filter(Boolean)
          .join(', ');
        sections.push(`- ${m.title}${meta ? ` [${meta}]` : ''}`);
      }
    }
  }

  return sections.join('\n\n');
}

const PERSONA_INSTRUCTIONS_BY_LANG: Record<'pt-PT' | 'en', Record<UniPersonaMode, string>> = {
  'pt-PT': {
    amigo:
      'Estilo Amigo: caloroso, frases curtas e diretas, explica conceitos difíceis primeiro com analogias e exemplos do dia a dia.',
    exigente:
      'Estilo Exigente (Modo Exame): direto e sem rodeios, rigoroso nas definições e provas, cobra raciocínio em formato de teste antes de dar a solução final.',
    calmo:
      'Estilo Anti-Stress: voz tranquila e paciente, valida o esforço do aluno e parte tarefas grandes em micro-passos muito simples (uma ideia de cada vez).',
    curioso:
      'Estilo Curioso (Socrático): entusiasta pela matéria, faz perguntas orientadoras («E se x fosse negativo? O que muda?») para puxar a descoberta pelo estudante.',
    treinador:
      'Estilo Treinador: enérgico e orientado por metas curtas por sessão («Meta de hoje: 5 exercícios seguidos sem erro»), mantendo foco e ritmo claro.',
  },
  en: {
    amigo:
      'Friend style: warm, crisp short sentences; starts with everyday examples and clear intuition before formal jargon.',
    exigente:
      'Strict style (Exam Mode): direct, concise, zero fluff; tests exact definitions and exam reasoning before revealing full solutions.',
    calmo:
      'Calm / Anti-stress style: steady and reassuring; validates effort and breaks daunting topics into tiny one-idea steps.',
    curioso:
      'Curious (Socratic) style: genuinely enthusiastic about the subject; uses probing follow-up questions ("What changes if x is negative?") to spark discovery.',
    treinador:
      'Coach style: energetic and target-driven; sets bite-sized session goals ("Target: 5 clean problems in a row") to sustain momentum.',
  },
};

const PERSONA_INSTRUCTIONS: Record<UniPersonaMode, string> = PERSONA_INSTRUCTIONS_BY_LANG['pt-PT'];

const AREA_VOICE_HINTS: Record<UniAccessoryId, string> = {
  default: 'Companheiro versátil do caderno escolar.',
  math: 'Com chapéu π de Matemática: raciocínio lógico passo a passo, intuição geométrica e verificação de contas.',
  tech: 'Com auscultadores de Engenharia & Programação: pensamento estruturado, pseudocódigo limpo e depuração metódica.',
  health: 'Com estetoscópio de Saúde & Biociências: liga conceitos anatómicos/fisiológicos a casos práticos.',
  arts: 'Com boina de Artes & Design: visual, criativo, atento a referências e composição.',
  science: 'Com óculos de laboratório: rigor experimental, unidades, hipóteses e fenómeno físico/químico.',
  humanities: 'Com óculos clássicos de Letras, Direito & Economia: clareza argumentativa, tese-síntese e contexto histórico.',
};

const UNIPEDIA_CONSTITUTION = `Constituição Unipedia (regras fixas e obrigatórias):
- Fala sempre na primeira pessoa com a identidade do Uni. Nunca digas "como modelo de IA", "como assistente virtual" nem "sou o Gemini".
- Salvaguarda e ética: nunca simules vínculo romântico, afeto exclusivo ou ciúmes; mantém foco académico saudável para qualquer idade (13+). Se o estudante expressar sofrimento emocional intenso, responde com cuidado sóbrio, sugere falar com alguém de confiança e indica os serviços de apoio da universidade.
- Modo socrático em exercícios e trabalhos avaliados: NUNCA entregues trabalhos avaliados feitos de raiz nem resoluções completas à primeira; dá primeiro pistas em passos pequenos (até 3 níveis) para puxar pelo raciocínio do estudante.
- Rigor e citação: baseia o ensino nas fichas da cadeira e nos materiais/excertos fornecidos. Cita explicitamente a fonte (\`[Fonte: nome do ficheiro]\`). Se algo não estiver nas fichas nem nos anexos, diz com transparência "Isto não está nos teus materiais" em vez de inventar fórmulas ou regras.
- Mestria real vem da app: nunca inventes notas, pontuações de mestria nem datas que não estejam nos dados fornecidos.
- Escreve em português europeu (pt-PT) com Markdown limpo e LaTeX padrão (\`$...$\` ou \`$$...$$\` numa linha própria) quando houver matemática/fórmulas.
- Em quizzes: faz UMA pergunta de cada vez e espera pela resposta antes de corrigir.
- Se a conversa sair do estudo, brinca brevemente e redireciona para a cadeira ou plano.`;

export const SYSTEM_PROMPT = (
  context: string,
  docContext?: string,
  opts?: {
    persona?: UniPersonaMode;
    accessory?: UniAccessoryId;
    studentName?: string;
    appTone?: AppTone;
    language?: 'pt-PT' | 'en';
    uniAgent?: UniAgentRecord | null;
    retrievedSheets?: TopicSheetRecord[];
    courseName?: string;
  },
): string => {
  const persona = opts?.uniAgent?.personaId ?? opts?.persona ?? 'amigo';
  const accessory = opts?.accessory ?? 'default';
  const appTone = opts?.appTone ?? 'vibrante';
  const firstName = opts?.studentName?.trim().split(/\s+/)[0] || '';
  const agent = opts?.uniAgent ?? null;
  const rawLang = opts?.uniAgent?.language ?? opts?.language ?? 'pt-PT';
  const targetLang: 'pt-PT' | 'en' = rawLang.toLowerCase().startsWith('en') ? 'en' : 'pt-PT';
  const personaText = PERSONA_INSTRUCTIONS_BY_LANG[targetLang][persona];

  const toneDirective =
    appTone === 'serio'
      ? targetLang === 'en'
        ? '- App tone (Minimal & Focused): structured, sober, concise, zero hype.'
        : '- Tom da app (Sério & Minimalista): direto, estruturado, sóbrio e profissional, sem exclamações excessivas.'
      : targetLang === 'en'
        ? '- Concise, grounded, encouraging tone without filler.'
        : '- Tom natural e conciso, concreto e encorajador sem exageros.';

  const languageDirective =
    targetLang === 'en'
      ? '- Idioma de resposta obrigatório: escreve TODA a resposta em inglês claro (en), mantendo entre aspas/parênteses termos técnicos originais se vierem de apontamentos em português.'
      : '- Idioma de resposta obrigatório: português europeu (pt-PT).';

  const expertDirective =
    agent && agent.stage >= 3
      ? targetLang === 'en'
        ? '- Specialist/Master stage unlocked: include exam-grade edge cases, past-test rigor, and cross-topic links while keeping your archetype tone.'
        : '- Estágio Especialista/Mestre desbloqueado: inclui rigor de nível exame/teste, casos-limite e ligações entre tópicos sem perder o teu tom.'
      : '';

  const layer2Personality = agent
    ? `CAMADA 2 — PERSONALIDADE DO UNI ESPECIALISTA:
- Nome: «${agent.name}»${opts?.courseName ? ` (especialista em ${opts.courseName})` : ''} · Forma: ${agent.formId} · Estágio atual: ${agent.stage} (mestria ${agent.mastery}/100 calculada pela app) · Idioma: ${targetLang}.
- ${personaText}
- Área e estilo: ${AREA_VOICE_HINTS[accessory]}
${languageDirective}
${expertDirective ? `${expertDirective}\n` : ''}${toneDirective}`
    : `CAMADA 2 — PERSONALIDADE DO UNI:
- Tu és o Uni da Unipedia${firstName ? ` a ajudar ${firstName}` : ''}.
- ${personaText}
- Visual e área ativa: ${AREA_VOICE_HINTS[accessory]}
${languageDirective}
${toneDirective}`;

  const layer3Notebook = agent
    ? `\nCAMADA 3 — CADERNO DO UNI (JSON compacto do que o Uni sabe sobre o estudante nesta cadeira):\n${JSON.stringify({
        goals: agent.notebook.goals.slice(0, 8),
        learningStyle: agent.notebook.learningStyle ?? null,
        weakSpots: agent.notebook.weakSpots.slice(0, 6),
        strengths: agent.notebook.strengths.slice(0, 6),
        customNotes: (agent.notebook.customNotes ?? []).slice(0, 6),
        nextAssessment: agent.notebook.nextAssessment ?? null,
      })}`
    : '';

  const sheetsBlock =
    opts?.retrievedSheets && opts.retrievedSheets.length > 0
      ? `\nFICHAS DE TÓPICO GUARDADAS NO CADERNO (${opts.retrievedSheets.length}):\n` +
        opts.retrievedSheets
          .map(
            (sheet, idx) =>
              `### [Ficha ${idx + 1}: ${sheet.title}]\n${sheet.summary.trim().slice(0, 2200)}`,
          )
          .join('\n\n')
      : '';

  return `${UNIPEDIA_CONSTITUTION}

${layer2Personality}${layer3Notebook}

CAMADA 4 — CONTEXTO DO MOMENTO:
- SINCRONIZAÇÃO COM O CADERNO (Calendário, Cadeiras e Plano): sempre que o estudante enviar uma imagem/print ou texto com datas de testes, exames, entregas de projetos ou aulas semanais do horário (ou pedir para guardar/atualizar no resto da app), explica claramente o que encontraste e no FINAL da tua resposta inclui exatamente um bloco técnico (que a interface transforma num cartão de 1 toque):
<uni-sync>{"hasSaturdayColumn":false,"slots":[{"courseName":"Nome real da cadeira","courseCode":"SIGLA","dayHeader":"2ª|3ª|4ª|5ª|6ª|Sáb","type":"T|TP|P|OT","weekday":1,"start":"09:00","end":"11:00","room":"Sala opcional"}],"assessments":[{"courseName":"Nome real da cadeira","courseCode":"SIGLA opcional","title":"1.º Teste","date":"2026-11-25T14:00:00","kind":"teste|exame|trabalho|projeto|quiz","location":"Sala opcional"}]}</uni-sync>
(Regra Portugal + colunas sobrepostas: "2ª"=1, "3ª"=2, "4ª"=3, "5ª"=4, "6ª"=5 — "6ª" é Sexta-feira, NUNCA 6! Se não houver aulas nem avaliações para guardar na app, NÃO incluas <uni-sync>.)
${sheetsBlock}${docContext ? `\n${docContext}\n` : ''}
Resumo atual do caderno do estudante${firstName ? ` (${firstName})` : ''}:
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

export interface GeneratedPracticeCardDraft {
  prompt: string;
  answer: string;
  sourceTitle?: string;
}

/**
 * Gera um micro-baralho de 3 a 5 cartões de prática ativa fundamentado nos materiais reais
 * da cadeira (PDFs, excertos extraídos e notas do Diário) para rever após foco ou no SRS.
 */
export async function generateMaterialPracticeSet(args: {
  topicTitle: string;
  courseName?: string;
  cardCount?: number;
  sources?: NotebookSourceInput[];
  attachments?: ChatAttachment[];
  diaryContext?: string;
  existingPrompts?: string[];
}): Promise<GeneratedPracticeCardDraft[]> {
  const { customKey, model } = resolveGeminiConfig();
  const count = Math.max(3, Math.min(5, args.cardCount ?? 4));

  const sourcesBlock = (args.sources ?? [])
    .filter((s) => s.content.trim())
    .slice(0, 3)
    .map((s, i) => `### [Fonte ${i + 1}: ${s.title}]\n${s.content.trim().slice(0, 4500)}`)
    .join('\n\n');

  const avoidBlock =
    args.existingPrompts && args.existingPrompts.length > 0
      ? `\nEvita repetir perguntas já feitas:\n- ${args.existingPrompts.slice(0, 5).join('\n- ')}`
      : '';

  const prompt = `Cria exatamente ${count} cartões curtos de prática ativa (active recall / estilo pergunta de teste) em português europeu sobre "${args.topicTitle}"${args.courseName ? ` (${args.courseName})` : ''}.
${args.diaryContext ? `\nContexto real do estudante (Diário / até onde deu a matéria):\n${args.diaryContext}` : ''}
${sourcesBlock ? `\nCONTEÚDO REAL DOS MATERIAIS DA CADEIRA:\n${sourcesBlock}` : ''}
${!sourcesBlock && args.attachments && args.attachments.length > 0 ? '\nAnalisa os ficheiros anexados da cadeira e extrai perguntas fiéis à matéria real.' : ''}
${avoidBlock}

Regras:
- Perguntas diretas, concretas e verificáveis (1–2 frases), privilegiando exercícios típicos, definições críticas ou armadilhas de exame presentes nos materiais quando houver fontes.
- Resposta objetiva em 1–3 frases, suficiente para o estudante confirmar se acertou.
- Em "sourceTitle", coloca o nome exato da fonte/documento usado (ou omite se não houver fontes anexadas).
Devolve APENAS JSON válido no formato:
{"cards":[{"prompt":"...","answer":"...","sourceTitle":"opcional"}]}`;

  const contents = buildContentsWithAttachments([{ role: 'user', text: prompt }], args.attachments);
  const generationConfig: GenerationConfig = {
    temperature: 0.4,
    maxOutputTokens: 900,
    responseMimeType: 'application/json',
  };

  const rawText = await withQuotaAndFallback('notebook', customKey, () =>
    customKey
      ? callDirectRest({ key: customKey, model, contents, generationConfig })
      : runNativeGenerate({ model, contents, generationConfig }),
  );

  const match = /\{[\s\S]*\}/.exec(rawText || '{}');
  const parsed = JSON.parse(match ? match[0] : rawText || '{}') as {
    cards?: Array<Partial<GeneratedPracticeCardDraft>>;
  };

  const clean = (parsed.cards ?? [])
    .map((c) => ({
      prompt: c.prompt?.trim() ?? '',
      answer: c.answer?.trim() ?? '',
      ...(c.sourceTitle?.trim() ? { sourceTitle: c.sourceTitle.trim().slice(0, 90) } : {}),
    }))
    .filter((c) => c.prompt.length >= 6 && c.answer.length >= 3)
    .slice(0, count);

  if (clean.length === 0) {
    throw new Error('Não foi possível gerar cartões de prática agora.');
  }
  return clean;
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
- REGRA DE SUBCOLUNAS SOBREPOSTAS (MUITO IMPORTANTE — tabelas CLIP / horários universitários):
  * Se um dia tiver aulas sobrepostas (ex.: dois blocos lado a lado em Quinta-feira / "5ª"), o cabeçalho azul/cinzento desse dia ("5ª") fica LARGO (colspan=2 ou 3) e cobre TODAS essas subcolunas lado a lado!
  * Traça uma linha vertical imaginária desde as bordas esquerda e direita da célula do cabeçalho ("2ª", "3ª", "4ª", "5ª", "6ª", "Sábado", "Domingo"). TUDO o que estiver debaixo da largura do cabeçalho "5ª" pertence a "5ª" (weekday=4), mesmo na 2.ª subcoluna à direita!
  * Só passa a "6ª" (weekday=5) o que estiver literalmente debaixo do cabeçalho "6ª", e só passa a "Sábado" (weekday=6) o que estiver literalmente debaixo do cabeçalho "Sábado" (que em horários de faculdade normalmente está completamente vazio).
  * NUNCA contes o índice da coluna pela largura simples da grelha; segue sempre a barra do cabeçalho imediatamente acima de cada retângulo!
- PORTUGAL DAY RULE (CRÍTICA):
  * "2ª" / "Seg" = dayHeader "2ª", weekday = 1 (Segunda-feira)
  * "3ª" / "Ter" = dayHeader "3ª", weekday = 2 (Terça-feira)
  * "4ª" / "Qua" = dayHeader "4ª", weekday = 3 (Quarta-feira)
  * "5ª" / "Qui" = dayHeader "5ª", weekday = 4 (Quinta-feira)
  * "6ª" / "Sex" = dayHeader "6ª", weekday = 5 (Sexta-feira)
  * CUIDADO: "6ª" é SEXTA-FEIRA (weekday 5), NUNCA uses 6 para "6ª"!
  * Sábado (weekday = 6) e hasSaturdayColumn = true SÓ devem ser usados se houver REALMENTE blocos de aula colocados debaixo de uma coluna escrita "Sáb" ou "Sábado" (se a coluna "Sábado" existir no cabeçalho mas estiver vazia, hasSaturdayColumn = false).
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

/** Converte rapidamente uma resposta em texto (ex.: do Tutor Uni) em aulas/avaliações estruturadas para sincronizar com a app. */
export async function extractScheduleFromText(
  sourceText: string,
  knownCourses?: KnownCourseHint[],
): Promise<ExtractedSchedulePayload> {
  const clean = sourceText.trim();
  if (!clean) return { slots: [], assessments: [] };

  const { customKey, model } = resolveGeminiConfig();
  const knownSection = buildKnownCoursesPromptSection(knownCourses);
  const prompt = `Extrai TODAS as datas de testes, frequências, exames, entregas de projetos/trabalhos e aulas semanais mencionadas no texto abaixo.
Devolve APENAS JSON válido no formato exato:
{
  "hasSaturdayColumn": false,
  "slots": [
    {"courseName": "Nome real da cadeira", "courseCode": "SIGLA opcional", "dayHeader": "2ª|3ª|4ª|5ª|6ª|Sáb", "type": "T|TP|P|OT", "weekday": 1, "start": "09:00", "end": "11:00", "room": "Sala opcional"}
  ],
  "assessments": [
    {"courseName": "Nome real da cadeira", "courseCode": "SIGLA opcional", "title": "1.º Teste", "date": "2026-11-20T14:30:00", "kind": "teste|exame|trabalho|projeto|quiz", "location": "Sala opcional"}
  ]
}
Regras:
- Regra Portugal para aulas: "2ª"=1, "3ª"=2, "4ª"=3, "5ª"=4, "6ª"=5 (6ª é Sexta-feira, NUNCA 6).
- Para avaliações sem ano explícito: Set–Dez = 2026, Jan–Jul = 2027. Se não houver hora, usa "09:00:00".
- Liga sempre à cadeira real da lista abaixo se corresponder à sigla/nome.${knownSection}

Texto a extrair:
"""
${clean.slice(0, 6000)}
"""`;

  const contents: Content[] = [{ role: 'user', parts: [{ type: 'text', text: prompt }] }];
  const generationConfig: GenerationConfig = {
    temperature: 0.1,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json',
  };

  const rawJson = customKey
    ? await callDirectRest({ key: customKey, model, contents, generationConfig })
    : await runNativeGenerate({ model, contents, generationConfig });

  return parseScheduleJsonText(rawJson);
}

/**
 * Conduz um turno conversacional curto no Diário/Check-in do Uni para extrair matéria (ex.: "cai até ao slide 8"),
 * estado emocional e resumo de estudo em linguagem natural.
 */
export async function converseCheckInWithGemini(args: {
  messages: { role: 'user' | 'model'; text: string }[];
  baseUnderstanding: ParsedCheckInUnderstanding;
  courseName?: string;
  courseTopics: { id: string; title: string }[];
  courseMaterials: string[];
  assessmentTitle?: string;
  persona?: UniPersonaMode;
  signal?: AbortSignal;
}): Promise<{
  reply: string;
  understanding: ParsedCheckInUnderstanding;
}> {
  const personaHint =
    args.persona === 'exigente'
      ? 'Sê direto, energético e prático.'
      : args.persona === 'calmo'
        ? 'Sê sereno, acolhedor e tranquilo.'
        : args.persona === 'curioso'
          ? 'Sê curioso e faz uma pergunta breve para confirmar detalhes.'
          : args.persona === 'treinador'
            ? 'Sê positivo, prático e focado em metas curtas.'
            : 'Sê próximo, humano e empático como um colega atento.';

  const topicsList =
    args.courseTopics.length > 0
      ? args.courseTopics.map((t) => `- [${t.id}] ${t.title}`).join('\n')
      : '(sem tópicos listados ainda)';
  const matsList =
    args.courseMaterials.length > 0
      ? args.courseMaterials.slice(0, 28).map((m) => `- ${m}`).join('\n')
      : '(sem apontamentos anexados)';

  const system = `És o Uni num mini-chat humano de check-in com um estudante universitário em Portugal. ${personaHint}
Modo de conversa: ${args.baseUnderstanding.kind} (${args.courseName ?? 'geral'}${args.assessmentTitle ? ` · ${args.assessmentTitle}` : ''}).
Responde em 2 a 3 frases curtas, humanas e naturais em português de Portugal, confirmando exatamente o que entendeste (matéria até que slide/aula, dúvidas, cansaço ou ansiedade) e perguntando se quer ajustar algo antes de confirmar. NÃO uses listas longas nem questionários formais.

Tópicos existentes na cadeira:
${topicsList}

Apontamentos disponíveis na biblioteca desta cadeira (usa para perceber intervalos como "até ao slide 8" ou "até T08"):
${matsList}

No FINAL da tua resposta, inclui exatamente um bloco técnico invisível ao utilizador:
<uni-checkin-sync>{"feeling":"clara|mais_ou_menos|dificil|faltei|produtivo|normal|cansado|confiante|estavel|pressionado|atrasado|ansioso","scopeLabel":"opcional ex: Até Slide 8","studyFocus":"opcional ex: Refazer testes antigos / Resolver exercícios / Rever resumos","topicTitle":"opcional","matchedTopicIds":["ids existentes aplicáveis"],"newTopics":["títulos novos a adicionar caso faltem"],"studiedSummary":"opcional","difficulties":"opcional","rating":4}</uni-checkin-sync>`;

  const raw = await askGemini({
    messages: args.messages,
    system,
    signal: args.signal,
  });

  const { visibleReply, sync } = extractUniCheckInSyncBlock(raw);
  const understanding = mergeParsedUnderstandingWithAi(
    args.baseUnderstanding,
    sync,
    args.courseTopics.length > 0
      ? ({ topics: args.courseTopics } as unknown as AppState['courses'][number])
      : undefined,
  );
  return {
    reply:
      visibleReply ||
      'Percebi tudo! Alinhei esse resumo e o estado no teu plano — confirma abaixo quando estiver bom.',
    understanding,
  };
}

export interface ExtractedTopicSheetResult {
  title: string;
  summary: string;
  keyConcepts: string[];
}

/** Gera uma ficha de tópico estruturada e citável a partir de materiais reais para guardar em IndexedDB. */
export async function extractTopicSheetFromSources(args: {
  topicTitle: string;
  courseName?: string;
  sources: NotebookSourceInput[];
  attachments?: ChatAttachment[];
}): Promise<ExtractedTopicSheetResult> {
  const { customKey, model } = resolveGeminiConfig();
  const formattedSources = args.sources
    .filter((s) => s.content.trim())
    .map((s, i) => `### [Fonte ${i + 1}: ${s.title}]\n${s.content.trim().slice(0, 5000)}`)
    .join('\n\n');

  const hasAttachments = Boolean(args.attachments && args.attachments.length > 0);
  if (!formattedSources && !hasAttachments) {
    throw new Error('Seleciona pelo menos um material com conteúdo ou anexa um ficheiro antes de gerar a ficha.');
  }

  const prompt = `Cria uma ficha de estudo permanente e citável em português europeu (pt-PT) sobre "${args.topicTitle}"${args.courseName ? ` (${args.courseName})` : ''}.
Regras obrigatórias:
- Usa EXCLUSIVAMENTE as fontes fornecidas.
- Inclui: 1) Ideia central, 2) Definições e fórmulas-chave (com LaTeX se aplicável), 3) Armadilhas típicas de teste e 4) Exemplo resolvido ou caso prático curto.
- Cita sempre a origem entre parênteses retos: [Fonte: nome exato]. Se faltar algo nas fontes, não inventes.
${formattedSources ? `\nFONTES:\n${formattedSources}` : '\nAnalisa os ficheiros anexados como fontes principais.'}

Devolve APENAS JSON válido:
{"title":"Título claro da ficha","summary":"Markdown estruturado da ficha","keyConcepts":["conceito 1","conceito 2","conceito 3"]}`;

  const contents = buildContentsWithAttachments([{ role: 'user', text: prompt }], args.attachments);
  const generationConfig: GenerationConfig = {
    temperature: 0.35,
    maxOutputTokens: 1600,
    responseMimeType: 'application/json',
  };

  const rawText = await withQuotaAndFallback('notebook', customKey, () =>
    customKey
      ? callDirectRest({ key: customKey, model, contents, generationConfig })
      : runNativeGenerate({ model, contents, generationConfig }),
  );

  const match = /\{[\s\S]*\}/.exec(rawText || '{}');
  const parsed = JSON.parse(match ? match[0] : rawText || '{}') as Partial<ExtractedTopicSheetResult>;
  const summary = parsed.summary?.trim() ?? '';
  if (!summary) {
    throw new Error('Não foi possível extrair uma ficha estruturada agora. Tenta novamente.');
  }
  return {
    title: parsed.title?.trim().slice(0, 80) || args.topicTitle,
    summary,
    keyConcepts: Array.isArray(parsed.keyConcepts)
      ? parsed.keyConcepts.map((k) => String(k).trim()).filter(Boolean).slice(0, 8)
      : [],
  };
}

export interface UniRecallPromptResult {
  question: string;
  hint: string;
}

/** Gera uma pergunta aberta curta de Recall do Uni para o fecho da sessão de foco. */
export async function generateUniRecallQuestion(args: {
  topicTitle: string;
  courseName?: string;
  agent: UniAgentRecord;
  sheets?: TopicSheetRecord[];
  examMode?: boolean;
}): Promise<UniRecallPromptResult> {
  const { customKey, model } = resolveGeminiConfig();
  const targetLang: 'pt-PT' | 'en' = args.agent.language?.toLowerCase().startsWith('en') ? 'en' : 'pt-PT';
  const examMode = args.examMode ?? args.agent.stage >= 3;
  const sheetContext = (args.sheets ?? [])
    .slice(0, 2)
    .map((s) => `[${s.title}]\n${s.summary.slice(0, 1200)}`)
    .join('\n\n');
  const weakHint =
    args.agent.notebook.weakSpots.length > 0
      ? `${targetLang === 'en' ? 'Recorded weak spots' : 'Pontos fracos registados'}: ${args.agent.notebook.weakSpots
          .slice(0, 3)
          .map((w) => `${w.topic} (${w.note})`)
          .join('; ')}.`
      : '';

  const prompt =
    targetLang === 'en'
      ? `You are "${args.agent.name}", specialist Uni for ${args.courseName ?? 'this course'}. ${PERSONA_INSTRUCTIONS_BY_LANG.en[args.agent.personaId]}
Ask the student for an active 2-sentence recall on "${args.topicTitle}" from memory (no notes).
${examMode ? 'Specialist Exam Mode unlocked: make the prompt exam-grade (test a condition, trap, or application).' : ''}
${weakHint}
${sheetContext ? `\nCourse sheets:\n${sheetContext}` : ''}
Return ONLY valid JSON:
{"question":"1-2 concise sentences in your archetype voice","hint":"short 1-sentence hint if requested"}`
      : `És «${args.agent.name}», Uni especialista de ${args.courseName ?? 'cadeira'}. ${PERSONA_INSTRUCTIONS_BY_LANG['pt-PT'][args.agent.personaId]}
Pede ao estudante um recall ativo de 2 frases sobre «${args.topicTitle}» sem consultar apontamentos.
${examMode ? 'Modo Exame de Especialista ativo: formula uma pergunta exigente estilo teste/exame (testando condição, exceção ou aplicação).' : ''}
${weakHint}
${sheetContext ? `\nMaterial real da cadeira:\n${sheetContext}` : ''}
Devolve APENAS JSON válido:
{"question":"pergunta curta e concreta em 1–2 frases no tom do teu arquétipo","hint":"pista curta em 1 frase caso o aluno peça ajuda"}`;

  const contents: Content[] = [{ role: 'user', parts: [{ type: 'text', text: prompt }] }];
  const generationConfig: GenerationConfig = {
    temperature: 0.45,
    maxOutputTokens: 320,
    responseMimeType: 'application/json',
  };

  const rawText = await withQuotaAndFallback('recall', customKey, () =>
    customKey
      ? callDirectRest({ key: customKey, model, contents, generationConfig })
      : runNativeGenerate({ model, contents, generationConfig }),
  );

  const match = /\{[\s\S]*\}/.exec(rawText || '{}');
  const parsed = JSON.parse(match ? match[0] : rawText || '{}') as Partial<UniRecallPromptResult>;
  return {
    question:
      parsed.question?.trim() ||
      (targetLang === 'en'
        ? `In 2 sentences from memory, explain the core idea of "${args.topicTitle}".`
        : `Explica-me em 2 frases, sem olhar para a sebenta, a ideia essencial de «${args.topicTitle}».`),
    hint:
      parsed.hint?.trim() ||
      (targetLang === 'en'
        ? 'Include a concise definition and one condition where it applies.'
        : 'Pensa numa definição curta e num caso em que se aplica (ou falha).'),
  };
}

export interface UniRecallEvaluationResult {
  score: 1 | 2 | 3;
  feedback: string;
  detectedWeakSpot?: { topic: string; note: string };
  matchedStrength?: string;
}

/** Avalia a resposta de recall do estudante com feedback no arquétipo do Uni e nota 1|2|3 para o SRS. */
export async function evaluateUniRecall(args: {
  topicTitle: string;
  question: string;
  studentAnswer: string;
  courseName?: string;
  agent: UniAgentRecord;
  sheets?: TopicSheetRecord[];
}): Promise<UniRecallEvaluationResult> {
  const { customKey, model } = resolveGeminiConfig();
  const targetLang: 'pt-PT' | 'en' = args.agent.language?.toLowerCase().startsWith('en') ? 'en' : 'pt-PT';
  const sheetContext = (args.sheets ?? [])
    .slice(0, 2)
    .map((s) => `[${targetLang === 'en' ? 'Source' : 'Fonte'}: ${s.title}]\n${s.summary.slice(0, 1600)}`)
    .join('\n\n');

  const prompt =
    targetLang === 'en'
      ? `You are "${args.agent.name}", specialist Uni for ${args.courseName ?? 'this course'}. ${PERSONA_INSTRUCTIONS_BY_LANG.en[args.agent.personaId]}
Evaluate the student's active recall answer in clear English.
Topic: ${args.topicTitle}
Question: ${args.question}
Student answer: ${args.studentAnswer}
${sheetContext ? `\nReference sheets:\n${sheetContext}` : ''}

Strict SRS rubric:
- 1 ("Missed"): major conceptual error or empty/inaccurate answer.
- 2 ("Partial"): got the main idea but missed a condition, sign, or nuance.
- 3 ("Mastered"): clear, accurate explanation at course level.

Return ONLY valid JSON:
{"score":1|2|3,"feedback":"2-3 concrete sentences in your archetype voice (cite [Source: ...] if applicable)","weakNote":"if score<3, short note of mistake (max 100 chars), else empty string","strengthNote":"if score==3, short strength (max 90 chars), else empty string"}`
      : `És «${args.agent.name}», Uni especialista de ${args.courseName ?? 'cadeira'}. ${PERSONA_INSTRUCTIONS_BY_LANG['pt-PT'][args.agent.personaId]}
Avalia a resposta de recall ativo do estudante em português europeu (pt-PT).
Tópico: ${args.topicTitle}
Pergunta feita: ${args.question}
Resposta do estudante: ${args.studentAnswer}
${sheetContext ? `\nReferência das fichas:\n${sheetContext}` : ''}

Critério estrito de score para repetição espaçada:
- 1 ("Falhei"): erro conceptual grave ou resposta vazia/muito imprecisa.
- 2 ("Lembrei +-"): acertou a ideia geral mas falhou um detalhe, condição ou aplicação.
- 3 ("Dominei"): explicação correta, clara e precisa para o nível do tópico.

Devolve APENAS JSON válido:
{"score":1|2|3,"feedback":"2 a 3 frases concretas no tom do teu arquétipo a corrigir ou validar (cita [Fonte: ...] se aplicável)","weakNote":"se score<3, nota curta do erro ou omissão (máx 100 chars), senão string vazia","strengthNote":"se score==3, ponto forte curto (máx 90 chars), senão string vazia"}`;

  const contents: Content[] = [{ role: 'user', parts: [{ type: 'text', text: prompt }] }];
  const generationConfig: GenerationConfig = {
    temperature: 0.35,
    maxOutputTokens: 450,
    responseMimeType: 'application/json',
  };

  const rawText = await withQuotaAndFallback('recall', customKey, () =>
    customKey
      ? callDirectRest({ key: customKey, model, contents, generationConfig })
      : runNativeGenerate({ model, contents, generationConfig }),
  );

  const match = /\{[\s\S]*\}/.exec(rawText || '{}');
  const parsed = JSON.parse(match ? match[0] : rawText || '{}') as {
    score?: number;
    feedback?: string;
    weakNote?: string;
    strengthNote?: string;
  };
  const score = parsed.score === 1 || parsed.score === 2 || parsed.score === 3 ? parsed.score : 2;
  const feedback =
    parsed.feedback?.trim() ||
    (score === 3
      ? targetLang === 'en'
        ? 'Clean, accurate answer — strong retention!'
        : 'Resposta limpa e sólida. Boa retenção!'
      : targetLang === 'en'
        ? 'Almost there — double check the key condition in your sheet before the next review.'
        : 'Quase lá — revê a condição principal na ficha antes da próxima revisão.');
  const weakNote = parsed.weakNote?.trim();
  const strengthNote = parsed.strengthNote?.trim();

  return {
    score,
    feedback,
    ...(score < 3 && weakNote
      ? { detectedWeakSpot: { topic: args.topicTitle, note: weakNote.slice(0, 180) } }
      : {}),
    ...(score === 3 && strengthNote ? { matchedStrength: strengthNote.slice(0, 120) } : {}),
  };
}

/** Prepara até 3 perguntas curtas de expedição para a revisão espaçada do dia seguinte. */
export async function generateUniExpeditionQuestions(args: {
  courseName: string;
  agent: UniAgentRecord;
  candidateTopics: Array<{ id?: string; title: string }>;
  sheets?: TopicSheetRecord[];
  forDate: string;
}): Promise<UniAgentExpedition> {
  const { customKey, model } = resolveGeminiConfig();
  const targetLang: 'pt-PT' | 'en' = args.agent.language?.toLowerCase().startsWith('en') ? 'en' : 'pt-PT';
  const topics = args.candidateTopics.slice(0, 3);
  const sheetContext = (args.sheets ?? [])
    .slice(0, 4)
    .map((s) => `[${s.title}]\n${s.summary.slice(0, 1100)}`)
    .join('\n\n');

  const prompt =
    targetLang === 'en'
      ? `You are "${args.agent.name}", specialist Uni for ${args.courseName}. ${PERSONA_INSTRUCTIONS_BY_LANG.en[args.agent.personaId]}
Prepare ${topics.length || 2} sharp spaced-repetition expedition questions for tomorrow (${args.forDate}) covering these topics:
${topics.map((t, i) => `${i + 1}. ${t.title}`).join('\n') || `- Core concepts of ${args.courseName}`}
${sheetContext ? `\nSaved course sheets:\n${sheetContext}` : ''}
Return ONLY valid JSON:
{"questions":[{"topicTitle":"exact topic name","q":"short active-recall question in your voice","hint":"1-sentence hint","sourceRef":"sheet title or Syllabus"}]}`
      : `És «${args.agent.name}», Uni especialista de ${args.courseName}. ${PERSONA_INSTRUCTIONS_BY_LANG['pt-PT'][args.agent.personaId]}
Prepara ${topics.length || 2} perguntas curtas de expedição para a revisão espaçada de amanhã (${args.forDate}) sobre estes tópicos:
${topics.map((t, i) => `${i + 1}. ${t.title}`).join('\n') || `- Ideias centrais de ${args.courseName}`}
${sheetContext ? `\nFichas reais da cadeira:\n${sheetContext}` : ''}
Devolve APENAS JSON válido:
{"questions":[{"topicTitle":"nome exato do tópico","q":"pergunta curta de recall no teu tom","hint":"pista curta em 1 frase","sourceRef":"nome da ficha ou Programa"}]}`;

  const contents: Content[] = [{ role: 'user', parts: [{ type: 'text', text: prompt }] }];
  const generationConfig: GenerationConfig = {
    temperature: 0.45,
    maxOutputTokens: 700,
    responseMimeType: 'application/json',
  };

  const rawText = await withQuotaAndFallback('recall', customKey, () =>
    customKey
      ? callDirectRest({ key: customKey, model, contents, generationConfig })
      : runNativeGenerate({ model, contents, generationConfig }),
  );

  const match = /\{[\s\S]*\}/.exec(rawText || '{}');
  const parsed = JSON.parse(match ? match[0] : rawText || '{}') as {
    questions?: Array<{ topicTitle?: string; q?: string; hint?: string; sourceRef?: string }>;
  };

  const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions.slice(0, 3) : [];
  const questions: UniExpeditionQuestion[] = rawQuestions
    .filter((item) => item?.q?.trim())
    .map((item, idx) => {
      const matchedTopic =
        topics.find(
          (t) =>
            item.topicTitle &&
            t.title.toLowerCase().includes(item.topicTitle.trim().toLowerCase()),
        ) ?? topics[idx];
      return {
        id: `exp-${args.forDate}-${idx + 1}`,
        ...(matchedTopic?.id ? { topicId: matchedTopic.id } : {}),
        topicTitle: (matchedTopic?.title || item.topicTitle || args.courseName).slice(0, 120),
        q: String(item.q).trim().slice(0, 500),
        hint:
          String(item.hint || '').trim().slice(0, 260) ||
          (targetLang === 'en' ? 'Recall the key definition first.' : 'Começa pela definição principal.'),
        sourceRef:
          String(item.sourceRef || '').trim().slice(0, 120) ||
          (args.sheets?.[0]?.title ?? args.courseName),
      };
    });

  if (questions.length === 0 && topics.length > 0) {
    questions.push({
      id: `exp-${args.forDate}-1`,
      ...(topics[0].id ? { topicId: topics[0].id } : {}),
      topicTitle: topics[0].title,
      q:
        targetLang === 'en'
          ? `Summarize the core rule of "${topics[0].title}" in 2 sentences from memory.`
          : `Resume em 2 frases sem apontamentos a regra principal de «${topics[0].title}».`,
      hint: targetLang === 'en' ? 'Name the main condition and one example.' : 'Indica a condição principal e um exemplo.',
      sourceRef: args.sheets?.[0]?.title ?? args.courseName,
    });
  }

  return {
    preparedAt: new Date().toISOString(),
    forDate: args.forDate,
    questions,
  };
}

/** Extrai uma observação incremental curta para o Caderno do Uni apenas quando `memoryEnabled === true`. */
export async function summarizeNotebookMemoryDelta(args: {
  courseName: string;
  userMessage: string;
  assistantReply: string;
  agent: UniAgentRecord;
}): Promise<NotebookDeltaProposal> {
  if (!args.agent.memoryEnabled) return {};
  if (args.userMessage.trim().length < 20) return {};

  const { customKey, model } = resolveGeminiConfig();
  const prompt = `Analisa esta troca rápida sobre "${args.courseName}" entre estudante e o Uni «${args.agent.name}».
Extrai APENAS factos pedagógicos objetivos e úteis para estudo futuro (dificuldade recorrente concreta ou ponto forte demonstrado). Nunca inventes notas nem incluas dados pessoais sensíveis. Se não houver nenhum facto relevante novo, devolve vazio.
Pergunta do estudante: ${args.userMessage.slice(0, 600)}
Resposta do Uni: ${args.assistantReply.slice(0, 900)}

Devolve APENAS JSON válido:
{"weakSpot":{"topic":"nome curto do tópico","note":"dificuldade concreta observada"},"strength":"ponto forte curto opcional"}`;

  const contents: Content[] = [{ role: 'user', parts: [{ type: 'text', text: prompt }] }];
  const generationConfig: GenerationConfig = {
    temperature: 0.25,
    maxOutputTokens: 220,
    responseMimeType: 'application/json',
  };

  const rawText = await withQuotaAndFallback('recall', customKey, () =>
    customKey
      ? callDirectRest({ key: customKey, model, contents, generationConfig })
      : runNativeGenerate({ model, contents, generationConfig }),
  );

  const match = /\{[\s\S]*\}/.exec(rawText || '{}');
  const parsed = JSON.parse(match ? match[0] : rawText || '{}') as {
    weakSpot?: { topic?: string; note?: string } | null;
    strength?: string | null;
  };
  return {
    ...(parsed.weakSpot?.topic?.trim() && parsed.weakSpot?.note?.trim()
      ? {
          weakSpot: {
            topic: parsed.weakSpot.topic.trim().slice(0, 80),
            note: parsed.weakSpot.note.trim().slice(0, 180),
          },
        }
      : {}),
    ...(parsed.strength?.trim() ? { strength: parsed.strength.trim().slice(0, 120) } : {}),
  };
}
