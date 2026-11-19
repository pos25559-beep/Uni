import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Assessment, Course, Settings } from '../../types';
import { useStore } from '../../store/useStore';
import {
  applyPlanIntent,
  intentFromParsedBriefing,
  mergeIntents,
  oneOffDateForWeekday,
  sanitizeIntentItems,
} from '../planner/intent';
import { computeReplan } from '../planner/replan';
import { generatePlan } from '../planner/engine';
import { parsePlannerBriefing } from '../plannerBriefing';

const courses: Course[] = [
  {
    id: 'c-cdi',
    code: 'CDI',
    name: 'Cálculo Diferencial e Integral',
    shortName: 'CDI',
    ects: 6,
    color: 'emerald',
    targetGrade: 14,
    topics: [
      { id: 't-lim', title: 'Limites', status: 'todo', confidence: 2 },
      { id: 't-der', title: 'Derivadas', status: 'learning', confidence: 3 },
    ],
  },
  {
    id: 'c-fis',
    code: 'FIS',
    name: 'Física I',
    shortName: 'Física',
    ects: 6,
    color: 'sky',
    targetGrade: 14,
    topics: [{ id: 't-mec', title: 'Mecânica', status: 'todo', confidence: 2 }],
  },
];

const settings: Settings = {
  userName: 'Pedro',
  theme: 'light',
  semesterName: '2026/27',
  semesterStart: '2026-09-14',
  semesterEnd: '2027-01-30',
  dailyStudyMinutes: 120,
  studyDays: [1, 2, 3, 4, 5, 6],
  geminiApiKey: '',
  geminiModel: 'gemini-4-hydrogen',
  googleClientId: '',
  aiConsent: true,
};

afterEach(() => {
  vi.restoreAllMocks();
  useStore.getState().clearAll();
});

describe('planner intent (Fase C)', () => {
  it('converte texto com exceção por data e validade («esta sexta não posso, reforçar CDI até quarta»)', () => {
    // 2026-11-16 é segunda-feira; esta sexta é 2026-11-20; quarta é 2026-11-18
    const today = '2026-11-16';
    const parsed = parsePlannerBriefing({
      text: 'esta sexta não posso, reforçar CDI até quarta',
      courses,
    });
    const intent = intentFromParsedBriefing(parsed, today);

    const fridayOverride = intent.items.find((i) => i.kind === 'date_override');
    expect(fridayOverride).toEqual({
      id: 'date-2026-11-20',
      kind: 'date_override',
      date: '2026-11-20',
      enabled: false,
      minutes: 0,
    });

    const cdiBoost = intent.items.find((i) => i.kind === 'course_mode');
    expect(cdiBoost).toEqual({
      id: 'mode-c-cdi',
      kind: 'course_mode',
      courseId: 'c-cdi',
      mode: 'boost',
      until: '2026-11-18',
    });
    expect(intent.items).toHaveLength(2);
  });

  it('distingue exceção por data («esta sexta») de regra permanente («às sextas») e deteta mistura teoria/prática', () => {
    const today = '2026-11-16';
    expect(oneOffDateForWeekday('esta sexta não posso', 5, today)).toBe('2026-11-20');
    expect(oneOffDateForWeekday('às sextas não estudo', 5, today)).toBeUndefined();

    const permParsed = parsePlannerBriefing({
      text: 'às sextas não estudo e quero mais prática primeiro',
      courses,
    });
    const permIntent = intentFromParsedBriefing(permParsed, today);

    expect(permIntent.items.some((i) => i.kind === 'weekday_rule' && i.weekday === 5 && i.enabled === false)).toBe(true);
    expect(permIntent.items.some((i) => i.kind === 'content_mix' && i.mix === 'practice_first')).toBe(true);

    const { prefs } = applyPlanIntent(undefined, permIntent.items);
    expect(prefs.weekdaySchedule?.['5']?.enabled).toBe(false);
    expect(prefs.contentMix).toBe('practice_first');
  });

  it('valida respostas da IA simulada (descarta ids desconhecidos e datas fora da janela) e junta com leitura simples', () => {
    const today = '2026-11-16';
    const validated = sanitizeIntentItems(
      [
        { kind: 'date_override', date: '2026-11-20', enabled: false },
        { kind: 'date_override', date: '2026-12-30', enabled: false }, // > 21 dias -> descartado
        { kind: 'course_mode', courseId: 'id-falso', mode: 'boost' }, // id falso -> descartado
        { kind: 'course_note', courseId: 'c-cdi', text: 'Focar em séries e Taylor', until: '2026-11-22' },
        { kind: 'content_mix', contentMix: 'theory_first' },
      ],
      courses,
      today,
    );

    expect(validated.map((i) => i.kind)).toEqual(['date_override', 'course_note', 'content_mix']);

    const base = intentFromParsedBriefing(parsePlannerBriefing({ text: 'reforçar Física', courses }), today);
    const merged = mergeIntents(base, validated);
    expect(merged.usedAi).toBe(true);
    expect(merged.items.some((i) => i.kind === 'course_mode' && i.courseId === 'c-fis')).toBe(true);
    expect(merged.items.some((i) => i.kind === 'content_mix' && i.mix === 'theory_first')).toBe(true);
  });

  it('IA simulada via extractPlanIntentWithAi usa schema de intenção sem quebrar em falha/lixo', async () => {
    const core = await import('../../integrations/gemini/core');
    vi.spyOn(core, 'resolveGeminiConfig').mockReturnValue({
      customKey: 'k-test',
      model: 'gemini-4-hydrogen',
      consent: true,
    } as never);
    vi.spyOn(core, 'withQuotaAndFallback').mockImplementation((async (
      _b: unknown,
      _k: unknown,
      fn: () => Promise<string>,
    ) => fn()) as never);
    vi.spyOn(core, 'callDirectRest').mockResolvedValue(
      JSON.stringify({
        items: [
          { kind: 'date_override', date: '2026-11-20', enabled: false },
          { kind: 'course_mode', courseId: 'c-cdi', mode: 'boost', until: '2026-11-25' },
        ],
      }),
    );

    const { extractPlanIntentWithAi } = await import('../../integrations/gemini/plannerAi');
    const items = await extractPlanIntentWithAi({
      text: 'esta sexta não posso e reforço CDI',
      courses,
      assessments: [],
      today: '2026-11-16',
      lang: 'pt-PT',
    });
    expect(items).toEqual([
      { id: 'date-2026-11-20', kind: 'date_override', date: '2026-11-20', enabled: false },
      { id: 'mode-c-cdi', kind: 'course_mode', courseId: 'c-cdi', mode: 'boost', until: '2026-11-25' },
    ]);
  });

  it('fluxo completo na store: aplicar briefing («esta sexta não posso»), editar um teste, e a sexta continua vazia (e Desfazer restaura tudo)', () => {
    const store = useStore.getState();
    store.clearAll();

    // Encontrar a próxima sexta-feira a partir de hoje real (para alinhar com store.replan/applyBriefing)
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const daysToFriday = (5 - now.getDay() + 7) % 7 || 7;
    const fridayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToFriday);
    const fridayIso = `${fridayDate.getFullYear()}-${String(fridayDate.getMonth() + 1).padStart(2, '0')}-${String(fridayDate.getDate()).padStart(2, '0')}`;
    const examDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10);
    const examIso = `${examDate.getFullYear()}-${String(examDate.getMonth() + 1).padStart(2, '0')}-${String(examDate.getDate()).padStart(2, '0')}T14:00:00`;

    const initialAssessment: Assessment = {
      id: 'a-cdi',
      courseId: 'c-cdi',
      kind: 'teste',
      title: 'Teste CDI',
      date: examIso,
      weight: 40,
      topicIds: ['t-lim', 't-der'],
      source: 'local',
    };

    useStore.setState({
      courses,
      assessments: [initialAssessment],
      settings: { ...settings, studyDays: [0, 1, 2, 3, 4, 5, 6] },
    });

    // Gerar plano inicial
    expect(useStore.getState().replan('manual', { force: true })).toBe(true);

    // Aplicar briefing com exceção para essa sexta + reforço de CDI
    const applied = useStore.getState().applyBriefing(
      [
        { id: `date-${fridayIso}`, kind: 'date_override', date: fridayIso, enabled: false, minutes: 0 },
        { id: 'mode-c-cdi', kind: 'course_mode', courseId: 'c-cdi', mode: 'boost' },
      ],
      'esta sexta não posso e quero reforçar CDI',
    );
    expect(applied).toBe(true);
    expect(useStore.getState().sessions.filter((s) => s.date === fridayIso)).toEqual([]);

    // Editar o teste (dispara replan automático por 'assessment'): a sexta TEM de continuar vazia
    useStore.getState().patch('assessments', 'a-cdi', { weight: 60 });
    expect(useStore.getState().sessions.filter((s) => s.date === fridayIso)).toEqual([]);

    // Verificar também no computeReplan puro que o perfil da semana seguinte à sexta continua ativo
    const afterNext = computeReplan(useStore.getState(), { today: todayIso, force: true });
    expect(afterNext.sessions.filter((s) => s.date === fridayIso)).toEqual([]);

    // Desfazer o último replan funciona sem erros
    expect(useStore.getState().undoLastReplan()).toBe(true);
  });

  it('interpreta «só focar em TEP até meu teste e deixar Fabrico aditivo para depois» como foco exclusivo + pausa com validade', () => {
    const today = '2026-11-16';
    const tepCourse: Course = {
      id: 'c-tep',
      code: 'TEP',
      name: 'Tecnologia de Produção',
      shortName: 'TEP',
      ects: 6,
      color: 'emerald',
      targetGrade: 14,
      topics: [{ id: 't-tep-1', title: 'Plasticidade', status: 'todo', confidence: 2 }],
    };
    const fabCourse: Course = {
      id: 'c-fab',
      code: 'FA',
      name: 'Fabrico Aditivo',
      shortName: 'Fabrico Aditivo',
      ects: 6,
      color: 'amber',
      targetGrade: 14,
      topics: [{ id: 't-fab-1', title: 'Processos', status: 'todo', confidence: 2 }],
    };
    const testAssessments: Assessment[] = [
      {
        id: 'a-tep',
        courseId: 'c-tep',
        kind: 'teste',
        title: '1.º Teste TEP',
        date: '2026-11-20T10:00:00',
        weight: 50,
        topicIds: ['t-tep-1'],
        source: 'local',
      },
      {
        id: 'a-fab',
        courseId: 'c-fab',
        kind: 'teste',
        title: '1.º Teste Fabrico Aditivo',
        date: '2026-11-24T10:00:00',
        weight: 50,
        topicIds: ['t-fab-1'],
        source: 'local',
      },
    ];

    const parsed = parsePlannerBriefing({
      text: 'só focar em TEP até meu teste e deixar Fabrico aditivo para depois',
      courses: [tepCourse, fabCourse],
    });
    expect(parsed.exclusiveFocusCourseId).toBe('c-tep');
    expect(parsed.pausedCourseIds).toContain('c-fab');
    expect(parsed.pausedCourseIds).not.toContain('c-tep');

    const intent = intentFromParsedBriefing(parsed, today, testAssessments);
    const { prefs } = applyPlanIntent(undefined, intent.items);
    expect(prefs.exclusiveTestFocus).toBe(true);
    expect(prefs.boostCourseIds).toContain('c-tep');
    expect(prefs.pausedCourseIds).toContain('c-fab');
    expect(prefs.courseModeUntil?.['c-tep']).toBe('2026-11-20');
    expect(prefs.courseModeUntil?.['c-fab']).toBe('2026-11-20');
  });

  it('suporta pedido sequencial multi-fases (TEP até sexta 16h -> Fabrico Aditivo só depois -> semana normal 2.ºs testes)', () => {
    const today = '2026-11-16'; // segunda-feira
    const tepCourse: Course = {
      id: 'c-tep',
      code: 'TEP',
      name: 'Tecnologia de Produção',
      shortName: 'TEP',
      ects: 6,
      color: 'emerald',
      targetGrade: 14,
      topics: [
        { id: 't-tep-1', title: 'Plasticidade', status: 'todo', confidence: 2 },
        { id: 't-tep-2', title: 'Fatia elementar', status: 'todo', confidence: 2 },
      ],
    };
    const fabCourse: Course = {
      id: 'c-fab',
      code: 'FA',
      name: 'Fabrico Aditivo',
      shortName: 'Fabrico Aditivo',
      ects: 6,
      color: 'amber',
      targetGrade: 14,
      topics: [
        { id: 't-fab-1', title: 'Fotopolimerização', status: 'todo', confidence: 2 },
        { id: 't-fab-2', title: 'SLS / SLM', status: 'todo', confidence: 2 },
      ],
    };
    const cdiCourse = courses[0];

    const multiAssessments: Assessment[] = [
      {
        id: 'a-tep-1',
        courseId: 'c-tep',
        kind: 'teste',
        title: '1.º Teste TEP',
        date: '2026-11-20T16:00:00',
        weight: 40,
        topicIds: ['t-tep-1'],
        source: 'local',
      },
      {
        id: 'a-fab-1',
        courseId: 'c-fab',
        kind: 'teste',
        title: '1.º Teste Fabrico Aditivo',
        date: '2026-11-23T14:00:00',
        weight: 40,
        topicIds: ['t-fab-1'],
        source: 'local',
      },
      {
        id: 'a-tep-2',
        courseId: 'c-tep',
        kind: 'teste',
        title: '2.º Teste TEP',
        date: '2026-12-10T10:00:00',
        weight: 40,
        topicIds: ['t-tep-2'],
        source: 'local',
      },
      {
        id: 'a-cdi-2',
        courseId: 'c-cdi',
        kind: 'teste',
        title: '2.º Teste CDI',
        date: '2026-12-12T10:00:00',
        weight: 40,
        topicIds: ['t-der'],
        source: 'local',
      },
    ];

    const prompt =
      'Quero estudar só para TEP até meu teste na sexta as 16h e depois estudar e focar somente em Fabrico Aditivo. Depois disso poderiamos voltar a ter uma semana de estudos mais normal focando para os segundos testes.';

    const parsed = parsePlannerBriefing({
      text: prompt,
      courses: [tepCourse, fabCourse, cdiCourse],
    });
    expect(parsed.sequentialPhases?.length).toBe(3);

    const intent = intentFromParsedBriefing(parsed, today, multiAssessments);
    const phaseItems = intent.items.filter((it) => it.kind === 'focus_phase');
    expect(phaseItems.length).toBe(3);
    if (
      phaseItems[0]?.kind !== 'focus_phase' ||
      phaseItems[1]?.kind !== 'focus_phase' ||
      phaseItems[2]?.kind !== 'focus_phase'
    ) {
      throw new Error('Expected 3 focus_phase items');
    }

    expect(phaseItems[0].phase.courseIds).toEqual(['c-tep']);
    expect(phaseItems[0].phase.mode).toBe('exclusive');
    expect(phaseItems[0].phase.untilDate).toBe('2026-11-20');
    expect(phaseItems[0].phase.untilTime).toBe('16:00');

    expect(phaseItems[1].phase.courseIds).toEqual(['c-fab']);
    expect(phaseItems[1].phase.mode).toBe('exclusive');
    expect(phaseItems[1].phase.fromDate).toBe('2026-11-20');
    expect(phaseItems[1].phase.fromTime).toBe('16:00');
    expect(phaseItems[1].phase.untilDate).toBe('2026-11-23');
    expect(phaseItems[1].phase.untilTime).toBe('14:00');

    expect(phaseItems[2].phase.mode).toBe('balanced');
    expect(phaseItems[2].phase.fromDate).toBe('2026-11-23');
    expect(phaseItems[2].phase.fromTime).toBe('14:00');
    expect(phaseItems[2].phase.strategy).toBe('exams_first');

    const { prefs } = applyPlanIntent(undefined, intent.items);
    expect(prefs.focusPhases?.length).toBe(3);

    const sessions = generatePlan({
      courses: [tepCourse, fabCourse, cdiCourse],
      assessments: multiAssessments,
      classes: [],
      events: [],
      settings: {
        ...settings,
        studyDays: [0, 1, 2, 3, 4, 5, 6],
        dailyStudyMinutes: 300,
      },
      from: today,
      days: 10,
      blockMinutes: 50,
      focusPhases: prefs.focusPhases,
    });

    // Seg–Qui: 100% TEP
    for (const d of ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19']) {
      const daySessions = sessions.filter((s) => s.date === d);
      expect(daySessions.length).toBeGreaterThan(0);
      expect(daySessions.every((s) => s.courseId === 'c-tep')).toBe(true);
    }

    // Sexta 2026-11-20: antes das 16:00 apenas TEP; depois das 16:00 apenas Fabrico Aditivo
    const friday = sessions.filter((s) => s.date === '2026-11-20');
    expect(friday.length).toBeGreaterThan(0);
    const friBefore = friday.filter((s) => (s.start ?? '00:00') < '16:00');
    const friAfter = friday.filter((s) => (s.start ?? '00:00') >= '16:00');
    expect(friBefore.length).toBeGreaterThan(0);
    expect(friBefore.every((s) => s.courseId === 'c-tep')).toBe(true);
    expect(friAfter.length).toBeGreaterThan(0);
    expect(friAfter.every((s) => s.courseId === 'c-fab')).toBe(true);

    // Sáb–Dom: apenas Fabrico Aditivo
    for (const d of ['2026-11-21', '2026-11-22']) {
      const daySessions = sessions.filter((s) => s.date === d);
      expect(daySessions.length).toBeGreaterThan(0);
      expect(daySessions.every((s) => s.courseId === 'c-fab')).toBe(true);
    }

    // Após teste de FA (2026-11-24 e 2026-11-25): semana normal equilibrada pelos 2.ºs testes (>1 cadeira)
    const afterSessions = sessions.filter((s) => s.date === '2026-11-24' || s.date === '2026-11-25');
    expect(afterSessions.length).toBeGreaterThan(0);
    const distinctCoursesAfter = new Set(afterSessions.map((s) => s.courseId));
    expect(distinctCoursesAfter.size).toBeGreaterThan(1);
    expect(distinctCoursesAfter.has('c-tep') || distinctCoursesAfter.has('c-cdi')).toBe(true);
  });
});
