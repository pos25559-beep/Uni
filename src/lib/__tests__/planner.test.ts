import { addDays, format } from 'date-fns';
import { describe, expect, it } from 'vitest';
import type { Assessment, ClassSlot, Course, Settings, StudySession } from '../../types';
import { useStore } from '../../store/useStore';
import {
  analyzeTestMode,
  computeDayBudget,
  generatePlan,
  rescheduleOverdueSessions,
  resolveDayPlanProfile,
} from '../planner';
import { pickActiveInAppNudge } from '../uniNotifications';
import { formatSessionDisplay } from '../selectors';
import { selectCompactDaySessions } from '../planner/compactView';

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

  it('ignora cadeiras em pausa no banner do Modo Teste', () => {
    const assessments: Assessment[] = [
      {
        id: 'a1',
        courseId: 'c1',
        kind: 'teste',
        title: '1.º Teste',
        date: '2026-11-18T10:00:00',
        weight: 50,
        topicIds: ['t1'],
        source: 'local',
      },
    ];
    expect(analyzeTestMode([baseCourse], assessments, '2026-11-15', ['c1']).mode).toBe('normal');
    expect(analyzeTestMode([baseCourse], assessments, '2026-11-15', ['c1']).urgentAssessments).toEqual([]);
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

  it('nunca marca em dias desligados e respeita a hora do teste (acaba 30 min antes e outras cadeiras não ocupam a hora da prova)', () => {
    const secondCourse: Course = {
      ...baseCourse,
      id: 'c2',
      code: 'AL',
      name: 'Álgebra Linear',
      shortName: 'AL',
    };
    const assessments: Assessment[] = [
      {
        id: 'a-sat',
        courseId: 'c1',
        kind: 'teste',
        title: 'Teste Sábado',
        date: '2026-11-21T14:00:00',
        weight: 50,
        topicIds: ['t1', 't2'],
        source: 'local',
      },
    ];
    // 2026-11-18 quarta (3, a 3 dias do teste) desligada; quinta (4), sexta (5) e sábado (6) ligadas
    const sessions = generatePlan({
      courses: [baseCourse, secondCourse],
      assessments,
      classes: [],
      events: [],
      settings: { ...baseSettings, studyDays: [4, 5, 6], dailyStudyMinutes: 300 },
      from: '2026-11-18',
      nowMinutes: 8 * 60,
      days: 5,
    });
    expect(sessions.some((s) => s.date === '2026-11-18')).toBe(false);
    for (const s of sessions.filter((x) => x.date === '2026-11-21')) {
      const [h, m] = (s.start ?? '00:00').split(':').map(Number);
      const startMin = h * 60 + m;
      if (s.courseId === 'c1') {
        expect(startMin + s.minutes).toBeLessThanOrEqual(13 * 60 + 30);
      } else {
        const overlaps = startMin < 16 * 60 && startMin + s.minutes > 13 * 60 + 30;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('computeDayBudget devolve o mesmo orçamento reduzido que o motor usa num dia com muitas aulas', () => {
    const classes: ClassSlot[] = [
      {
        id: 'cl-heavy',
        courseId: 'c1',
        type: 'T',
        weekday: 1, // segunda 2026-11-16
        start: '09:00',
        end: '13:30', // 270 min >= 240 min -> reduz 25% e assinala heavy_classes
        source: 'local',
      },
    ];
    const profile = resolveDayPlanProfile({
      dateKey: '2026-11-16',
      weekday: 1,
      settings: { ...baseSettings, dailyStudyMinutes: 200 },
      assessments: [],
    });
    const budgetResult = computeDayBudget({
      dateKey: '2026-11-16',
      weekday: 1,
      dayProfile: profile,
      classes,
      events: [],
    });
    expect(budgetResult.budget).toBe(150);
    expect(budgetResult.reducedReason).toBe('heavy_classes');

    const sessions = generatePlan({
      courses: [baseCourse],
      assessments: [],
      classes,
      events: [],
      settings: { ...baseSettings, dailyStudyMinutes: 200 },
      from: '2026-11-16',
      days: 1,
      preferredPeriod: 'afternoon',
      blockMinutes: 50,
    });
    const mondayPlanned = sessions.filter((s) => s.date === '2026-11-16').reduce((sum, s) => sum + s.minutes, 0);
    expect(mondayPlanned).toBeLessThanOrEqual(budgetResult.budget);
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
    latest.replan('checkin', { force: true });

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

  it('nunca agenda blocos de uma avaliação depois da hora do exame no próprio dia nem mantém o foco vencido nos dias seguintes', () => {
    const assessments: Assessment[] = [
      {
        id: 'a1',
        courseId: 'c1',
        kind: 'teste',
        title: '1.º Teste',
        date: '2026-11-20T09:00:00',
        weight: 50,
        topicIds: ['t1', 't2'],
        source: 'local',
      },
    ];
    const sessions = generatePlan({
      courses: [baseCourse],
      assessments,
      classes: [],
      events: [],
      settings: { ...baseSettings, dailyStudyMinutes: 300 },
      preferredPeriod: 'morning',
      from: '2026-11-19',
      days: 5,
      studyLogs: [
        {
          id: 'log-focus',
          kind: 'exam_prep',
          date: '2026-11-18',
          createdAt: '2026-11-18T19:00:00.000Z',
          courseId: 'c1',
          assessmentId: 'a1',
          feeling: 'estavel',
          studyFocus: 'Revisão total para teste',
          topicIds: ['t1', 't2'],
        },
      ],
    });

    const examDayPostTest = sessions.filter((s) => {
      if (s.date !== '2026-11-20' || s.courseId !== 'c1' || !s.start) return false;
      const [h, m] = s.start.split(':').map(Number);
      return h * 60 + m + s.minutes > 9 * 60;
    });
    expect(examDayPostTest).toEqual([]);

    const postExamWithStaleNote = sessions.filter(
      (s) => s.date > '2026-11-20' && s.courseId === 'c1' && s.notes === 'Revisão total para teste',
    );
    expect(postExamWithStaleNote).toEqual([]);
  });

  it('distribui sessões por múltiplos tópicos da cadeira antes do teste em vez de repetir só 1 ou 2', () => {
    const sixTopicCourse: Course = {
      ...baseCourse,
      topics: [
        { id: 't1', title: 'Von Mises', status: 'todo', confidence: 2 },
        { id: 't2', title: 'Teoria da Plasticidade', status: 'learning', confidence: 2 },
        { id: 't3', title: 'Limite Superior', status: 'todo', confidence: 2 },
        { id: 't4', title: 'Fatia Elementar', status: 'todo', confidence: 2 },
        { id: 't5', title: 'Energia Uniforme', status: 'todo', confidence: 3 },
        { id: 't6', title: 'Tresca e Mohr', status: 'todo', confidence: 3 },
      ],
    };
    const assessments: Assessment[] = [
      {
        id: 'a1',
        courseId: 'c1',
        kind: 'teste',
        title: '1.º Teste',
        date: '2026-11-20T09:00:00',
        weight: 50,
        topicIds: ['t1', 't2', 't3', 't4', 't5', 't6'],
        source: 'local',
      },
    ];
    const sessions = generatePlan({
      courses: [sixTopicCourse],
      assessments,
      classes: [],
      events: [],
      settings: { ...baseSettings, dailyStudyMinutes: 300 },
      from: '2026-11-16',
      days: 4,
    });

    const distinctTopics = new Set(sessions.filter((s) => s.courseId === 'c1').map((s) => s.topicId));
    expect(distinctTopics.size).toBeGreaterThanOrEqual(4);
  });

  it('em multi_test garante sessões também para a 2.ª cadeira urgente mesmo quando a 1.ª tem muitas horas por cobrir', () => {
    const tepCourse: Course = {
      ...baseCourse,
      topics: [
        { id: 't1', title: 'Plasticidade', status: 'todo', confidence: 1 },
        { id: 't2', title: 'Von Mises', status: 'todo', confidence: 1 },
        { id: 't3', title: 'Tresca', status: 'todo', confidence: 1 },
        { id: 't4', title: 'Fatia', status: 'todo', confidence: 1 },
      ],
    };
    const faCourse: Course = {
      id: 'c2',
      code: 'FA',
      name: 'Fabrico Aditivo',
      shortName: 'Fab. Aditivo',
      ects: 6,
      color: 'sky',
      targetGrade: 14,
      topics: [{ id: 'fa1', title: 'Processos PBF', status: 'done', confidence: 4 }],
    };
    const assessments: Assessment[] = [
      {
        id: 'a1',
        courseId: 'c1',
        kind: 'teste',
        title: '1.º Teste TEP',
        date: '2026-11-20T09:00:00',
        weight: 40,
        topicIds: ['t1', 't2', 't3', 't4'],
        source: 'local',
      },
      {
        id: 'a2',
        courseId: 'c2',
        kind: 'teste',
        title: '1.º Teste FA',
        date: '2026-11-23T14:00:00',
        weight: 30,
        topicIds: [],
        source: 'local',
      },
    ];
    const sessions = generatePlan({
      courses: [tepCourse, faCourse],
      assessments,
      classes: [],
      events: [],
      settings: { ...baseSettings, dailyStudyMinutes: 240 },
      from: '2026-11-16',
      days: 7,
    });

    expect(sessions.some((s) => s.courseId === 'c1')).toBe(true);
    expect(sessions.some((s) => s.courseId === 'c2')).toBe(true);
  });

  it('permite atingir metas de 5h com blocos adaptativos de 35 min e agenda revisão no fim de semana antes de teste na segunda', () => {
    const lowConfCourse: Course = {
      ...baseCourse,
      topics: [
        { id: 't1', title: 'Tópico 1', status: 'todo', confidence: 1 },
        { id: 't2', title: 'Tópico 2', status: 'todo', confidence: 1 },
        { id: 't3', title: 'Tópico 3', status: 'todo', confidence: 1 },
        { id: 't4', title: 'Tópico 4', status: 'todo', confidence: 1 },
        { id: 't5', title: 'Tópico 5', status: 'todo', confidence: 1 },
        { id: 't6', title: 'Tópico 6', status: 'todo', confidence: 1 },
      ],
    };
    const assessments: Assessment[] = [
      {
        id: 'a1',
        courseId: 'c1',
        kind: 'teste',
        title: 'Teste de Segunda',
        date: '2026-11-23T09:00:00', // segunda-feira
        weight: 50,
        topicIds: ['t1', 't2', 't3', 't4', 't5', 't6'],
        source: 'local',
      },
    ];
    const sessions = generatePlan({
      courses: [lowConfCourse],
      assessments,
      classes: [],
      events: [],
      settings: {
        ...baseSettings,
        dailyStudyMinutes: 300,
        studyDays: [1, 2, 3, 4, 5], // fins de semana desativados fora de véspera de exame
      },
      from: '2026-11-20', // sexta-feira
      days: 4, // sexta, sábado, domingo, segunda
    });

    const fridayMinutes = sessions
      .filter((s) => s.date === '2026-11-20')
      .reduce((sum, s) => sum + s.minutes, 0);
    expect(fridayMinutes).toBeGreaterThanOrEqual(240);

    // Sábado (2026-11-21) e Domingo (2026-11-22) estão a 2 e 1 dias do teste de segunda: devem ter revisão urgente.
    expect(sessions.some((s) => s.date === '2026-11-21' && s.courseId === 'c1')).toBe(true);
    expect(sessions.some((s) => s.date === '2026-11-22' && s.courseId === 'c1')).toBe(true);

    // Sem exame iminente, um fim de semana fora de studyDays continua vazio.
    const quietWeekend = generatePlan({
      courses: [lowConfCourse],
      assessments: [],
      classes: [],
      events: [],
      settings: { ...baseSettings, dailyStudyMinutes: 300, studyDays: [1, 2, 3, 4, 5] },
      from: '2026-11-21',
      days: 2,
    });
    expect(quietWeekend).toEqual([]);
  });

  it('em multiTestMode com foco exclusivo numa cadeira (TEP vs Fab. Aditivo), dedica 100% até ao teste sem agendar a outra', () => {
    const tep: Course = {
      id: 'c-tep',
      code: 'TEP',
      name: 'Tecnologia de Produção',
      shortName: 'TEP',
      ects: 6,
      color: 'emerald',
      targetGrade: 14,
      topics: [
        { id: 'tep-1', title: 'Plasticidade', status: 'todo', confidence: 2 },
        { id: 'tep-2', title: 'Estampagem', status: 'learning', confidence: 3 },
      ],
    };
    const fab: Course = {
      id: 'c-fab',
      code: 'FA',
      name: 'Fabrico Aditivo',
      shortName: 'Fab. Aditivo',
      ects: 6,
      color: 'amber',
      targetGrade: 14,
      topics: [{ id: 'fab-1', title: 'Processos PBF', status: 'todo', confidence: 2 }],
    };
    const assessments: Assessment[] = [
      {
        id: 'a-tep',
        courseId: 'c-tep',
        kind: 'teste',
        title: '1.º Teste TEP',
        date: '2026-11-20T10:00:00', // daqui a 4 dias
        weight: 50,
        topicIds: ['tep-1', 'tep-2'],
        source: 'local',
      },
      {
        id: 'a-fab',
        courseId: 'c-fab',
        kind: 'teste',
        title: '1.º Teste Fabrico Aditivo',
        date: '2026-11-23T10:00:00', // daqui a 7 dias (multiTestMode!)
        weight: 50,
        topicIds: ['fab-1'],
        source: 'local',
      },
    ];

    const plan = generatePlan({
      courses: [tep, fab],
      assessments,
      classes: [],
      events: [],
      settings: { ...baseSettings, dailyStudyMinutes: 180 },
      from: '2026-11-16',
      days: 7,
      boostCourseIds: ['c-tep'],
      courseModeUntil: { 'c-tep': '2026-11-20' },
      exclusiveTestFocus: true,
    });

    const beforeTepExam = plan.filter(
      (s) => s.date < '2026-11-20' || (s.date === '2026-11-20' && (!s.start || s.start < '10:00')),
    );
    expect(beforeTepExam.length).toBeGreaterThan(0);
    expect(beforeTepExam.some((s) => s.courseId === 'c-fab')).toBe(false);
    expect(beforeTepExam.every((s) => s.courseId === 'c-tep')).toBe(true);

    // Depois do teste de TEP (21–22 nov), Fabrico Aditivo volta automaticamente ao plano.
    const afterTepExam = plan.filter((s) => s.date > '2026-11-20');
    expect(afterTepExam.some((s) => s.courseId === 'c-fab')).toBe(true);

    // Com a pausa gerada por «deixar Fabrico aditivo para depois» até 2026-11-20, nem na noite de 20 entra FA.
    const withPause = generatePlan({
      courses: [tep, fab],
      assessments,
      classes: [],
      events: [],
      settings: { ...baseSettings, dailyStudyMinutes: 180 },
      from: '2026-11-16',
      days: 7,
      boostCourseIds: ['c-tep'],
      pausedCourseIds: ['c-fab'],
      courseModeUntil: { 'c-tep': '2026-11-20', 'c-fab': '2026-11-20' },
      exclusiveTestFocus: true,
    });
    expect(withPause.filter((s) => s.date <= '2026-11-20').some((s) => s.courseId === 'c-fab')).toBe(false);
    expect(withPause.filter((s) => s.date > '2026-11-20').some((s) => s.courseId === 'c-fab')).toBe(true);
  });

  it('limita a vista compacta semanal a 6 blocos e faz os blocos seguintes subirem com o passar da hora', () => {
    const daySessions: StudySession[] = [
      { id: 's1', courseId: 'c1', date: '2026-11-19', start: '09:00', minutes: 50, done: false, generated: true },
      { id: 's2', courseId: 'c1', date: '2026-11-19', start: '10:00', minutes: 50, done: false, generated: true },
      { id: 's3', courseId: 'c1', date: '2026-11-19', start: '11:00', minutes: 50, done: false, generated: true },
      { id: 's4', courseId: 'c1', date: '2026-11-19', start: '12:00', minutes: 50, done: false, generated: true },
      { id: 's5', courseId: 'c1', date: '2026-11-19', start: '14:00', minutes: 50, done: false, generated: true },
      { id: 's6', courseId: 'c1', date: '2026-11-19', start: '15:00', minutes: 50, done: false, generated: true },
      { id: 's7', courseId: 'c1', date: '2026-11-19', start: '16:00', minutes: 50, done: false, generated: true },
      { id: 's8', courseId: 'c1', date: '2026-11-19', start: '17:00', minutes: 50, done: false, generated: true },
    ];

    // Outro dia (não hoje): mostra sempre no máximo 6 + extraCount=2
    const otherDay = selectCompactDaySessions(daySessions, { isToday: false, nowMinutes: 12 * 60 });
    expect(otherDay.visible.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4', 's5', 's6']);
    expect(otherDay.extraCount).toBe(2);

    // Hoje às 11:00 (s1 09:00–09:50 e s2 10:00–10:50 já passaram): sobem s7 e s8!
    const today11 = selectCompactDaySessions(daySessions, { isToday: true, nowMinutes: 11 * 60 });
    expect(today11.rolledOffCount).toBe(2);
    expect(today11.visible.map((s) => s.id)).toEqual(['s3', 's4', 's5', 's6', 's7', 's8']);
    expect(today11.extraCount).toBe(0);

    // Hoje às 18:00 (todos passaram): lista compacta fica vazia com flag allPassedToday
    const todayEnd = selectCompactDaySessions(daySessions, { isToday: true, nowMinutes: 18 * 60 });
    expect(todayEnd.visible).toEqual([]);
    expect(todayEnd.allPassedToday).toBe(true);
  });
});

