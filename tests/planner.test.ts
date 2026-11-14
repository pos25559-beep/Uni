import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeExtraActivityPenaltyByWeekday,
  inferAcademicStageFromEcts,
} from '../src/lib/academicCredits';
import { parseCurriculumFromText } from '../src/lib/curriculumParser';
import { matchCourse } from '../src/integrations/clip';
import { extractAcademicsFromGoogleCalendar } from '../src/integrations/gcal';
import { groupConversations, subjectLabel } from '../src/lib/geminiConversations';
import { generatePlan } from '../src/lib/planner';
import {
  applyImportedScheduleRecords,
  buildInitialCompletedRecords,
  findMatchingCourseRecordIndex,
  formatAcademicYearLabel,
  getUniversityById,
} from '../src/lib/portugalCurriculum';
import { defaultSettings } from '../src/lib/seed';
import { computeNextSrsState, isTopicReviewDue } from '../src/lib/spacedRepetition';
import {
  getHubProgress,
  inferHubProfile,
  normalizeSafeHubUrl,
  normalizeSharedDriveUrl,
} from '../src/lib/studyHub';
import { getUniCollectibleStates } from '../src/lib/uniCollectibles';
import { pickNextShyBehavior, resolveVisibleUniPeers } from '../src/lib/uniPetEngine';
import { parseHistoryJsonText, parseScheduleJsonText } from '../src/lib/visionParsers';
import type {
  AcademicProfile,
  Assessment,
  CalendarEvent,
  ClassSlot,
  Course,
  Material,
  Topic,
} from '../src/types';

test('computeNextSrsState avanca 1 -> 3 -> 7 -> 21 quando recall=3 e confianca >= 4', () => {
  const base: Topic = { id: 't1', title: 'Derivadas', status: 'learning', confidence: 4 };

  const s1 = computeNextSrsState(base, 3, 4, '2026-11-01');
  assert.equal(s1.srsIntervalDays, 3);
  assert.equal(s1.nextReviewDate, '2026-11-04');
  assert.equal(s1.status, 'review');

  const s2 = computeNextSrsState({ ...base, ...s1 }, 3, 4, '2026-11-04');
  assert.equal(s2.srsIntervalDays, 7);
  assert.equal(s2.nextReviewDate, '2026-11-11');
  assert.equal(s2.status, 'done');

  const s3 = computeNextSrsState({ ...base, ...s2 }, 3, 5, '2026-11-11');
  assert.equal(s3.srsIntervalDays, 21);
  assert.equal(s3.nextReviewDate, '2026-12-02');
});

test('computeNextSrsState reinicia para 1 dia quando recall=1 ou confianca baixa', () => {
  const topic: Topic = {
    id: 't2',
    title: 'Integrais',
    status: 'review',
    confidence: 4,
    srsIntervalDays: 7,
  };
  const reset = computeNextSrsState(topic, 1, 2, '2026-11-10');
  assert.equal(reset.srsIntervalDays, 1);
  assert.equal(reset.nextReviewDate, '2026-11-11');
  assert.equal(reset.status, 'learning');
});

test('generatePlan agenda revisao espacada continua mesmo com avaliacao no horizonte', () => {
  const courses: Course[] = [
    {
      id: 'c1',
      code: 'MAT1',
      name: 'Calculo I',
      shortName: 'Calc I',
      ects: 6,
      color: 'emerald',
      targetGrade: 14,
      topics: [
        {
          id: 't-due',
          title: 'Limites notaveis',
          status: 'review',
          confidence: 4,
          srsIntervalDays: 3,
          nextReviewDate: '2026-11-13',
        },
        {
          id: 't-new',
          title: 'Series numericas',
          status: 'todo',
          confidence: 2,
        },
      ],
    },
  ];

  const sessions = generatePlan({
    courses,
    assessments: [
      {
        id: 'a1',
        courseId: 'c1',
        kind: 'teste',
        title: 'Frequencia 1',
        date: '2026-11-28T10:00:00',
        weight: 50,
        topicIds: ['t-new'],
        source: 'local',
      },
    ],
    classes: [],
    events: [],
    settings: { ...defaultSettings, dailyStudyMinutes: 100, studyDays: [1, 2, 3, 4, 5, 6] },
    from: '2026-11-13',
    days: 5,
  });

  const srsSessions = sessions.filter((s) => s.topicId === 't-due' && s.notes?.includes('SRS'));
  assert.ok(srsSessions.length >= 1, 'Deve agendar bloco SRS para topico vencido');
  assert.equal(srsSessions[0]?.date, '2026-11-13');

  const adaptiveBlocks = sessions.filter((s) => s.topicId === 't-new');
  assert.ok(adaptiveBlocks.length >= 1);
  assert.ok(adaptiveBlocks[0]!.minutes <= 35, 'Topico de baixa confianca deve usar bloco curto (<=35 min)');
});

test('isTopicReviewDue respeita nextReviewDate explicito', () => {
  const future: Topic = {
    id: 't3',
    title: 'Algebra Linear',
    status: 'review',
    confidence: 4,
    nextReviewDate: '2026-11-20',
  };
  assert.equal(isTopicReviewDue(future, '2026-11-13'), false);
  assert.equal(isTopicReviewDue(future, '2026-11-20'), true);
});

test('getUniCollectibleStates desbloqueia Uni Vermelho Coral com 3 recalls ativos', () => {
  const locked = getUniCollectibleStates({
    completedSessions: 1,
    totalRecalls: 1,
    streakDays: 1,
    checkInsCount: 0,
    mastered21dCount: 0,
  });
  const crimsonLocked = locked.find((i) => i.skin.id === 'crimson');
  assert.equal(crimsonLocked?.unlocked, false);

  const unlocked = getUniCollectibleStates({
    completedSessions: 3,
    totalRecalls: 3,
    streakDays: 1,
    checkInsCount: 0,
    mastered21dCount: 0,
  });
  const crimsonUnlocked = unlocked.find((i) => i.skin.id === 'crimson');
  assert.equal(crimsonUnlocked?.unlocked, true);
});

test('extractAcademicsFromGoogleCalendar deteta aulas recorrentes e exames', () => {
  const events: CalendarEvent[] = [
    {
      id: 'google:1',
      title: 'Cálculo I TP',
      start: '2026-11-02T09:00:00',
      end: '2026-11-02T10:30:00',
      source: 'google',
      location: 'Sala 1.4',
    },
    {
      id: 'google:2',
      title: 'Cálculo I TP',
      start: '2026-11-09T09:00:00',
      end: '2026-11-09T10:30:00',
      source: 'google',
      location: 'Sala 1.4',
    },
    {
      id: 'google:3',
      title: 'Frequência Cálculo I',
      start: '2026-11-24T14:00:00',
      end: '2026-11-24T16:00:00',
      source: 'google',
    },
  ];
  const res = extractAcademicsFromGoogleCalendar(events, []);
  assert.equal(res.classes.length, 1);
  assert.equal(res.classes[0]?.room, 'Sala 1.4');
  assert.equal(res.assessments.length, 1);
  assert.equal(res.assessments[0]?.kind, 'teste');
});

test('subjectLabel e groupConversations organizam conversas por cadeira e assunto', () => {
  assert.equal(subjectLabel('duvidas'), 'Dúvidas');
  assert.equal(subjectLabel(undefined), 'Geral');
  assert.equal(subjectLabel('Projeto'), 'Projeto');

  const groups = groupConversations(
    [
      {
        id: '1',
        title: 'Integrais por partes',
        courseId: 'c1',
        subject: 'duvidas',
        createdAt: '2026-11-10T10:00:00Z',
        updatedAt: '2026-11-10T10:00:00Z',
      },
      {
        id: '2',
        title: 'Modelo de exame',
        courseId: 'c1',
        subject: 'exame',
        createdAt: '2026-11-11T10:00:00Z',
        updatedAt: '2026-11-11T10:00:00Z',
      },
      {
        id: '3',
        title: 'Resumo capítulo 2',
        subject: 'resumos',
        createdAt: '2026-11-12T10:00:00Z',
        updatedAt: '2026-11-12T10:00:00Z',
      },
    ],
    [{ id: 'c1', name: 'Cálculo I', shortName: 'Calc I' }],
  );

  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.label, 'Calc I');
  assert.equal(groups[0]?.items.length, 2);
  assert.equal(groups[1]?.label, 'Assunto · Resumos');
});

test('buildInitialCompletedRecords suporta plano 2026/27 e varios anos simultaneos (LEMc + MEMc)', () => {
  const mixed = buildInitialCompletedRecords('nova-fct', 'lemc-memec', 4, 1, undefined, [2, 3, 4]);
  const active = mixed.filter((r) => r.status === 'a_fazer');

  assert.ok(active.some((r) => r.code === 'C3D' && r.year === 2), 'Inclui 2.º ano atual (Cálculo III D)');
  assert.ok(active.some((r) => r.code === 'MS2' && r.year === 3), 'Inclui 3.º ano atual (MS2)');
  assert.ok(active.some((r) => r.code === 'EME' && r.year === 4), 'Inclui 1.º Mestrado 2026/27 (EME)');
  assert.ok(active.some((r) => r.code === 'TEP' && r.year === 4), 'Inclui 1.º Mestrado atual (TEP)');
  assert.ok(
    mixed.some((r) => r.code === 'FEXP' && r.status === 'aprovada'),
    'Plano 2026/27 tem Física Experimental aprovada do 1.º ano',
  );
  assert.ok(
    mixed.some((r) => r.code === 'IPEIO' && r.year === 2 && r.semester === 2),
    'Plano 2026/27 inclui IPEIO no 2.º ano 2.º sem',
  );
  assert.ok(
    mixed.some((r) => r.code === 'OM' && r.year === 3 && r.semester === 2),
    'Plano 2026/27 inclui Órgãos de Máquinas no 3.º ano 2.º sem',
  );
  assert.ok(
    mixed.some((r) => r.code === 'TFI' && r.year === 4 && r.semester === 2),
    'Plano 2026/27 inclui Termofluidos Industrial no 1.º Mestrado 2.º sem',
  );

  // Cadeiras opcionais não devem ser marcadas como aprovadas nem ativas automaticamente
  const fabad = mixed.find((r) => r.code === 'FABAD');
  assert.equal(fabad?.isOptional, true);
  assert.equal(fabad?.status, 'por_fazer');

  assert.equal(formatAcademicYearLabel(4), '4.º Ano · 1.º Mestrado');
  assert.equal(formatAcademicYearLabel(5), '5.º Ano · 2.º Mestrado');
});

test('parseCurriculumFromText extrai cadeiras e opcoes do formato Guia UNL / CLIP', () => {
  const sample = [
    '1.º Semestre',
    '13493\tCálculo I D\t6.0',
    '13501\tFísica Experimental\t6.0',
    'Opções:',
    '14123\tFabrico Aditivo\t6.0',
  ].join('\n');

  const parsed = parseCurriculumFromText(sample, 1, 1);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0]?.name, 'Cálculo I D');
  assert.equal(parsed[0]?.year, 1);
  assert.equal(parsed[0]?.ects, 6);
  assert.equal(parsed[1]?.name, 'Física Experimental');
  assert.equal(parsed[2]?.name, 'Fabrico Aditivo');
  assert.equal(parsed[2]?.optional, true);
});

test('parseScheduleJsonText suporta grelha portuguesa (2a..6a), arrays e chaves alternativas', () => {
  const fromArray = parseScheduleJsonText(
    '```json\n[{"courseCode":"MdF","courseName":"Mecânica dos Fluidos","type":"l.1","weekday":"2ª","start":"11h00","room":"Ed 8: 3.09"},{"courseCode":"FabAd","type":"tp.1","weekday":"Seg","start":"9:00","end":"11:00"}]\n```',
  );
  assert.equal(fromArray.slots.length, 2);
  assert.equal(fromArray.slots[0]?.courseName, 'Mecânica dos Fluidos');
  assert.equal(fromArray.slots[0]?.type, 'P');
  assert.equal(fromArray.slots[0]?.weekday, 1);
  assert.equal(fromArray.slots[0]?.start, '11:00');
  assert.equal(fromArray.slots[0]?.end, '12:30');
  assert.equal(fromArray.slots[1]?.courseName, 'FabAd');
  assert.equal(fromArray.slots[1]?.type, 'TP');
  assert.equal(fromArray.slots[1]?.weekday, 1);
  assert.equal(fromArray.slots[1]?.start, '09:00');

  const fromWrapper = parseScheduleJsonText(
    JSON.stringify({
      aulas: [
        { disciplina: 'C3 D', sigla: 'C3 D', tipo: 't.2', dia: '3ª', inicio: '10:30', fim: '12:00' },
      ],
    }),
  );
  assert.equal(fromWrapper.slots.length, 1);
  assert.equal(fromWrapper.slots[0]?.weekday, 2);
  assert.equal(fromWrapper.slots[0]?.type, 'T');

  const courses = parseHistoryJsonText(
    JSON.stringify({
      courses: [
        { name: 'Fabrico Aditivo', status: 'a_fazer' },
        { name: 'Cálculo I D', grade: '14,5', ects: '6' },
      ],
    }),
  );
  assert.equal(courses.length, 2);
  assert.equal(courses[0]?.status, 'a_fazer');
  assert.equal(courses[1]?.grade, 14.5);
  assert.equal(courses[1]?.status, 'aprovada');
});

test('inferAcademicStageFromEcts interpreta metas 180, 120 e 300 ECTS corretamente', () => {
  const lic = inferAcademicStageFromEcts(90, 180);
  assert.equal(lic.estimatedYear, 2);
  assert.equal(lic.recommendedCycle, 'licenciatura');
  assert.equal(lic.progressPct, 50);

  const misto = inferAcademicStageFromEcts(156, 300);
  assert.equal(misto.estimatedYear, 3);
  assert.equal(misto.recommendedCycle, 'misto');

  const mest = inferAcademicStageFromEcts(195, 300);
  assert.equal(mest.estimatedYear, 4);
  assert.equal(mest.recommendedCycle, 'mestrado');

  const isolatedMest = inferAcademicStageFromEcts(72, 120);
  assert.equal(isolatedMest.estimatedYear, 5);
  assert.equal(isolatedMest.recommendedCycle, 'mestrado');
});

test('computeExtraActivityPenaltyByWeekday e generatePlan reduzem carga em dias de atividade extra', () => {
  const penalties = computeExtraActivityPenaltyByWeekday([
    {
      id: 'ext1',
      label: 'Part-time',
      kind: 'trabalho',
      hoursPerWeek: 6,
      weekdays: [1, 3], // Seg e Qua (~180 min/dia)
    },
  ]);
  assert.equal(penalties.get(1), 180);
  assert.equal(penalties.get(3), 180);
  assert.equal(penalties.get(2) ?? 0, 0);

  const course: Course = {
    id: 'c1',
    code: 'MEC',
    name: 'Mecanica',
    shortName: 'Mec',
    ects: 6,
    color: 'emerald',
    targetGrade: 14,
    topics: [
      { id: 't1', title: 'Estatica', status: 'todo', confidence: 2 },
      { id: 't2', title: 'Dinamica', status: 'todo', confidence: 2 },
      { id: 't3', title: 'Energia', status: 'todo', confidence: 2 },
    ],
  };

  // 2026-11-16 é Segunda-feira (weekday=1), 2026-11-17 é Terça-feira (weekday=2)
  const sessions = generatePlan({
    courses: [course],
    assessments: [
      {
        id: 'a1',
        courseId: 'c1',
        kind: 'teste',
        title: 'Teste 1',
        date: '2026-11-28T10:00:00',
        weight: 50,
        topicIds: ['t1', 't2', 't3'],
        source: 'local',
      },
    ],
    classes: [],
    events: [],
    settings: { ...defaultSettings, dailyStudyMinutes: 180, studyDays: [1, 2] },
    from: '2026-11-16',
    days: 2,
    extraActivities: [
      { id: 'ext1', label: 'Part-time', kind: 'trabalho', hoursPerWeek: 6, weekdays: [1] },
    ],
  });

  const monMinutes = sessions
    .filter((s) => s.date === '2026-11-16')
    .reduce((sum, s) => sum + s.minutes, 0);
  const tueMinutes = sessions
    .filter((s) => s.date === '2026-11-17')
    .reduce((sum, s) => sum + s.minutes, 0);

  assert.ok(monMinutes < tueMinutes, 'Segunda com atividade extra deve ter menos carga que Terca livre');
});

test('uniPetEngine respeita modo serio, off e interacoes discretas', () => {
  const telemetry = {
    completedSessions: 8,
    totalRecalls: 6,
    streakDays: 4,
    checkInsCount: 2,
    mastered21dCount: 1,
  };

  assert.deepEqual(
    resolveVisibleUniPeers({ activeSkin: 'classic', telemetry, mode: 'all', appTone: 'serio' }),
    [],
  );
  assert.deepEqual(
    resolveVisibleUniPeers({ activeSkin: 'classic', telemetry, mode: 'off', appTone: 'vibrante' }),
    [],
  );
  assert.deepEqual(
    resolveVisibleUniPeers({ activeSkin: 'classic', telemetry, mode: 'solo', appTone: 'vibrante' }),
    ['classic'],
  );

  const peers = resolveVisibleUniPeers({
    activeSkin: 'classic',
    telemetry,
    mode: 'all',
    appTone: 'vibrante',
    tickSeed: 1,
  });
  assert.equal(peers.length, 2);
  assert.equal(pickNextShyBehavior({ hasPeer: true, stepCount: 3, isFocusActive: true }), 'shy_hide');
  assert.equal(pickNextShyBehavior({ hasPeer: true, stepCount: 3, isFocusActive: false }), 'quiet_meetup');
});

test('findMatchingCourseRecordIndex reconhece siglas com espacos/capitalizacao e protege algarismos romanos', () => {
  const templates = [
    {
      code: 'C3D',
      name: 'Cálculo III D',
      shortName: 'C3D',
      year: 2 as const,
      semester: 1 as const,
      ects: 6,
      topics: [],
    },
    {
      code: 'MDF',
      name: 'Mecânica dos Fluidos',
      shortName: 'MdF',
      year: 4 as const,
      semester: 1 as const,
      ects: 6,
      topics: [],
    },
    {
      code: 'FISI',
      name: 'Física I',
      shortName: 'Fís I',
      year: 1 as const,
      semester: 1 as const,
      ects: 6,
      topics: [],
    },
    {
      code: 'FISII',
      name: 'Física II',
      shortName: 'Fís II',
      year: 1 as const,
      semester: 2 as const,
      ects: 6,
      topics: [],
    },
  ];
  const records = templates.map((t, i) => ({
    id: `r-${i}`,
    code: t.code,
    name: t.name,
    year: t.year,
    semester: t.semester,
    ects: t.ects,
    status: 'por_fazer' as const,
  }));

  assert.equal(
    findMatchingCourseRecordIndex(records, { code: 'C3 D', name: 'Cálculo III D' }, templates),
    0,
  );
  assert.equal(
    findMatchingCourseRecordIndex(records, { code: 'MdF', name: 'Mecanica de Fluidos' }, templates),
    1,
  );
  assert.equal(
    findMatchingCourseRecordIndex(records, { code: 'FIS II', name: 'Física II' }, templates),
    3,
  );
  assert.equal(
    findMatchingCourseRecordIndex(records, { name: 'Física I' }, templates),
    0 + 2,
  );
});

test('applyImportedScheduleRecords substitui sugestoes por apenas as cadeiras do horario partilhado e preserva aprovadas', () => {
  const initial = buildInitialCompletedRecords('nova-fct', 'lemc-memec', 4, 1, undefined, [2, 3, 4]);
  const initialActive = initial.filter((r) => r.status === 'a_fazer');
  const initialApproved = initial.filter((r) => r.status === 'aprovada');
  assert.ok(initialActive.length >= 10, 'Misto [2,3,4] arranca com várias cadeiras ativas sugeridas');

  const templates = getUniversityById('nova-fct')?.degrees.find((d) => d.id === 'lemc-memec')?.courses ?? [];

  const updated = applyImportedScheduleRecords(
    initial,
    [
      { code: 'C3 D', name: 'Cálculo III D', status: 'a_fazer' },
      { code: 'CMAT', name: 'Ciência dos Materiais', status: 'a_fazer' },
      { code: 'MS2', name: 'Mecânica dos Sólidos II', status: 'a_fazer' },
      { code: 'TFS', name: 'Tecnologias de Fundição e Soldadura', status: 'a_fazer' },
      { code: 'MdF', name: 'Mecânica dos Fluidos', status: 'a_fazer' },
      { code: 'FabAd', name: 'Fabrico Aditivo', status: 'a_fazer' },
    ],
    {
      primaryAcademicYear: 4,
      currentSemester: 1,
      defaultEcts: 6,
      templates,
      replaceActiveScope: true,
    },
  );

  const activeAfter = updated.filter((r) => r.status === 'a_fazer');
  const approvedAfter = updated.filter((r) => r.status === 'aprovada');

  assert.equal(activeAfter.length, 6, 'Deve manter estritamente as 6 cadeiras do horário');
  assert.equal(approvedAfter.length, initialApproved.length, 'Cadeiras já aprovadas permanecem aprovadas');

  // Upload exclusivo de pauta (só aprovadas) não deve apagar as cadeiras ativas atuais
  const afterTranscript = applyImportedScheduleRecords(
    updated,
    [{ code: 'CAL1', name: 'Cálculo I D', status: 'aprovada', grade: 15 }],
    {
      primaryAcademicYear: 4,
      currentSemester: 1,
      defaultEcts: 6,
      templates,
      replaceActiveScope: false,
    },
  );
  assert.equal(afterTranscript.filter((r) => r.status === 'a_fazer').length, 6);
});

test('applyImportedScheduleRecords separa 2.º Semestre do 1.º Semestre, dedup sem/com sigla (SNTI/FabAd) e suporta opcionais nos 2 anos de Mestrado', () => {
  const rawClipJson = JSON.stringify([
    { name: 'Cálculo III D', semester: '1º Semestre', status: 'a_fazer' },
    { name: 'Fabrico Aditivo', semester: '1º Semestre', status: 'a_fazer' },
    { name: 'Mecânica dos Fluidos', semester: '1º Semestre', status: 'a_fazer' },
    { name: 'Mecânica dos Sólidos II', semester: '1º Semestre', status: 'a_fazer' },
    { name: 'Sociologia das Novas Tecnologias de Informação', semester: '1º Semestre', status: 'a_fazer' },
    { name: 'Tecnologias de Enformação Plástica', semester: '1º Semestre', status: 'a_fazer' },
    { name: 'Energia na Sociedade Tecnológica', semester: '2º Semestre', status: 'a_fazer' },
    { name: 'Materiais Compósitos Estruturais', semester: '2º Semestre', status: 'a_fazer' },
    { name: 'Projeto de Fadiga de Ligações Mecânicas e Estruturas Aeroespaciais', semester: '2º Semestre', status: 'a_fazer' },
    { name: 'Teoria e Metodologias de Projeto', semester: '2º Semestre', status: 'a_fazer' },
    { name: 'Termofluidos Industrial', semester: '2º Semestre', status: 'a_fazer' },
    { name: 'Empreendedorismo', semester: '2º Trimestre', status: 'a_fazer' },
  ]);

  const parsedItems = parseHistoryJsonText(rawClipJson);
  assert.equal(parsedItems.filter((i) => i.semester === 1).length, 6);
  assert.equal(parsedItems.filter((i) => i.semester === 2).length, 6);

  const initial = buildInitialCompletedRecords('nova-fct', 'lemc-memec', 4, 1, undefined, [2, 3, 4]);
  const templates = getUniversityById('nova-fct')?.degrees.find((d) => d.id === 'lemc-memec')?.courses ?? [];

  // Passo 1: importa lista de Unidades Curriculares (sem siglas) + depois slots do horário (com siglas SNTI / FabAd)
  const afterClipAndSlots = applyImportedScheduleRecords(
    initial,
    [
      ...parsedItems.map((p) => ({
        code: p.code,
        name: p.name,
        ects: p.ects,
        semester: p.semester,
        status: p.status,
        grade: p.grade,
      })),
      { code: 'SNTI', name: 'SNTI', semester: 1 as const, status: 'a_fazer' as const },
      { code: 'FabAd', name: 'FabAd', semester: 1 as const, status: 'a_fazer' as const },
      { code: 'C3 D', name: 'C3 D', semester: 1 as const, status: 'a_fazer' as const },
    ],
    {
      primaryAcademicYear: 4,
      activeYears: [2, 3, 4],
      currentSemester: 1,
      defaultEcts: 6,
      templates,
      replaceActiveScope: true,
    },
  );

  const active = afterClipAndSlots.filter((r) => r.status === 'a_fazer');
  assert.equal(
    active.length,
    6,
    `Apenas as 6 cadeiras do 1.º Semestre devem ficar ativas: ${JSON.stringify(active.map((r) => [r.code, r.name]))}`,
  );

  // SNTI não pode duplicar com/sem sigla e deve preservar nome completo + sigla SNTI
  const sntiMatches = afterClipAndSlots.filter((r) => r.name.includes('Sociologia'));
  assert.equal(sntiMatches.length, 1);
  assert.equal(sntiMatches[0]!.code, 'SNTI');

  // Fabrico Aditivo não pode duplicar entre nome completo e sigla FabAd
  const fabMatches = afterClipAndSlots.filter((r) => /Fabrico Aditivo|FabAd/i.test(r.name));
  assert.equal(fabMatches.length, 1);
  assert.equal(fabMatches[0]!.code, 'FABAD');

  // Nenhuma cadeira do 2.º Semestre pode estar ativa no 1.º Semestre
  assert.equal(
    active.some((r) => /Energia na Sociedade|Compósitos|Fadiga|Termofluidos/i.test(r.name)),
    false,
  );
  // Mecânica dos Fluidos importada no 1.º Semestre deve mostrar 1.º Sem
  const mdf = active.find((r) => r.code === 'MDF');
  assert.equal(mdf?.semester, 1);

  // Ordem inversa: slot com sigla primeiro, nome completo depois também não duplica em matchCourse nem em applyImportedScheduleRecords
  const slotFirst = applyImportedScheduleRecords(
    [],
    [
      { code: 'SNTI', name: 'SNTI', semester: 1, status: 'a_fazer' },
      { name: 'Sociologia das Novas Tecnologias de Informação', semester: 1, status: 'a_fazer' },
    ],
    { primaryAcademicYear: 4, activeYears: [4], currentSemester: 1, templates, replaceActiveScope: true },
  );
  assert.equal(slotFirst.length, 1);
  assert.equal(slotFirst[0]!.code, 'SNTI');
  assert.equal(slotFirst[0]!.name, 'Sociologia das Novas Tecnologias de Informação');

  assert.ok(
    matchCourse('SNTI', [
      { id: 'c1', code: 'SDN', shortName: 'SDN', name: 'Sociologia das Novas Tecnologias de Informação', ects: 6, color: 'sky', targetGrade: 14, topics: [] },
    ]),
    'matchCourse deve ligar sigla SNTI ao nome completo sem duplicar',
  );

  // Opcionais de Mestrado elegíveis em 4.º e 5.º Ano (2.º Mest.) não duplicam e alinham ano quando aluno está no 2.º Mest.
  const fabRecs = initial.filter((r) => r.code === 'FABAD');
  assert.equal(fabRecs.length, 1);
  assert.deepEqual(fabRecs[0]!.eligibleYears, [4, 5]);

  const master2Only = buildInitialCompletedRecords('nova-fct', 'lemc-memec', 5, 1, undefined, [5]);
  const alignedMaster2 = applyImportedScheduleRecords(
    master2Only,
    [{ code: 'FabAd', name: 'Fabrico Aditivo', semester: 1, status: 'a_fazer' }],
    { primaryAcademicYear: 5, activeYears: [5], currentSemester: 1, templates, replaceActiveScope: true },
  );
  const fabMaster2 = alignedMaster2.find((r) => r.code === 'FABAD');
  assert.equal(fabMaster2?.status, 'a_fazer');
  assert.equal(fabMaster2?.year, 5);
});

test('inferHubProfile, getHubProgress e normalizacao de links cobrem os 4 fluxos pos-onboarding', () => {
  const baseCourse: Course = {
    id: 'c1',
    code: 'AM1',
    name: 'Análise Matemática I',
    shortName: 'AM1',
    ects: 6,
    color: 'emerald',
    targetGrade: 14,
    topics: [{ id: 't1', title: 'Limites', status: 'todo', confidence: 2 }],
  };
  const baseSettings = defaultSettings;
  const freshmanProfile: AcademicProfile = {
    universityId: 'nova-fct',
    degreeId: 'lemc',
    degreeName: 'LEMc',
    currentAcademicYear: 1,
    currentSemester: 1,
    completedCourses: [],
    difficultCourseIds: [],
    onboardingCompleted: true,
    completedEcts: 0,
    activeYears: [1],
  };
  const veteranProfile: AcademicProfile = {
    ...freshmanProfile,
    currentAcademicYear: 3,
    completedEcts: 120,
    activeYears: [3],
  };

  // 1) Caloiro início de semestre: sem horário, sem provas, sem docs/drives
  const f1 = inferHubProfile({
    academicProfile: freshmanProfile,
    courses: [baseCourse],
    classes: [],
    assessments: [],
    materials: [],
    sessions: [],
    settings: baseSettings,
  });
  assert.equal(f1.recommendedFlow, 'caloiro_inicio');

  // 2) Caloiro a meio do semestre: já tem horário ou provas, ainda sem materiais
  const sampleClass: ClassSlot = {
    id: 'cl1',
    courseId: 'c1',
    type: 'T',
    weekday: 1,
    start: '09:00',
    end: '10:30',
  };
  const f2 = inferHubProfile({
    academicProfile: freshmanProfile,
    courses: [baseCourse],
    classes: [sampleClass],
    assessments: [],
    materials: [],
    sessions: [],
    settings: baseSettings,
  });
  assert.equal(f2.recommendedFlow, 'caloiro_meio');

  // 3) Veterano início de semestre: tem Drive/HD/Gemini Notebook, ainda sem horário nem provas
  const sampleMat: Material = {
    id: 'm1',
    courseId: 'c1',
    title: 'Sebenta Drive',
    kind: 'pdf',
    category: 'sebenta',
    provider: 'gdrive',
    url: 'https://drive.google.com/file/d/abc/view',
    addedAt: '2026-09-10T10:00:00Z',
  };
  const f3 = inferHubProfile({
    academicProfile: veteranProfile,
    courses: [baseCourse],
    classes: [],
    assessments: [],
    materials: [sampleMat],
    sessions: [],
    settings: { ...baseSettings, personalNotebookUrl: 'https://notebooklm.google.com/notebook/123' },
  });
  assert.equal(f3.recommendedFlow, 'veterano_inicio');

  // 4) Veterano a meio do semestre: tem cronograma + materiais
  const sampleExam: Assessment = {
    id: 'a1',
    courseId: 'c1',
    kind: 'teste',
    title: '1.º Teste',
    date: '2026-12-01T10:00:00',
    weight: 40,
    topicIds: [],
    source: 'local',
  };
  const f4 = inferHubProfile({
    academicProfile: veteranProfile,
    courses: [baseCourse],
    classes: [sampleClass],
    assessments: [sampleExam],
    materials: [sampleMat],
    sessions: [],
    settings: { ...baseSettings, personalNotebookUrl: 'https://notebooklm.google.com/notebook/123' },
  });
  assert.equal(f4.recommendedFlow, 'veterano_meio');

  const progress = getHubProgress({
    academicProfile: veteranProfile,
    courses: [baseCourse],
    classes: [sampleClass],
    assessments: [sampleExam],
    materials: [sampleMat],
    sessions: [],
    settings: { ...baseSettings, personalNotebookUrl: 'https://notebooklm.google.com/notebook/123' },
  });
  assert.equal(progress.readyCount, 4);
  assert.equal(progress.allReady, true);
  assert.equal(progress.steps.find((s) => s.key === 'schedule')?.ready, true);
  assert.equal(progress.steps.find((s) => s.key === 'assessments')?.ready, true);
  assert.equal(progress.steps.find((s) => s.key === 'drive_hd')?.ready, true);
  assert.equal(progress.steps.find((s) => s.key === 'notebook')?.ready, true);

  // Normalização de URLs seguras
  assert.equal(
    normalizeSharedDriveUrl('drive.google.com/drive/folders/1abcXYZ?usp=sharing'),
    'https://drive.google.com/drive/folders/1abcXYZ?usp=sharing',
  );
  assert.equal(normalizeSharedDriveUrl('https://evil.example.com/folder'), null);
  assert.equal(normalizeSafeHubUrl('javascript:alert(1)'), null);
  assert.equal(
    normalizeSafeHubUrl('notebooklm.google.com/notebook/xyz'),
    'https://notebooklm.google.com/notebook/xyz',
  );
});

test('generatePlan entra em Modo Arranque de Semestre quando ha cadeiras sem avaliacoes pendentes', () => {
  const courses: Course[] = [
    {
      id: 'c1',
      code: 'MDF',
      name: 'Mecânica dos Fluidos',
      shortName: 'MDF',
      ects: 6,
      color: 'sky',
      targetGrade: 14,
      topics: [
        { id: 't1', title: 'Estática dos Fluidos', status: 'todo', confidence: 2 },
        { id: 't2', title: 'Equação de Bernoulli', status: 'todo', confidence: 2 },
      ],
    },
    {
      id: 'c2',
      code: 'C3D',
      name: 'Cálculo III D',
      shortName: 'C3D',
      ects: 6,
      color: 'emerald',
      targetGrade: 15,
      topics: [{ id: 't3', title: 'Equações Diferenciais', status: 'todo', confidence: 2 }],
    },
  ];

  const sessions = generatePlan({
    courses,
    assessments: [],
    classes: [],
    events: [],
    settings: defaultSettings,
    from: '2026-11-14',
    days: 14,
    existing: [],
    difficultCourseIds: ['c1'],
  });

  assert.ok(sessions.length >= 6, `Esperava varias sessoes no Modo Arranque, obteve ${sessions.length}`);
  assert.ok(sessions.some((s) => s.courseId === 'c1'));
  assert.ok(sessions.some((s) => s.courseId === 'c2'));
  assert.ok(sessions.every((s) => s.minutes >= 30 && s.minutes <= 60));
  assert.ok(sessions.every((s) => s.notes?.includes('Arranque contínuo')));
});
