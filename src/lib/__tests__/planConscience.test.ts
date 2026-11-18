import { describe, expect, it } from 'vitest';
import type { Assessment, Course, Settings, StudySession } from '../../types';
import { analyzePlanConscience } from '../planner/conscience';
import { computeReplan } from '../planner/replan';

const courses: Course[] = [
  {
    id: 'c-tep',
    code: 'TEP',
    name: 'Tecnologia de Produção',
    shortName: 'TEP',
    ects: 6,
    color: 'emerald',
    targetGrade: 14,
    topics: [
      { id: 't1', title: 'Plasticidade', status: 'todo', confidence: 2 },
      { id: 't2', title: 'Conformação', status: 'learning', confidence: 3 },
    ],
  },
  {
    id: 'c-fab',
    code: 'FA',
    name: 'Fabrico Aditivo',
    shortName: 'Fab. Aditivo',
    ects: 6,
    color: 'amber',
    targetGrade: 14,
    topics: [{ id: 'f1', title: 'Processos PBF', status: 'todo', confidence: 2 }],
  },
];

const settings: Settings = {
  userName: 'Pedro',
  theme: 'dark',
  semesterName: '2026/27',
  semesterStart: '2026-09-14',
  semesterEnd: '2027-01-30',
  dailyStudyMinutes: 120,
  studyDays: [1, 2, 3, 4, 5, 6],
  geminiApiKey: '',
  geminiModel: 'gemini-4-hydrogen',
  googleClientId: '',
  aiConsent: false,
};

describe('Consciência do Uni & Modo Manual', () => {
  it('modo manual protege os blocos existentes em recálculos normais e só gera quando allowInManualMode=true', () => {
    const manualSession: StudySession = {
      id: 'm1',
      courseId: 'c-tep',
      date: '2026-11-17',
      start: '18:00',
      minutes: 50,
      done: false,
      generated: false,
    };
    const manualSettings: Settings = {
      ...settings,
      plannerPrefs: {
        horizonDays: 14,
        preferredPeriod: 'auto',
        blockMinutes: 50,
        strategy: 'balanced',
        plannerMode: 'manual',
      },
    };
    const assessments: Assessment[] = [
      {
        id: 'a-tep',
        courseId: 'c-tep',
        kind: 'teste',
        title: '1.º Teste TEP',
        date: '2026-11-20T10:00:00',
        weight: 50,
        topicIds: ['t1', 't2'],
        source: 'local',
      },
    ];

    const blocked = computeReplan(
      {
        courses,
        assessments,
        classes: [],
        events: [],
        materials: [],
        settings: manualSettings,
        sessions: [manualSession],
        academicProfile: { difficultCourseIds: [], extraActivities: [] },
        weeklyCheckIns: [],
        studyLogs: [],
      },
      { today: '2026-11-16', force: true },
    );
    expect(blocked.changed).toBe(false);
    expect(blocked.sessions).toEqual([manualSession]);

    const explicitDraft = computeReplan(
      {
        courses,
        assessments,
        classes: [],
        events: [],
        materials: [],
        settings: manualSettings,
        sessions: [manualSession],
        academicProfile: { difficultCourseIds: [], extraActivities: [] },
        weeklyCheckIns: [],
        studyLogs: [],
      },
      { today: '2026-11-16', force: true, allowInManualMode: true },
    );
    expect(explicitDraft.changed).toBe(true);
    expect(explicitDraft.sessions.some((s) => s.id === 'm1')).toBe(true);
    expect(explicitDraft.sessions.length).toBeGreaterThan(1);
  });

  it('deteta cadeira pausada com bloco marcado, teste urgente sem tempo e choque com aula', () => {
    const report = analyzePlanConscience({
      courses,
      assessments: [
        {
          id: 'a-tep',
          courseId: 'c-tep',
          kind: 'teste',
          title: '1.º Teste TEP',
          date: '2026-11-20T10:00:00',
          weight: 50,
          topicIds: ['t1', 't2'],
          source: 'local',
        },
      ],
      classes: [
        {
          id: 'cls-1',
          courseId: 'c-tep',
          type: 'T',
          weekday: 2, // terça 2026-11-17
          start: '18:00',
          end: '20:00',
          source: 'local',
        },
      ],
      events: [],
      sessions: [
        {
          id: 's-fab',
          courseId: 'c-fab',
          date: '2026-11-17',
          start: '18:30',
          minutes: 50,
          done: false,
          generated: false,
        },
      ],
      settings: {
        ...settings,
        plannerPrefs: {
          horizonDays: 14,
          preferredPeriod: 'auto',
          blockMinutes: 50,
          strategy: 'balanced',
          plannerMode: 'manual',
          pausedCourseIds: ['c-fab'],
        },
      },
      today: '2026-11-16',
    });

    expect(report.status).toBe('needs_attention');
    expect(report.opinions.some((o) => o.kind === 'paused_course_active')).toBe(true);
    expect(report.opinions.some((o) => o.kind === 'schedule_clash')).toBe(true);
    expect(report.opinions.some((o) => o.kind === 'urgent_exam_underfunded')).toBe(true);

    const pausedOp = report.opinions.find((o) => o.kind === 'paused_course_active');
    expect(pausedOp?.action?.kind).toBe('remove_sessions');
    const examOp = report.opinions.find((o) => o.kind === 'urgent_exam_underfunded');
    expect(examOp?.action?.kind).toBe('add_session');
  });

  it('usa o maxUntil mais tardio no foco exclusivo e ignora nowMinutes em choques de dias futuros', () => {
    const report = analyzePlanConscience({
      courses,
      assessments: [],
      classes: [
        {
          id: 'cl-wed',
          courseId: 'c-tep',
          type: 'TP',
          weekday: 3, // Quarta 2026-11-18
          start: '09:00',
          end: '10:30',
          source: 'local',
        },
      ],
      events: [],
      sessions: [
        {
          id: 'clash-future',
          courseId: 'c-tep',
          date: '2026-11-18',
          start: '09:30',
          minutes: 50,
          done: false,
          generated: false,
        },
        {
          id: 'late-fab',
          courseId: 'c-fab',
          date: '2026-11-24',
          minutes: 50,
          done: false,
          generated: false,
        },
      ],
      settings: {
        ...settings,
        plannerPrefs: {
          horizonDays: 14,
          preferredPeriod: 'auto',
          blockMinutes: 50,
          strategy: 'balanced',
          plannerMode: 'manual',
          exclusiveTestFocus: true,
          boostCourseIds: ['c-tep'],
          courseModeUntil: { 'c-tep': '2026-11-25' },
          dateOverrides: {
            '2026-11-18': { enabled: true, window: 'all_day' },
          },
        },
      },
      today: '2026-11-16',
      nowMinutes: 20 * 60, // 20h hoje não deve impedir slot de manhã na quarta 2026-11-18
    });

    const clashOp = report.opinions.find((o) => o.kind === 'schedule_clash');
    expect(clashOp?.action?.kind).toBe('move_session');
    if (clashOp?.action?.kind === 'move_session') {
      expect(clashOp.action.targetDate).toBe('2026-11-18');
      expect(clashOp.action.targetStart < '20:00').toBe(true);
    }
    expect(report.opinions.some((o) => o.kind === 'exclusive_violation')).toBe(true);
  });
});
