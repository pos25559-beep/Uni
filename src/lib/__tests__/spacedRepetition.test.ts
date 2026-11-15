import { describe, expect, it } from 'vitest';
import {
  computeNextSrsState,
  estimateTopicRetention,
  getDueReviewQueue,
} from '../spacedRepetition';
import type { Course, Topic } from '../../types';

function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 't1',
    title: 'Plasticidade Aplicada',
    status: 'learning',
    confidence: 3,
    ...overrides,
  };
}

describe('computeNextSrsState', () => {
  it('promotes interval and tracks recallSuccessCount, recallStreak and recallHistory', () => {
    const t0 = makeTopic({ confidence: 4 });
    const s1 = computeNextSrsState(t0, 3, 4, '2026-11-10', { hits: 4, total: 4 });
    expect(s1.srsIntervalDays).toBe(3);
    expect(s1.nextReviewDate).toBe('2026-11-13');
    expect(s1.recallCount).toBe(1);
    expect(s1.recallSuccessCount).toBe(1);
    expect(s1.recallStreak).toBe(1);
    expect(s1.recallHistory).toEqual([{ date: '2026-11-10', score: 3, hits: 4, total: 4 }]);

    const t1 = { ...t0, ...s1 };
    const s2 = computeNextSrsState(t1, 3, 5, '2026-11-13', { hits: 3, total: 3 });
    expect(s2.srsIntervalDays).toBe(7);
    expect(s2.status).toBe('done');
    expect(s2.recallCount).toBe(2);
    expect(s2.recallSuccessCount).toBe(2);
    expect(s2.recallStreak).toBe(2);

    const t2 = { ...t1, ...s2 };
    const s3 = computeNextSrsState(t2, 1, 2, '2026-11-15', { hits: 1, total: 4 });
    expect(s3.srsIntervalDays).toBe(1);
    expect(s3.status).toBe('learning');
    expect(s3.recallCount).toBe(3);
    expect(s3.recallSuccessCount).toBe(2);
    expect(s3.recallStreak).toBe(0);
    expect(s3.recallHistory).toHaveLength(3);
  });

  it('caps recallHistory to the latest 10 samples', () => {
    let t = makeTopic({ confidence: 4 });
    for (let i = 1; i <= 12; i += 1) {
      const day = `2026-11-${String(i).padStart(2, '0')}`;
      t = { ...t, ...computeNextSrsState(t, 2, 4, day) };
    }
    expect(t.recallHistory).toHaveLength(10);
    expect(t.recallHistory?.[0].date).toBe('2026-11-03');
    expect(t.recallHistory?.[9].date).toBe('2026-11-12');
  });
});

describe('estimateTopicRetention', () => {
  it('marks untouched topics as unstudied with 0%', () => {
    const res = estimateTopicRetention(makeTopic({ status: 'todo' }), '2026-11-15');
    expect(res.state).toBe('unstudied');
    expect(res.retentionPct).toBe(0);
    expect(res.due).toBe(false);
  });

  it('decays retention monotonically over elapsed days without review', () => {
    const t = makeTopic({
      status: 'review',
      confidence: 4,
      srsIntervalDays: 3,
      nextReviewDate: '2026-11-13',
      lastStudied: '2026-11-10',
      lastRecallScore: 3,
      recallCount: 2,
      recallSuccessCount: 2,
      recallStreak: 2,
    });
    const fresh = estimateTopicRetention(t, '2026-11-10');
    const mid = estimateTopicRetention(t, '2026-11-14');
    const late = estimateTopicRetention(t, '2026-11-22');

    expect(fresh.state).toBe('fresh');
    expect(fresh.retentionPct).toBeGreaterThan(mid.retentionPct);
    expect(mid.retentionPct).toBeGreaterThan(late.retentionPct);
    expect(late.due).toBe(true);
    expect(late.state).toBe('at_risk');
  });
});

describe('getDueReviewQueue', () => {
  it('orders due and at-risk topics first and filters by courseId when supplied', () => {
    const courses: Course[] = [
      {
        id: 'c1',
        name: 'TEP',
        shortName: 'TEP',
        code: 'TEP',
        ects: 6,
        targetGrade: 14,
        color: 'emerald',
        topics: [
          makeTopic({
            id: 't-fresh',
            title: 'Laminagem',
            status: 'done',
            confidence: 5,
            srsIntervalDays: 7,
            lastStudied: '2026-11-15',
            nextReviewDate: '2026-11-22',
            lastRecallScore: 3,
            recallCount: 3,
            recallSuccessCount: 3,
          }),
          makeTopic({
            id: 't-due',
            title: 'Forjamento',
            status: 'learning',
            confidence: 2,
            srsIntervalDays: 1,
            lastStudied: '2026-11-11',
            nextReviewDate: '2026-11-12',
            lastRecallScore: 1,
            recallCount: 2,
            recallSuccessCount: 0,
          }),
        ],
      },
      {
        id: 'c2',
        name: 'Fabrico Aditivo',
        shortName: 'FA',
        code: 'FA',
        ects: 6,
        targetGrade: 14,
        color: 'rose',
        topics: [
          makeTopic({
            id: 't-due-2',
            title: 'PBF & DED',
            status: 'review',
            confidence: 3,
            srsIntervalDays: 3,
            lastStudied: '2026-11-12',
            nextReviewDate: '2026-11-15',
            lastRecallScore: 2,
            recallCount: 1,
            recallSuccessCount: 1,
          }),
        ],
      },
    ];

    const allQueue = getDueReviewQueue(courses, '2026-11-15');
    expect(allQueue.map((item) => item.topic.id)).toEqual(['t-due', 't-due-2']);

    const c2Queue = getDueReviewQueue(courses, '2026-11-15', 'c2');
    expect(c2Queue.map((item) => item.topic.id)).toEqual(['t-due-2']);
  });
});
