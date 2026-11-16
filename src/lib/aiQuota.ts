// Controlo local de quota diária para proteger a cota gratuita do Uni nativo.
// Quando o utilizador usa chave própria (Avançado), os limites locais são ignorados.
import i18n, { resources } from '../i18n';
import { todayStr } from './selectors';

export const DAILY_CHAT_LIMIT = 15;
export const DAILY_NOTEBOOK_LIMIT = 3;
export const DAILY_RECALL_LIMIT = 8;

const STORAGE_KEY = 'unipedia_uni_quota_v1';
const METRICS_STORAGE_KEY = 'unipedia_uni_metrics_v1';

export type QuotaKind = 'chat' | 'notebook' | 'recall';

interface StoredQuota {
  date: string;
  chat: number;
  notebook: number;
  recall: number;
}

export interface DailyQuotaSnapshot {
  date: string;
  chatUsed: number;
  chatLimit: number;
  chatRemaining: number;
  notebookUsed: number;
  notebookLimit: number;
  notebookRemaining: number;
  recallUsed: number;
  recallLimit: number;
  recallRemaining: number;
  bypassed: boolean;
}

export interface DailyAiMetricsSnapshot {
  date: string;
  inputTokens: number;
  outputTokens: number;
  calls: number;
  wrongFeedbackCount: number;
  voiceSessions: number;
  voiceSeconds: number;
}

type QuotaMessageKey = keyof (typeof resources)['pt-PT']['common']['quota'];

/** Traduz mensagens de quota; sem i18n inicializado (testes), usa pt-PT. */
function quotaMessage(key: QuotaMessageKey, vars: Record<string, number> = {}): string {
  if (i18n.isInitialized) return i18n.t(`common:quota.${key}`, vars);
  return resources['pt-PT'].common.quota[key].replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(vars[name] ?? ''),
  );
}

export class UniDailyLimitReachedError extends Error {
  constructor(kind: QuotaKind) {
    const label =
      kind === 'chat'
        ? quotaMessage('chatLimit', { limit: DAILY_CHAT_LIMIT })
        : kind === 'notebook'
          ? quotaMessage('notebookLimit', { limit: DAILY_NOTEBOOK_LIMIT })
          : quotaMessage('recallLimit', { limit: DAILY_RECALL_LIMIT });
    super(`${label} ${quotaMessage('renewHint')}`);
    this.name = 'UniDailyLimitReachedError';
  }
}

function readRawQuota(): StoredQuota {
  const today = todayStr();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: today, chat: 0, notebook: 0, recall: 0 };
    const parsed = JSON.parse(raw) as Partial<StoredQuota>;
    if (parsed.date !== today) {
      return { date: today, chat: 0, notebook: 0, recall: 0 };
    }
    return {
      date: today,
      chat: typeof parsed.chat === 'number' && parsed.chat >= 0 ? parsed.chat : 0,
      notebook: typeof parsed.notebook === 'number' && parsed.notebook >= 0 ? parsed.notebook : 0,
      recall: typeof parsed.recall === 'number' && parsed.recall >= 0 ? parsed.recall : 0,
    };
  } catch {
    return { date: today, chat: 0, notebook: 0, recall: 0 };
  }
}

function writeRawQuota(data: StoredQuota): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export function getDailyQuotaSnapshot(bypassed = false): DailyQuotaSnapshot {
  const q = readRawQuota();
  return {
    date: q.date,
    chatUsed: q.chat,
    chatLimit: DAILY_CHAT_LIMIT,
    chatRemaining: Math.max(0, DAILY_CHAT_LIMIT - q.chat),
    notebookUsed: q.notebook,
    notebookLimit: DAILY_NOTEBOOK_LIMIT,
    notebookRemaining: Math.max(0, DAILY_NOTEBOOK_LIMIT - q.notebook),
    recallUsed: q.recall,
    recallLimit: DAILY_RECALL_LIMIT,
    recallRemaining: Math.max(0, DAILY_RECALL_LIMIT - q.recall),
    bypassed,
  };
}

export function consumeDailyQuota(kind: QuotaKind, bypassed = false): DailyQuotaSnapshot {
  if (bypassed) return getDailyQuotaSnapshot(true);
  const q = readRawQuota();
  const limit =
    kind === 'chat'
      ? DAILY_CHAT_LIMIT
      : kind === 'notebook'
        ? DAILY_NOTEBOOK_LIMIT
        : DAILY_RECALL_LIMIT;
  if (q[kind] >= limit) {
    throw new UniDailyLimitReachedError(kind);
  }
  q[kind] += 1;
  writeRawQuota(q);
  return getDailyQuotaSnapshot(false);
}

export function refundDailyQuota(kind: QuotaKind, bypassed = false): void {
  if (bypassed) return;
  const q = readRawQuota();
  if (q[kind] > 0) {
    q[kind] -= 1;
    writeRawQuota(q);
  }
}

function readRawMetrics(): DailyAiMetricsSnapshot {
  const today = todayStr();
  try {
    const raw = localStorage.getItem(METRICS_STORAGE_KEY);
    if (!raw) {
      return {
        date: today,
        inputTokens: 0,
        outputTokens: 0,
        calls: 0,
        wrongFeedbackCount: 0,
        voiceSessions: 0,
        voiceSeconds: 0,
      };
    }
    const parsed = JSON.parse(raw) as Partial<DailyAiMetricsSnapshot>;
    if (parsed.date !== today) {
      return {
        date: today,
        inputTokens: 0,
        outputTokens: 0,
        calls: 0,
        wrongFeedbackCount: 0,
        voiceSessions: 0,
        voiceSeconds: 0,
      };
    }
    return {
      date: today,
      inputTokens: typeof parsed.inputTokens === 'number' ? Math.max(0, parsed.inputTokens) : 0,
      outputTokens: typeof parsed.outputTokens === 'number' ? Math.max(0, parsed.outputTokens) : 0,
      calls: typeof parsed.calls === 'number' ? Math.max(0, parsed.calls) : 0,
      wrongFeedbackCount:
        typeof parsed.wrongFeedbackCount === 'number' ? Math.max(0, parsed.wrongFeedbackCount) : 0,
      voiceSessions:
        typeof parsed.voiceSessions === 'number' ? Math.max(0, parsed.voiceSessions) : 0,
      voiceSeconds:
        typeof parsed.voiceSeconds === 'number' ? Math.max(0, parsed.voiceSeconds) : 0,
    };
  } catch {
    return {
      date: today,
      inputTokens: 0,
      outputTokens: 0,
      calls: 0,
      wrongFeedbackCount: 0,
      voiceSessions: 0,
      voiceSeconds: 0,
    };
  }
}

function writeRawMetrics(metrics: DailyAiMetricsSnapshot): void {
  try {
    localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(metrics));
  } catch {
    // Ignore storage quota errors
  }
}

export function getAiMetricsSnapshot(): DailyAiMetricsSnapshot {
  return readRawMetrics();
}

export function recordAiTokenUsage(inputTokens = 0, outputTokens = 0): void {
  const current = readRawMetrics();
  writeRawMetrics({
    ...current,
    inputTokens: current.inputTokens + Math.max(0, Math.round(inputTokens)),
    outputTokens: current.outputTokens + Math.max(0, Math.round(outputTokens)),
    calls: current.calls + 1,
  });
}

export function recordWrongAnswerFeedback(): void {
  const current = readRawMetrics();
  writeRawMetrics({
    ...current,
    wrongFeedbackCount: current.wrongFeedbackCount + 1,
  });
}

/**
 * Regra explícita da Fase 3: Voz Live (`gemini-3.8-live`) exige chave Gemini própria
 * configurada em Definições → Tutor → Avançado, preservando a quota gratuita partilhada
 * apenas para texto, recall e expedições.
 */
export function canStartLiveVoiceSession(hasCustomKey: boolean): {
  allowed: boolean;
  reason?: string;
} {
  if (!hasCustomKey) {
    return {
      allowed: false,
      reason: quotaMessage('voiceNeedsKey'),
    };
  }
  return { allowed: true };
}

export function recordVoiceSessionUsage(durationSeconds: number): void {
  const current = readRawMetrics();
  writeRawMetrics({
    ...current,
    voiceSessions: current.voiceSessions + 1,
    voiceSeconds: current.voiceSeconds + Math.max(0, Math.round(durationSeconds)),
  });
}
