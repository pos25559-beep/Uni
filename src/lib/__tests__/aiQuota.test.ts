import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumeDailyQuota,
  DAILY_CHAT_LIMIT,
  DAILY_NOTEBOOK_LIMIT,
  DAILY_RECALL_LIMIT,
  getAiMetricsSnapshot,
  getDailyQuotaSnapshot,
  recordAiTokenUsage,
  recordWrongAnswerFeedback,
  refundDailyQuota,
  UniDailyLimitReachedError,
} from '../aiQuota';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key) {
      return map.get(key) ?? null;
    },
    key(index) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key) {
      map.delete(key);
    },
    setItem(key, value) {
      map.set(key, value);
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createMemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('aiQuota', () => {
  it('isolates daily recall quota (8/day) from chat (15/day) and notebook (3/day)', () => {
    for (let i = 0; i < DAILY_RECALL_LIMIT; i += 1) {
      consumeDailyQuota('recall');
    }

    const snap = getDailyQuotaSnapshot();
    expect(snap.recallUsed).toBe(DAILY_RECALL_LIMIT);
    expect(snap.recallRemaining).toBe(0);
    expect(snap.chatRemaining).toBe(DAILY_CHAT_LIMIT);
    expect(snap.notebookRemaining).toBe(DAILY_NOTEBOOK_LIMIT);

    expect(() => consumeDailyQuota('recall')).toThrow(UniDailyLimitReachedError);

    // Chat and notebook quotas remain untouched and usable
    consumeDailyQuota('chat');
    consumeDailyQuota('notebook');
    const afterOtherKinds = getDailyQuotaSnapshot();
    expect(afterOtherKinds.chatUsed).toBe(1);
    expect(afterOtherKinds.notebookUsed).toBe(1);

    refundDailyQuota('recall');
    expect(getDailyQuotaSnapshot().recallRemaining).toBe(1);
  });

  it('tracks daily token usage and wrong-answer feedback counters', () => {
    recordAiTokenUsage(120, 45);
    recordAiTokenUsage(80, 55);
    recordWrongAnswerFeedback();

    const metrics = getAiMetricsSnapshot();
    expect(metrics.inputTokens).toBe(200);
    expect(metrics.outputTokens).toBe(100);
    expect(metrics.calls).toBe(2);
    expect(metrics.wrongFeedbackCount).toBe(1);
  });
});
