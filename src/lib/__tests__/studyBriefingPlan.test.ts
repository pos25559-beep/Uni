import { describe, expect, it } from 'vitest';
import {
  buildBriefingPlannerSnapshot,
  buildOfflineBriefingWeeklyFallback,
  groundLlmWeeklyPlan,
} from '../studyBriefingPlan';
import type {
  Assessment,
  ClassSlot,
  Course,
  Material,
  Settings,
  StudySession,
} from '../../types';

const courses: Course[] = [
  {
    id: 'c-math',
    code: 'AM1',
    name: 'Análise Matemática I',
    shortName: 'AM1',
    ects: 6,
    color: 'emerald',
    targetGrade: 15,
    topics: [
      { id: 't-lim', title: 'Limites e Continuidade', status: 'done', confidence: 5 },
      { id: 't-int', title: 'Cálculo Integral', status: 'learning', confidence: 2 },
    ],
  },
  {
    id: 'c-alg',
    code: 'AL',
    name: 'Álgebra Linear',
    shortName: 'AL',
    ects: 6,
    color: 'sky',
    targetGrade: 14,
    topics: [
      { id: 't-mat', title: 'Matrizes e Determinantes', status: 'todo', confidence: 2 },
    ],
  },
];

const assessments: Assessment[] = [
  {
    id: 'a-math-1',
    courseId: 'c-math',
    kind: 'teste',
    title: 'Teste de Cálculo',
    date: '2026-11-21T14:00:00',
    weight: 40,
    topicIds: ['t-int'],
    source: 'local',
  },
];

const classes: ClassSlot[] = [
  {
    id: 'cl-1',
    courseId: 'c-math',
    type: 'T',
    weekday: 4, // Quinta-feira (2026-11-19)
    start: '09:00',
    end: '11:00',
    source: 'local',
  },
];

const materials: Material[] = [
  {
    id: 'm-test',
    courseId: 'c-math',
    title: 'Teste Antigo 2024 Cálculo Integral [teste_antigo]',
    url: 'https://example.com/teste.pdf',
    provider: 'gdrive',
    category: 'teste_antigo',
    hasSolution: true,
  },
  {
    id: 'm-slides',
    courseId: 'c-alg',
    title: 'Slides Matrizes [slide_oficial]',
    url: 'https://example.com/slides.pdf',
    provider: 'gdrive',
    category: 'slide_oficial',
  },
];

const settings: Settings = {
  userName: 'Teste',
  theme: 'light',
  semesterName: '2026/2027 · 1.º Semestre',
  semesterStart: '2026-09-14',
  semesterEnd: '2027-01-31',
  dailyStudyMinutes: 150,
  studyDays: [1, 2, 3, 4, 5, 6],
  geminiApiKey: '',
  geminiModel: 'gemini-4-hydrogen',
  googleClientId: '',
  msClientId: '',
  aiConsent: true,
  aiAgeConfirmed18Plus: true,
};

describe('studyBriefingPlan helpers', () => {
  it('buildBriefingPlannerSnapshot lists active courses, topics, exams, and 7-day availability', () => {
    const snap = buildBriefingPlannerSnapshot({
      courses,
      assessments,
      classes,
      events: [],
      settings,
      today: '2026-11-18',
    });

    expect(snap).toContain('c-math');
    expect(snap).toContain('Cálculo Integral');
    expect(snap).toContain('Teste de Cálculo');
    expect(snap).toContain('dayOffset=0');
    expect(snap).toContain('dayOffset=6');
  });

  it('groundLlmWeeklyPlan resolves courses/topics/materials and avoids collisions with classes and locked sessions', () => {
    const lockedExisting: StudySession = {
      id: 'locked-1',
      courseId: 'c-alg',
      date: '2026-11-19',
      start: '11:15',
      minutes: 50,
      done: false,
      generated: false,
      locked: true,
    };

    const sessions = groundLlmWeeklyPlan({
      llmOutput: {
        strategySummary: 'Foco intensivo em Cálculo Integral antes do teste.',
        focusCourseIds: ['c-math'],
        suggestedFollowUps: ['Mais prática', 'Mais leve'],
        blocks: [
          {
            dayOffset: 1, // Quinta-feira 2026-11-19 (aula 09:00-11:00 + locked 11:15-12:05)
            courseId: 'AM1', // testa fallback por shortName!
            topicTitle: 'Integral', // testa fuzzy match em Cálculo Integral
            window: 'morning',
            minutes: 50,
            focusKind: 'exam_prep',
            reasonNote: 'Praticar integrais para o teste de sábado',
          },
          {
            dayOffset: 2,
            courseId: 'c-alg',
            topicId: 't-mat',
            window: 'evening',
            minutes: 45,
            focusKind: 'theory',
            reasonNote: 'Rever base de matrizes',
          },
        ],
      },
      courses,
      assessments,
      classes,
      events: [],
      materials,
      settings,
      existingPreservedSessions: [lockedExisting],
      today: '2026-11-18',
    });

    expect(sessions).toHaveLength(2);
    const mathBlock = sessions.find((s) => s.courseId === 'c-math')!;
    expect(mathBlock.topicId).toBe('t-int');
    expect(mathBlock.materialId).toBe('m-test');
    expect(mathBlock.assessmentId).toBe('a-math-1');
    expect(mathBlock.reason?.code).toBe('briefing');
    expect(mathBlock.start).toBeDefined();
    // Não pode colidir com 09:00-11:00 nem com 11:15-12:05
    expect(mathBlock.start! >= '12:15' || mathBlock.date !== '2026-11-19').toBe(true);

    const algBlock = sessions.find((s) => s.courseId === 'c-alg')!;
    expect(algBlock.materialId).toBe('m-slides');
    expect(algBlock.start! >= '17:30').toBe(true);
  });

  it('buildOfflineBriefingWeeklyFallback generates valid 7-day study sessions from briefing text', () => {
    const out = buildOfflineBriefingWeeklyFallback({
      briefingText: 'Tenho teste de AM1 em 3 dias e estou a travar em Cálculo Integral',
      courses,
      assessments,
      classes,
      events: [],
      materials,
      settings,
      existingPreservedSessions: [],
      today: '2026-11-18',
    });

    expect(out.sessions.length).toBeGreaterThan(0);
    expect(out.sessions.some((s) => s.courseId === 'c-math')).toBe(true);
    expect(out.strategySummary.length).toBeGreaterThan(0);
  });
});
