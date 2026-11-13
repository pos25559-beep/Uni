import { pedroCourses, pedroMaterials, demoData } from './seed';
import { isNonAcademicDocument, matchesCourse } from './courseAliases';
import type { AcademicProfile, Course, Material, WeeklyCheckIn } from '../types';

const LEMC_SHARED_DRIVE_URL = 'https://drive.google.com/drive/folders/1v3KSXUxC6E62ekhx4zawYbcF3YEHre1B';

/**
 * Normaliza URLs legados do repositório partilhado de LEMc e remove links quebrados.
 */
function normalizeMaterialUrl(url = ''): string {
  if (
    url.includes('folders/shared-lemc') ||
    url.includes('id=shared-lemc') ||
    url.includes('drive.google.com/search') ||
    url.includes('drive.google.com/drive/search')
  ) {
    return LEMC_SHARED_DRIVE_URL;
  }
  return url;
}

/**
 * Função única e pura para higienizar materiais persistidos ou importados.
 * Remove documentos pessoais (faturas, recibos), ficheiros legados do OneDrive,
 * links de pesquisa inválidos e ficheiros atribuídos erroneamente a Cálculo III D.
 */
export function sanitizeMaterials(
  materials: Material[],
  courses: Course[] = pedroCourses,
): { clean: Material[]; removedCount: number } {
  const c3d = courses.find((c) => c.id === 'c3d') ?? pedroCourses.find((c) => c.id === 'c3d');
  const seedIds = new Set(pedroMaterials.map((m) => m.id));
  let removedCount = 0;

  const clean: Material[] = [];
  for (const m of materials) {
    if (!m || !m.id || m.id.includes('-d') || m.id.includes('-m')) {
      removedCount++;
      continue;
    }

    if (seedIds.has(m.id)) {
      clean.push(m);
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

    const normalizedUrl = normalizeMaterialUrl(m.url);
    clean.push(normalizedUrl !== (m.url || '') ? { ...m, url: normalizedUrl } : m);
  }

  return { clean, removedCount };
}

/**
 * Recupera e higieniza materiais guardados no localStorage entre versões (v4 -> v5).
 */
export function getInitialPersistedMaterials(): Material[] {
  if (typeof window === 'undefined') return pedroMaterials;
  try {
    const raw4 = localStorage.getItem('uni-erp-v4');
    const raw5 = localStorage.getItem('uni-erp-v5');
    const p4 = raw4 ? JSON.parse(raw4) : null;
    const p5 = raw5 ? JSON.parse(raw5) : null;

    const materials5: Material[] = Array.isArray(p5?.state?.materials) ? p5.state.materials : [];
    const materials4: Material[] = Array.isArray(p4?.state?.materials) ? p4.state.materials : [];

    const map = new Map<string, Material>();
    for (const m of pedroMaterials) map.set(m.id, m);

    const { clean } = sanitizeMaterials([...materials5, ...materials4], pedroCourses);
    for (const m of clean) map.set(m.id, m);

    return [...map.values()];
  } catch {
    return pedroMaterials;
  }
}

/**
 * Garante a integridade dos materiais após a re-hidratação do Zustand.
 */
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

  if (!Array.isArray(state.materials) || state.materials.length === 0) {
    state.materials = pedroMaterials;
    return;
  }

  const courses = Array.isArray(state.courses) && state.courses.length > 0 ? state.courses : pedroCourses;
  const { clean } = sanitizeMaterials(state.materials, courses);

  // Garante que os repositórios base autênticos de LEMc estão sempre presentes
  const existingIds = new Set(clean.map((m) => m.id));
  const missing = pedroMaterials.filter((m) => !existingIds.has(m.id));
  state.materials = missing.length > 0 ? [...clean, ...missing] : clean;
}

/**
 * Executa a migração de estado persistido para a versão atual do schema.
 */
export function migrateStoreState(persistedState: any, _version: number) {
  const base = persistedState || demoData();
  const existingMaterials: Material[] = Array.isArray(base.materials) ? base.materials : [];
  const courses: Course[] =
    Array.isArray(base.courses) && base.courses.length > 0 ? base.courses : pedroCourses;

  const map = new Map<string, Material>();
  for (const m of getInitialPersistedMaterials()) map.set(m.id, m);

  const { clean } = sanitizeMaterials(existingMaterials, courses);
  for (const m of clean) map.set(m.id, m);

  return {
    ...base,
    materials: [...map.values()],
  };
}
