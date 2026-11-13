import type { AppState } from '../store/useStore';
import type {
  AcademicProfile,
  Assessment,
  CalendarEvent,
  ClassSlot,
  Course,
  Material,
  Settings,
  StudySession,
  Task,
  WeeklyCheckIn,
} from '../types';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const hasId = (v: unknown) => isRecord(v) && typeof v.id === 'string' && v.id.length > 0;

/** Itens válidos (objetos com id) de uma coleção do ficheiro. */
export const pickItems = <T,>(v: unknown): T[] =>
  Array.isArray(v) ? (v.filter(hasId) as T[]) : [];

/** Serializa todos os dados locais sem expor a chave Gemini do utilizador. */
export function buildBackupPayload(s: AppState) {
  return {
    app: 'unipedia',
    version: 1,
    exportedAt: new Date().toISOString(),
    collections: {
      courses: s.courses,
      assessments: s.assessments,
      classes: s.classes,
      sessions: s.sessions,
      tasks: s.tasks,
      materials: s.materials,
      events: s.events,
    },
    academicProfile: s.academicProfile,
    weeklyCheckIns: s.weeklyCheckIns,
    settings: { ...s.settings, geminiApiKey: '' },
  };
}

/** Valida e aplica um ficheiro JSON de cópia de segurança ao store local. */
export function applyBackupJson(rawText: string, st: AppState): number {
  const parsed: unknown = JSON.parse(rawText);
  if (!isRecord(parsed) || !isRecord(parsed.collections)) {
    throw new Error('Ficheiro inválido: falta o objeto «collections».');
  }
  const cols = parsed.collections;
  const known = ['courses', 'assessments', 'classes', 'sessions', 'tasks', 'materials', 'events'];
  if (!known.some((k) => Array.isArray(cols[k]))) {
    throw new Error('Ficheiro inválido: não encontrei nenhuma coleção conhecida.');
  }

  const courses = pickItems<Course>(cols.courses);
  const assessments = pickItems<Assessment>(cols.assessments);
  const classes = pickItems<ClassSlot>(cols.classes);
  const sessions = pickItems<StudySession>(cols.sessions);
  const tasks = pickItems<Task>(cols.tasks);
  const materials = pickItems<Material>(cols.materials);
  const events = pickItems<CalendarEvent>(cols.events);

  st.upsertMany('courses', courses);
  st.upsertMany('assessments', assessments);
  st.upsertMany('classes', classes);
  st.upsertMany('sessions', sessions);
  st.upsertMany('tasks', tasks);
  st.upsertMany('materials', materials);
  st.upsertMany('events', events);

  if (isRecord(parsed.academicProfile)) {
    const prof = parsed.academicProfile as Partial<AcademicProfile>;
    st.saveAcademicProfile({
      ...prof,
      completedCourses: Array.isArray(prof.completedCourses) ? prof.completedCourses : [],
      difficultCourseIds: Array.isArray(prof.difficultCourseIds) ? prof.difficultCourseIds : [],
    });
  }

  if (Array.isArray(parsed.weeklyCheckIns)) {
    for (const ci of pickItems<WeeklyCheckIn>(parsed.weeklyCheckIns)) {
      st.addWeeklyCheckIn(ci);
    }
  }

  if (isRecord(parsed.settings)) {
    // Ignora a chave Gemini do ficheiro para não apagar a do utilizador.
    const incoming = Object.fromEntries(
      Object.entries(parsed.settings).filter(([k]) => k !== 'geminiApiKey'),
    );
    st.updateSettings(incoming as Partial<Settings>);
  }

  return (
    courses.length +
    assessments.length +
    classes.length +
    sessions.length +
    tasks.length +
    materials.length +
    events.length
  );
}
