// Desfazer do último recálculo do plano e o aviso «Plano atualizado · Desfazer».
// Fica FORA do store persistido (nada disto vai para o localStorage nem para a nuvem).
import type { Course, PlannerPreferences, StudySession } from '../types';
import type { ReplanReason } from '../lib/planner/replan';

export interface PlanUndoSnapshot {
  token: number;
  reason: ReplanReason;
  /** Sessões substituíveis antes do recálculo. */
  prevFuture: StudySession[];
  /** Preferências do plano antes (quando o recálculo veio de mudar preferências / briefing). */
  prevPrefs?: PlannerPreferences;
  /** Cadeiras antes (quando o briefing mudou o estado de tópicos). */
  prevCourses?: Course[];
  at: number;
}

const UNDO_TTL_MS = 15_000;
let snapshot: PlanUndoSnapshot | null = null;
let tokenSeq = 0;

export function recordPlanUndo(data: Omit<PlanUndoSnapshot, 'token' | 'at'>): number {
  tokenSeq += 1;
  snapshot = { ...data, token: tokenSeq, at: Date.now() };
  return tokenSeq;
}

/** Fotografia ainda válida (dentro do prazo) para desfazer; consome-a. */
export function takePlanUndo(token?: number): PlanUndoSnapshot | null {
  const s = snapshot;
  if (!s) return null;
  if (token !== undefined && s.token !== token) return null;
  if (Date.now() - s.at > UNDO_TTL_MS) {
    snapshot = null;
    return null;
  }
  snapshot = null;
  return s;
}

// --- Aviso -------------------------------------------------------------------------------

type Notifier = (token: number, reason: ReplanReason) => void;
let notifier: Notifier | null = null;
let pending: { token: number; reason: ReplanReason } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let silentAdjusted = false;

/** A UI regista aqui como mostrar o aviso (toast com Desfazer). */
export function setPlanReplanNotifier(fn: Notifier | null) {
  notifier = fn;
}

/**
 * Vários recálculos seguidos (ex.: guardar uma avaliação e os tópicos) dão um só aviso.
 * Recálculos silenciosos (acabar um foco, prática) não interrompem: ficam para a próxima visita ao Plano.
 */
export function notifyPlanReplanned(token: number, reason: ReplanReason, silent: boolean) {
  if (silent) {
    silentAdjusted = true;
    return;
  }
  pending = { token, reason };
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const p = pending;
    pending = null;
    if (p && notifier) notifier(p.token, p.reason);
  }, 500);
}

/** O plano foi ajustado em silêncio desde a última visita? (consome o aviso) */
export function consumeSilentPlanAdjust(): boolean {
  const was = silentAdjusted;
  silentAdjusted = false;
  return was;
}
