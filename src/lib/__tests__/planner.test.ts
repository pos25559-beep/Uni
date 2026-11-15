import { describe, expect, it } from 'vitest';
import type { Assessment, ClassSlot, Course, Settings, StudySession } from '../../types';
import { analyzeTestMode, generatePlan, rescheduleOverdueSessions } from '../planner';

const baseSettings: Settings = {
  userName: 'Pedro',
  theme: 'light',
  semesterName: '2026/27 · 1.º Semestre',
  semesterStart: '2026-09-14',
  semesterEnd: '2027-01-30',
  dailyStudyMinutes: 120,
  studyDays: [0, 1, 2, 3, 4, 5, 6],
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  googleClientId: '',
  msClientId: '',
};

const baseCourse: Course = {
  id: 'c1',
  code: 'TEP',
  name: 'Tecnologia de Processos',
  shortName: 'TEP',
  ects: 6,
  color: 'emerald',
  targetGrade: 14,
  topics: [
    { id: 't1', title: 'Plasticidade aplicada', status: 'todo', confidence: 2 },
    { id: 't2', title: 'Laminagem', status: 'learning', confidence: 3 },
  ],
};

describe('planner.analyzeTestMode', () => {
  it('ativa Modo Teste quando há avaliação nos próximos 10 dias', () => {
    const assessments: Assessment[] = [
      {
        id: 'a1',
        courseId: 'c1',
        kind: 'teste',
        title: '1.º Teste',
        date: '2026-11-20T10:00:00',
        weight: 50,
        topicIds: ['t1'],
        source: 'local',
      },
    ];
    const status = analyzeTestMode([baseCourse], assessments, '2026-11-15');
    expect(status.mode).toBe('single_test');
    expect(status.urgentCourseIds).toEqual(['c1']);
    expect(status.urgentAssessments[0]?.daysLeft).toBe(5);
  });

  it('mantém modo normal quando o teste está a mais de 10 dias', () => {
    const assessments: Assessment[] = [
      {
        id: 'a1',
        courseId: 'c1',
        kind: 'exame',
        title: 'Exame',
        date: '2026-12-10T09:00:00',
        weight: 100,
        topicIds: ['t1'],
        source: 'local',
      },
    ];
    expect(analyzeTestMode([baseCourse], assessments, '2026-11-15').mode).toBe('normal');
  });
});

describe('planner.generatePlan', () => {
  it('gera sessões determinísticas evitando horários ocupados por aulas', () => {
    const classes: ClassSlot[] = [
      {
        id: 'cl1',
        courseId: 'c1',
        type: 'T',
        weekday: 1, // segunda-feira (2026-11-16)
        start: '17:00',
        end: '19:00',
        source: 'local',
      },
    ];
    const assessments: Assessment[] = [
      {
        id: 'a1',
        courseId: 'c1',
        kind: 'teste',
        title: '1.º Teste',
        date: '2026-11-20T10:00:00',
        weight: 50,
        topicIds: ['t1', 't2'],
        source: 'local',
      },
    ];

    const sessions = generatePlan({
      courses: [baseCourse],
      assessments,
      classes,
      events: [],
      settings: baseSettings,
      from: '2026-11-16',
      days: 4,
      blockMinutes: 50,
    });

    expect(sessions.length).toBeGreaterThan(0);
    const mondaySessions = sessions.filter((s) => s.date === '2026-11-16');
    for (const s of mondaySessions) {
      expect(s.start).toBeDefined();
      const [h, m] = s.start!.split(':').map(Number);
      const startMin = h * 60 + m;
      const endMin = startMin + s.minutes;
      const overlapsClass = startMin < 19 * 60 && endMin > 17 * 60;
      expect(overlapsClass).toBe(false);
    }
  });

  it('respeita cadeiras pausadas', () => {
    const assessments: Assessment[] = [
      {
        id: 'a1',
        courseId: 'c1',
        kind: 'teste',
        title: '1.º Teste',
        date: '2026-11-20T10:00:00',
        weight: 50,
        topicIds: ['t1'],
        source: 'local',
      },
    ];
    const sessions = generatePlan({
      courses: [baseCourse],
      assessments,
      classes: [],
      events: [],
      settings: baseSettings,
      from: '2026-11-16',
      days: 4,
      pausedCourseIds: ['c1'],
    });
    expect(sessions.filter((s) => s.courseId === 'c1')).toEqual([]);
  });
});

describe('planner.rescheduleOverdueSessions', () => {
  it('redistribui sessões em atraso para datas >= from sem exceder orçamento diário', () => {
    const overdue: StudySession[] = [
      {
        id: 'old1',
        courseId: 'c1',
        topicId: 't1',
        date: '2026-11-12',
        minutes: 50,
        done: false,
        generated: true,
      },
    ];
    const res = rescheduleOverdueSessions({
      overdue,
      existing: [],
      classes: [],
      events: [],
      settings: baseSettings,
      from: '2026-11-15',
      days: 5,
    });
    expect(res.unscheduledCount).toBe(0);
    expect(res.updated).toHaveLength(1);
    expect(res.updated[0]!.date >= '2026-11-15').toBe(true);
  });
});
