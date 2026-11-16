import { describe, expect, it } from 'vitest';
import type { Course } from '../../types';
import type { TopicSheetRecord, UniAgentRecord } from '../localDb';
import {
  buildStudyGuideExport,
  parseAndImportQuizResult,
  transferMasteryToNextCourse,
} from '../studyBridge';

const CALC_I: Course = {
  id: 'c-calc1',
  code: 'C1D',
  name: 'Cálculo I D',
  shortName: 'Cálculo I',
  ects: 6,
  color: 'emerald',
  targetGrade: 15,
  topics: [
    {
      id: 't-lim',
      title: 'Limites no infinito',
      status: 'learning',
      confidence: 3,
    },
  ],
};

const CALC_II: Course = {
  id: 'c-calc2',
  code: 'C2D',
  name: 'Cálculo II D',
  shortName: 'Cálculo II',
  ects: 6,
  color: 'sky',
  targetGrade: 15,
  topics: [
    {
      id: 't-rn',
      title: 'Limites e continuidade em R^n',
      status: 'todo',
      confidence: 3,
    },
  ],
};

const SAMPLE_AGENT: UniAgentRecord = {
  courseId: 'c-calc1',
  name: 'Calc',
  formId: 'cristal',
  personaId: 'curioso',
  language: 'pt-PT',
  memoryEnabled: true,
  stage: 4,
  mastery: 94,
  milestones: [],
  items: ['Régua Geométrica', 'Louros de Mestre'],
  notebook: {
    goals: ['Dominar teoremas'],
    learningStyle: 'exemplos',
    weakSpots: [{ topic: 'Limites no infinito', note: 'Sinal da raiz par em -∞', seen: 2 }],
    strengths: ['Derivação implícita sólida'],
    customNotes: [],
    updatedAt: '2026-11-16T00:00:00.000Z',
  },
  createdAt: '2026-11-10T00:00:00.000Z',
  updatedAt: '2026-11-16T00:00:00.000Z',
};

const SAMPLE_SHEETS: TopicSheetRecord[] = [
  {
    id: 'sh-1',
    courseId: 'c-calc1',
    topicId: 't-lim',
    title: 'Ficha · Limites no infinito',
    mode: 'guide',
    summary: 'Dividir numerador e denominador pela maior potência de x.',
    keyConcepts: ['Indeterminação ∞/∞', 'Assíntotas horizontais'],
    updatedAt: '2026-11-15T10:00:00.000Z',
  },
];

describe('studyBridge', () => {
  it('builds a structured study guide including sheets, weak spots, and recall prompts', () => {
    const guide = buildStudyGuideExport({
      course: CALC_I,
      topic: CALC_I.topics[0],
      sheets: SAMPLE_SHEETS,
      agent: SAMPLE_AGENT,
      language: 'pt-PT',
    });

    expect(guide).toContain('Cálculo I D');
    expect(guide).toContain('Limites no infinito');
    expect(guide).toContain('Assíntotas horizontais');
    expect(guide).toContain('Sinal da raiz par em -∞');
  });

  it('parses quiz results back into spacedRepetition.ts and weakSpots', () => {
    const imported = parseAndImportQuizResult({
      rawText: 'Score 2/5 em Limites no infinito. Errei assíntotas oblíquas e sinais em raízes pares.',
      course: CALC_I,
      topicId: 't-lim',
      agent: SAMPLE_AGENT,
      today: '2026-11-16',
    });

    expect(imported.hits).toBe(2);
    expect(imported.total).toBe(5);
    expect(imported.ratioPct).toBe(40);
    expect(imported.score).toBe(1);
    expect(imported.targetTopic.srsIntervalDays).toBe(1);
    expect(imported.targetTopic.nextReviewDate).toBe('2026-11-17');
    expect(imported.nextAgent?.notebook.weakSpots[0]?.note).toContain('assíntotas oblíquas');
  });

  it('requires Stage 4 Master to mentor the next course Uni and transfers study methodology', () => {
    const nonMaster: UniAgentRecord = { ...SAMPLE_AGENT, stage: 2, mastery: 45 };
    expect(() =>
      transferMasteryToNextCourse({
        sourceCourse: CALC_I,
        sourceAgent: nonMaster,
        targetCourse: CALC_II,
      }),
    ).toThrow();

    const mentoredTarget = transferMasteryToNextCourse({
      sourceCourse: CALC_I,
      sourceAgent: SAMPLE_AGENT,
      targetCourse: CALC_II,
      nowIso: '2026-11-16T02:00:00.000Z',
    });

    expect(mentoredTarget.courseId).toBe('c-calc2');
    expect(mentoredTarget.stage).toBe(0);
    expect(mentoredTarget.notebook.learningStyle).toBe('exemplos');
    expect(mentoredTarget.notebook.strengths).toContain('Derivação implícita sólida');
    expect(mentoredTarget.notebook.customNotes?.[0]).toContain('Cálculo I');
  });
});
