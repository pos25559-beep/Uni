import type {
  AcademicProfile,
  Assessment,
  AssessmentKind,
  ClassSlot,
  ClassType,
  Course,
  CourseColor,
  Settings,
} from '../types';

export interface SharedCourseItem {
  code: string;
  name: string;
  shortName: string;
  color: CourseColor;
  ects: number;
}

export interface SharedClassItem {
  courseCode: string;
  weekday: number;
  start: string;
  end: string;
  type: ClassType;
  room?: string;
}

export interface SharedAssessmentItem {
  courseCode: string;
  title: string;
  date: string;
  kind: AssessmentKind;
  weight: number;
}

export interface SemesterSharePayload {
  v: 1;
  semesterName: string;
  universityName?: string;
  degreeName?: string;
  courses: SharedCourseItem[];
  classes: SharedClassItem[];
  assessments: SharedAssessmentItem[];
}

const VALID_COLORS = new Set<CourseColor>([
  'violet',
  'sky',
  'emerald',
  'amber',
  'rose',
  'cyan',
  'orange',
  'lime',
]);
const VALID_CLASS_TYPES = new Set<ClassType>(['T', 'TP', 'P', 'OT']);
const VALID_ASSESSMENT_KINDS = new Set<AssessmentKind>([
  'exame',
  'teste',
  'trabalho',
  'projeto',
  'quiz',
]);

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlToBytes(str: string): Uint8Array {
  const padded = str.replaceAll('-', '+').replaceAll('_', '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

/** Constrói payload limpo sem dados pessoais (sem email, nome, notas ou chaves API). */
export function buildSemesterSharePayload(input: {
  settings: Partial<Settings>;
  academicProfile?: Partial<AcademicProfile>;
  courses: Course[];
  classes: ClassSlot[];
  assessments: Assessment[];
}): SemesterSharePayload {
  const courseById = new Map(input.courses.map((c) => [c.id, c]));

  return {
    v: 1,
    semesterName: (input.settings.semesterName || 'Semestre atual').slice(0, 80),
    universityName: input.academicProfile?.universityName?.slice(0, 80),
    degreeName: input.academicProfile?.degreeName?.slice(0, 80),
    courses: input.courses.slice(0, 20).map((c) => ({
      code: (c.code || c.shortName || c.name).slice(0, 24),
      name: c.name.slice(0, 100),
      shortName: (c.shortName || c.code || c.name).slice(0, 32),
      color: c.color,
      ects: c.ects,
    })),
    classes: input.classes.slice(0, 60).map((cl) => {
      const course = courseById.get(cl.courseId);
      return {
        courseCode: (course?.code || course?.shortName || course?.name || 'UC').slice(0, 24),
        weekday: cl.weekday,
        start: cl.start,
        end: cl.end,
        type: cl.type,
        ...(cl.room ? { room: cl.room.slice(0, 60) } : {}),
      };
    }),
    assessments: input.assessments
      .filter((a) => a.grade === undefined)
      .slice(0, 40)
      .map((a) => {
        const course = courseById.get(a.courseId);
        return {
          courseCode: (course?.code || course?.shortName || course?.name || 'UC').slice(0, 24),
          title: a.title.slice(0, 90),
          date: a.date,
          kind: a.kind,
          weight: a.weight,
        };
      }),
  };
}

export function encodeSemesterSharePayload(payload: SemesterSharePayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  return bytesToBase64Url(bytes);
}

export function decodeSemesterSharePayload(token: string): SemesterSharePayload | null {
  try {
    if (!token || token.length > 24000) return null;
    const bytes = base64UrlToBytes(token.trim());
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<SemesterSharePayload>;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.courses)) return null;

    const courses: SharedCourseItem[] = parsed.courses
      .filter((c) => c && typeof c.name === 'string' && typeof c.code === 'string')
      .slice(0, 20)
      .map((c) => ({
        code: c.code.slice(0, 24),
        name: c.name.slice(0, 100),
        shortName: (typeof c.shortName === 'string' ? c.shortName : c.code).slice(0, 32),
        color: VALID_COLORS.has(c.color) ? c.color : 'sky',
        ects: typeof c.ects === 'number' && Number.isFinite(c.ects) ? Math.max(0, Math.min(30, c.ects)) : 6,
      }));

    const classes: SharedClassItem[] = Array.isArray(parsed.classes)
      ? parsed.classes
          .filter(
            (cl) =>
              cl &&
              typeof cl.courseCode === 'string' &&
              typeof cl.weekday === 'number' &&
              cl.weekday >= 0 &&
              cl.weekday <= 6 &&
              typeof cl.start === 'string' &&
              typeof cl.end === 'string',
          )
          .slice(0, 60)
          .map((cl) => ({
            courseCode: cl.courseCode.slice(0, 24),
            weekday: cl.weekday,
            start: cl.start.slice(0, 5),
            end: cl.end.slice(0, 5),
            type: VALID_CLASS_TYPES.has(cl.type) ? cl.type : 'TP',
            ...(typeof cl.room === 'string' && cl.room.trim() ? { room: cl.room.trim().slice(0, 60) } : {}),
          }))
      : [];

    const assessments: SharedAssessmentItem[] = Array.isArray(parsed.assessments)
      ? parsed.assessments
          .filter(
            (a) =>
              a &&
              typeof a.courseCode === 'string' &&
              typeof a.title === 'string' &&
              typeof a.date === 'string',
          )
          .slice(0, 40)
          .map((a) => ({
            courseCode: a.courseCode.slice(0, 24),
            title: a.title.slice(0, 90),
            date: a.date.slice(0, 25),
            kind: VALID_ASSESSMENT_KINDS.has(a.kind) ? a.kind : 'teste',
            weight: typeof a.weight === 'number' && Number.isFinite(a.weight) ? Math.max(0, Math.min(100, a.weight)) : 0,
          }))
      : [];

    return {
      v: 1,
      semesterName:
        typeof parsed.semesterName === 'string' && parsed.semesterName.trim()
          ? parsed.semesterName.slice(0, 80)
          : 'Turma partilhada',
      universityName:
        typeof parsed.universityName === 'string' ? parsed.universityName.slice(0, 80) : undefined,
      degreeName: typeof parsed.degreeName === 'string' ? parsed.degreeName.slice(0, 80) : undefined,
      courses,
      classes,
      assessments,
    };
  } catch {
    return null;
  }
}

export function buildSemesterShareUrl(payload: SemesterSharePayload, origin?: string): string {
  const token = encodeSemesterSharePayload(payload);
  const base =
    origin ??
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://campus-erp-84964.web.app');
  return `${base.replace(/\/$/, '')}/calendario?turma=${encodeURIComponent(token)}`;
}

/** Calcula cursos novos, aulas e avaliações a acrescentar sem duplicar registos já existentes. */
export function planSharedSemesterImport(
  payload: SemesterSharePayload,
  existing: { courses: Course[]; classes: ClassSlot[]; assessments: Assessment[] },
  genId: () => string,
): { newCourses: Course[]; newClasses: ClassSlot[]; newAssessments: Assessment[] } {
  const courseIdByCode = new Map<string, string>();
  for (const c of existing.courses) {
    courseIdByCode.set(c.code.trim().toLowerCase(), c.id);
    courseIdByCode.set(c.name.trim().toLowerCase(), c.id);
  }

  const newCourses: Course[] = [];
  for (const item of payload.courses) {
    const key = item.code.trim().toLowerCase();
    const nameKey = item.name.trim().toLowerCase();
    if (courseIdByCode.has(key) || courseIdByCode.has(nameKey)) continue;
    const id = genId();
    courseIdByCode.set(key, id);
    courseIdByCode.set(nameKey, id);
    newCourses.push({
      id,
      code: item.code,
      name: item.name,
      shortName: item.shortName,
      ects: item.ects,
      color: item.color,
      targetGrade: 14,
      topics: [],
    });
  }

  const existingClassSigs = new Set(
    existing.classes.map((cl) => `${cl.courseId}|${cl.weekday}|${cl.start}|${cl.type}`),
  );
  const newClasses: ClassSlot[] = [];
  for (const cl of payload.classes) {
    let cid = courseIdByCode.get(cl.courseCode.trim().toLowerCase());
    if (!cid) {
      cid = genId();
      courseIdByCode.set(cl.courseCode.trim().toLowerCase(), cid);
      newCourses.push({
        id: cid,
        code: cl.courseCode,
        name: cl.courseCode,
        shortName: cl.courseCode,
        ects: 6,
        color: 'sky',
        targetGrade: 14,
        topics: [],
      });
    }
    const sig = `${cid}|${cl.weekday}|${cl.start}|${cl.type}`;
    if (existingClassSigs.has(sig)) continue;
    existingClassSigs.add(sig);
    newClasses.push({
      id: genId(),
      courseId: cid,
      type: cl.type,
      weekday: cl.weekday,
      start: cl.start,
      end: cl.end,
      ...(cl.room ? { room: cl.room } : {}),
      source: 'local',
    });
  }

  const existingAssessmentSigs = new Set(
    existing.assessments.map((a) => `${a.courseId}|${a.date.slice(0, 10)}|${a.title.trim().toLowerCase()}`),
  );
  const newAssessments: Assessment[] = [];
  for (const a of payload.assessments) {
    const cid = courseIdByCode.get(a.courseCode.trim().toLowerCase());
    if (!cid) continue;
    const sig = `${cid}|${a.date.slice(0, 10)}|${a.title.trim().toLowerCase()}`;
    if (existingAssessmentSigs.has(sig)) continue;
    existingAssessmentSigs.add(sig);
    newAssessments.push({
      id: genId(),
      courseId: cid,
      kind: a.kind,
      title: a.title,
      date: a.date,
      weight: a.weight,
      topicIds: [],
      source: 'local',
    });
  }

  return { newCourses, newClasses, newAssessments };
}
