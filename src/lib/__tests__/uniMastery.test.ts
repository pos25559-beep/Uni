import { describe, expect, it } from 'vitest';
import type { Assessment, Course, StudySession } from '../../types';
import type { TopicSheetRecord, UniAgentNotebook, UniAgentRecord } from '../localDb';
import {
  buildUniDiploma,
  canIssueDiploma,
  computeCourseMastery,
  computeCourseMilestones,
  getPendingExpeditionQuestions,
  pickExpeditionCandidateTopics,
  recomputeUniAgentProgression,
  retrieveRelevantSheets,
  sanitizeNotebookDelta,
  shouldPrepareExpedition,
  stageFromMastery,
  transferMasteryWisdomToAgent,
} from '../uniMastery';

function makeCourse(topics: Course['topics']): Course {
  return {
    id: 'course-1',
    code: 'MAT101',
    name: 'Análise Matemática I',
    shortName: 'AMI',
    ects: 6,
    color: 'emerald',
    targetGrade: 16,
    topics,
  };
}

function makeAgent(overrides: Partial<UniAgentRecord> = {}): UniAgentRecord {
  const now = '2026-11-16T00:00:00.000Z';
  return {
    courseId: 'course-1',
    name: 'Eulerinho',
    formId: 'nuvem',
    personaId: 'amigo',
    language: 'pt-PT',
    memoryEnabled: true,
    stage: 0,
    mastery: 0,
    milestones: [],
    items: [],
    notebook: {
      goals: ['Passar com boa nota'],
      weakSpots: [],
      strengths: [],
      updatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('uniMastery', () => {
  it('computes realistic course mastery and stage transitions from verified study data', () => {
    const dayKey = '2026-11-16';
    const freshCourse = makeCourse([
      { id: 't1', title: 'Limites', status: 'todo', confidence: 1 },
      { id: 't2', title: 'Derivadas', status: 'todo', confidence: 1 },
    ]);
    expect(computeCourseMastery(freshCourse, [], dayKey)).toBe(0);
    expect(stageFromMastery(0)).toBe(0);
    expect(stageFromMastery(9)).toBe(0);
    expect(stageFromMastery(10)).toBe(1);
    expect(stageFromMastery(34)).toBe(1);
    expect(stageFromMastery(35)).toBe(2);
    expect(stageFromMastery(64)).toBe(2);
    expect(stageFromMastery(65)).toBe(3);
    expect(stageFromMastery(89)).toBe(3);
    expect(stageFromMastery(90)).toBe(4);

    const progressingCourse = makeCourse([
      {
        id: 't1',
        title: 'Limites',
        status: 'done',
        confidence: 5,
        lastStudied: dayKey,
        lastRecallScore: 3,
        recallCount: 2,
        recallSuccessCount: 2,
        srsIntervalDays: 7,
      },
      {
        id: 't2',
        title: 'Derivadas',
        status: 'review',
        confidence: 4,
        lastStudied: dayKey,
        lastRecallScore: 2,
        recallCount: 1,
        recallSuccessCount: 1,
        srsIntervalDays: 3,
      },
    ]);
    const assessments: Assessment[] = [
      {
        id: 'a1',
        courseId: 'course-1',
        kind: 'teste',
        title: '1.º Teste',
        date: '2026-11-10T10:00:00',
        weight: 50,
        grade: 16,
        topicIds: ['t1'],
        source: 'local',
      },
    ];

    const mastery = computeCourseMastery(progressingCourse, assessments, dayKey);
    expect(mastery).toBeGreaterThanOrEqual(65);
    expect(mastery).toBeLessThanOrEqual(100);
    expect(stageFromMastery(mastery)).toBe(3);
  });

  it('unlocks verifiable milestones and explorer item only when conditions are met', () => {
    const dayKey = '2026-11-16';
    const course = makeCourse([
      {
        id: 't1',
        title: 'Séries numéricas',
        status: 'done',
        confidence: 5,
        lastStudied: dayKey,
        lastRecallScore: 3,
        recallCount: 1,
        srsIntervalDays: 7,
      },
    ]);
    const sessions: StudySession[] = ['10', '11', '12', '13', '14'].map((d, idx) => ({
      id: `s-${idx}`,
      courseId: 'course-1',
      date: `2026-11-${d}`,
      minutes: 45,
      done: true,
      generated: false,
    }));
    const assessments: Assessment[] = [
      {
        id: 'a1',
        courseId: 'course-1',
        kind: 'teste',
        title: 'Teste 1',
        date: '2026-11-25T14:00:00',
        weight: 40,
        grade: 15,
        topicIds: ['t1'],
        source: 'local',
      },
    ];

    const { milestones, items } = computeCourseMilestones(
      course,
      sessions,
      assessments,
      [],
      `${dayKey}T12:00:00.000Z`,
      'pt20',
      'pt-PT',
      dayKey,
    );
    expect(milestones.map((m) => m.id)).toEqual([
      'first_perfect_recall',
      'five_study_days',
      'first_graded_assessment',
    ]);
    expect(items).toEqual([
      'Régua Geométrica',
      'Selo de Especialista',
      'Louros de Mestre',
    ]);

    const { agent: evolved, stageUpFrom } = recomputeUniAgentProgression(
      makeAgent(),
      course,
      sessions,
      assessments,
      dayKey,
    );
    expect(stageUpFrom).toBe(0);
    expect(evolved.stage).toBe(4);
    expect(evolved.notebook.nextAssessment).toEqual({
      title: 'Teste 1',
      date: '2026-11-25T14:00:00',
    });
  });

  it('retrieves relevant topic sheets by topic match and normalized token overlap', () => {
    const sheets: TopicSheetRecord[] = [
      {
        id: 'sh-1',
        courseId: 'course-1',
        topicId: 't-derivadas',
        title: 'Regras de Derivação e Regra da Cadeia',
        mode: 'summary',
        summary: 'Função composta e derivada implícita com exemplos práticos.',
        keyConcepts: ['Regra da cadeia', 'Derivada implícita'],
        updatedAt: '2026-11-15T10:00:00.000Z',
      },
      {
        id: 'sh-2',
        courseId: 'course-1',
        title: 'Integrais Impróprios e Convergência',
        mode: 'summary',
        summary: 'Critérios de comparação e testes de divergência.',
        keyConcepts: ['Comparação', 'Convergência'],
        updatedAt: '2026-11-16T10:00:00.000Z',
      },
    ];

    const picked = retrieveRelevantSheets('derivacao regra da cadeia', sheets, 't-derivadas', 1);
    expect(picked.map((s) => s.id)).toEqual(['sh-1']);
  });

  it('sanitizes and deduplicates incremental notebook delta proposals', () => {
    const base: UniAgentNotebook = {
      goals: ['Consolidar base'],
      weakSpots: [{ topic: 'Limites', note: 'Indeterminação 0/0', seen: 1 }],
      strengths: ['Derivadas imediatas'],
      updatedAt: '2026-11-15T10:00:00.000Z',
    };

    const next = sanitizeNotebookDelta(
      base,
      {
        weakSpot: { topic: 'limites', note: 'Esqueceu fatorização no denominador' },
        strength: 'Derivadas imediatas',
      },
      '2026-11-16T12:00:00.000Z',
    );

    expect(next.weakSpots).toHaveLength(1);
    expect(next.weakSpots[0]).toEqual({
      topic: 'limites',
      note: 'Esqueceu fatorização no denominador',
      seen: 2,
    });
    expect(next.strengths).toEqual(['Derivadas imediatas']);
    expect(next.updatedAt).toBe('2026-11-16T12:00:00.000Z');
  });

  it('supports Phase 2 expeditions, diplomas, grading scales, and Master inheritance', () => {
    const dayKey = '2026-11-16';
    const course = makeCourse([
      {
        id: 't1',
        title: 'Séries',
        status: 'done',
        confidence: 5,
        lastStudied: dayKey,
        lastRecallScore: 3,
        recallCount: 3,
        recallSuccessCount: 3,
        srsIntervalDays: 21,
        nextReviewDate: '2026-11-17',
      },
      {
        id: 't2',
        title: 'Integrais Duplos',
        status: 'done',
        confidence: 5,
        lastStudied: dayKey,
        lastRecallScore: 3,
        recallCount: 2,
        recallSuccessCount: 2,
        srsIntervalDays: 7,
      },
    ]);
    const assessments: Assessment[] = [
      {
        id: 'a1',
        courseId: 'course-1',
        kind: 'exame',
        title: 'Exame Final',
        date: '2026-11-15T09:00:00',
        weight: 100,
        grade: 9, // 9/10 in scale10 = 90%
        topicIds: ['t1', 't2'],
        source: 'local',
      },
    ];

    const masteryScale10 = computeCourseMastery(course, assessments, dayKey, 'scale10');
    expect(masteryScale10).toBeGreaterThanOrEqual(90);
    expect(stageFromMastery(masteryScale10)).toBe(4);

    const masterAgent = makeAgent({
      stage: 4,
      mastery: masteryScale10,
      notebook: {
        goals: ['Tirar 18'],
        learningStyle: 'exercicios',
        weakSpots: [{ topic: 'Erro específico', note: 'Não deve ser copiado', seen: 2 }],
        strengths: ['Resolver integrais por partes com calma', 'Verificar limites laterais'],
        updatedAt: '2026-11-16T00:00:00.000Z',
      },
    });

    expect(shouldPrepareExpedition(masterAgent, course, dayKey)).toBe(true);
    expect(pickExpeditionCandidateTopics(course, '2026-11-17').map((t) => t.id)).toEqual([
      't1',
      't2',
    ]);

    const readyTodayAgent = makeAgent({
      stage: 2,
      expedition: {
        preparedAt: '2026-11-15T22:00:00.000Z',
        forDate: '2026-11-16',
        questions: [
          {
            id: 'q1',
            topicId: 't1',
            topicTitle: 'Séries',
            q: 'Qual o critério da razão?',
            hint: 'Calcula o limite de |a_{n+1}/a_n|.',
            sourceRef: 'Ficha Séries',
          },
          {
            id: 'q2',
            topicTitle: 'Integrais',
            q: 'Já respondida',
            hint: 'Hint',
            sourceRef: 'Ficha 2',
            answeredScore: 3,
          },
        ],
      },
    });
    expect(getPendingExpeditionQuestions(readyTodayAgent, '2026-11-16').map((q) => q.id)).toEqual([
      'q1',
    ]);

    expect(canIssueDiploma(course, assessments, masterAgent)).toBe(true);
    const diploma = buildUniDiploma(course, assessments, masterAgent, '2026-11-16T18:00:00.000Z');
    expect(diploma).toEqual({
      issuedAt: '2026-11-16T18:00:00.000Z',
      finalGrade: 9,
      masteredTopicCount: 2,
      totalTopicCount: 2,
      stageAtGraduation: 4,
    });

    const successor = makeAgent({ courseId: 'course-2', name: 'CalcII', language: 'en' });
    const taught = transferMasteryWisdomToAgent(masterAgent, 'AMI', successor);
    expect(taught.notebook.learningStyle).toBe('exercicios');
    expect(taught.notebook.strengths).toEqual([
      'Resolver integrais por partes com calma',
      'Verificar limites laterais',
    ]);
    expect(taught.notebook.weakSpots).toEqual([]);
    expect(taught.notebook.customNotes?.[0]).toContain('AMI');
  });
});
