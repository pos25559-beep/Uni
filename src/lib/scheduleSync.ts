import { matchCourse } from '../integrations/clip';
import { newId, useStore } from '../store/useStore';
import type { Assessment, ClassSlot, Course, CourseColor } from '../types';
import { colorNames } from './colors';
import {
  collectKnownCourseCandidates,
  deriveCourseAcronym,
  getDegreeCurriculum,
  resolveKnownCourseIdentity,
  type CurriculumCourseTemplate,
} from './portugalCurriculum';
import type {
  ExtractedScheduleAssessment,
  ExtractedSchedulePayload,
  ExtractedScheduleSlot,
} from './visionParsers';

export interface ResolvedSyncSlot extends ExtractedScheduleSlot {
  id: string;
  selected: boolean;
  matchedCourse?: Course;
}

export interface ResolvedSyncAssessment extends ExtractedScheduleAssessment {
  id: string;
  selected: boolean;
  matchedCourse?: Course;
}

export interface ResolvedScheduleSyncBundle {
  slots: ResolvedSyncSlot[];
  assessments: ResolvedSyncAssessment[];
  applied?: boolean;
  appliedSummary?: string;
}

function getKnownCourseContext() {
  const state = useStore.getState();
  const profile = state.academicProfile;
  const degreeTemplates: CurriculumCourseTemplate[] =
    profile?.universityId && profile?.degreeId
      ? (getDegreeCurriculum(profile.universityId, profile.degreeId)?.courses ?? [])
      : [];
  const knownCourses = collectKnownCourseCandidates({
    courses: state.courses,
    completedCourses: profile?.completedCourses ?? [],
    degreeTemplates,
  });
  return { state, degreeTemplates, knownCourses };
}

/** Resolve siglas/nomes extraídos contra cadeiras reais do aluno antes de apresentar ou gravar. */
export function resolveExtractedScheduleBundle(
  payload: ExtractedSchedulePayload,
): ResolvedScheduleSyncBundle {
  const { state, degreeTemplates, knownCourses } = getKnownCourseContext();

  const slots: ResolvedSyncSlot[] = payload.slots.map((s, idx) => {
    const resolved = resolveKnownCourseIdentity(
      { code: s.courseCode, name: s.courseName },
      knownCourses,
      degreeTemplates,
    );
    const canonicalName = resolved?.name ?? s.courseName;
    const canonicalCode = resolved?.shortName || resolved?.code || s.courseCode;
    const matchedCourse = matchCourse(canonicalName, state.courses, canonicalCode);
    return {
      ...s,
      id: `sync-slot-${idx}-${canonicalName}-${s.weekday}-${s.start}`,
      courseName: matchedCourse?.name || canonicalName,
      courseCode: matchedCourse?.shortName || matchedCourse?.code || canonicalCode,
      matchedCourse,
      selected: true,
    };
  });

  const assessments: ResolvedSyncAssessment[] = payload.assessments.map((a, idx) => {
    const resolved = resolveKnownCourseIdentity(
      { code: a.courseCode, name: a.courseName },
      knownCourses,
      degreeTemplates,
    );
    const canonicalName = resolved?.name ?? a.courseName;
    const canonicalCode = resolved?.shortName || resolved?.code || a.courseCode;
    const matchedCourse = matchCourse(canonicalName, state.courses, canonicalCode);
    return {
      ...a,
      id: `sync-ass-${idx}-${canonicalName}-${a.date}-${a.title}`,
      courseName: matchedCourse?.name || canonicalName,
      courseCode: matchedCourse?.shortName || matchedCourse?.code || canonicalCode,
      matchedCourse,
      selected: true,
    };
  });

  return { slots, assessments };
}

/** Aplica aulas e avaliações selecionadas no store da Unipedia e reconcilia o plano de estudo. */
export function commitScheduleSyncToStore(bundle: {
  slots: ResolvedSyncSlot[];
  assessments: ResolvedSyncAssessment[];
}): { createdCoursesCount: number; classesCount: number; assessmentsCount: number } {
  const store = useStore.getState();
  const currentCourses = [...store.courses];
  const createdCourses: Course[] = [];
  let colorIdx = currentCourses.length;
  const palette = colorNames.length > 0 ? colorNames : (['emerald', 'sky', 'amber'] as CourseColor[]);

  const ensureCourseId = (courseName: string, courseCode?: string): string => {
    const existing = matchCourse(courseName, [...currentCourses, ...createdCourses], courseCode);
    if (existing) return existing.id;

    const code = deriveCourseAcronym(courseName, courseCode);
    const created: Course = {
      id: newId(),
      code,
      name: courseName,
      shortName: code.slice(0, 12),
      ects: 6,
      color: palette[colorIdx++ % palette.length] ?? 'emerald',
      targetGrade: 14,
      topics: [],
    };
    createdCourses.push(created);
    return created.id;
  };

  const selectedSlots = bundle.slots.filter((s) => s.selected);
  const selectedAssessments = bundle.assessments.filter((a) => a.selected);

  const existingClassKeys = new Set(
    store.classes.map((c) => `${c.courseId}|${c.weekday}|${c.start}|${c.end}`),
  );
  const newClasses: ClassSlot[] = [];
  for (const s of selectedSlots) {
    const courseId = ensureCourseId(s.courseName, s.courseCode);
    const key = `${courseId}|${s.weekday}|${s.start}|${s.end}`;
    if (existingClassKeys.has(key)) continue;
    existingClassKeys.add(key);
    newClasses.push({
      id: newId(),
      courseId,
      type: s.type,
      weekday: s.weekday,
      start: s.start,
      end: s.end,
      room: s.room,
      source: 'local',
    });
  }

  const assessmentsToUpsert: Assessment[] = [];
  for (const a of selectedAssessments) {
    const courseId = ensureCourseId(a.courseName, a.courseCode);
    const normTitle = a.title.trim().toLowerCase();
    const existing = store.assessments.find(
      (x) =>
        x.courseId === courseId &&
        (x.title.trim().toLowerCase() === normTitle || x.date.slice(0, 10) === a.date.slice(0, 10)),
    );
    if (existing) {
      assessmentsToUpsert.push({
        ...existing,
        date: a.date,
        title: a.title || existing.title,
        kind: a.kind,
        location: a.location ?? existing.location,
      });
    } else {
      assessmentsToUpsert.push({
        id: newId(),
        courseId,
        kind: a.kind,
        title: a.title,
        date: a.date,
        weight: 30,
        topicIds: [],
        location: a.location,
        source: 'local',
      });
    }
  }

  if (createdCourses.length > 0) store.upsertMany('courses', createdCourses);
  if (newClasses.length > 0) store.upsertMany('classes', newClasses);
  if (assessmentsToUpsert.length > 0) store.upsertMany('assessments', assessmentsToUpsert);
  if (createdCourses.length > 0 || newClasses.length > 0 || assessmentsToUpsert.length > 0) {
    store.reconcileFuturePlan(true);
  }

  return {
    createdCoursesCount: createdCourses.length,
    classesCount: newClasses.length,
    assessmentsCount: assessmentsToUpsert.length,
  };
}
