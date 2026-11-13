// Controlo local de quota diária para proteger a cota gratuita do Uni nativo.
// Quando o utilizador usa chave própria (Avançado), os limites locais são ignorados.
import { todayStr } from './selectors';

export const DAILY_CHAT_LIMIT = 15;
export const DAILY_NOTEBOOK_LIMIT = 3;

const STORAGE_KEY = 'unipedia_uni_quota_v1';

export type QuotaKind = 'chat' | 'notebook';

interface StoredQuota {
  date: string;
  chat: number;
  notebook: number;
}

export interface DailyQuotaSnapshot {
  date: string;
  chatUsed: number;
  chatLimit: number;
  chatRemaining: number;
  notebookUsed: number;
  notebookLimit: number;
  notebookRemaining: number;
  bypassed: boolean;
}

export class UniDailyLimitReachedError extends Error {
  constructor(kind: QuotaKind) {
    const label =
      kind === 'chat'
        ? `Atingiste o limite diário de ${DAILY_CHAT_LIMIT} mensagens gratuitas com o Uni.`
        : `Atingiste o limite diário de ${DAILY_NOTEBOOK_LIMIT} gerações no Caderno do Uni.`;
    super(
      `${label} A quota renova à meia-noite — se precisares de estudo intensivo agora, podes colar uma chave pessoal em Definições → Tutor → Avançado.`,
    );
    this.name = 'UniDailyLimitReachedError';
  }
}

function readRawQuota(): StoredQuota {
  const today = todayStr();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: today, chat: 0, notebook: 0 };
    const parsed = JSON.parse(raw) as Partial<StoredQuota>;
    if (parsed.date !== today) {
      return { date: today, chat: 0, notebook: 0 };
    }
    return {
      date: today,
      chat: typeof parsed.chat === 'number' && parsed.chat >= 0 ? parsed.chat : 0,
      notebook: typeof parsed.notebook === 'number' && parsed.notebook >= 0 ? parsed.notebook : 0,
    };
  } catch {
    return { date: today, chat: 0, notebook: 0 };
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
    bypassed,
  };
}

export function consumeDailyQuota(kind: QuotaKind, bypassed = false): DailyQuotaSnapshot {
  if (bypassed) return getDailyQuotaSnapshot(true);
  const q = readRawQuota();
  const limit = kind === 'chat' ? DAILY_CHAT_LIMIT : DAILY_NOTEBOOK_LIMIT;
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
