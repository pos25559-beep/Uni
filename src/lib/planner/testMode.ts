import { differenceInCalendarDays } from 'date-fns';
import type { Assessment, Course, StudySession, TestModeStatus } from '../../types';
import { sessionMinutes } from '../selectors';
import { parseDay } from './slots';
import { TEST_MODE_DAYS, type CourseMinutes } from './types';

/** Analisa se o estudante está em Modo Teste (< 10 dias para 1 ou 2+ avaliações). */
export function analyzeTestMode(
  courses: Course[],
  assessments: Assessment[],
  from: string,
): TestModeStatus {
  const refDay = parseDay(from);
  const courseById = new Map(courses.map((c) => [c.id, c]));

  const urgentAssessments = assessments
    .filter((a) => a.grade === undefined)
    .map((assessment) => {
      const course = courseById.get(assessment.courseId);
      if (!course) return null;
      const daysLeft = differenceInCalendarDays(parseDay(assessment.date), refDay);
      if (daysLeft < 0 || daysLeft > TEST_MODE_DAYS) return null;
      return { assessment, course, daysLeft };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.daysLeft - b.daysLeft || b.assessment.weight - a.assessment.weight);

  const urgentCourseIds = Array.from(new Set(urgentAssessments.map((u) => u.course.id)));
  const mode: TestModeStatus['mode'] =
    urgentCourseIds.length === 0
      ? 'normal'
      : urgentCourseIds.length === 1
        ? 'single_test'
        : 'multi_test';

  return { mode, urgentAssessments, urgentCourseIds };
}

/** Minutos planeados e realizados por cadeira, na ordem de `courses`. */
export function planSummary(sessions: StudySession[], courses: Course[]): CourseMinutes[] {
  return courses.map((c) => {
    const mine = sessions.filter((s) => s.courseId === c.id);
    return {
      courseId: c.id,
      planned: mine.reduce((sum, s) => sum + s.minutes, 0),
      done: mine.reduce((sum, s) => sum + sessionMinutes(s), 0),
    };
  });
}
