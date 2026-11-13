import { isNonAcademicDocument, matchesCourse } from './courseAliases';
import { emptyCollections } from './seed';
import type { AcademicProfile, Collections, Course, Material, WeeklyCheckIn } from '../types';

const LEGACY_PERSONAL_IDS = [
  '1v3KSXUxC6E62ekhx4zawYbcF3YEHre1B',
  '1FrdZ9ifEs_0rpTHZAA4K6YOo2kMOkKI8',
  '15LIku2BmCeBuOKEblcrOLre80gZ8_N56',
];

function containsLegacyPersonalSeed(text?: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes('mec bolinhas') ||
    LEGACY_PERSONAL_IDS.some((id) => text.includes(id))
  );
}

/**
 * Higieniza materiais persistidos ou importados: remove ficheiros pessoais,
 * links de pesquisa inválidos e eventuais registos herdados do modo demo antigo.
 */
export function sanitizeMaterials(
  materials: Material[],
  courses: Course[] = [],
): { clean: Material[]; removedCount: number } {
  const c3d = courses.find((c) => c.id === 'c3d');
  let removedCount = 0;
  const clean: Material[] = [];

  for (const m of materials) {
    if (!m || !m.id || m.id.includes('-d') || m.id.includes('-m')) {
      removedCount++;
      continue;
    }
    if (containsLegacyPersonalSeed(m.title) || containsLegacyPersonalSeed(m.url)) {
      removedCount++;
      continue;
    }
    if (m.provider === 'onedrive') {
      removedCount++;
      continue;
    }
    if (m.url?.includes('drive.google.com/search') || m.url?.includes('drive.google.com/drive/search')) {
      removedCount++;
      continue;
    }
    if (isNonAcademicDocument(m.title) || (m.fileName && isNonAcademicDocument(m.fileName))) {
      removedCount++;
      continue;
    }
    if (m.courseId === 'c3d' && c3d) {
      const matched =
        matchesCourse(m.title, c3d) || (m.fileName ? matchesCourse(m.fileName, c3d) : false);
      if (!matched) {
        removedCount++;
        continue;
      }
    }
    clean.push(m);
  }

  return { clean, removedCount };
}

/** Garante integridade dos campos obrigatórios após rehidratação do localStorage. */
export function rehydrateStoreState(
  state: {
    courses?: Course[];
    materials?: Material[];
    academicProfile?: AcademicProfile;
    weeklyCheckIns?: WeeklyCheckIn[];
  } | undefined,
): void {
  if (!state) return;

  if (!state.academicProfile) {
    state.academicProfile = {
      onboardingCompleted: false,
      universityId: 'nova-fct',
      universityName: 'NOVA FCT — Faculdade de Ciências e Tecnologia',
      degreeId: 'lemc',
      degreeName: 'Licenciatura em Engenharia Mecânica (LEMc)',
      entryYear: 2024,
      currentAcademicYear: 2,
      currentSemester: 2,
      difficultCourseIds: [],
      difficultTopicsNotes: '',
      completedCourses: [],
    };
  }
  if (!Array.isArray(state.weeklyCheckIns)) {
    state.weeklyCheckIns = [];
  }

  const courses = Array.isArray(state.courses) ? state.courses : [];
  if (Array.isArray(state.materials)) {
    const { clean } = sanitizeMaterials(state.materials, courses);
    state.materials = clean;
  } else {
    state.materials = [];
  }
}

/**
 * Executa a migração limpa de versões anteriores para a v6 (sem dados demo nem dados pessoais).
 */
export function migrateStoreState(persistedState: unknown, _version: number) {
  const base = (persistedState && typeof persistedState === 'object' ? persistedState : {}) as Record<string, unknown> & Partial<Collections> & {
    isDemo?: boolean;
    settings?: { userName?: string };
    academicProfile?: AcademicProfile;
  };

  // Se era apenas o antigo estado de demonstração sem onboarding completo, limpa para arranque fresco.
  if (base.isDemo && !base.academicProfile?.onboardingCompleted) {
    return {
      ...emptyCollections(),
      academicProfile: base.academicProfile,
      weeklyCheckIns: [],
    };
  }

  const rawCourses: Course[] = Array.isArray(base.courses) ? base.courses : [];
  const cleanedCourses = rawCourses.map((c) => {
    const next = { ...c };
    if (containsLegacyPersonalSeed(next.sharedDriveUrl)) delete next.sharedDriveUrl;
    if (containsLegacyPersonalSeed(next.driveFolderId)) delete next.driveFolderId;
    return next;
  });

  const rawMaterials: Material[] = Array.isArray(base.materials) ? base.materials : [];
  const { clean } = sanitizeMaterials(rawMaterials, cleanedCourses);

  const nextSettings = base.settings ? { ...base.settings } : undefined;
  if (nextSettings?.userName === 'Pedro de Oliveira Silva') {
    nextSettings.userName = '';
  }

  const rest = { ...base };
  delete rest.isDemo;

  return {
    ...rest,
    ...(nextSettings ? { settings: nextSettings } : {}),
    courses: cleanedCourses,
    materials: clean,
  };
}
