import { addDays, format } from 'date-fns';
import { describe, expect, it } from 'vitest';
import type { Assessment, ClassSlot, Course, Settings, StudySession } from '../../types';
import { useStore } from '../../store/useStore';
import { analyzeTestMode, generatePlan, rescheduleOverdueSessions } from '../planner';
import { pickActiveInAppNudge } from '../uniNotifications';
import { formatSessionDisplay } from '../selectors';

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

  it('aplica foco personalizado do Diário do Uni (ex.: Refazer testes antigos) nos blocos do teste', () => {
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
      days: 3,
      studyLogs: [
        {
          id: 'log-1',
          kind: 'exam_prep',
          date: '2026-11-15',
          createdAt: '2026-11-15T20:00:00.000Z',
          courseId: 'c1',
          assessmentId: 'a1',
          feeling: 'estavel',
          studyFocus: 'Refazer testes antigos',
          topicIds: ['t1'],
        },
      ],
    });

    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0]?.notes).toBe('Refazer testes antigos');
    const display = formatSessionDisplay(sessions[0]!, baseCourse.topics[0]);
    expect(display.title).toBe('Refazer testes antigos · Plasticidade aplicada');
    expect(display.badge).toBe('Modo Teste');
    expect(display.isPersonalized).toBe(true);
  });

  it('extrai foco das mensagens antigas do Diário e substitui sessões antigas via store sem Equilíbrio Modo Teste', () => {
    const store = useStore.getState();
    store.clearAll();

    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const tomorrow = format(addDays(now, 1), 'yyyy-MM-dd');
    const futureTestDate = format(addDays(now, 5), 'yyyy-MM-dd');
    const assessment: Assessment = {
      id: 'a-tep',
      courseId: 'c1',
      title: '1.º Teste',
      kind: 'teste',
      date: futureTestDate,
      weight: 40,
      topicIds: ['t1'],
      source: 'local',
    };

    useStore.setState({
      courses: [baseCourse],
      assessments: [assessment],
      settings: { ...baseSettings, dailyStudyMinutes: 120 },
      sessions: [
        {
          id: 'legacy-gen-1',
          courseId: 'c1',
          topicId: 't1',
          assessmentId: 'a-tep',
          date: tomorrow,
          start: '18:10',
          minutes: 50,
          done: false,
          generated: true,
          notes: 'Equilíbrio Modo Teste',
        },
      ],
    });

    const latest = useStore.getState();
    latest.patch('assessments', 'a-tep', { topicIds: ['t1'] }, { skipReconcile: true });
    latest.addStudyLog({
      id: 'log-from-chat',
      kind: 'exam_prep',
      date: today,
      createdAt: `${today}T20:00:00.000Z`,
      courseId: 'c1',
      assessmentId: 'a-tep',
      feeling: 'estavel',
      messages: [
        { id: 'u1', role: 'user', text: 'Quero focar em refazer os testes antigos' },
      ],
    });
    latest.reconcileFuturePlan(true);

    const updatedSessions = useStore.getState().sessions;
    expect(updatedSessions.length).toBeGreaterThan(0);
    expect(updatedSessions.some((s) => s.notes === 'Equilíbrio Modo Teste')).toBe(false);
    expect(updatedSessions[0]?.notes).toBe('Refazer testes antigos');
    const display = formatSessionDisplay(updatedSessions[0]!, baseCourse.topics[0]);
    expect(display.title).toBe('Refazer testes antigos · Plasticidade aplicada');
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

  it('nunca agenda Revisão espaçada nem Consolidação no mesmo dia depois da hora do exame', () => {
    const courseWithDue: Course = {
      ...baseCourse,
      topics: [
        {
          id: 't1',
          title: 'Derivadas',
          status: 'review',
          confidence: 3,
          nextReviewDate: '2026-11-18',
          srsIntervalDays: 3,
        },
        { id: 't2', title: 'Integrais', status: 'todo', confidence: 2 },
      ],
    };
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
      courses: [courseWithDue],
      assessments,
      classes: [],
      events: [],
      settings: baseSettings,
      from: '2026-11-20',
      nowMinutes: 16 * 60 + 30,
      days: 1,
    });
    expect(sessions.filter((s) => s.courseId === 'c1')).toEqual([]);
  });

  it('arredonda horários de início a múltiplos de 5 min após sessões reais curtas (evita 17:11)', () => {
    const assessments: Assessment[] = [
      {
        id: 'a1',
        courseId: 'c1',
        kind: 'teste',
        title: '1.º Teste',
        date: '2026-11-22T10:00:00',
        weight: 50,
        topicIds: ['t1', 't2'],
        source: 'local',
      },
    ];
    const doneShort: StudySession = {
      id: 'done-1m',
      courseId: 'c1',
      topicId: 't1',
      date: '2026-11-16',
      start: '17:00',
      minutes: 50,
      actualMinutes: 1,
      done: true,
      generated: true,
    };
    const sessions = generatePlan({
      courses: [baseCourse],
      assessments,
      classes: [],
      events: [],
      settings: baseSettings,
      existing: [doneShort],
      from: '2026-11-16',
      days: 1,
    });
    expect(sessions.length).toBeGreaterThan(0);
    for (const s of sessions) {
      const mm = Number(s.start?.split(':')[1] ?? 0);
      expect(mm % 5).toBe(0);
    }
  });

  it('reserva manutenção leve para outras cadeiras em Modo Teste (> 2 dias) salvo foco exclusivo', () => {
    const secondCourse: Course = {
      id: 'c2',
      code: 'F1',
      name: 'Física I',
      shortName: 'F1',
      ects: 6,
      color: 'amber',
      targetGrade: 14,
      topics: [{ id: 't3', title: 'Cinemática', status: 'todo', confidence: 2 }],
    };
    const assessments: Assessment[] = [
      {
        id: 'a1',
        courseId: 'c1',
        kind: 'teste',
        title: '1.º Teste',
        date: '2026-11-22T10:00:00', // 6 dias depois
        weight: 50,
        topicIds: ['t1', 't2'],
        source: 'local',
      },
    ];
    const balanced = generatePlan({
      courses: [baseCourse, secondCourse],
      assessments,
      classes: [],
      events: [],
      settings: { ...baseSettings, dailyStudyMinutes: 180 },
      from: '2026-11-16',
      days: 1,
    });
    expect(balanced.some((s) => s.courseId === 'c2')).toBe(true);

    const exclusive = generatePlan({
      courses: [baseCourse, secondCourse],
      assessments,
      classes: [],
      events: [],
      settings: { ...baseSettings, dailyStudyMinutes: 180 },
      from: '2026-11-16',
      days: 1,
      exclusiveTestFocus: true,
    });
    expect(exclusive.some((s) => s.courseId === 'c2')).toBe(false);
  });

  it('não mostra Balanço de domingo no dia 1 para conta nova sem atividade prévia', () => {
    const sundayNow = new Date(2026, 10, 15, 21, 0, 0); // domingo 15 nov 21:00
    const nudge = pickActiveInAppNudge({
      courses: [baseCourse],
      assessments: [],
      classes: [],
      sessions: [],
      weeklyCheckIns: [],
      studyLogs: [],
      settings: baseSettings,
      now: sundayNow,
    });
    expect(nudge?.kind).not.toBe('sunday');
  });
});
