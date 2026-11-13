import { addDays, differenceInCalendarDays, format } from 'date-fns';
import type { Topic } from '../types';

export const SRS_INTERVALS = [1, 3, 7, 21] as const;

export type RecallScore = 1 | 2 | 3;

export const RECALL_LABELS: Record<RecallScore, { label: string; hint: string }> = {
  1: { label: 'Rever já', hint: 'Falhei pontos-chave — volta amanhã (1d)' },
  2: { label: 'Com esforço', hint: 'Lembrei parte — consolida em breve' },
  3: { label: 'Dominei', hint: 'Expliquei sem cábula — avança no ciclo SRS' },
};

const parseDay = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Calcula o próximo intervalo de revisão espaçada (1 → 3 → 7 → 21 dias)
 * com base no recall ativo pós-sessão e na confiança declarada.
 */
export function computeNextSrsState(
  topic: Topic,
  recallScore: RecallScore,
  confidence: Topic['confidence'],
  dateStr: string,
): Partial<Topic> {
  const currentInterval = topic.srsIntervalDays ?? 0;
  let nextInterval: number;

  if (recallScore === 1 || confidence <= 2) {
    nextInterval = 1;
  } else if (recallScore === 2) {
    if (currentInterval <= 1) nextInterval = 3;
    else if (currentInterval <= 3) nextInterval = confidence >= 4 ? 7 : 3;
    else nextInterval = 7;
  } else {
    const idx = SRS_INTERVALS.findIndex((step) => step > currentInterval);
    if (currentInterval === 0) {
      nextInterval = confidence >= 4 ? 3 : 1;
    } else if (idx >= 0) {
      nextInterval = SRS_INTERVALS[idx];
    } else {
      nextInterval = 21;
    }
  }

  const nextReviewDate = format(addDays(parseDay(dateStr), nextInterval), 'yyyy-MM-dd');
  const nextStatus: Topic['status'] =
    nextInterval === 1
      ? 'learning'
      : nextInterval >= 7 && confidence >= 4
        ? 'done'
        : 'review';

  return {
    srsIntervalDays: nextInterval,
    nextReviewDate,
    lastRecallScore: recallScore,
    recallCount: (topic.recallCount ?? 0) + 1,
    confidence,
    lastStudied: dateStr,
    status: nextStatus,
  };
}

/**
 * Indica se um tópico precisa de revisão espaçada na data `dayKey` (yyyy-MM-dd).
 * Respeita `nextReviewDate` sempre (mesmo em semana de testes) e mantém fallback
 * de 7 dias para tópicos antigos em `review`/`done` ainda sem `nextReviewDate`.
 */
export function isTopicReviewDue(topic: Topic, dayKey: string): boolean {
  if (topic.nextReviewDate) {
    return topic.nextReviewDate <= dayKey;
  }
  if (topic.status !== 'review' && topic.status !== 'done') return false;
  if (!topic.lastStudied) return true;
  return differenceInCalendarDays(parseDay(dayKey), parseDay(topic.lastStudied)) > 7;
}
