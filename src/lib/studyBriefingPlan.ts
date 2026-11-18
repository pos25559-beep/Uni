import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { newId } from '../store/useStore';
import {
  findFirstFreeSlotOnDate,
  generatePlan,
  matchBestMaterialForTopic,
  resolveDayPlanProfile,
} from './planner';
import { parsePlannerBriefing, resolveWeekdayAvailability } from './plannerBriefing';
import type {
  Assessment,
  CalendarEvent,
  ClassSlot,
  Course,
  ExtraActivity,
  ID,
  Material,
  PlannerPreferences,
  PlannerWindowMode,
  Settings,
  StudyLogEntry,
  StudySession,
  Topic,
  WeeklyCheckIn,
} from '../types';

export type LlmBriefingFocusKind = 'theory' | 'practice' | 'review' | 'exam_prep';

export interface LlmWeeklyBriefingBlock {
  dayOffset: number;
  courseId: string;
  courseShortName?: string | null;
  topicId?: string | null;
  topicTitle?: string | null;
  window: PlannerWindowMode;
  minutes: number;
  focusKind: LlmBriefingFocusKind;
  reasonNote: string;
}

export interface LlmWeeklyBriefingOutput {
  strategySummary: string;
  focusCourseIds: string[];
  suggestedFollowUps: string[];
  blocks: LlmWeeklyBriefingBlock[];
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const VALID_WINDOWS = new Set<PlannerWindowMode>(['auto', 'morning', 'afternoon', 'evening', 'all_day']);

/** Constroi um resumo compacto e seguro dos cursos, topicos, provas e disponibilidade dos proximos 7 dias para o LLM. */
export function buildBriefingPlannerSnapshot(args: {
  courses: Course[];
  assessments: Assessment[];
  classes: ClassSlot[];
  events: CalendarEvent[];
  settings: Settings;
  today: string;
}): string {
  const { courses, assessments, classes, events, settings, today } = args;
  const prefs = settings.plannerPrefs;
  const lines: string[] = [];

  lines.push(`TODAY: ${today}`);
  lines.push(`DEFAULT_DAILY_BUDGET_MIN: ${settings.dailyStudyMinutes}`);

  lines.push('COURSES:');
  for (const c of courses) {
    const pendingTopics = c.topics
      .filter((t) => t.status !== 'done' || t.confidence <= 3)
      .slice(0, 10)
      .map((t) => `${t.id}:"${t.title}"(${t.status},conf=${t.confidence}/5)`);
    const fallbackTopics =
      pendingTopics.length === 0
        ? c.topics.slice(0, 6).map((t) => `${t.id}:"${t.title}"(${t.status},conf=${t.confidence}/5)`)
        : [];
    const topicText = [...pendingTopics, ...fallbackTopics].join('; ');
    lines.push(
      `- id=${c.id} | short=${c.shortName} | code=${c.code} | name="${c.name}"${topicText ? ` | topics=[${topicText}]` : ''}`,
    );
  }

  const todayDate = parseISO(today);
  const upcoming = assessments
    .filter((a) => a.grade === undefined)
    .map((a) => ({ a, daysLeft: differenceInCalendarDays(parseISO(a.date.slice(0, 10)), todayDate) }))
    .filter((x) => x.daysLeft >= 0 && x.daysLeft <= 21)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  if (upcoming.length > 0) {
    lines.push('UPCOMING_ASSESSMENTS:');
    for (const { a, daysLeft } of upcoming) {
      const course = courses.find((c) => c.id === a.courseId);
      lines.push(
        `- courseId=${a.courseId} (${course?.shortName ?? ''}) | title="${a.title}" | kind=${a.kind} | inDays=${daysLeft} | weight=${a.weight}%`,
      );
    }
  }

  lines.push('NEXT_7_DAYS_AVAILABILITY:');
  for (let offset = 0; offset < 7; offset++) {
    const day = addDays(todayDate, offset);
    const dateKey = format(day, 'yyyy-MM-dd');
    const wd = day.getDay();
    const avail = resolveWeekdayAvailability(
      wd,
      settings,
      prefs?.weekdaySchedule,
      prefs?.preferredPeriod ?? 'auto',
    );
    const dayClasses = classes
      .filter((cl) => cl.weekday === wd)
      .map((cl) => `${cl.start}-${cl.end}`)
      .join(',');
    const dayEvents = events
      .filter((ev) => !ev.allDay && ev.start.slice(0, 10) === dateKey)
      .map((ev) => `${ev.start.slice(11, 16)}-${ev.end.slice(11, 16)}`)
      .join(',');
    lines.push(
      `- dayOffset=${offset} (${dateKey}, wd=${wd}): enabled=${avail.enabled}, targetMin=${avail.minutes}, window=${avail.window}${avail.blockedPeriods?.length ? `, blocked=[${avail.blockedPeriods.join(',')}]` : ''}${dayClasses ? `, classes=[${dayClasses}]` : ''}${dayEvents ? `, events=[${dayEvents}]` : ''}`,
    );
  }

  return lines.join('\n');
}

function resolveCourseForBlock(
  block: LlmWeeklyBriefingBlock,
  courses: Course[],
  assessments: Assessment[],
  today: string,
): Course | undefined {
  if (courses.length === 0) return undefined;
  const byId = courses.find((c) => c.id === block.courseId);
  if (byId) return byId;

  const hint = norm(block.courseShortName || block.courseId || '');
  if (hint) {
    const exactMatch = courses.find(
      (c) => norm(c.shortName) === hint || norm(c.code) === hint || norm(c.name) === hint,
    );
    if (exactMatch) return exactMatch;
    const partialMatch = courses.find(
      (c) =>
        norm(c.name).includes(hint) ||
        hint.includes(norm(c.shortName)) ||
        norm(c.shortName).includes(hint),
    );
    if (partialMatch) return partialMatch;
  }

  const todayDate = parseISO(today);
  const nearest = assessments
    .filter((a) => a.grade === undefined && differenceInCalendarDays(parseISO(a.date.slice(0, 10)), todayDate) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return (nearest && courses.find((c) => c.id === nearest.courseId)) ?? courses[0];
}

function resolveTopicForBlock(
  block: LlmWeeklyBriefingBlock,
  course: Course,
): Topic | undefined {
  if (course.topics.length === 0) return undefined;
  if (block.topicId) {
    const exact = course.topics.find((t) => t.id === block.topicId);
    if (exact) return exact;
  }
  const titleHint = norm(block.topicTitle || '');
  if (titleHint) {
    const exactTitle = course.topics.find((t) => norm(t.title) === titleHint);
    if (exactTitle) return exactTitle;
    const partialTitle = course.topics.find(
      (t) => norm(t.title).includes(titleHint) || titleHint.includes(norm(t.title)),
    );
    if (partialTitle) return partialTitle;
    const words = titleHint.split(/\s+/).filter((w) => w.length >= 4);
    if (words.length > 0) {
      let best: { topic: Topic; hits: number } | null = null;
      for (const tp of course.topics) {
        const tpNorm = norm(tp.title);
        const hits = words.filter((w) => tpNorm.includes(w)).length;
        if (hits > 0 && (!best || hits > best.hits)) {
          best = { topic: tp, hits };
        }
      }
      if (best) return best.topic;
    }
  }
  return undefined;
}

/**
 * Converte os blocos estruturados gerados pelo LLM em sessoes reais encaixadas sem colisoes
 * com aulas, eventos e sessoes fixadas/concluidas nos proximos 7 dias.
 */
export function groundLlmWeeklyPlan(args: {
  llmOutput: LlmWeeklyBriefingOutput;
  courses: Course[];
  assessments: Assessment[];
  classes: ClassSlot[];
  events: CalendarEvent[];
  materials: Material[];
  settings: Settings;
  existingPreservedSessions: StudySession[];
  today: string;
  nowMinutes?: number;
}): StudySession[] {
  const {
    llmOutput,
    courses,
    assessments,
    classes,
    events,
    materials,
    settings,
    existingPreservedSessions,
    today,
    nowMinutes,
  } = args;

  if (courses.length === 0 || !Array.isArray(llmOutput.blocks) || llmOutput.blocks.length === 0) {
    return [];
  }

  const prefs = settings.plannerPrefs;
  const baseDate = parseISO(today);
  const grounded: StudySession[] = [];
  const allOccupied = [...existingPreservedSessions];

  const sortedBlocks = [...llmOutput.blocks]
    .slice(0, 28)
    .sort((a, b) => a.dayOffset - b.dayOffset);

  for (const rawBlock of sortedBlocks) {
    const course = resolveCourseForBlock(rawBlock, courses, assessments, today);
    if (!course) continue;
    if (prefs?.pausedCourseIds?.includes(course.id)) continue;

    const topic = resolveTopicForBlock(rawBlock, course);
    const clampedOffset = Math.max(0, Math.min(6, Math.round(rawBlock.dayOffset || 0)));
    const clampedMinutes = Math.max(
      25,
      Math.min(90, Math.round((rawBlock.minutes || prefs?.blockMinutes || 50) / 5) * 5),
    );
    const preferredWindow: PlannerWindowMode = VALID_WINDOWS.has(rawBlock.window)
      ? rawBlock.window
      : prefs?.preferredPeriod ?? 'auto';

    // Proxima avaliacao desta cadeira para ligar contexto e material
    const baseTargetDate = addDays(baseDate, clampedOffset);
    const nearestAssessment = assessments
      .filter((a) => a.courseId === course.id && a.grade === undefined)
      .map((a) => ({
        a,
        daysFromToday: differenceInCalendarDays(parseISO(a.date.slice(0, 10)), baseDate),
      }))
      .filter((x) => x.daysFromToday >= 0)
      .sort((a, b) => a.daysFromToday - b.daysFromToday)[0];

    // Procura o primeiro slot livre a partir de dayOffset (e se o dia estiver cheio, tenta dias seguintes dentro da semana)
    let chosenDateKey: string | null = null;
    let chosenSlot: string | undefined;

    for (let spill = 0; spill < 7; spill++) {
      const candidateOffset = (clampedOffset + spill) % 7;
      // Evita voltar para tras depois de tentar todos os restantes dias se o proprio dia ja passou
      if (spill > 0 && candidateOffset < clampedOffset && clampedOffset + spill >= 7) {
        // Permite encaixe noutro dia livre da semana apenas como ultimo recurso
      }
      const candidateDate = addDays(baseDate, candidateOffset);
      const dateKey = format(candidateDate, 'yyyy-MM-dd');
      const wd = candidateDate.getDay();
      const avail = resolveWeekdayAvailability(
        wd,
        settings,
        prefs?.weekdaySchedule,
        prefs?.preferredPeriod ?? 'auto',
      );
      const effectiveWindow =
        preferredWindow !== 'auto'
          ? preferredWindow
          : avail.window;

      const slot = findFirstFreeSlotOnDate({
        dateKey,
        minutes: clampedMinutes,
        preferredPeriod: effectiveWindow,
        nowMinutes: candidateOffset === 0 ? nowMinutes : undefined,
        classes,
        events,
        existingSessions: allOccupied,
        blockedPeriods: avail.blockedPeriods,
      });

      if (slot) {
        chosenDateKey = dateKey;
        chosenSlot = slot;
        break;
      }
    }

    if (!chosenDateKey || !chosenSlot) continue;

    const isExamUrgent =
      rawBlock.focusKind === 'exam_prep' ||
      Boolean(nearestAssessment && nearestAssessment.daysFromToday <= 10);
    const contentMix =
      rawBlock.focusKind === 'practice' || rawBlock.focusKind === 'exam_prep'
        ? 'practice_first'
        : rawBlock.focusKind === 'theory'
          ? 'theory_first'
          : prefs?.contentMix ?? 'balanced';

    const materialId = matchBestMaterialForTopic({
      courseId: course.id,
      topic,
      materials,
      contentMix,
      isExamUrgent,
    });

    const cleanNote = rawBlock.reasonNote.trim().slice(0, 90);
    const examDays =
      nearestAssessment && nearestAssessment.daysFromToday <= 14
        ? Math.max(
            0,
            differenceInCalendarDays(parseISO(nearestAssessment.a.date.slice(0, 10)), parseISO(chosenDateKey)),
          )
        : undefined;

    const session: StudySession = {
      id: newId(),
      courseId: course.id,
      ...(topic ? { topicId: topic.id } : {}),
      ...(nearestAssessment && isExamUrgent ? { assessmentId: nearestAssessment.a.id } : {}),
      ...(materialId ? { materialId } : {}),
      date: chosenDateKey,
      start: chosenSlot,
      minutes: clampedMinutes,
      done: false,
      ...(cleanNote ? { notes: cleanNote } : {}),
      reason: {
        code: 'briefing',
        ...(cleanNote ? { label: cleanNote } : {}),
        ...(examDays !== undefined ? { examDays } : {}),
        ...(nearestAssessment?.a.weight ? { weight: nearestAssessment.a.weight } : {}),
      },
      generated: true,
    };

    grounded.push(session);
    allOccupied.push(session);
    void baseTargetDate;
  }

  return grounded.sort(
    (a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''),
  );
}

/**
 * Fallback offline explícito (só invocado quando o estudante escolhe explicitamente continuar sem IA).
 */
export function buildOfflineBriefingWeeklyFallback(args: {
  briefingText: string;
  courses: Course[];
  assessments: Assessment[];
  classes: ClassSlot[];
  events: CalendarEvent[];
  materials: Material[];
  settings: Settings;
  existingPreservedSessions: StudySession[];
  difficultCourseIds?: ID[];
  weeklyCheckIns?: WeeklyCheckIn[];
  studyLogs?: StudyLogEntry[];
  extraActivities?: ExtraActivity[];
  today: string;
  nowMinutes?: number;
}): { sessions: StudySession[]; strategySummary: string } {
  const parsed = parsePlannerBriefing({
    text: args.briefingText,
    courses: args.courses,
    materials: args.materials,
  });

  const prefs: PlannerPreferences | undefined = args.settings.plannerPrefs;
  const weekdaySchedule = prefs?.weekdaySchedule
    ? { ...prefs.weekdaySchedule }
    : undefined;

  if (weekdaySchedule) {
    for (const u of parsed.weekdayUpdates) {
      const k = String(u.weekday);
      const cur = weekdaySchedule[k] ?? { enabled: true, minutes: 120, window: 'auto' as const };
      const blocked = new Set(cur.blockedPeriods ?? []);
      if (u.blockedPeriod) blocked.add(u.blockedPeriod);
      weekdaySchedule[k] = {
        ...cur,
        ...(u.enabled !== undefined ? { enabled: u.enabled } : {}),
        ...(u.window ? { window: u.window } : {}),
        ...(u.minutes !== undefined ? { minutes: u.minutes } : {}),
        ...(blocked.size > 0 ? { blockedPeriods: [...blocked] } : {}),
      };
    }
  }

  const effectiveCourses =
    parsed.topicUpdates.length > 0
      ? args.courses.map((c) => ({
          ...c,
          topics: c.topics.map((tp) => {
            const upd = parsed.topicUpdates.find((u) => u.topicId === tp.id);
            return upd ? { ...tp, status: upd.status, confidence: upd.confidence } : tp;
          }),
        }))
      : args.courses;

  const sessions = generatePlan({
    courses: effectiveCourses,
    assessments: args.assessments,
    classes: args.classes,
    events: args.events,
    materials: args.materials,
    settings: args.settings,
    from: args.today,
    nowMinutes: args.nowMinutes,
    days: 7,
    existing: args.existingPreservedSessions,
    difficultCourseIds: args.difficultCourseIds,
    weeklyCheckIns: args.weeklyCheckIns,
    studyLogs: args.studyLogs,
    extraActivities: args.extraActivities,
    preferredPeriod: prefs?.preferredPeriod,
    blockMinutes: prefs?.blockMinutes,
    strategy: parsed.midSemesterCatchUp ? 'catch_up' : prefs?.strategy ?? 'balanced',
    boostCourseIds: [...new Set([...(prefs?.boostCourseIds ?? []), ...parsed.boostCourseIds])],
    pausedCourseIds: parsed.pausedCourseIds.length > 0 ? parsed.pausedCourseIds : prefs?.pausedCourseIds,
    exclusiveTestFocus: prefs?.exclusiveTestFocus,
    weekdaySchedule,
    fillClassGaps: prefs?.fillClassGaps,
    preExamMarathon: parsed.suggestedMarathon ?? prefs?.preExamMarathon,
    contentMix: prefs?.contentMix,
    briefingCourseFocus: {
      ...(prefs?.briefingCourseFocus ?? {}),
      ...parsed.briefingCourseFocus,
    },
  });

  const insightLabels = parsed.insights.map((i) => i.label).slice(0, 3);
  const strategySummary =
    insightLabels.length > 0
      ? insightLabels.join(' · ')
      : args.briefingText.trim().slice(0, 140);

  void resolveDayPlanProfile;

  return { sessions, strategySummary };
}
