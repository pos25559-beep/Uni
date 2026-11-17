import { addDays, differenceInCalendarDays, format } from 'date-fns';
import { tr } from '../i18n/tr';
import type { Course, Topic, TopicRecallSample } from '../types';

export const SRS_INTERVALS = [1, 3, 7, 21] as const;

export type RecallScore = 1 | 2 | 3;

export const RECALL_LABELS: Record<RecallScore, { label: string; hint: string }> = {
  1: {
    get label() { return tr('plan:focus.recall.score1Label'); },
    get hint() { return tr('plan:focus.recall.score1Hint'); },
  },
  2: {
    get label() { return tr('plan:focus.recall.score2Label'); },
    get hint() { return tr('plan:focus.recall.score2Hint'); },
  },
  3: {
    get label() { return tr('plan:focus.recall.score3Label'); },
    get hint() { return tr('plan:focus.recall.score3Hint'); },
  },
};

const parseDay = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Calcula o próximo intervalo de revisão espaçada (1 → 3 → 7 → 21 dias)
 * com base no recall ativo pós-sessão, na confiança declarada e no histórico leve.
 */
export function computeNextSrsState(
  topic: Topic,
  recallScore: RecallScore,
  confidence: Topic['confidence'],
  dateStr: string,
  stats?: { hits?: number; total?: number },
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

  const prevCount = topic.recallCount ?? 0;
  const prevSuccess =
    topic.recallSuccessCount ??
    (topic.lastRecallScore && topic.lastRecallScore >= 2 ? prevCount : 0);
  const succeeded = recallScore >= 2;
  const nextSample: TopicRecallSample = {
    date: dateStr.slice(0, 10),
    score: recallScore,
    ...(typeof stats?.hits === 'number' ? { hits: stats.hits } : {}),
    ...(typeof stats?.total === 'number' ? { total: stats.total } : {}),
  };
  const nextHistory = [...(topic.recallHistory ?? []), nextSample].slice(-10);

  return {
    srsIntervalDays: nextInterval,
    nextReviewDate,
    lastRecallScore: recallScore,
    recallCount: prevCount + 1,
    recallSuccessCount: prevSuccess + (succeeded ? 1 : 0),
    recallStreak: succeeded ? (topic.recallStreak ?? 0) + 1 : 0,
    recallHistory: nextHistory,
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

export type RetentionState = 'fresh' | 'review_soon' | 'at_risk' | 'unstudied';

export interface TopicRetentionEstimate {
  retentionPct: number;
  state: RetentionState;
  daysSinceStudy: number | null;
  stabilityDays: number;
  hitRatePct: number | null;
  due: boolean;
}

/**
 * Estima a retenção atual (0..100%) de um tópico combinando decaimento temporal SRS
 * (curva exponencial de Ebbinghaus sobre a estabilidade atual) e o histórico real de recall.
 */
export function estimateTopicRetention(topic: Topic, dayKey: string): TopicRetentionEstimate {
  const due = isTopicReviewDue(topic, dayKey);
  const count = topic.recallCount ?? 0;
  const success =
    topic.recallSuccessCount ??
    (topic.lastRecallScore && topic.lastRecallScore >= 2 ? count : 0);
  const hitRatePct = count > 0 ? Math.round((success / count) * 100) : null;

  if (!topic.lastStudied && topic.status === 'todo' && count === 0) {
    return {
      retentionPct: 0,
      state: 'unstudied',
      daysSinceStudy: null,
      stabilityDays: 1,
      hitRatePct: null,
      due: false,
    };
  }

  const daysSince = topic.lastStudied
    ? Math.max(0, differenceInCalendarDays(parseDay(dayKey), parseDay(topic.lastStudied)))
    : 3;

  const baseInterval = topic.srsIntervalDays ?? (topic.confidence >= 4 ? 5 : topic.confidence >= 3 ? 3 : 1);
  const streakBonus = 1 + Math.min(3, topic.recallStreak ?? 0) * 0.15;
  const stabilityDays = Math.max(1, baseInterval * 1.6 * streakBonus);

  // Decaimento exponencial suavizado entre 0.15 e 1.0
  const decayFactor = Math.max(0.15, Math.exp(-daysSince / stabilityDays));
  const masteryBase =
    hitRatePct !== null
      ? (hitRatePct * 0.65 + (topic.confidence / 5) * 100 * 0.35) / 100
      : Math.max(0.35, topic.confidence / 5);

  const recallPenalty = topic.lastRecallScore === 1 ? 0.72 : topic.lastRecallScore === 2 ? 0.92 : 1;
  const retentionPct = Math.max(
    10,
    Math.min(100, Math.round(decayFactor * masteryBase * recallPenalty * 100)),
  );

  const state: RetentionState =
    retentionPct >= 75 && !due ? 'fresh' : due || retentionPct < 55 ? 'at_risk' : 'review_soon';

  return {
    retentionPct,
    state,
    daysSinceStudy: topic.lastStudied ? daysSince : null,
    stabilityDays: Number(stabilityDays.toFixed(1)),
    hitRatePct,
    due,
  };
}

export interface DueReviewItem {
  course: Course;
  topic: Topic;
  retention: TopicRetentionEstimate;
}

/** Lista tópicos pendentes de revisão ativa (SRS due ou em risco), ordenados do mais urgente para o mais estável. */
export function getDueReviewQueue(
  courses: Course[],
  dayKey: string,
  courseId?: string,
): DueReviewItem[] {
  const items: DueReviewItem[] = [];
  for (const course of courses) {
    if (courseId && course.id !== courseId) continue;
    for (const topic of course.topics) {
      const retention = estimateTopicRetention(topic, dayKey);
      if (retention.due || retention.state === 'at_risk') {
        items.push({ course, topic, retention });
      }
    }
  }

  return items.sort((a, b) => {
    if (a.retention.due !== b.retention.due) return a.retention.due ? -1 : 1;
    if (a.retention.retentionPct !== b.retention.retentionPct) {
      return a.retention.retentionPct - b.retention.retentionPct;
    }
    return a.topic.confidence - b.topic.confidence;
  });
}
