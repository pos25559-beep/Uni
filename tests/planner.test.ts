import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeExtraActivityPenaltyByWeekday,
  inferAcademicStageFromEcts,
} from '../src/lib/academicCredits';
import { parseCurriculumFromText } from '../src/lib/curriculumParser';
import { extractAcademicsFromGoogleCalendar } from '../src/integrations/gcal';
import { groupConversations, subjectLabel } from '../src/lib/geminiConversations';
import { generatePlan } from '../src/lib/planner';
import {
  buildInitialCompletedRecords,
  formatAcademicYearLabel,
} from '../src/lib/portugalCurriculum';
import { defaultSettings } from '../src/lib/seed';
import { computeNextSrsState, isTopicReviewDue } from '../src/lib/spacedRepetition';
import { getUniCollectibleStates } from '../src/lib/uniCollectibles';
import { pickNextShyBehavior, resolveVisibleUniPeers } from '../src/lib/uniPetEngine';
import { parseHistoryJsonText, parseScheduleJsonText } from '../src/lib/visionParsers';
import type { CalendarEvent, Course, Topic } from '../src/types';

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
