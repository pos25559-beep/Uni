import { describe, expect, it } from 'vitest';
import {
  computePracticeSessionOutcome,
  MAX_PRACTICE_CARDS_PER_TOPIC,
  mergeTopicPracticeDeck,
  selectPriorityMaterialsForTopic,
} from '../practiceEngine';
import { retentionOverview } from '../../components/progress/data';
import type { Course, Material, PracticeCard, StudySession } from '../../types';

describe('selectPriorityMaterialsForTopic', () => {
  it('ranks old tests, uploads, pinned materials and title matches highest', () => {
    const materials: Material[] = [
      {
        id: 'm1',
        courseId: 'c1',
        title: 'Programa da disciplina',
        url: 'https://example.com/programa',
        category: 'outro',
        provider: 'link',
      },
      {
        id: 'm2',
        courseId: 'c1',
        title: 'Teste 2024 — Critério de Von Mises e Plasticidade',
        url: 'local://m2',
        category: 'teste_antigo',
        provider: 'upload',
        pinned: true,
        hasSolution: true,
      },
      {
        id: 'm3',
        courseId: 'c2',
        title: 'Teste 2023 outra cadeira',
        url: 'local://m3',
        category: 'teste_antigo',
        provider: 'upload',
      },
      {
        id: 'm4',
        courseId: 'c1',
        title: 'Slides Aula 3 — Plasticidade',
        url: 'https://drive.google.com/file/d/m4',
        category: 'slide_oficial',
        provider: 'gdrive',
      },
    ];

    const picked = selectPriorityMaterialsForTopic(materials, 'c1', 'Plasticidade Aplicada', 2);
    expect(picked.map((m) => m.id)).toEqual(['m2', 'm4']);
  });
});

describe('mergeTopicPracticeDeck', () => {
  it('deduplicates prompts and caps saved deck at MAX_PRACTICE_CARDS_PER_TOPIC', () => {
    const existing: PracticeCard[] = Array.from({ length: 6 }, (_, i) => ({
      id: `old-${i}`,
      prompt: `Pergunta existente ${i}`,
      answer: `Resposta ${i}`,
      createdAt: '2026-11-01',
      lastScore: i % 2 === 0 ? 3 : 1,
    }));

    let seq = 0;
    const merged = mergeTopicPracticeDeck(
      existing,
      [
        { prompt: '  pergunta existente 0 ', answer: 'Dup' },
        { prompt: 'Nova questão 1', answer: 'Resp 1', sourceTitle: 'Teste 2024' },
        { prompt: 'Nova questão 2', answer: 'Resp 2' },
        { prompt: 'Nova questão 3', answer: 'Resp 3' },
      ],
      '2026-11-15',
      () => `new-${(seq += 1)}`,
    );

    expect(merged).toHaveLength(MAX_PRACTICE_CARDS_PER_TOPIC);
    expect(merged.slice(0, 3).map((c) => c.prompt)).toEqual([
      'Nova questão 1',
      'Nova questão 2',
      'Nova questão 3',
    ]);
    expect(merged[0].sourceTitle).toBe('Teste 2024');
  });
});

describe('computePracticeSessionOutcome', () => {
  it('maps low hit rate to recall 1 and caps confidence', () => {
    const res = computePracticeSessionOutcome([1, 1, 2], 5);
    expect(res).toEqual({ recallScore: 1, confidence: 2, hits: 1, total: 3 });
  });

  it('maps high performance to recall 3 and promotes confidence', () => {
    const res = computePracticeSessionOutcome([3, 3, 2, 3], 2);
    expect(res).toEqual({ recallScore: 3, confidence: 4, hits: 4, total: 4 });
  });
});

describe('retentionOverview', () => {
  it('aggregates course retention, due queue and focus shield cleanliness', () => {
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
          {
            id: 't1',
            title: 'Extrusão',
            status: 'review',
            confidence: 4,
            srsIntervalDays: 3,
            lastStudied: '2026-11-14',
            nextReviewDate: '2026-11-17',
            recallCount: 4,
            recallSuccessCount: 3,
            lastRecallScore: 3,
          },
          {
            id: 't2',
            title: 'Laminagem',
            status: 'learning',
            confidence: 2,
            srsIntervalDays: 1,
            lastStudied: '2026-11-10',
            nextReviewDate: '2026-11-11',
            recallCount: 2,
            recallSuccessCount: 1,
            lastRecallScore: 1,
          },
        ],
      },
    ];

    const sessions: StudySession[] = [
      {
        id: 's1',
        courseId: 'c1',
        topicId: 't1',
        date: '2026-11-14',
        minutes: 45,
        done: true,
        generated: false,
        focusShieldUsed: true,
        focusDistractions: 0,
        practiceHits: 3,
        practiceTotal: 4,
      },
      {
        id: 's2',
        courseId: 'c1',
        topicId: 't2',
        date: '2026-11-15',
        minutes: 30,
        done: true,
        generated: false,
        focusShieldUsed: true,
        focusDistractions: 2,
        practiceHits: 2,
        practiceTotal: 2,
      },
    ];

    const overview = retentionOverview(courses, sessions, '2026-11-15');
    expect(overview.studiedTopicCount).toBe(2);
    expect(overview.dueCount).toBe(1);
    expect(overview.fragileTopics[0].topicId).toBe('t2');
    expect(overview.focusQuality).toEqual({
      trackedCount: 2,
      cleanFocusCount: 1,
      cleanFocusPct: 50,
      avgExits: 1,
      practiceHits: 5,
      practiceTotal: 6,
      practiceHitRatePct: 83,
    });
  });
});
