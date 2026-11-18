import { addDays, format } from 'date-fns';
import { describe, expect, it } from 'vitest';
import type { Assessment, ClassSlot, Course, Material, Settings, StudySession } from '../../types';
import { useStore } from '../../store/useStore';
import {
  findFirstFreeSlotOnDate,
  generatePlan,
  resolveDayPlanProfile,
} from '../planner';
import {
  applyWeekdayPreset,
  parsePlannerBriefing,
  resolveWeekdayAvailability,
} from '../plannerBriefing';
import { formatSessionReason } from '../selectors';

const baseSettings: Settings = {
  userName: 'Maria',
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

const calcCourse: Course = {
  id: 'c-calc',
  code: 'AM1',
  name: 'Cálculo I',
  shortName: 'Cálculo',
  ects: 6,
  color: 'emerald',
  targetGrade: 15,
  topics: [
    { id: 'tp1', title: 'Aula 1 · Limites', status: 'todo', confidence: 2 },
    { id: 'tp2', title: 'Aula 2 · Continuidade', status: 'todo', confidence: 2 },
    { id: 'tp3', title: 'Aula 3 · Derivadas', status: 'todo', confidence: 2 },
    { id: 'tp4', title: 'Aula 4 · Integrais', status: 'todo', confidence: 2 },
  ],
};

const tepCourse: Course = {
  id: 'c-tep',
  code: 'TEP',
  name: 'Tecnologia de Processos',
  shortName: 'TEP',
  ects: 6,
  color: 'emerald',
  targetGrade: 14,
  topics: [
    { id: 'tep1', title: 'Laminagem a quente', status: 'todo', confidence: 2 },
    { id: 'tep2', title: 'Forjamento livre', status: 'learning', confidence: 3 },
  ],
};

describe('plannerBriefing.parsePlannerBriefing', () => {
  it('deteta meio do semestre, maratona pré-teste, bloqueios de dia e domínio até ao tópico N', () => {
    const parsed = parsePlannerBriefing({
      text: 'Comecei a meio do semestre. Fico a estudar o dia todo antes dos testes. À quarta de manhã não posso e ao sábado tenho o dia todo. Já domino até à aula 2 de Cálculo e quero reforçar TEP.',
      courses: [calcCourse, tepCourse],
    });

    expect(parsed.midSemesterCatchUp).toBe(true);
    expect(parsed.suggestedMarathon?.enabled).toBe(true);
    expect(parsed.suggestedMarathon?.dailyMinutes).toBeGreaterThanOrEqual(480);

    // Quarta (weekday 3) manhã bloqueada
    const wed = parsed.weekdayUpdates.find((u) => u.weekday === 3 && u.blockedPeriod === 'morning');
    expect(wed).toBeDefined();

    // Sábado (weekday 6) dia todo
    const sat = parsed.weekdayUpdates.find((u) => u.weekday === 6 && u.window === 'all_day');
    expect(sat).toBeDefined();

    // Primeiros 2 tópicos de Cálculo marcados como dominados
    expect(parsed.topicUpdates.filter((u) => u.courseId === 'c-calc').map((u) => u.topicId)).toEqual([
      'tp1',
      'tp2',
    ]);
    expect(parsed.boostCourseIds).toContain('c-tep');
  });
});

describe('planner v2 · disponibilidade semanal, maratona pré-teste, bloqueios e materiais', () => {
  it('aplica orçamento por dia da semana (pouco na semana, forte ao fim de semana)', () => {
    const weekdaySchedule = applyWeekdayPreset('light_week_strong_weekend');
    const assessments: Assessment[] = [
      {
        id: 'a1',
        courseId: 'c-calc',
        kind: 'teste',
        title: '1.º Teste',
        date: '2026-11-28T10:00:00',
        weight: 50,
        topicIds: ['tp1', 'tp2', 'tp3', 'tp4'],
        source: 'local',
      },
    ];

    const sessions = generatePlan({
      courses: [calcCourse],
      assessments,
      classes: [],
      events: [],
      settings: baseSettings,
      from: '2026-11-16', // segunda-feira
      days: 7,
      weekdaySchedule,
      blockMinutes: 50,
    });

    const monMin = sessions
      .filter((s) => s.date === '2026-11-16')
      .reduce((sum, s) => sum + s.minutes, 0);
    const satMin = sessions
      .filter((s) => s.date === '2026-11-21')
      .reduce((sum, s) => sum + s.minutes, 0);

    expect(monMin).toBeLessThanOrEqual(100);
    expect(satMin).toBeGreaterThanOrEqual(200);
  });

  it('ativa Maratona Pré-Teste de dia inteiro N dias antes da avaliação', () => {
    const weekdaySchedule = applyWeekdayPreset('evenings_week');
    const assessments: Assessment[] = [
      {
        id: 'a-mar',
        courseId: 'c-calc',
        kind: 'exame',
        title: 'Exame Final',
        date: '2026-11-20T14:00:00', // sexta
        weight: 60,
        topicIds: ['tp1', 'tp2', 'tp3', 'tp4'],
        source: 'local',
      },
    ];

    const marProfile = resolveDayPlanProfile({
      dateKey: '2026-11-19', // véspera (1 dia antes)
      weekday: 4,
      settings: baseSettings,
      assessments,
      weekdaySchedule,
      preExamMarathon: { enabled: true, daysBefore: 2, dailyMinutes: 480 },
    });
    expect(marProfile.isMarathonDay).toBe(true);
    expect(marProfile.baseBudget).toBe(480);
    expect(marProfile.windowMode).toBe('all_day');

    const sessions = generatePlan({
      courses: [calcCourse],
      assessments,
      classes: [],
      events: [],
      settings: baseSettings,
      from: '2026-11-18', // quarta -> quinta -> sexta
      days: 3,
      weekdaySchedule,
      preExamMarathon: { enabled: true, daysBefore: 2, dailyMinutes: 480 },
      blockMinutes: 50,
    });

    const thursdaySessions = sessions.filter((s) => s.date === '2026-11-19');
    const thursdayMin = thursdaySessions.reduce((sum, s) => sum + s.minutes, 0);
    expect(thursdayMin).toBeGreaterThanOrEqual(300);
    expect(thursdaySessions.some((s) => s.reason?.code === 'exam_marathon')).toBe(true);
    expect(thursdaySessions.some((s) => Number(s.start?.slice(0, 2)) < 12)).toBe(true);

    // No próprio dia do exame (14:00), nenhum bloco acaba depois das 13:30
    const fridaySessions = sessions.filter((s) => s.date === '2026-11-20');
    for (const fs of fridaySessions) {
      const [h, m] = (fs.start ?? '00:00').split(':').map(Number);
      expect(h * 60 + m + fs.minutes).toBeLessThanOrEqual(13 * 60 + 30);
    }
  });

  it('associa o melhor material da cadeira e gera Porquê traduzível', () => {
    const materials: Material[] = [
      {
        id: 'm-slides',
        courseId: 'c-calc',
        title: 'Slides Aula 3 Derivadas',
        url: 'https://example.com/slides',
        provider: 'gdrive',
        category: 'slide_oficial',
      },
      {
        id: 'm-teste',
        courseId: 'c-calc',
        title: 'Teste Antigo 2025 Derivadas [teste_antigo]',
        url: 'https://example.com/teste',
        provider: 'gdrive',
        category: 'teste_antigo',
        hasSolution: true,
      },
    ];
    const assessments: Assessment[] = [
      {
        id: 'a-urgent',
        courseId: 'c-calc',
        kind: 'teste',
        title: '1.º Teste',
        date: '2026-11-19T10:00:00',
        weight: 40,
        topicIds: ['tp3'],
        source: 'local',
      },
    ];

    const sessions = generatePlan({
      courses: [{ ...calcCourse, topics: [calcCourse.topics[2]!] }],
      assessments,
      classes: [],
      events: [],
      materials,
      settings: baseSettings,
      from: '2026-11-16',
      days: 3,
      contentMix: 'practice_first',
    });

    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0]?.materialId).toBe('m-teste');
    const reasonLabelPt = formatSessionReason(sessions[0]!, assessments[0], 'pt-PT');
    const reasonLabelEn = formatSessionReason(sessions[0]!, assessments[0], 'en');
    expect(reasonLabelPt).toBeTruthy();
    expect(reasonLabelEn).toBeTruthy();
    expect(reasonLabelPt).not.toEqual(reasonLabelEn);
  });

  it('preserva sessões fixadas (locked) ao regenerar o plano via useStore e evita colisões ao mover', () => {
    const store = useStore.getState();
    store.clearAll();

    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const tomorrow = format(addDays(now, 1), 'yyyy-MM-dd');
    const lockedSession: StudySession = {
      id: 'locked-1',
      courseId: 'c-tep',
      topicId: 'tep1',
      date: tomorrow,
      start: '17:30',
      minutes: 50,
      done: false,
      generated: true,
      locked: true,
      notes: 'Bloco fixado pelo estudante',
    };
    const unlockedOld: StudySession = {
      id: 'unlocked-old',
      courseId: 'c-tep',
      topicId: 'tep2',
      date: tomorrow,
      start: '19:00',
      minutes: 50,
      done: false,
      generated: true,
    };

    useStore.setState({
      courses: [tepCourse],
      assessments: [
        {
          id: 'a-tep',
          courseId: 'c-tep',
          kind: 'teste',
          title: 'Teste TEP',
          date: format(addDays(now, 5), 'yyyy-MM-dd'),
          weight: 50,
          topicIds: ['tep1', 'tep2'],
          source: 'local',
        },
      ],
      settings: { ...baseSettings, dailyStudyMinutes: 180 },
      sessions: [lockedSession, unlockedOld],
    });

    useStore.getState().reconcileFuturePlan(true);
    const updated = useStore.getState().sessions;

    // A sessão fixada mantém exatamente a mesma ID, hora e nota; a não fixada foi substituída.
    const preserved = updated.find((s) => s.id === 'locked-1');
    expect(preserved).toBeDefined();
    expect(preserved?.start).toBe('17:30');
    expect(preserved?.locked).toBe(true);
    expect(updated.some((s) => s.id === 'unlocked-old')).toBe(false);

    // Nenhum outro bloco gerado no mesmo dia pode sobrepor 17:30..18:20
    const sameDayGenerated = updated.filter((s) => s.date === tomorrow && s.id !== 'locked-1');
    for (const s of sameDayGenerated) {
      const [h, m] = (s.start ?? '00:00').split(':').map(Number);
      const startMin = h * 60 + m;
      const endMin = startMin + s.minutes;
      const overlapsLocked = startMin < 18 * 60 + 20 && endMin > 17 * 60 + 30;
      expect(overlapsLocked).toBe(false);
    }

    // findFirstFreeSlotOnDate encontra slot livre sem colidir com aulas nem com o bloco fixado
    const classes: ClassSlot[] = [
      {
        id: 'cl1',
        courseId: 'c-tep',
        type: 'T',
        weekday: addDays(now, 1).getDay(),
        start: '16:00',
        end: '17:20',
        source: 'local',
      },
    ];
    const slot = findFirstFreeSlotOnDate({
      dateKey: tomorrow,
      minutes: 50,
      preferredPeriod: 'afternoon',
      classes,
      events: [],
      existingSessions: [lockedSession],
    });
    expect(slot).toBeDefined();
    expect(slot).not.toBe('17:30');
    expect(today.length).toBe(10);
  });
});

describe('resolveWeekdayAvailability · dias de estudo das Definições', () => {
  it('um dia desligado em studyDays não fica ativo, mesmo com o mapa semanal a marcá-lo', () => {
    // Plano criado com fim de semana ligado; depois o utilizador desliga o sábado nas Definições.
    const weekdaySchedule = applyWeekdayPreset('light_week_strong_weekend');
    expect(weekdaySchedule['6']?.enabled).toBe(true);
    const settings = { ...baseSettings, studyDays: [1, 2, 3, 4, 5] };

    const saturday = resolveWeekdayAvailability(6, settings, weekdaySchedule);
    expect(saturday.enabled).toBe(false);
    // Os minutos continuam a vir do mapa; só o estado de dia de estudo muda.
    expect(saturday.minutes).toBe(weekdaySchedule['6']?.minutes);

    const monday = resolveWeekdayAvailability(1, settings, weekdaySchedule);
    expect(monday.enabled).toBe(true);
  });

  it('sem mapa semanal, usa studyDays como antes', () => {
    const settings = { ...baseSettings, studyDays: [1, 2, 3, 4, 5] };
    expect(resolveWeekdayAvailability(0, settings).enabled).toBe(false);
    expect(resolveWeekdayAvailability(3, settings).enabled).toBe(true);
  });
});
