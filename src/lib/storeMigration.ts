import { isNonAcademicDocument, isPreEntryDriveFile, matchesCourse } from './courseAliases';
import { defaultSettings, emptyCollections } from './seed';
import type { AcademicProfile, Collections, Course, Material, StudyLogEntry, WeeklyCheckIn } from '../types';

// Impressões digitais (FNV-1a) de ids e nomes do antigo modo demo pessoal. Guardamos só o
// hash para não publicar identificadores pessoais no código; serve apenas para os limpar.
const LEGACY_SEED_HASHES = new Set(['9347a3a9', '473e3d5f', '798931df', '4b1aec8a']);

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(s)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function containsLegacyPersonalSeed(text?: string): boolean {
  if (!text) return false;
  const ids = text.match(/[A-Za-z0-9_-]{25,}/g) ?? [];
  if (ids.some((id) => LEGACY_SEED_HASHES.has(fnv1a(id)))) return true;
  const words = text.toLowerCase().split(/[^a-z0-9à-ú]+/).filter(Boolean);
  for (let i = 0; i < words.length - 1; i += 1) {
    if (LEGACY_SEED_HASHES.has(fnv1a(`${words[i]} ${words[i + 1]}`))) return true;
  }
  return false;
}

/**
 * Higieniza materiais persistidos ou importados: remove ficheiros pessoais,
 * links de pesquisa inválidos e eventuais registos herdados do modo demo antigo.
 */
export function sanitizeMaterials(
  materials: Material[],
  courses: Course[] = [],
  entryYear?: number,
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
    if (m.provider === 'gdrive' && !m.pinned && isPreEntryDriveFile(m.modifiedAt, entryYear)) {
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

function emptyAcademicProfile(): AcademicProfile {
  return {
    onboardingCompleted: false,
    universityId: 'outra',
    universityName: '',
    degreeId: 'outro',
    degreeName: '',
    entryYear: new Date().getFullYear(),
    currentAcademicYear: 1,
    currentSemester: 1,
    difficultCourseIds: [],
    difficultTopicsNotes: '',
    completedCourses: [],
  };
}

/** Garante integridade dos campos obrigatórios após rehidratação do localStorage. */
export function rehydrateStoreState(
  state: {
    courses?: Course[];
    materials?: Material[];
    academicProfile?: AcademicProfile;
    settings?: { userName?: string; semesterName?: string };
    weeklyCheckIns?: WeeklyCheckIn[];
    studyLogs?: StudyLogEntry[];
  } | undefined,
): void {
  if (!state) return;

  if (!state.academicProfile) {
    state.academicProfile = emptyAcademicProfile();
  }
  if (!Array.isArray(state.weeklyCheckIns)) {
    state.weeklyCheckIns = [];
  }
  if (!Array.isArray(state.studyLogs)) {
    state.studyLogs = [];
  }

  const courses = Array.isArray(state.courses) ? state.courses : [];
  state.settings = { ...defaultSettings, ...(state.settings ?? {}) };
  if (
    courses.length === 0 &&
    state.settings.semesterName?.includes('(LEMc)')
  ) {
    state.settings.semesterName = 'Semestre atual';
  }

  if (Array.isArray(state.materials)) {
    const entryYear = state.academicProfile?.onboardingCompleted
      ? state.academicProfile.entryYear
      : undefined;
    const { clean } = sanitizeMaterials(state.materials, courses, entryYear);
    state.materials = clean;
  } else {
    state.materials = [];
  }
}

/**
 * Executa a migração limpa de versões anteriores para a v7 (sem dados demo nem dados pessoais).
 */
export function migrateStoreState(persistedState: unknown, version: number) {
  const base = (persistedState && typeof persistedState === 'object' ? persistedState : {}) as Record<string, unknown> & Partial<Collections> & {
    isDemo?: boolean;
    settings?: { userName?: string; semesterName?: string; guestMode?: boolean; geminiModel?: string };
    academicProfile?: AcademicProfile;
  };

  // Se era apenas o antigo estado de demonstração sem onboarding completo, limpa para arranque fresco.
  if (base.isDemo && !base.academicProfile?.onboardingCompleted) {
    return {
      ...emptyCollections(),
      academicProfile: emptyAcademicProfile(),
      weeklyCheckIns: [],
      studyLogs: [],
    };
  }

  const rawCourses: Course[] = Array.isArray(base.courses) ? base.courses : [];
  const cleanedCourses = rawCourses.map((c) => {
    const next = { ...c };
    if (containsLegacyPersonalSeed(next.sharedDriveUrl)) delete next.sharedDriveUrl;
    if (containsLegacyPersonalSeed(next.driveFolderId)) delete next.driveFolderId;
    return next;
  });

  let nextProfile = base.academicProfile;
  if (
    nextProfile &&
    !nextProfile.onboardingCompleted &&
    nextProfile.universityId === 'nova-fct' &&
    nextProfile.degreeId === 'lemc'
  ) {
    nextProfile = emptyAcademicProfile();
  }

  const rawMaterials: Material[] = Array.isArray(base.materials) ? base.materials : [];
  const migrateEntryYear = nextProfile?.onboardingCompleted ? nextProfile.entryYear : undefined;
  const { clean } = sanitizeMaterials(rawMaterials, cleanedCourses, migrateEntryYear);

  const nextSettings = base.settings ? { ...base.settings } : undefined;
  if (nextSettings) {
    if (cleanedCourses.length === 0 && nextSettings.semesterName?.includes('(LEMc)')) {
      nextSettings.semesterName = 'Semestre atual';
    }
    if (version < 7 && nextSettings.guestMode === undefined) {
      nextSettings.guestMode = false;
    }
    if (
      version < 9 &&
      (!nextSettings.geminiModel ||
        nextSettings.geminiModel === 'gemini-3.8-flash' ||
        nextSettings.geminiModel.startsWith('gemini-2.') ||
        nextSettings.geminiModel.startsWith('gemini-1.'))
    ) {
      nextSettings.geminiModel = 'gemini-4-hydrogen';
    }
  }

  const rest = { ...base };
  delete rest.isDemo;

  return {
    ...rest,
    ...(nextSettings ? { settings: nextSettings } : {}),
    ...(nextProfile ? { academicProfile: nextProfile } : {}),
    courses: cleanedCourses,
    materials: clean,
  };
}
