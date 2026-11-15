import { describe, expect, it } from 'vitest';
import type { Assessment, Course, StudySession } from '../../types';
import {
  fmtMinutes,
  gradeSummary,
  parsePtGrade,
  readiness,
  semesterAverage,
  studyStreak,
  toDateStr,
  topicProgress,
  urgency,
} from '../selectors';

const makeCourse = (overrides: Partial<Course> = {}): Course => ({
  id: 'c1',
  code: 'MAT1',
  name: 'Cálculo III',
  shortName: 'C3',
  ects: 6,
  color: 'sky',
  targetGrade: 15,
  topics: [],
  ...overrides,
});

const makeAssessment = (overrides: Partial<Assessment> = {}): Assessment => ({
  id: 'a1',
  courseId: 'c1',
  kind: 'teste',
  title: '1.º Teste',
  date: '2026-11-25T10:00:00',
  weight: 50,
  topicIds: [],
  source: 'local',
  ...overrides,
});

describe('selectors.topicProgress & readiness', () => {
  it('devolve 0 sem NaN quando a cadeira não tem tópicos ou falta confidence', () => {
    const emptyCourse = makeCourse({ topics: [] });
    expect(topicProgress(emptyCourse)).toBe(0);
    expect(Number.isNaN(readiness(makeAssessment(), emptyCourse))).toBe(false);
    expect(readiness(makeAssessment(), emptyCourse)).toBe(0);

    // Simula tópico legado vindo de backup sem confidence definido
    const legacyTopicCourse = makeCourse({
      topics: [{ id: 't1', title: 'Limites', status: 'learning' } as unknown as Course['topics'][0]],
    });
    const r = readiness(makeAssessment({ topicIds: ['t1'] }), legacyTopicCourse);
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeCloseTo(0.35 * 0.6 + (3 / 5) * 0.4, 5);
  });

  it('calcula readiness agregada quando os tópicos têm estados mistos', () => {
    const c = makeCourse({
      topics: [
        { id: 't1', title: 'Derivadas', status: 'done', confidence: 5 },
        { id: 't2', title: 'Integrais', status: 'todo', confidence: 1 },
      ],
    });
    expect(topicProgress(c)).toBeCloseTo(0.5, 5);
    const r = readiness(makeAssessment({ topicIds: ['t1', 't2'] }), c);
    // t1 = 1*0.6 + 1*0.4 = 1.0; t2 = 0*0.6 + 0.2*0.4 = 0.08 -> média 0.54
    expect(r).toBeCloseTo(0.54, 5);
  });

  it('mantém urgência entre 0 e 100', () => {
    const u = urgency(makeAssessment(), makeCourse());
    expect(u).toBeGreaterThanOrEqual(0);
    expect(u).toBeLessThanOrEqual(100);
  });
});

describe('selectors.gradeSummary & semesterAverage', () => {
  it('calcula média ponderada, falta necessária e média por ECTS', () => {
    const c1 = makeCourse({ id: 'c1', ects: 6, targetGrade: 14 });
    const c2 = makeCourse({ id: 'c2', ects: 3, targetGrade: 12 });
    const assessments: Assessment[] = [
      makeAssessment({ id: 'a1', courseId: 'c1', weight: 40, grade: 16 }),
      makeAssessment({ id: 'a2', courseId: 'c1', weight: 60, grade: undefined }),
      makeAssessment({ id: 'a3', courseId: 'c2', weight: 100, grade: 10 }),
    ];

    const summary = gradeSummary(c1, assessments);
    expect(summary.current).toBeCloseTo(16, 5);
    expect(summary.gradedWeight).toBe(40);
    // (14*100 - 16*40) / 60 = 760 / 60 = 12.6667
    expect(summary.needed).toBeCloseTo(760 / 60, 4);

    // Média ECTS: (16*6 + 10*3) / 9 = 126 / 9 = 14
    expect(semesterAverage([c1, c2], assessments)).toBeCloseTo(14, 5);
  });
});

describe('selectors formatação e streak', () => {
  it('interpreta notas portuguesas com vírgula ou ponto dentro de 0-20', () => {
    expect(parsePtGrade('')).toBeNull();
    expect(parsePtGrade('14,5')).toBe(14.5);
    expect(parsePtGrade('18.25')).toBe(18.25);
    expect(parsePtGrade('21')).toBe('invalid');
    expect(parsePtGrade('abc')).toBe('invalid');
  });

  it('formata minutos corretamente', () => {
    expect(fmtMinutes(45)).toBe('45 min');
    expect(fmtMinutes(120)).toBe('2 h');
    expect(fmtMinutes(95)).toBe('1 h 35 min');
  });

  it('conta dias seguidos de estudo até hoje ou ontem', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const sessions: StudySession[] = [
      { id: 's1', courseId: 'c1', date: toDateStr(today), minutes: 50, done: true, generated: false },
      { id: 's2', courseId: 'c1', date: toDateStr(yesterday), minutes: 40, done: true, generated: false },
    ];
    expect(studyStreak(sessions)).toBe(2);
  });
});
