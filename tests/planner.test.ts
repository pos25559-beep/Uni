import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeExtraActivityPenaltyByWeekday,
  inferAcademicStageFromEcts,
} from '../src/lib/academicCredits';
import { parseCurriculumFromText } from '../src/lib/curriculumParser';
import { matchCourse } from '../src/integrations/clip';
import { extractAcademicsFromGoogleCalendar } from '../src/integrations/gcal';
import { buildIcsCalendar } from '../src/integrations/ics';
import { isLikelyAcademicDriveFolderName, traverseDriveFoldersBfs, type CloudFile } from '../src/integrations/drive';
import {
  getAcademicEntryCutoffMs,
  isPreEntryDriveFile,
  parseFilenameToParsedItem,
} from '../src/lib/courseAliases';
import katex from 'katex';
import {
  extractGoogleDriveFileId,
  getAiMaterialLimit,
  isFileUriCacheValid,
} from '../src/lib/materialContent';
import { sanitizeMaterials } from '../src/lib/storeMigration';
import { filterMaterialsForCourse } from '../src/lib/courseMaterials';
import {
  clearAcademicEmailsCache,
  loadPersistedAcademicEmails,
  persistAcademicEmails,
  type AcademicEmail,
} from '../src/integrations/gmail';
import { groupConversations, subjectLabel } from '../src/lib/geminiConversations';
import { flattenMarkdownMathForText, formatInlineLatexToText } from '../src/lib/latexText';
import { CustomKeyError, HttpStatusError, friendlyCustomKeyError } from '../src/lib/geminiErrors';
import { sanitizePdfWinAnsi } from '../src/lib/pdfExport';
import { generatePlan, analyzeTestMode, rescheduleOverdueSessions } from '../src/lib/planner';
import { capitalizeFirst, parsePtGrade, sessionMinutes } from '../src/lib/selectors';
import {
  applyImportedScheduleRecords,
  buildInitialCompletedRecords,
  collectKnownCourseCandidates,
  findMatchingCourseRecordIndex,
  formatAcademicYearLabel,
  getUniversityById,
  resolveKnownCourseIdentity,
} from '../src/lib/portugalCurriculum';
import { defaultSettings } from '../src/lib/seed';
import {
  buildSemesterSharePayload,
  decodeSemesterSharePayload,
  encodeSemesterSharePayload,
  planSharedSemesterImport,
} from '../src/lib/semesterShare';
import { computeNextSrsState, isTopicReviewDue } from '../src/lib/spacedRepetition';
import { buildStudyContext } from '../src/integrations/gemini';
import {
  extractUniCheckInSyncBlock,
  parseConversationalCheckIn,
} from '../src/lib/uniCheckInNlu';
import {
  DEFAULT_NOTIFICATION_PREFS,
  clampOutOfQuietHours,
  isWithinQuietHours,
  pickActiveInAppNudge,
  planSmartNotifications,
} from '../src/lib/uniNotifications';
import {
  getHubProgress,
  inferHubProfile,
  normalizeSafeHubUrl,
  normalizeSharedDriveUrl,
} from '../src/lib/studyHub';
import {
  UNI_PETS,
  UNI_SKINS,
  computeUniCompanionState,
  getUniCollectibleStates,
  getUniPetStates,
} from '../src/lib/uniCollectibles';
import {
  pickNextNomadPlacement,
  pickNextShyBehavior,
  resolveVisibleUniPeers,
} from '../src/lib/uniPetEngine';
import {
  extractUniSyncBlock,
  looksSyncableReply,
  normalizeAssessmentIsoDate,
  parseHistoryJsonText,
  parseScheduleJsonText,
} from '../src/lib/visionParsers';
import type {
  AcademicProfile,
  Assessment,
  CalendarEvent,
  ClassSlot,
  Course,
  Material,
  StudyLogEntry,
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

test('parsePtGrade, capitalizeFirst e sessionMinutes respeitam regras PT e sessoes parciais', () => {
  assert.equal(parsePtGrade(''), null);
  assert.equal(parsePtGrade('   '), null);
  assert.equal(parsePtGrade('14,5'), 14.5);
  assert.equal(parsePtGrade('16.25'), 16.25);
  assert.equal(parsePtGrade('20'), 20);
  assert.equal(parsePtGrade('21'), 'invalid');
  assert.equal(parsePtGrade('-1'), 'invalid');
  assert.equal(parsePtGrade('abc'), 'invalid');

  assert.equal(capitalizeFirst('sábado, 14 de novembro'), 'Sábado, 14 de novembro');
  assert.equal(capitalizeFirst(''), '');

  assert.equal(
    sessionMinutes({
      id: 's1',
      courseId: 'c1',
      date: '2026-11-14',
      minutes: 45,
      done: true,
      actualMinutes: 20,
      generated: true,
    }),
    20,
  );
  assert.equal(
    sessionMinutes({
      id: 's2',
      courseId: 'c1',
      date: '2026-11-14',
      minutes: 45,
      done: true,
      generated: true,
    }),
    45,
  );
});

test('generatePlan com nowMinutes nunca agenda no passado nem após as 22:30 e evita colisões', () => {
  const courses: Course[] = [
    {
      id: 'c1',
      code: 'C1',
      name: 'Álgebra',
      shortName: 'Álg',
      ects: 6,
      color: 'sky',
      targetGrade: 14,
      topics: [
        { id: 't1', title: 'Matrizes', status: 'todo', confidence: 2 },
        { id: 't2', title: 'Determinantes', status: 'todo', confidence: 2 },
      ],
    },
  ];
  const assessments: Assessment[] = [
    {
      id: 'a1',
      courseId: 'c1',
      kind: 'teste',
      title: 'Teste Álgebra',
      date: '2026-11-17T14:00:00',
      weight: 40,
      topicIds: ['t1', 't2'],
      source: 'local',
    },
  ];

  const eveningSessions = generatePlan({
    courses,
    assessments,
    classes: [],
    events: [],
    settings: { ...defaultSettings, studyDays: [0, 1, 2, 3, 4, 5, 6], dailyStudyMinutes: 90 },
    from: '2026-11-14',
    days: 3,
    existing: [],
    nowMinutes: 22 * 60 + 35,
  });
  assert.equal(
    eveningSessions.filter((s) => s.date === '2026-11-14').length,
    0,
    'Após as 22:30 não deve agendar sessões para hoje',
  );

  const daySessions = generatePlan({
    courses,
    assessments,
    classes: [
      { id: 'cl1', courseId: 'c1', type: 'T', weekday: 6, start: '14:00', end: '16:00', source: 'local' },
    ],
    events: [],
    settings: { ...defaultSettings, studyDays: [0, 1, 2, 3, 4, 5, 6], dailyStudyMinutes: 90 },
    from: '2026-11-14', // sábado = weekday 6
    days: 2,
    existing: [
      {
        id: 'manual1',
        courseId: 'c1',
        date: '2026-11-14',
        start: '16:15',
        minutes: 60,
        done: false,
        generated: false,
      },
    ],
    nowMinutes: 13 * 60 + 30,
  });

  const todayPlanned = daySessions.filter((s) => s.date === '2026-11-14');
  for (const s of todayPlanned) {
    assert.ok(s.start, 'Sessão deve ter hora de início');
    const [hh, mm] = s.start.split(':').map(Number);
    const startMin = hh * 60 + mm;
    assert.ok(startMin >= 13 * 60 + 30, `Sessão ${s.start} não pode estar no passado`);
    const endMin = startMin + s.minutes;
    const overlapsClass = startMin < 16 * 60 && endMin > 14 * 60;
    const overlapsManual = startMin < 17 * 60 + 15 && endMin > 16 * 60 + 15;
    assert.equal(overlapsClass, false, `Sessão ${s.start} colidiu com aula`);
    assert.equal(overlapsManual, false, `Sessão ${s.start} colidiu com sessão manual`);
  }
});

test('generatePlan respeita hora da prova no proprio dia e modo de teste progressivo', () => {
  const courses: Course[] = [
    {
      id: 'c1',
      code: 'C1',
      name: 'Termodinâmica',
      shortName: 'Termo',
      ects: 6,
      color: 'amber',
      targetGrade: 14,
      topics: [{ id: 't1', title: 'Entropia', status: 'learning', confidence: 2 }],
    },
    {
      id: 'c2',
      code: 'C2',
      name: 'Redes',
      shortName: 'Redes',
      ects: 6,
      color: 'cyan',
      targetGrade: 15,
      topics: [
        {
          id: 't2',
          title: 'TCP/IP',
          status: 'review',
          confidence: 3,
          lastStudied: '2026-11-10',
          nextReviewDate: '2026-11-14',
        },
      ],
    },
  ];

  // Prova a 5 dias -> foco não estrito (reserva espaço para SRS/outras cadeiras)
  const earlyMode = analyzeTestMode(
    courses,
    [
      {
        id: 'a1',
        courseId: 'c1',
        kind: 'teste',
        title: 'Teste Termo',
        date: '2026-11-19T14:00:00',
        weight: 40,
        topicIds: ['t1'],
        source: 'local',
      },
    ],
    '2026-11-14',
  );
  assert.equal(earlyMode.mode, 'single_test');
  assert.equal(earlyMode.urgentAssessments[0]?.daysLeft, 5);

  const farPlan = generatePlan({
    courses,
    assessments: [
      {
        id: 'a1',
        courseId: 'c1',
        kind: 'teste',
        title: 'Teste Termo',
        date: '2026-11-19T14:00:00',
        weight: 40,
        topicIds: ['t1'],
        source: 'local',
      },
    ],
    classes: [],
    events: [],
    settings: { ...defaultSettings, studyDays: [0, 1, 2, 3, 4, 5, 6], dailyStudyMinutes: 120 },
    from: '2026-11-14',
    days: 2,
    existing: [],
  });
  assert.ok(farPlan.some((s) => s.courseId === 'c2'), 'Deve reservar espaço para SRS/outra cadeira quando falta > 3 dias');

  // Prova a 1 dia -> foco estrito na prova urgente (strictSingleTestMode)
  const nearPlan = generatePlan({
    courses,
    assessments: [
      {
        id: 'a1',
        courseId: 'c1',
        kind: 'teste',
        title: 'Teste Termo',
        date: '2026-11-15T14:00:00',
        weight: 40,
        topicIds: ['t1'],
        source: 'local',
      },
    ],
    classes: [],
    events: [],
    settings: { ...defaultSettings, studyDays: [0, 1, 2, 3, 4, 5, 6], dailyStudyMinutes: 120 },
    from: '2026-11-14',
    days: 1,
    existing: [],
  });
  assert.ok(nearPlan.length > 0 && nearPlan.every((s) => s.courseId === 'c1'), 'Quando falta <= 2 dias, concentra 100% na cadeira da prova');

  // Prova no próprio dia às 14:00 com nowMinutes = 14:30 -> não deve agendar depois da prova
  const examPassed = generatePlan({
    courses,
    assessments: [
      {
        id: 'a1',
        courseId: 'c1',
        kind: 'teste',
        title: 'Teste Termo',
        date: '2026-11-14T14:00:00',
        weight: 40,
        topicIds: ['t1'],
        source: 'local',
      },
    ],
    classes: [],
    events: [],
    settings: { ...defaultSettings, studyDays: [0, 1, 2, 3, 4, 5, 6], dailyStudyMinutes: 90 },
    from: '2026-11-14',
    days: 1,
    existing: [],
    nowMinutes: 14 * 60 + 30,
  });
  assert.equal(
    examPassed.filter((s) => s.assessmentId === 'a1').length,
    0,
    'Não deve agendar estudo para uma prova cuja hora já passou',
  );
});

test('resolveKnownCourseIdentity e matchCourse corrigem siglas expandidas erradamente contra cadeiras reais', () => {
  const realCourses: Course[] = [
    {
      id: 'c-mdf',
      code: 'MDF',
      name: 'Mecânica dos Fluidos',
      shortName: 'MdF',
      ects: 6,
      color: 'emerald',
      targetGrade: 14,
      topics: [],
    },
    {
      id: 'c-snti',
      code: 'SDN',
      name: 'Sociologia das Novas Tecnologias de Informação',
      shortName: 'SDN',
      ects: 6,
      color: 'sky',
      targetGrade: 14,
      topics: [],
    },
    {
      id: 'c-fabad',
      code: 'FABAD',
      name: 'Fabrico Aditivo',
      shortName: 'Fab. Aditivo',
      ects: 6,
      color: 'amber',
      targetGrade: 14,
      topics: [],
    },
  ];

  const known = collectKnownCourseCandidates({ courses: realCourses });

  const resolvedMdf = resolveKnownCourseIdentity(
    { code: 'MdF', name: 'Matemática discreta e Fundamentos' },
    known,
  );
  assert.equal(resolvedMdf?.name, 'Mecânica dos Fluidos');

  const resolvedSnti = resolveKnownCourseIdentity(
    { code: 'SNTI', name: 'Segurança nas Novas Tecnologias de Informação' },
    known,
  );
  assert.equal(resolvedSnti?.name, 'Sociologia das Novas Tecnologias de Informação');

  const resolvedFab = resolveKnownCourseIdentity(
    { code: 'FabAd', name: 'Fabricação Aditiva' },
    known,
  );
  assert.equal(resolvedFab?.name, 'Fabrico Aditivo');

  const matchedSnti = matchCourse('Segurança nas Novas Tecnologias de Informação', realCourses, 'SNTI');
  assert.equal(matchedSnti?.id, 'c-snti');
});

test('parseScheduleJsonText impede falso Sábado em colunas "6ª" sem coluna de Sábado e preserva Sábado explícito', () => {
  const noSat = parseScheduleJsonText(
    JSON.stringify({
      hasSaturdayColumn: false,
      slots: [
        { courseCode: 'MS2', type: 'P', dayHeader: '6ª', weekday: 6, start: '10:00', end: '12:00' },
        { courseCode: 'C3 D', type: 'TP', dayHeader: 'Sexta', weekday: 6, start: '14:00', end: '16:00' },
      ],
    }),
  );
  assert.equal(noSat.slots.length, 2);
  assert.equal(noSat.slots[0]?.weekday, 5, '"6ª" deve mapear para Sexta (5)');
  assert.equal(noSat.slots[1]?.weekday, 5, 'weekday 6 sem coluna de Sábado deve voltar a Sexta (5)');

  const withSat = parseScheduleJsonText(
    JSON.stringify({
      hasSaturdayColumn: true,
      slots: [
        { courseCode: 'Lab', type: 'P', dayHeader: 'Sáb', weekday: 6, start: '09:00', end: '11:00' },
      ],
    }),
  );
  assert.equal(withSat.slots[0]?.weekday, 6, 'Sábado explícito mantém weekday 6');
});

test('extractUniSyncBlock oculta bloco durante streaming e extrai avaliações + aulas completas', () => {
  const partialStream = 'Organizei as tuas datas:\n\n<uni-sync>{"assessments":[';
  const partialRes = extractUniSyncBlock(partialStream);
  assert.equal(partialRes.displayText, 'Organizei as tuas datas:');
  assert.equal(partialRes.payload, null);

  const fullReply =
    'Atualizei as datas dos testes de TEP!\n\n<uni-sync>' +
    JSON.stringify({
      slots: [],
      assessments: [
        {
          courseCode: 'TEP',
          courseName: 'Tecnologias de Energias e Processos',
          title: '2º Teste',
          kind: 'teste',
          date: '2026-11-20 14:30',
          location: 'Ed 8 · 3.09',
        },
      ],
    }) +
    '</uni-sync>';
  const fullRes = extractUniSyncBlock(fullReply);
  assert.equal(fullRes.displayText, 'Atualizei as datas dos testes de TEP!');
  assert.equal(fullRes.payload?.assessments.length, 1);
  assert.equal(fullRes.payload?.assessments[0]?.courseCode, 'TEP');
  assert.equal(fullRes.payload?.assessments[0]?.date, '2026-11-20T14:30:00');
  assert.equal(fullRes.payload?.assessments[0]?.location, 'Ed 8 · 3.09');
});

test('normalizeAssessmentIsoDate e looksSyncableReply suportam datas PT e respostas do Tutor sem tag <uni-sync>', () => {
  assert.equal(normalizeAssessmentIsoDate('20/11/2026', '14:30'), '2026-11-20T14:30:00');
  assert.equal(normalizeAssessmentIsoDate('20 de novembro', '10h00'), '2026-11-20T10:00:00');

  const sigOnly = parseScheduleJsonText(
    JSON.stringify({
      assessments: [{ courseCode: 'TEP', title: '2º Teste', date: '20/11', hora: '14:30' }],
    }),
  );
  assert.equal(sigOnly.assessments.length, 1);
  assert.equal(sigOnly.assessments[0]?.courseName, 'TEP');
  assert.equal(sigOnly.assessments[0]?.date, '2026-11-20T14:30:00');

  assert.equal(
    looksSyncableReply('Aqui estão as datas que encontrei:\n- 2.º Teste de TEP a 20/11 às 14:30.'),
    true,
  );
  assert.equal(
    looksSyncableReply('O princípio da conservação da energia diz que a energia total permanece constante.'),
    false,
  );
});

test('friendlyCustomKeyError traduz créditos pré-pagos esgotados (402), chave inválida e quota pessoal', () => {
  const prepayErr = friendlyCustomKeyError(
    new HttpStatusError(
      402,
      'Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.',
    ),
  );
  assert.ok(prepayErr instanceof CustomKeyError);
  assert.equal(prepayErr.kind, 'billing');
  assert.match(prepayErr.message, /créditos pré-pagos esgotados/i);
  assert.match(prepayErr.message, /ai\.studio\/projects/i);

  const invalidErr = friendlyCustomKeyError(new Error('API key not valid. Please pass a valid API key.'));
  assert.ok(invalidErr instanceof CustomKeyError);
  assert.equal(invalidErr.kind, 'invalid');

  const quotaErr = friendlyCustomKeyError(new HttpStatusError(429, 'RESOURCE_EXHAUSTED: Quota exceeded'));
  assert.ok(quotaErr instanceof CustomKeyError);
  assert.equal(quotaErr.kind, 'quota');
});

test('planSmartNotifications respeita opt-in, cancela streak após estudo hoje, aplica silêncio e orçamento diário', () => {
  const course: Course = {
    id: 'c-tep',
    code: 'TEP',
    name: 'Tecnologias de Energias e Processos',
    shortName: 'TEP',
    ects: 6,
    color: 'emerald',
    targetGrade: 14,
    topics: [
      {
        id: 't1',
        title: 'Laminagem',
        status: 'review',
        confidence: 3,
        nextReviewDate: '2026-11-10',
      },
    ],
  };
  const nowMorning = new Date(2026, 10, 14, 9, 0, 0); // 14 nov 2026 09:00
  const classSlot = {
    id: 'cl-1',
    courseId: 'c-tep',
    type: 'TP' as const,
    weekday: 6, // Sábado (day 6 = Nov 14, 2026)
    start: '11:00',
    end: '13:00',
    room: 'Ed 8 · 3.09',
    source: 'local' as const,
  };
  const assessment: Assessment = {
    id: 'a-1',
    courseId: 'c-tep',
    kind: 'teste',
    title: '2.º Teste',
    date: '2026-11-15T11:00:00',
    weight: 40,
    topicIds: ['t1'],
    source: 'local',
  };

  // 1) Opt-in desligado -> 0 notificações
  const disabledPlan = planSmartNotifications({
    courses: [course],
    assessments: [assessment],
    classes: [classSlot],
    sessions: [],
    settings: { ...defaultSettings, notifications: { ...DEFAULT_NOTIFICATION_PREFS, enabled: false } },
    now: nowMorning,
  });
  assert.equal(disabledPlan.length, 0);

  // 2) Ativo, sem estudo hoje -> agenda aula 15m antes com sala, avaliação e streak de hoje
  const activeNoStudy = planSmartNotifications({
    courses: [course],
    assessments: [assessment],
    classes: [classSlot],
    sessions: [
      { id: 'prev', courseId: 'c-tep', date: '2026-11-13', minutes: 45, done: true, actualMinutes: 45, generated: false },
    ],
    settings: {
      ...defaultSettings,
      notifications: { ...DEFAULT_NOTIFICATION_PREFS, enabled: true, maxDailyNudges: 6 },
    },
    now: nowMorning,
    horizonHours: 30,
  });
  assert.ok(activeNoStudy.some((n) => n.key === 'class-cl-1-2026-11-14' && n.body.includes('Ed 8 · 3.09')));
  assert.ok(activeNoStudy.some((n) => n.key === 'streak-2026-11-14'));
  assert.ok(activeNoStudy.some((n) => n.key === 'assessment-a-1-24h'));

  // 3) Com sessão concluída hoje -> alerta streak-2026-11-14 desaparece automaticamente!
  const afterStudyToday = planSmartNotifications({
    courses: [course],
    assessments: [assessment],
    classes: [classSlot],
    sessions: [
      { id: 'prev', courseId: 'c-tep', date: '2026-11-13', minutes: 45, done: true, actualMinutes: 45, generated: false },
      { id: 'today', courseId: 'c-tep', date: '2026-11-14', minutes: 30, done: true, actualMinutes: 30, generated: false },
    ],
    settings: {
      ...defaultSettings,
      appTone: 'serio',
      notifications: { ...DEFAULT_NOTIFICATION_PREFS, enabled: true, maxDailyNudges: 6 },
    },
    now: nowMorning,
    horizonHours: 30,
  });
  assert.equal(afterStudyToday.some((n) => n.key === 'streak-2026-11-14'), false);

  // 4) Horas de silêncio 22:30–08:30
  const quietMidnight = new Date(2026, 10, 14, 23, 45, 0);
  assert.equal(isWithinQuietHours(quietMidnight, DEFAULT_NOTIFICATION_PREFS), true);
  const clamped = clampOutOfQuietHours(quietMidnight, DEFAULT_NOTIFICATION_PREFS);
  assert.equal(clamped.getDate(), 15);
  assert.equal(clamped.getHours(), 8);
  assert.equal(clamped.getMinutes(), 30);
});

test('buildIcsCalendar, semesterShare e sanitizePdfWinAnsi geram artefactos válidos sem PII', () => {
  const courses: Course[] = [
    {
      id: 'c1',
      code: 'C3D',
      name: 'Cálculo III D',
      shortName: 'C3D',
      ects: 6,
      color: 'amber',
      targetGrade: 14,
      topics: [],
    },
  ];
  const classes = [
    {
      id: 'cl1',
      courseId: 'c1',
      type: 'TP' as const,
      weekday: 2,
      start: '10:00',
      end: '12:00',
      room: 'Ed 7 · 1.14',
      source: 'local' as const,
    },
  ];
  const assessments: Assessment[] = [
    {
      id: 'a1',
      courseId: 'c1',
      kind: 'teste',
      title: '1.º Teste',
      date: '2026-11-24T10:00:00',
      weight: 50,
      grade: 16.5, // não deve vazar no link da turma!
      topicIds: [],
      source: 'local',
    },
    {
      id: 'a2',
      courseId: 'c1',
      kind: 'exame',
      title: 'Exame Normal',
      date: '2027-01-14T09:00:00',
      weight: 50,
      topicIds: [],
      source: 'local',
    },
  ];

  const ics = buildIcsCalendar({ courses, classes, assessments, settings: defaultSettings });
  assert.match(ics, /^BEGIN:VCALENDAR/);
  assert.match(ics, /RRULE:FREQ=WEEKLY/);
  assert.match(ics, /LOCATION:Ed 7 · 1\.14/);
  assert.match(ics, /END:VCALENDAR\r?\n$/);

  const sharePayload = buildSemesterSharePayload({
    settings: { ...defaultSettings, personalEmail: 'secret@uni.pt', userName: 'Pedro' },
    courses,
    classes,
    assessments,
  });
  // Sem nota já lançada nem email pessoal
  assert.equal(sharePayload.assessments.length, 1);
  assert.equal(sharePayload.assessments[0]?.title, 'Exame Normal');
  const encoded = encodeSemesterSharePayload(sharePayload);
  assert.equal(encoded.includes('secret@uni.pt'), false);
  const decoded = decodeSemesterSharePayload(encoded);
  assert.ok(decoded);
  assert.equal(decoded.courses[0]?.code, 'C3D');

  let seq = 0;
  const firstImport = planSharedSemesterImport(decoded, { courses: [], classes: [], assessments: [] }, () => `id-${++seq}`);
  assert.equal(firstImport.newCourses.length, 1);
  assert.equal(firstImport.newClasses.length, 1);
  assert.equal(firstImport.newAssessments.length, 1);

  const secondImport = planSharedSemesterImport(
    decoded,
    { courses: firstImport.newCourses, classes: firstImport.newClasses, assessments: firstImport.newAssessments },
    () => `id-${++seq}`,
  );
  assert.equal(secondImport.newCourses.length, 0);
  assert.equal(secondImport.newClasses.length, 0);
  assert.equal(secondImport.newAssessments.length, 0);

  const winAnsi = sanitizePdfWinAnsi('• Resumo → Cálculo III — Equação ✓🔥');
  assert.equal(winAnsi, '* Resumo -> Cálculo III -- Equação [OK]');
});

test('varredura dá prioridade a pastas por cadeira (FCT2627/C3D, MF, AMIII) e reconhece AM3D mesmo sem nome da cadeira no PDF', () => {
  const courses: Course[] = [
    {
      id: 'c-c3d',
      code: 'C3D',
      name: 'Cálculo III D',
      shortName: 'C3 D',
      ects: 6,
      color: 'amber',
      targetGrade: 14,
      topics: [],
    },
    {
      id: 'c-mdf',
      code: 'MdF',
      name: 'Mecânica dos Fluidos',
      shortName: 'MdF',
      ects: 6,
      color: 'sky',
      targetGrade: 14,
      topics: [],
    },
    {
      id: 'c-disc',
      code: 'MdF',
      name: 'Matemática Discreta e Fundamentos',
      shortName: 'MdF',
      ects: 6,
      color: 'rose',
      targetGrade: 14,
      topics: [],
    },
  ];

  assert.equal(isLikelyAcademicDriveFolderName('FCT2627', courses), true);
  assert.equal(isLikelyAcademicDriveFolderName('Fotos Férias', courses), false);

  // 1) Ficheiro genérico dentro de FCT2627/MF associa diretamente a Fluidos (por pasta) e não a Matemática Discreta
  const mfIntro = parseFilenameToParsedItem('FCT2627 / MF / 1- Introducao.pdf', courses, undefined, 'upload');
  assert.equal(mfIntro.courseId, 'c-mdf');
  assert.equal(mfIntro.matchSource, 'folder');

  // 2) Ficheiro genérico Corr T1.pdf dentro de FCT2627/C3D associa a C3D por pasta
  const c3dCorr = parseFilenameToParsedItem('FCT2627 / C3D / Corr T1.pdf', courses, undefined, 'gdrive');
  assert.equal(c3dCorr.courseId, 'c-c3d');
  assert.equal(c3dCorr.matchSource, 'folder');
  assert.equal(c3dCorr.hasSolution, true);

  // 3) Pasta compartilhada AMIII com nomes AM3D e até TP AMII dentro -> prioridade à pasta AMIII -> C3D!
  const am3d = parseFilenameToParsedItem('AM3D 24-25-3.pdf', courses, undefined, 'gdrive');
  assert.equal(am3d.courseId, 'c-c3d');
  assert.equal(am3d.matchSource, 'filename');

  const sharedT1 = parseFilenameToParsedItem('AMIII / Prep T1.pdf', courses, undefined, 'gdrive');
  assert.equal(sharedT1.courseId, 'c-c3d');
  assert.equal(sharedT1.matchSource, 'folder');

  const sharedAmiiTypo = parseFilenameToParsedItem('AMIII / TP AMII 09-10-2024.pdf', courses, undefined, 'gdrive');
  assert.equal(sharedAmiiTypo.courseId, 'c-c3d');
  assert.equal(sharedAmiiTypo.matchSource, 'folder');
});

test('formatInlineLatexToText converts common LaTeX commands and keeps readable notation', () => {
  assert.equal(formatInlineLatexToText('\\pi'), 'π');
  assert.equal(formatInlineLatexToText('\\frac{a}{b}'), '(a)/(b)');
  assert.equal(formatInlineLatexToText('\\sqrt{x^2 + 1}'), '√(x^2 + 1)');
  assert.equal(formatInlineLatexToText('\\alpha \\to \\infty'), 'α → ∞');
});

test('getAcademicEntryCutoffMs & isPreEntryDriveFile filter pre-university files accurately', () => {
  const cutoff2026 = getAcademicEntryCutoffMs(2026);
  assert.equal(cutoff2026, Date.UTC(2026, 6, 1));
  assert.equal(getAcademicEntryCutoffMs(undefined), null);
  assert.equal(getAcademicEntryCutoffMs(1980), null);

  // Arquivo antigo (2019) é filtrado quando o ingresso é 2026
  assert.equal(isPreEntryDriveFile('2019-04-12T10:00:00.000Z', 2026), true);
  assert.equal(isPreEntryDriveFile('2026-06-30T23:59:59.000Z', 2026), true);

  // Arquivo no ou após 1 de julho de 2026 é mantido
  assert.equal(isPreEntryDriveFile('2026-07-01T00:00:00.000Z', 2026), false);
  assert.equal(isPreEntryDriveFile('2026-09-17T14:20:00.000Z', 2026), false);
  assert.equal(isPreEntryDriveFile(undefined, 2026), false);
});

test('sanitizeMaterials prunes unpinned pre-entry gdrive files and keeps pinned or folder-matched items', () => {
  const courses = [
    { id: 'c3d', code: 'C3D', name: 'Cálculo III D', shortName: 'C3D', ects: 6, color: 'amber', targetGrade: 14, topics: [] },
    { id: 'c-sdn', code: 'SDN', name: 'Sociologia das Novas Tecnologias', shortName: 'SDN', ects: 3, color: 'sky', targetGrade: 14, topics: [] },
  ] as any;

  const { clean, removedCount } = sanitizeMaterials(
    [
      {
        id: 'old-sdn',
        courseId: 'c-sdn',
        title: 'CONSTITUICOES BRASILEIRAS',
        provider: 'gdrive',
        addedAt: '2026-10-01T10:00:00Z',
        modifiedAt: '2019-03-01T10:00:00Z',
      },
      {
        id: 'old-pinned',
        courseId: 'c-sdn',
        title: 'Resumo antigo fixado pelo aluno',
        provider: 'gdrive',
        pinned: true,
        addedAt: '2026-10-01T10:00:00Z',
        modifiedAt: '2019-03-01T10:00:00Z',
      },
      {
        id: 'new-c3d',
        courseId: 'c3d',
        title: 'Prep T1.pdf',
        fileName: 'FCT2627 / C3D / Prep T1.pdf',
        provider: 'gdrive',
        addedAt: '2026-10-01T10:00:00Z',
        modifiedAt: '2026-09-17T10:00:00Z',
      },
    ],
    courses,
    2026,
  );

  assert.equal(removedCount, 1);
  assert.deepEqual(
    clean.map((m) => m.id),
    ['old-pinned', 'new-c3d'],
  );
  // Pasta FCT2627 / C3D em fileName protege material c3d sem sigla no título
  assert.equal(clean[1]?.courseId, 'c3d');
});

test('traverseDriveFoldersBfs visits all level-1 folders before diving deeper', async () => {
  const tree: Record<string, CloudFile[]> = {
    fct2627: [
      { id: 'c3d', name: 'C3D', mimeType: 'application/vnd.google-apps.folder', isFolder: true, modifiedAt: '2026-09-10T00:00:00Z' },
      { id: 'ms2', name: 'MS2', mimeType: 'application/vnd.google-apps.folder', isFolder: true, modifiedAt: '2026-09-10T00:00:00Z' },
      { id: 'snti', name: 'SNTI', mimeType: 'application/vnd.google-apps.folder', isFolder: true, modifiedAt: '2026-09-10T00:00:00Z' },
      { id: 'tep', name: 'TEP', mimeType: 'application/vnd.google-apps.folder', isFolder: true, modifiedAt: '2026-09-10T00:00:00Z' },
    ],
    c3d: [
      { id: 'c3d-sub', name: 'Aulas Antigas', mimeType: 'application/vnd.google-apps.folder', isFolder: true, modifiedAt: '2026-09-10T00:00:00Z' },
      { id: 'c3d-f1', name: 'Sebenta C3D.pdf', mimeType: 'application/pdf', isFolder: false, modifiedAt: '2026-09-12T00:00:00Z' },
    ],
    'c3d-sub': [
      { id: 'c3d-sub2', name: 'Arquivo Profundo', mimeType: 'application/vnd.google-apps.folder', isFolder: true, modifiedAt: '2026-09-10T00:00:00Z' },
    ],
    ms2: [
      { id: 'ms2-f1', name: 'Slides MS2.pdf', mimeType: 'application/pdf', isFolder: false, modifiedAt: '2026-09-15T00:00:00Z' },
    ],
    snti: [
      { id: 'snti-f1', name: 'Texto SNTI.pdf', mimeType: 'application/pdf', isFolder: false, modifiedAt: '2026-09-16T00:00:00Z' },
    ],
    tep: [
      { id: 'tep-f1', name: 'Aula T01.pdf', mimeType: 'application/pdf', isFolder: false, modifiedAt: '2026-09-17T00:00:00Z' },
    ],
  };

  const visited: string[] = [];
  const results = await traverseDriveFoldersBfs('fct2627', async (id) => {
    visited.push(id);
    return tree[id] ?? [];
  }, { maxDepth: 4, maxFolders: 5, initialPrefix: 'FCT2627' });

  // Com limite maxFolders=5: raiz + todas as 4 cadeiras de nível 1 são visitadas antes da subpasta c3d-sub
  assert.deepEqual(visited, ['fct2627', 'c3d', 'ms2', 'snti', 'tep']);
  assert.equal(results.length, 4);
  assert.ok(results.some((f) => f.name.includes('FCT2627 / TEP / Aula T01.pdf')));
  assert.ok(results.some((f) => f.name.includes('FCT2627 / MS2 / Slides MS2.pdf')));
  assert.ok(results.some((f) => f.name.includes('FCT2627 / SNTI / Texto SNTI.pdf')));
});

test('extractGoogleDriveFileId extracts IDs from Drive URLs, Docs URLs and gdrive refs', () => {
  assert.equal(
    extractGoogleDriveFileId('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view?usp=sharing'),
    '1AbCdEfGhIjKlMnOpQrStUvWxYz',
  );
  assert.equal(
    extractGoogleDriveFileId('https://docs.google.com/document/d/1DocId_Example-123/edit'),
    '1DocId_Example-123',
  );
  assert.equal(
    extractGoogleDriveFileId('https://drive.google.com/open?id=1OpenId_9876543210'),
    '1OpenId_9876543210',
  );
  assert.equal(extractGoogleDriveFileId(undefined, 'gdrive:1PrefixedId_ABCDEF12345'), '1PrefixedId_ABCDEF12345');
  assert.equal(extractGoogleDriveFileId('https://notebooklm.google.com/notebook/abc'), null);
});

test('getAiMaterialLimit keeps 3 sources on native free tier and lifts the file cap with a personal key', () => {
  assert.equal(getAiMaterialLimit(false), 3);
  assert.equal(getAiMaterialLimit(true), 100);
});

test('isFileUriCacheValid validates expiry and size mismatches for Gemini Files API entries', () => {
  const now = 1_700_000_000_000;
  const fresh = {
    fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/abc123',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    expiresAt: now + 60_000,
  };
  assert.equal(isFileUriCacheValid(fresh, 2048, now), true);
  assert.equal(isFileUriCacheValid(fresh, 4096, now), false);
  assert.equal(isFileUriCacheValid(fresh, 2048, now + 60_001), false);
  assert.equal(isFileUriCacheValid(null, 2048, now), false);
});

test('KaTeX renders complex scientific LaTeX while PDF export flattens math without leaking dollar currency', () => {
  const rendered = katex.renderToString('\\int_0^{\\infty} e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}', {
    displayMode: true,
    throwOnError: false,
    strict: false,
    trust: false,
  });
  assert.ok(rendered.includes('katex'), 'KaTeX HTML must include .katex class');
  assert.ok(rendered.includes('katex-display'), 'Display mode KaTeX must include .katex-display');

  const flattened = flattenMarkdownMathForText(
    'O resultado é $$\\frac{a}{b}$$ e o preço são $100.',
  );
  assert.equal(flattened, 'O resultado é (a)/(b) e o preço são $100.');
  const pdfSafe = sanitizePdfWinAnsi('Fórmula: $\\alpha \\to \\frac{1}{2}$ · Custo $100');
  assert.equal(pdfSafe.includes('\\frac'), false);
  assert.ok(pdfSafe.includes('$100'));
});

test('filterMaterialsForCourse devolve todos os materiais associados a uma cadeira mesmo com UUID e sem sigla no titulo', () => {
  const mdfCourse = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    code: 'MDF',
    shortName: 'MdF',
    name: 'Mecânica dos Fluidos',
    ects: 6,
    color: '#e04f33',
    target: 14,
    syllabus: [],
    assessments: [],
    schedule: [],
    rules: {},
  };

  const c3dCourse = {
    ...mdfCourse,
    id: 'c3d',
    code: 'C3D',
    shortName: 'Cálculo III D',
    name: 'Cálculo III D',
  };

  const materials = [
    {
      id: 'm1',
      courseId: '550e8400-e29b-41d4-a716-446655440000',
      title: 'MdF Exercícios',
      kind: 'resumo' as const,
      source: 'gdrive' as const,
    },
    {
      id: 'm2',
      courseId: '550e8400-e29b-41d4-a716-446655440000',
      title: 'IMG 6729.jpg',
      kind: 'apontamento' as const,
      source: 'gdrive' as const,
    },
    {
      id: 'm3',
      courseId: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Fatura_Uber_2025.pdf',
      kind: 'apontamento' as const,
      source: 'gdrive' as const,
    },
    {
      id: 'm4',
      courseId: 'other-course',
      title: 'Aula T01 Análise Matemática I',
      kind: 'apontamento' as const,
      source: 'gdrive' as const,
    },
  ];

  const mdfFiltered = filterMaterialsForCourse(materials, mdfCourse);
  assert.deepEqual(
    mdfFiltered.map((m) => m.id),
    ['m1', 'm2'],
    'Inclui tanto MdF Exercícios como IMG 6729 da pasta associada à UUID, excluindo lixo pessoal',
  );

  const c3dFiltered = filterMaterialsForCourse(materials, c3dCourse);
  assert.equal(c3dFiltered.length, 0, 'Guarda contra mistura de AM1 em Cálculo III D mantida');
});

test('persistAcademicEmails e loadPersistedAcademicEmails persistem avisos entre recarregamentos por conta institucional', () => {
  const prevStorage = (globalThis as { localStorage?: Storage }).localStorage;
  const backing = new Map<string, string>();
  const mockStorage: Storage = {
    get length() {
      return backing.size;
    },
    clear() {
      backing.clear();
    },
    getItem(key: string) {
      return backing.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(backing.keys())[index] ?? null;
    },
    removeItem(key: string) {
      backing.delete(key);
    },
    setItem(key: string, value: string) {
      backing.set(key, value);
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    configurable: true,
    writable: true,
  });

  try {
    const sampleCourses = [
      {
        id: 'tep-uuid',
        code: 'TEP',
        shortName: 'TEP',
        name: 'Tecnologia da Embutidura e Plasticidade',
        ects: 6,
        color: '#22c55e',
        target: 14,
        syllabus: [],
        assessments: [],
        schedule: [],
        rules: {},
      },
    ];
    const emails: AcademicEmail[] = [
      {
        id: 'em-1',
        threadId: 'th-1',
        from: 'docente@fct.unl.pt',
        subject: 'Sala do 1.º Teste de TEP',
        snippet: 'O teste realiza-se no anfiteatro 1A.',
        date: '2026-11-14T10:00:00Z',
        isImportant: true,
      },
    ];

    persistAcademicEmails(emails, 'Aluno@Campus.FCT.UNL.pt');

    const loaded = loadPersistedAcademicEmails(sampleCourses, 'aluno@campus.fct.unl.pt');
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0]?.courseId, 'tep-uuid');

    const wrongAccount = loadPersistedAcademicEmails(sampleCourses, 'outro@fct.unl.pt');
    assert.equal(wrongAccount.length, 0);

    clearAcademicEmailsCache(true);
    const afterClear = loadPersistedAcademicEmails(sampleCourses, 'aluno@campus.fct.unl.pt');
    assert.equal(afterClear.length, 0);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      value: prevStorage,
      configurable: true,
      writable: true,
    });
    clearAcademicEmailsCache(true);
  }
});

test('generatePlan suporta turno preferido, blocos 25m, boost e pausa de cadeira + reagendamento inteligente', () => {
  const c1: Course = {
    id: 'c-math',
    code: 'AM1',
    name: 'Análise Matemática I',
    shortName: 'AM1',
    ects: 6,
    color: 'emerald',
    targetGrade: 14,
    topics: [{ id: 'tm1', title: 'Limites', status: 'todo', confidence: 3 }],
  };
  const c2: Course = {
    id: 'c-phys',
    code: 'FIS',
    name: 'Física',
    shortName: 'FIS',
    ects: 6,
    color: 'sky',
    targetGrade: 14,
    topics: [{ id: 'tp1', title: 'Cinemática', status: 'todo', confidence: 3 }],
  };

  const plan = generatePlan({
    courses: [c1, c2],
    assessments: [],
    classes: [{ id: 'cls1', courseId: 'c-math', type: 'T', weekday: 1, start: '09:00', end: '10:30' }],
    events: [],
    settings: { ...defaultSettings, dailyStudyMinutes: 100, studyDays: [1, 2, 3, 4, 5] },
    from: '2026-11-16',
    days: 3,
    preferredPeriod: 'morning',
    blockMinutes: 25,
    boostCourseIds: ['c-math'],
    pausedCourseIds: ['c-phys'],
  });

  assert.ok(plan.length > 0, 'Deve gerar blocos no período da manhã');
  assert.equal(plan.some((s) => s.courseId === 'c-phys'), false, 'Cadeira pausada deve ser excluída');
  assert.ok(plan.every((s) => s.minutes <= 25), 'Blocos devem respeitar teto Pomodoro 25m');
  // Na segunda-feira (aula 09:00-10:30), bloco da manhã arranca às 08:30 (25m) e salta para depois da aula (10:40)
  const monSessions = plan.filter((s) => s.date === '2026-11-16');
  assert.equal(monSessions[0]?.start, '08:30');
  assert.equal(monSessions[1]?.start, '10:40');

  const overdue: StudySession[] = [
    {
      id: 'ov1',
      courseId: 'c-phys',
      date: '2026-11-12',
      minutes: 40,
      done: false,
      generated: true,
    },
  ];
  const rescheduled = rescheduleOverdueSessions({
    overdue,
    existing: plan,
    classes: [{ id: 'cls1', courseId: 'c-math', type: 'T', weekday: 1, start: '09:00', end: '10:30' }],
    events: [],
    settings: { ...defaultSettings, dailyStudyMinutes: 120, studyDays: [1, 2, 3, 4, 5] },
    from: '2026-11-16',
    days: 5,
    preferredPeriod: 'morning',
  });
  assert.equal(rescheduled.updated.length, 1);
  assert.equal(rescheduled.unscheduledCount, 0);
  assert.ok(rescheduled.updated[0]!.date >= '2026-11-16');
});

test('12 cores do Uni, 5 Micropets e energia diaria estilo Finch funcionam de forma deterministica', () => {
  assert.equal(UNI_SKINS.length, 12);
  assert.equal(UNI_PETS.length, 5);

  const zeroTelemetry = {
    completedSessions: 0,
    totalRecalls: 0,
    streakDays: 0,
    checkInsCount: 0,
    mastered21dCount: 0,
    totalStudyMinutes: 0,
  };
  const initialSkins = getUniCollectibleStates(zeroTelemetry);
  const initialPets = getUniPetStates(zeroTelemetry);
  assert.equal(initialSkins.filter((s) => s.unlocked).length, 6);
  assert.equal(initialPets.filter((p) => p.unlocked).length, 1);
  assert.equal(initialPets.find((p) => p.pet.id === 'cat')?.unlocked, true);

  const companion = computeUniCompanionState({
    sessions: [
      { id: 's1', courseId: 'c1', date: '2026-11-15', minutes: 50, done: true },
      { id: 's2', courseId: 'c1', date: '2026-11-15', minutes: 50, done: true },
      { id: 's3', courseId: 'c1', date: '2026-11-14', minutes: 40, done: true },
    ],
    tasks: [],
    weeklyCheckIns: [],
    today: '2026-11-15',
    dailyHugs: 2,
  });
  assert.equal(companion.totalStudyMinutes, 140);
  assert.equal(companion.stage.id, 'explorador');
  assert.equal(companion.dailyEnergy, 40);
  assert.equal(companion.adventureDone, true);
  assert.ok(companion.discoveryNote);
});

test('UniLivingOverlay nómada alterna ancoras e varia cores entre visitantes', () => {
  const seenZones = new Set<string>();
  for (let step = 0; step < 6; step++) {
    seenZones.add(pickNextNomadPlacement({ pathname: '/', stepCount: step }).zone);
  }
  assert.ok(seenZones.size >= 4, 'Deve passear por varias bordas/cantos sem ficar preso num unico canto');

  const tutorAnchor = pickNextNomadPlacement({ pathname: '/assistente', stepCount: 0 }).zone;
  assert.equal(tutorAnchor.startsWith('bottom_'), false, 'No Tutor deve evitar ancoragem inferior sobre o compositor');

  const peers = resolveVisibleUniPeers({
    activeSkin: 'classic',
    telemetry: {
      completedSessions: 0,
      totalRecalls: 0,
      streakDays: 0,
      checkInsCount: 0,
      mastered21dCount: 0,
    },
    mode: 'all',
    appTone: 'vibrante',
    tickSeed: 1,
    autoRotate: true,
    pathname: '/materiais',
  });
  assert.equal(peers.length, 2);
  assert.notEqual(peers[0], peers[1], 'Visitante secundario deve ter cor distinta da principal');
});

test('planSmartNotifications agenda pos-aula, fim do dia, domingo, modo teste e suprime apos registo', () => {
  const course: Course = {
    id: 'c-tep',
    code: 'TEP',
    name: 'Tecnologias de Energias e Processos',
    shortName: 'TEP',
    ects: 6,
    color: 'emerald',
    targetGrade: 14,
    topics: [],
  };
  const classSlot: ClassSlot = {
    id: 'cl-sat',
    courseId: 'c-tep',
    type: 'TP',
    weekday: 6, // Sábado 2026-11-14
    start: '11:00',
    end: '13:00',
    room: 'Ed 8',
    source: 'local',
  };
  const examInFiveDays: Assessment = {
    id: 'a-exam5',
    courseId: 'c-tep',
    kind: 'teste',
    title: '1.º Teste TEP',
    date: '2026-11-19T14:00:00',
    weight: 50,
    topicIds: [],
    source: 'local',
  };
  const nowMorning = new Date(2026, 10, 14, 9, 0, 0);

  const scheduled = planSmartNotifications({
    courses: [course],
    assessments: [examInFiveDays],
    classes: [classSlot],
    sessions: [],
    studyLogs: [],
    weeklyCheckIns: [],
    settings: {
      ...defaultSettings,
      notifications: { ...DEFAULT_NOTIFICATION_PREFS, enabled: true, maxDailyNudges: 6 },
    },
    now: nowMorning,
    horizonHours: 48,
  });

  assert.ok(scheduled.some((n) => n.key === 'post-class-cl-sat-2026-11-14' && n.route.includes('uniLog=class')));
  assert.ok(scheduled.some((n) => n.key === 'evening-2026-11-14' && n.route === '/?uniLog=day'));
  assert.ok(scheduled.some((n) => n.key === 'sunday-2026-11-15' && n.route === '/?uniLog=week'));
  assert.ok(scheduled.some((n) => n.key === 'exam-prep-a-exam5-2026-11-14' && n.route.includes('uniLog=exam_prep')));

  // Após registar pós-aula, fim do dia e modo teste, esses avisos de hoje desaparecem
  const logsAfter: StudyLogEntry[] = [
    {
      id: 'log-1',
      kind: 'class',
      date: '2026-11-14',
      courseId: 'c-tep',
      classSlotId: 'cl-sat',
      feeling: 'clara',
      topicTitle: 'Plasticidade',
      createdAt: '2026-11-14T13:15:00Z',
    },
    {
      id: 'log-2',
      kind: 'day',
      date: '2026-11-14',
      feeling: 'produtivo',
      rating: 4,
      createdAt: '2026-11-14T20:35:00Z',
    },
    {
      id: 'log-3',
      kind: 'exam_prep',
      date: '2026-11-14',
      courseId: 'c-tep',
      assessmentId: 'a-exam5',
      feeling: 'estavel',
      createdAt: '2026-11-14T11:30:00Z',
    },
  ];
  const scheduledAfterLogs = planSmartNotifications({
    courses: [course],
    assessments: [{ ...examInFiveDays, topicIds: ['t-1'] }],
    classes: [classSlot],
    sessions: [],
    studyLogs: logsAfter,
    weeklyCheckIns: [],
    settings: {
      ...defaultSettings,
      notifications: { ...DEFAULT_NOTIFICATION_PREFS, enabled: true, maxDailyNudges: 6 },
    },
    now: nowMorning,
    horizonHours: 48,
  });

  assert.equal(scheduledAfterLogs.some((n) => n.key === 'post-class-cl-sat-2026-11-14'), false);
  assert.equal(scheduledAfterLogs.some((n) => n.key === 'evening-2026-11-14'), false);
  assert.equal(scheduledAfterLogs.some((n) => n.key === 'exam-prep-a-exam5-2026-11-14'), false);

  // Nudge in-app pós-aula aparece quando a aula terminou há pouco e ainda não houve registo
  const afternoonAfterClass = new Date(2026, 10, 14, 13, 30, 0);
  const inAppPostClass = pickActiveInAppNudge({
    courses: [course],
    assessments: [examInFiveDays],
    classes: [classSlot],
    sessions: [],
    studyLogs: [],
    weeklyCheckIns: [],
    settings: defaultSettings,
    now: afternoonAfterClass,
  });
  assert.ok(inAppPostClass?.route.includes('uniLog=class'));
});

test('generatePlan prioriza cadeira/topico dificil em registo pos-aula com Reforco pos-aula', () => {
  const hardCourse: Course = {
    id: 'c-hard',
    code: 'MS2',
    name: 'Mecânica dos Sólidos II',
    shortName: 'MS2',
    ects: 6,
    color: 'amber',
    targetGrade: 14,
    topics: [{ id: 't-vm', title: 'Critério de Von Mises', status: 'learning', confidence: 2 }],
  };
  const easyCourse: Course = {
    id: 'c-easy',
    code: 'FAB',
    name: 'Fabrico Aditivo',
    shortName: 'FAB',
    ects: 3,
    color: 'sky',
    targetGrade: 15,
    topics: [{ id: 't-fdm', title: 'FDM', status: 'review', confidence: 4 }],
  };
  const difficultClassLog: StudyLogEntry = {
    id: 'log-hard',
    kind: 'class',
    date: '2026-11-14',
    courseId: 'c-hard',
    topicTitle: 'Critério de Von Mises',
    topicIds: ['t-vm'],
    feeling: 'dificil',
    difficulties: 'Sinal do tensor',
    createdAt: '2026-11-14T15:00:00Z',
  };

  const sessions = generatePlan({
    courses: [hardCourse, easyCourse],
    assessments: [],
    classes: [],
    events: [],
    existing: [],
    settings: { ...defaultSettings, dailyStudyMinutes: 120, studyDays: [1, 2, 3, 4, 5, 6] },
    studyLogs: [difficultClassLog],
    from: '2026-11-15',
    days: 3,
  });

  const hardSessions = sessions.filter((s) => s.courseId === 'c-hard');
  assert.ok(hardSessions.length > 0);
  assert.ok(
    hardSessions.some((s) => (s.notes ?? '').includes('Reforço pós-aula')),
    'Deve assinalar reforco pos-aula na cadeira dificil',
  );
});

test('buildStudyContext inclui materia que sai do teste e secao DIARIO RECENTE', () => {
  const ctx = buildStudyContext({
    courses: [
      {
        id: 'c1',
        code: 'TEP',
        name: 'Tecnologias de Produção',
        shortName: 'TEP',
        ects: 6,
        color: 'emerald',
        targetGrade: 15,
        topics: [{ id: 't1', title: 'Forjamento', status: 'learning', confidence: 3 }],
      },
    ],
    assessments: [
      {
        id: 'a1',
        courseId: 'c1',
        kind: 'teste',
        title: '1.º Teste',
        date: '2099-05-10T10:00:00',
        weight: 40,
        topicIds: ['t1'],
        source: 'local',
      },
    ],
    classes: [],
    sessions: [],
    tasks: [],
    materials: [],
    events: [],
    settings: defaultSettings,
    studyLogs: [
      {
        id: 'sl1',
        kind: 'exam_prep',
        date: '2026-11-14',
        courseId: 'c1',
        assessmentId: 'a1',
        feeling: 'ansioso',
        studiedSummary: 'Faltam exercicios de forjamento',
        createdAt: '2026-11-14T19:00:00Z',
      },
    ],
  });

  assert.ok(ctx.includes('matéria que sai: Forjamento'));
  assert.ok(ctx.includes('DIÁRIO RECENTE (AULAS, ESTUDO DIÁRIO & MODO TESTE):'));
  assert.ok(ctx.includes('Faltam exercicios de forjamento'));
});

test('parseConversationalCheckIn entende "cai ate ao slide 8", topicos de aula e bloco sync IA', () => {
  const tepCourse: Course = {
    id: 'c-tep',
    code: 'TEP',
    name: 'Tecnologias de Produção',
    shortName: 'TEP',
    ects: 6,
    color: 'emerald',
    targetGrade: 14,
    topics: [
      { id: 't-elast', title: 'Aula T02 - Revisão Elasticidade', status: 'review', confidence: 4 },
      { id: 't-forj', title: 'Aula T09 - Forjamento', status: 'todo', confidence: 2 },
    ],
  };
  const materials: Material[] = [
    { id: 'm0', courseId: 'c-tep', title: 'Aula T00 - Funcionamento Pt+Ing.pdf', kind: 'gdrive', addedAt: '2026-10-01' },
    { id: 'm3', courseId: 'c-tep', title: 'Aula T03a - Critérios de Plasticidade.pdf', kind: 'gdrive', addedAt: '2026-10-02' },
    { id: 'm5', courseId: 'c-tep', title: 'Aula T05 - Aspetos Fenomenológicos.pdf', kind: 'gdrive', addedAt: '2026-10-03' },
    { id: 'm8', courseId: 'c-tep', title: 'Aula T08 - Método do Limite Superior.pdf', kind: 'gdrive', addedAt: '2026-10-04' },
    { id: 'm9', courseId: 'c-tep', title: 'Aula T09 - Forjamento.pdf', kind: 'gdrive', addedAt: '2026-10-05' },
  ];
  const assessment: Assessment = {
    id: 'a-tep-1',
    courseId: 'c-tep',
    kind: 'teste',
    title: '1.º Teste',
    date: '2026-11-20T14:00:00',
    weight: 40,
    topicIds: [],
    source: 'local',
  };

  const examParsed = parseConversationalCheckIn({
    kind: 'exam_prep',
    userText: 'A matéria do teste cai até ao slide 8, já estudei a T02 e estou ansioso',
    course: tepCourse,
    courses: [tepCourse],
    materials,
    assessment,
  });

  assert.equal(examParsed.feeling, 'ansioso');
  assert.equal(examParsed.scopeLabel, 'Até slide 8');
  assert.ok(examParsed.matchedTopicIds.includes('t-elast'), 'Deve incluir topico <= 8');
  assert.equal(examParsed.matchedTopicIds.includes('t-forj'), false, 'Nao deve incluir Aula T09 (> slide 8)');
  assert.ok(
    examParsed.newTopicsToAdd.some((t) => t.includes('Aula T08')),
    'Deve importar automaticamente Aula T08 dos apontamentos',
  );
  assert.equal(
    examParsed.newTopicsToAdd.some((t) => t.includes('Funcionamento')),
    false,
    'Nao deve criar topico para T00 Funcionamento',
  );

  const classParsed = parseConversationalCheckIn({
    kind: 'class',
    userText: 'Hoje demos Critério de Von Mises, fiquei com dúvidas nos sinais do tensor',
    course: tepCourse,
    courses: [tepCourse],
    materials,
  });
  assert.equal(classParsed.feeling, 'mais_ou_menos');
  assert.ok(classParsed.topicTitle?.includes('Critério de Von Mises'));
  assert.ok(classParsed.difficulties?.includes('tensor'));

  const aiParsed = extractUniCheckInSyncBlock(
    'Boa! Fica já alinhado até T08.\n<uni-checkin-sync>{"feeling":"ansioso","scopeLabel":"Até Slide 8","newTopics":["Aula T08"]}</uni-checkin-sync>',
  );
  assert.equal(aiParsed.visibleReply, 'Boa! Fica já alinhado até T08.');
  assert.equal(aiParsed.sync?.feeling, 'ansioso');
  assert.equal(aiParsed.sync?.scopeLabel, 'Até Slide 8');
});
