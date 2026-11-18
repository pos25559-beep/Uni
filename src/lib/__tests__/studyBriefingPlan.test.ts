import { describe, expect, it } from 'vitest';
import {
  buildBriefingPlannerSnapshot,
  buildOfflineBriefingWeeklyFallback,
  groundLlmWeeklyPlan,
  groundLlmWeeklyPlanDetailed,
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

  describe('regras do planeador no plano da IA', () => {
    // 2026-11-18 é quarta; o teste de AM1 é sábado 21 às 14:00.
    const block = (dayOffset: number, courseId: string, minutes = 50) => ({
      dayOffset,
      courseId,
      window: 'auto' as const,
      minutes,
      focusKind: 'practice' as const,
      reasonNote: 'bloco',
    });
    const run = (blocks: ReturnType<typeof block>[], over: Partial<Settings> = {}) =>
      groundLlmWeeklyPlanDetailed({
        llmOutput: { strategySummary: 'x', focusCourseIds: [], suggestedFollowUps: [], blocks },
        courses,
        assessments,
        classes: [],
        events: [],
        materials: [],
        settings: { ...settings, ...over },
        existingPreservedSessions: [],
        today: '2026-11-18',
        nowMinutes: 8 * 60,
      });

    it('não marca em dias desligados e não volta para dias que já passaram', () => {
      // Só quarta (3) e quinta (4) ligadas; bloco pedido para domingo (offset 4) não pode ir para trás.
      const out = run([block(4, 'c-alg')], { studyDays: [3, 4] });
      expect(out.sessions).toHaveLength(0);
      expect(out.dropped).toBe(1);
    });

    it('salta um dia desligado para o seguinte ligado', () => {
      // Quinta (offset 1) desligada → sexta 2026-11-20.
      const out = run([block(1, 'c-alg')], { studyDays: [3, 5] });
      expect(out.sessions.map((s) => s.date)).toEqual(['2026-11-20']);
    });

    it('respeita a meta diária', () => {
      const out = run([block(1, 'c-alg', 60), block(1, 'c-alg', 60), block(1, 'c-alg', 60)], {
        dailyStudyMinutes: 90,
        studyDays: [4],
      });
      const total = out.sessions.reduce((sum, s) => sum + s.minutes, 0);
      expect(total).toBeLessThanOrEqual(90);
      expect(out.sessions.every((s) => s.date === '2026-11-19')).toBe(true);
      expect(out.dropped).toBe(1);
    });

    it('nada da cadeira depois do teste, e no dia do teste acaba 30 min antes', () => {
      const out = run([block(3, 'c-math'), block(5, 'c-math')], { studyDays: [0, 1, 2, 3, 4, 5, 6] });
      for (const s of out.sessions) {
        expect(s.date <= '2026-11-21').toBe(true);
        if (s.date === '2026-11-21') {
          const [h, m] = (s.start ?? '00:00').split(':').map(Number);
          expect(h * 60 + m + s.minutes).toBeLessThanOrEqual(13 * 60 + 30);
        }
      }
    });

    it('outras cadeiras não ocupam a hora do teste', () => {
      const out = run([block(3, 'c-alg', 90), block(3, 'c-alg', 90), block(3, 'c-alg', 90)], {
        studyDays: [6],
        dailyStudyMinutes: 600,
      });
      for (const s of out.sessions.filter((x) => x.date === '2026-11-21')) {
        const [h, m] = (s.start ?? '00:00').split(':').map(Number);
        const start = h * 60 + m;
        const overlaps = start < 16 * 60 && start + s.minutes > 13 * 60 + 30;
        expect(overlaps).toBe(false);
      }
    });
  });
});
