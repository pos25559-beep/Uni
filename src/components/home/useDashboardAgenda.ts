import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { courseColors } from '../../lib/colors';
import { analyzeTestMode } from '../../lib/planner';
import {
  daysUntil,
  minutesThisWeek,
  readiness,
  semesterAverage,
  sessionMinutes,
  studyStreak,
  upcomingAssessments,
  urgency,
} from '../../lib/selectors';
import { pickActiveInAppNudge } from '../../lib/uniNotifications';
import type {
  Assessment,
  CalendarEvent,
  ClassSlot,
  Course,
  Settings,
  StudyLogEntry,
  StudySession,
  Task,
  WeeklyCheckIn,
} from '../../types';
import type { AgendaItem, Scored } from './DashboardRows';

export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const fmtDay = (iso: string) => format(parseISO(iso), 'd MMM', { locale: pt });
export const fmtDateTime = (iso: string) => format(parseISO(iso), 'EEE d MMM · HH:mm', { locale: pt });
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const dayWord = (days: number) => {
  if (days === 0) return 'hoje';
  if (days === 1) return 'amanhã';
  if (days === -1) return 'ontem';
  return days > 0 ? `em ${days} dias` : `há ${-days} dias`;
};

export const compareTasks = (a: Task, b: Task) => {
  if (a.due !== b.due) {
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due < b.due ? -1 : 1;
  }
  return a.priority - b.priority;
};

interface DashboardAgendaArgs {
  courses: Course[];
  assessments: Assessment[];
  classes: ClassSlot[];
  events: CalendarEvent[];
  sessions: StudySession[];
  tasks: Task[];
  studyLogs: StudyLogEntry[];
  weeklyCheckIns: WeeklyCheckIn[];
  settings: Settings;
  now: Date;
}

/** Agrega dados derivados do dia, avaliações próximas, agenda e alertas do Uni para a página Hoje. */
export function useDashboardAgenda({
  courses,
  assessments,
  classes,
  events,
  sessions,
  tasks,
  studyLogs,
  weeklyCheckIns,
  settings,
  now,
}: DashboardAgendaArgs) {
  const today = useMemo(() => format(now, 'yyyy-MM-dd'), [now]);
  const weekday = now.getDay();
  const nowTime = useMemo(() => format(now, 'HH:mm'), [now]);

  const courseById = useMemo(
    () => new Map<string, Course>(courses.map((c) => [c.id, c])),
    [courses],
  );

  const upcoming = useMemo(() => upcomingAssessments(assessments), [assessments]);

  const scored = useMemo<Scored[]>(
    () =>
      upcoming.map((a) => {
        const course = courseById.get(a.courseId);
        return { a, course, score: urgency(a, course), ready: readiness(a, course) };
      }),
    [upcoming, courseById],
  );

  const topAlert = useMemo(() => {
    let top: Scored | undefined;
    for (const x of scored) {
      if (daysUntil(x.a.date) <= 14 && (!top || x.score > top.score)) top = x;
    }
    return top && top.score >= 30 ? top : undefined;
  }, [scored]);

  const overdue = useMemo(
    () => sessions.filter((s) => !s.done && s.date < today).length,
    [sessions, today],
  );

  const average = useMemo(() => semesterAverage(courses, assessments), [courses, assessments]);
  const weekMinutes = useMemo(() => minutesThisWeek(sessions), [sessions]);
  const weekGoal = settings.dailyStudyMinutes * settings.studyDays.length;
  const weekPct = weekGoal > 0 ? Math.min(100, Math.round((weekMinutes / weekGoal) * 100)) : 0;
  const streak = useMemo(() => studyStreak(sessions), [sessions]);

  const todaySessions = useMemo(
    () =>
      sessions
        .filter((s) => s.date === today)
        .sort(
          (a, b) =>
            (a.start ?? '99:99').localeCompare(b.start ?? '99:99') || a.minutes - b.minutes,
        ),
    [sessions, today],
  );

  const plannedToday = todaySessions.reduce((sum, s) => sum + s.minutes, 0);
  const doneToday = todaySessions.reduce((sum, s) => sum + (s.done ? sessionMinutes(s) : 0), 0);
  const progressToday = plannedToday > 0 ? doneToday / plannedToday : 0;

  const inAppNudge = useMemo(
    () =>
      pickActiveInAppNudge({
        courses,
        assessments,
        classes,
        sessions,
        studyLogs,
        weeklyCheckIns,
        settings,
        now,
      }),
    [courses, assessments, classes, sessions, studyLogs, weeklyCheckIns, settings, now],
  );

  const agenda = useMemo<AgendaItem[]>(() => {
    const fromClasses: AgendaItem[] = classes
      .filter((c) => c.weekday === weekday)
      .map((c) => {
        const course = courseById.get(c.courseId);
        return {
          key: `c-${c.id}`,
          start: c.start,
          end: c.end,
          allDay: false,
          title: course ? `${course.shortName} · ${c.type}` : c.type,
          sub: c.room,
          dot: course ? courseColors[course.color].dot : 'bg-muted',
        };
      });
    const fromEvents: AgendaItem[] = events
      .filter((e) => e.start.slice(0, 10) === today)
      .map((e) => {
        const course = e.courseId ? courseById.get(e.courseId) : undefined;
        return {
          key: `e-${e.id}`,
          start: e.allDay ? '00:00' : e.start.slice(11, 16),
          end: e.allDay ? '' : e.end.slice(11, 16),
          allDay: !!e.allDay,
          title: e.title,
          sub: e.location,
          dot: course ? courseColors[course.color].dot : 'bg-accent',
        };
      });
    return [...fromClasses, ...fromEvents].sort((a, b) => a.start.localeCompare(b.start));
  }, [classes, events, courseById, today, weekday]);

  const pendingTasks = useMemo(
    () => tasks.filter((t) => !t.done).sort(compareTasks),
    [tasks],
  );

  const testMode = useMemo(
    () => analyzeTestMode(courses, assessments, today),
    [courses, assessments, today],
  );

  return {
    today,
    nowTime,
    courseById,
    upcoming,
    scored,
    topAlert,
    overdue,
    average,
    weekMinutes,
    weekGoal,
    weekPct,
    streak,
    todaySessions,
    plannedToday,
    doneToday,
    progressToday,
    inAppNudge,
    agenda,
    pendingTasks,
    testMode,
  };
}
