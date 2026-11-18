import { deleteField, type FieldValue } from 'firebase/firestore';

/** Chaves de texto opcionais (e-mail/URL) em que '' equivale a «sem valor». */
export const OPTIONAL_EMAIL_OR_URL_KEYS = new Set<string>([
  'academicEmail',
  'personalEmail',
  'personalNotebookUrl',
  'photoURL',
]);

/** Campos que nunca se apagam no Firestore (as regras exigem-nos imutáveis). */
const PROTECTED_KEYS = new Set<string>(['id', 'userId', 'createdAt']);

/** Remove `undefined` recursivamente para nunca quebrar `setDoc` no Firestore. */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      if (OPTIONAL_EMAIL_OR_URL_KEYS.has(k) && v === '') continue;
      out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Prepara o payload de um `setDoc(..., { merge: true })` de um item completo.
 * Com `merge`, um campo `undefined` seria simplesmente ignorado e o valor antigo
 * ficava na nuvem (ex.: `locked: true`). Por isso, quando a versão anterior é
 * conhecida, cada campo de topo que existia e deixou de ter valor passa a
 * `deleteField()`. Só o nível de topo: campos aninhados e arrays seguem
 * `stripUndefined` (nunca se põe `deleteField()` dentro de arrays).
 */
export function buildFirestoreWrite(
  prev: object | undefined | null,
  next: object,
): Record<string, unknown | FieldValue> {
  const data = stripUndefined(next) as Record<string, unknown | FieldValue>;
  if (prev) {
    for (const key of Object.keys(prev)) {
      if (PROTECTED_KEYS.has(key)) continue;
      if (!(key in data)) data[key] = deleteField();
    }
  }
  return data;
}

/**
 * Prepara o payload de um patch parcial: uma chave explicitamente `undefined`
 * significa «limpar o campo» e vira `deleteField()`; o resto é limpo como antes.
 */
export function buildFirestorePatch(changes: Record<string, unknown>): Record<string, unknown | FieldValue> {
  const data = stripUndefined(changes) as Record<string, unknown | FieldValue>;
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined && !PROTECTED_KEYS.has(key)) data[key] = deleteField();
  }
  return data;
}
