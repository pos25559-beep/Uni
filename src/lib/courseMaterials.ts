import { isNonAcademicDocument, matchesCourse } from './courseAliases';
import type { Course, Material } from '../types';

function normalizeIdKey(value?: string): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Filtra os materiais associados a uma cadeira, preservando correspondência direta por UUID/ID
 * (com ou sem hífenes) bem como correspondência por código, sigla ou pasta no nome do ficheiro.
 */
export function filterMaterialsForCourse(materials: Material[], course: Course): Material[] {
  if (!Array.isArray(materials) || !course) return [];
  const rawCourseId = (course.id || '').toLowerCase().trim();
  const courseIdNorm = normalizeIdKey(course.id);
  const codeNorm = normalizeIdKey(course.code);
  const shortNorm = normalizeIdKey(course.shortName);

  return materials.filter((m) => {
    if (!m.courseId) return false;
    if (
      !m.pinned &&
      (isNonAcademicDocument(m.title, { allowImages: true }) ||
        (m.fileName && isNonAcademicDocument(m.fileName, { allowImages: true })))
    ) {
      return false;
    }

    const rawMatCourseId = m.courseId.toLowerCase().trim();
    const matCourseNorm = normalizeIdKey(m.courseId);
    const isDirectMatch =
      (rawCourseId && rawMatCourseId === rawCourseId) ||
      (courseIdNorm && matCourseNorm === courseIdNorm) ||
      (codeNorm && matCourseNorm === codeNorm) ||
      (shortNorm && matCourseNorm === shortNorm);

    if (isDirectMatch) {
      // Protege C3D de materiais explicitamente rotulados de AM1/AM2/C1D/C2D
      if (courseIdNorm === 'c3d') {
        const raw = `${m.title || ''} ${m.fileName || ''}`.toLowerCase();
        if (/\b(am\s?i{1,2}|am\s?[12]|c1\s?d|c2\s?d)\b/.test(raw) && !/\b(c3\s?d|am\s?3|am\s?iii)\b/.test(raw)) {
          return false;
        }
      }
      return true;
    }

    if (matchesCourse(m.title || '', course)) return true;
    if (m.fileName && matchesCourse(m.fileName, course)) return true;
    return false;
  });
}
