import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type FieldValue,
} from 'firebase/firestore';
import {
  auth,
  db,
  deleteCurrentFirebaseUser,
  onAuthStateChanged,
  sessionNeedsRecentLogin,
  type User,
} from './firebase';
import { useStore } from '../store/useStore';
import type {
  AcademicProfile,
  Collections,
  Course,
  ID,
  Settings,
  StudyLogEntry,
  WeeklyCheckIn,
} from '../types';

type CollectionKey = keyof Collections;
const COLLECTIONS: CollectionKey[] = [
  'courses',
  'assessments',
  'classes',
  'sessions',
  'tasks',
  'materials',
  'events',
];

const SETTINGS_KEYS: Array<keyof Settings> = [
  'userName',
  'theme',
  'semesterName',
  'semesterStart',
  'semesterEnd',
  'dailyStudyMinutes',
  'studyDays',
  'geminiApiKey',
  'geminiModel',
  'googleClientId',
  'msClientId',
  'academicEmail',
  'personalEmail',
  'personalNotebookUrl',
  'gdprAcceptedAt',
  'gdprPolicyVersion',
  'ageConfirmed13Plus',
  'aiConsent',
  'cloudSyncConsent',
  'tourCompleted',
];

const OPTIONAL_EMAIL_OR_URL_KEYS = new Set<string>([
  'academicEmail',
  'personalEmail',
  'personalNotebookUrl',
  'photoURL',
]);

let activeUnsubscribers: (() => void)[] = [];
let isApplyingRemote = false;

export function isRemoteSyncing() {
  return isApplyingRemote;
}

/** Remove `undefined` recursivamente para nunca quebrar `setDoc` no Firestore. */
function stripUndefined<T>(value: T): T {
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

function sanitizeSettingsPayload(
  changes: Partial<Settings>,
  isPatch: boolean,
): Record<string, unknown | FieldValue> {
  const payload: Record<string, unknown | FieldValue> = {};
  for (const key of SETTINGS_KEYS) {
    if (!(key in changes)) continue;
    const raw = changes[key];
    if (raw === undefined) continue;
    if (OPTIONAL_EMAIL_OR_URL_KEYS.has(key) && raw === '') {
      if (isPatch) {
        payload[key] = deleteField();
      }
      continue;
    }
    payload[key] = raw;
  }
  return payload;
}

function sanitizeAcademicProfile(profile: AcademicProfile): Record<string, unknown> {
  return stripUndefined({
    onboardingCompleted: Boolean(profile.onboardingCompleted),
    universityId: (profile.universityId || 'outra').slice(0, 100),
    universityName: (profile.universityName || '').slice(0, 200),
    degreeId: (profile.degreeId || 'outro').slice(0, 100),
    degreeName: (profile.degreeName || '').slice(0, 200),
    entryYear: Math.max(2000, Math.min(2100, Number(profile.entryYear) || new Date().getFullYear())),
    currentAcademicYear: ([1, 2, 3, 4, 5].includes(profile.currentAcademicYear)
      ? profile.currentAcademicYear
      : 1) as 1 | 2 | 3 | 4 | 5,
    ...(profile.academicCycle ? { academicCycle: profile.academicCycle } : {}),
    ...(Array.isArray(profile.activeYears) && profile.activeYears.length > 0
      ? {
          activeYears: profile.activeYears
            .map((y) => Number(y))
            .filter((y) => [1, 2, 3, 4, 5].includes(y))
            .slice(0, 5),
        }
      : {}),
    currentSemester: ([1, 2].includes(profile.currentSemester) ? profile.currentSemester : 1) as 1 | 2,
    difficultCourseIds: (profile.difficultCourseIds ?? []).slice(0, 50),
    ...(profile.difficultTopicsNotes?.trim()
      ? { difficultTopicsNotes: profile.difficultTopicsNotes.trim().slice(0, 4000) }
      : {}),
    completedCourses: (profile.completedCourses ?? []).slice(0, 100),
  });
}

function sanitizeWeeklyCheckIn(checkIn: WeeklyCheckIn): Record<string, unknown> {
  return stripUndefined({
    id: checkIn.id,
    weekOf: checkIn.weekOf,
    createdAt: checkIn.createdAt,
    mood: checkIn.mood,
    understoodTopics: (checkIn.understoodTopics ?? []).slice(0, 50),
    classDifficulties: (checkIn.classDifficulties ?? []).slice(0, 50),
    pendingNextWeek: (checkIn.pendingNextWeek ?? []).slice(0, 50),
    hardCourseIds: (checkIn.hardCourseIds ?? []).slice(0, 50),
    notes: (checkIn.notes ?? '').slice(0, 4000),
  });
}

function sanitizeStudyLog(log: StudyLogEntry): Record<string, unknown> {
  return stripUndefined({
    id: log.id.slice(0, 100),
    kind: log.kind,
    date: log.date.slice(0, 35),
    createdAt: log.createdAt,
    feeling: (log.feeling || 'normal').slice(0, 40),
    ...(typeof log.rating === 'number'
      ? { rating: Math.max(1, Math.min(5, Math.round(log.rating))) }
      : {}),
    ...(log.courseId ? { courseId: log.courseId.slice(0, 100) } : {}),
    ...(log.classSlotId ? { classSlotId: log.classSlotId.slice(0, 100) } : {}),
    ...(log.assessmentId ? { assessmentId: log.assessmentId.slice(0, 100) } : {}),
    ...(log.topicTitle?.trim() ? { topicTitle: log.topicTitle.trim().slice(0, 250) } : {}),
    ...(Array.isArray(log.topicIds) && log.topicIds.length > 0
      ? { topicIds: log.topicIds.map((t) => String(t).slice(0, 100)).slice(0, 100) }
      : {}),
    ...(log.studiedSummary?.trim()
      ? { studiedSummary: log.studiedSummary.trim().slice(0, 1000) }
      : {}),
    ...(log.difficulties?.trim() ? { difficulties: log.difficulties.trim().slice(0, 1000) } : {}),
    ...(log.notes?.trim() ? { notes: log.notes.trim().slice(0, 4000) } : {}),
    ...(Array.isArray(log.messages) && log.messages.length > 0
      ? {
          messages: log.messages
            .filter((m) => m && typeof m.text === 'string' && m.text.trim().length > 0)
            .slice(-30)
            .map((m) => ({
              id: String(m.id || 'msg').slice(0, 64),
              role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
              text: m.text.trim().slice(0, 2000),
            })),
        }
      : {}),
  });
}

/**
 * Inicia a escuta em tempo real de todas as coleções do utilizador autenticado no Firestore.
 * Suporta múltiplos utilizadores com isolamento por `uid` (`/users/{uid}`).
 */
export function initFirestoreSync() {
  onAuthStateChanged(auth, async (user: User | null) => {
    activeUnsubscribers.forEach((u) => u());
    activeUnsubscribers = [];

    if (!user) {
      return;
    }

    const uid = user.uid;
    const userDocRef = doc(db, 'users', uid);
    const academicDocRef = doc(db, 'users', uid, 'profile', 'academic');

    // Garante documento inicial na cloud para o utilizador autenticado
    try {
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
        const latestState = useStore.getState();
        const initialSettings = sanitizeSettingsPayload(
          {
            ...latestState.settings,
            userName: user.displayName || latestState.settings.userName || 'Estudante',
            ...(user.email ? { personalEmail: user.email } : {}),
          },
          false,
        );

        await setDoc(
          userDocRef,
          stripUndefined({
            uid,
            ...(user.email ? { email: user.email } : {}),
            ...(user.displayName ? { displayName: user.displayName } : {}),
            ...(user.photoURL ? { photoURL: user.photoURL } : {}),
            ...initialSettings,
            createdAt: new Date().toISOString(),
          }),
          { merge: true },
        ).catch(() => {});
      } else if (user.displayName && !useStore.getState().settings.userName) {
        useStore.getState().updateSettings({ userName: user.displayName });
      }
    } catch {
      // Fallback silencioso para continuar offline com listeners
    }

    // 1. Escuta do documento de Definições/Utilizador
    const unsubSettings = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<Settings>;
        isApplyingRemote = true;
        try {
          useStore.getState().updateSettings(data);
        } finally {
          isApplyingRemote = false;
        }
      }
    });
    activeUnsubscribers.push(unsubSettings);

    // 2. Escuta do Perfil Académico (`/users/{uid}/profile/academic`)
    const unsubProfile = onSnapshot(academicDocRef, (snap) => {
      if (snap.exists()) {
        const remoteProfile = snap.data() as AcademicProfile;
        isApplyingRemote = true;
        try {
          useStore.setState((prev) => ({
            academicProfile: {
              ...prev.academicProfile,
              ...remoteProfile,
            },
          }));
        } finally {
          isApplyingRemote = false;
        }
      }
    });
    activeUnsubscribers.push(unsubProfile);

    // 3. Escuta dos Check-Ins Semanais (`/users/{uid}/weeklyCheckIns`)
    const checkInsRef = collection(db, 'users', uid, 'weeklyCheckIns');
    const unsubCheckIns = onSnapshot(checkInsRef, (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<WeeklyCheckIn, 'id'>) }))
        .sort((a, b) => (b.weekOf || '').localeCompare(a.weekOf || ''));

      isApplyingRemote = true;
      try {
        useStore.setState({ weeklyCheckIns: items });
      } finally {
        isApplyingRemote = false;
      }
    });
    activeUnsubscribers.push(unsubCheckIns);

    // 3b. Escuta do Diário / Logs do Uni (`/users/{uid}/studyLogs`)
    const studyLogsRef = collection(db, 'users', uid, 'studyLogs');
    let firstStudyLogsSyncDone = false;
    const unsubStudyLogs = onSnapshot(studyLogsRef, (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<StudyLogEntry, 'id'>) }))
        .sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''));

      if (
        !firstStudyLogsSyncDone &&
        !snapshot.metadata.fromCache &&
        snapshot.empty
      ) {
        firstStudyLogsSyncDone = true;
        const localLogs = useStore.getState().studyLogs;
        if (localLogs.length > 0) {
          for (const log of localLogs.slice(0, 40)) {
            void syncStudyLog(log).catch((err) => {
              if (import.meta.env.DEV) console.warn('[CloudSync] initial studyLog upload failed:', err);
            });
          }
          return;
        }
      }
      if (!snapshot.metadata.fromCache) {
        firstStudyLogsSyncDone = true;
      }

      isApplyingRemote = true;
      try {
        useStore.setState({ studyLogs: items });
      } finally {
        isApplyingRemote = false;
      }
    });
    activeUnsubscribers.push(unsubStudyLogs);

    // 4. Escuta de cada coleção principal do aluno
    for (const colKey of COLLECTIONS) {
      const colRef = collection(db, 'users', uid, colKey);
      let firstServerSyncDone = false;
      const unsub = onSnapshot(colRef, (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Salvaguarda única na 1.ª sincronização de sessões: se a nuvem estiver vazia
        // mas existirem sessões geradas localmente pendentes, sobe-as em vez de apagar o plano.
        if (
          colKey === 'sessions' &&
          !firstServerSyncDone &&
          !snapshot.metadata.fromCache &&
          snapshot.empty
        ) {
          firstServerSyncDone = true;
          const localSessions = useStore.getState().sessions;
          if (localSessions.length > 0) {
            void syncCollectionDiff('sessions', [], localSessions).catch((err) => {
              if (import.meta.env.DEV) console.warn('[CloudSync] initial sessions upload failed:', err);
            });
            return;
          }
        }
        if (!snapshot.metadata.fromCache) {
          firstServerSyncDone = true;
        }

        isApplyingRemote = true;
        try {
          useStore.setState({
            [colKey]: items,
          } as Partial<Collections>);
        } finally {
          isApplyingRemote = false;
        }
      });
      activeUnsubscribers.push(unsub);
    }
  });
}

type BatchOp =
  | { type: 'set'; ref: ReturnType<typeof doc>; data: Record<string, unknown> }
  | { type: 'delete'; ref: ReturnType<typeof doc> };

async function commitChunkedOps(ops: BatchOp[]): Promise<void> {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.type === 'delete') {
        batch.delete(op.ref);
      } else {
        batch.set(op.ref, op.data, { merge: true });
      }
    }
    await batch.commit();
  }
}

/**
 * Sincroniza em lote a diferença entre uma coleção anterior e a nova no Firestore
 * (ex.: sessões geradas substituídas em `replaceGeneratedSessions` ou fontes `replaceSource`).
 */
export async function syncCollectionDiff<K extends CollectionKey>(
  key: K,
  prevItems: ReadonlyArray<{ id: ID }>,
  nextItems: ReadonlyArray<Collections[K][number]>,
): Promise<void> {
  const user = auth.currentUser;
  if (!user || isApplyingRemote) return;

  const nextIds = new Set(nextItems.map((it) => it.id));
  const prevById = new Map(prevItems.map((it) => [it.id, it]));
  const ops: BatchOp[] = [];

  for (const prev of prevItems) {
    if (!nextIds.has(prev.id)) {
      ops.push({ type: 'delete', ref: doc(db, 'users', user.uid, key, prev.id) });
    }
  }

  for (const item of nextItems) {
    const prev = prevById.get(item.id);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(item)) {
      ops.push({
        type: 'set',
        ref: doc(db, 'users', user.uid, key, item.id),
        data: stripUndefined(item) as unknown as Record<string, unknown>,
      });
    }
  }

  if (ops.length > 0) {
    await commitChunkedOps(ops);
  }
}

/** Sincroniza em lote substituições/reconciliações do plano de estudo no Firestore. */
export async function syncSessionsDiff(
  prevSessions: Collections['sessions'],
  nextSessions: Collections['sessions'],
): Promise<void> {
  if (prevSessions === nextSessions) return;
  await syncCollectionDiff('sessions', prevSessions, nextSessions);
}

/** Guarda um item numa coleção do utilizador atual. */
export async function syncUpsert<K extends CollectionKey>(key: K, item: Collections[K][number]) {
  const user = auth.currentUser;
  if (!user || isApplyingRemote) return;
  const docRef = doc(db, 'users', user.uid, key, item.id);
  await setDoc(docRef, stripUndefined(item) as unknown as Record<string, unknown>, { merge: true });
}

/** Atualiza campos de um item numa coleção do utilizador atual. */
export async function syncPatch<K extends CollectionKey>(key: K, id: ID, changes: Record<string, unknown>) {
  const user = auth.currentUser;
  if (!user || isApplyingRemote) return;
  const docRef = doc(db, 'users', user.uid, key, id);
  await setDoc(docRef, stripUndefined(changes), { merge: true });
}

/** Remove um item do Firestore do utilizador atual. */
export async function syncRemove(key: CollectionKey, id: ID) {
  const user = auth.currentUser;
  if (!user || isApplyingRemote) return;
  const docRef = doc(db, 'users', user.uid, key, id);
  await deleteDoc(docRef);
}

/** Guarda alterações de definições no Firestore (limpando campos vazios com deleteField). */
export async function syncSettings(changes: Partial<Settings>) {
  const user = auth.currentUser;
  if (!user || isApplyingRemote) return;
  const payload = sanitizeSettingsPayload(changes, true);
  if (Object.keys(payload).length === 0) return;
  const userDocRef = doc(db, 'users', user.uid);
  await setDoc(userDocRef, payload, { merge: true });
}

/** Sincroniza o percurso académico / histórico do aluno autenticado. */
export async function syncAcademicProfile(profile: AcademicProfile) {
  const user = auth.currentUser;
  if (!user || isApplyingRemote) return;
  const ref = doc(db, 'users', user.uid, 'profile', 'academic');
  await setDoc(ref, sanitizeAcademicProfile(profile), { merge: true });
}

/** Sincroniza um check-in semanal do Tutor Semanal para o utilizador autenticado. */
export async function syncWeeklyCheckIn(checkIn: WeeklyCheckIn) {
  const user = auth.currentUser;
  if (!user || isApplyingRemote) return;
  const ref = doc(db, 'users', user.uid, 'weeklyCheckIns', checkIn.id);
  await setDoc(ref, sanitizeWeeklyCheckIn(checkIn), { merge: true });
}

/** Sincroniza um registo do Diário do Uni (`/users/{uid}/studyLogs`). */
export async function syncStudyLog(log: StudyLogEntry) {
  const user = auth.currentUser;
  if (!user || isApplyingRemote) return;
  const ref = doc(db, 'users', user.uid, 'studyLogs', log.id);
  await setDoc(ref, sanitizeStudyLog(log), { merge: true });
}

/** Remove um registo do Diário do Uni no Firestore. */
export async function deleteStudyLogFromCloud(logId: ID) {
  const user = auth.currentUser;
  if (!user || isApplyingRemote) return;
  await deleteDoc(doc(db, 'users', user.uid, 'studyLogs', logId));
}

/** Substitui/sincroniza em lote um conjunto de cadeiras geradas pelo onboarding curricular. */
export async function syncCourseBatch(courses: Course[]) {
  const user = auth.currentUser;
  if (!user || isApplyingRemote || courses.length === 0) return;
  const batch = writeBatch(db);
  for (const c of courses) {
    batch.set(doc(db, 'users', user.uid, 'courses', c.id), stripUndefined(c), { merge: true });
  }
  await batch.commit();
}

/**
 * Elimina definitivamente todos os dados do utilizador na cloud (`/users/{uid}` + subcoleções)
 * e apaga a conta do Firebase Authentication + armazenamento local (RGPD Art. 17.º & Google Play Account Deletion).
 */
export async function deleteCurrentAccountAndCloudData(): Promise<void> {
  const user = auth.currentUser;

  if (user && sessionNeedsRecentLogin()) {
    const err = new Error('Reautenticação necessária antes de apagar a conta.');
    (err as Error & { code?: string }).code = 'auth/requires-recent-login';
    throw err;
  }

  // Desliga os listeners antes de apagar para evitar ressincronização fantasma
  activeUnsubscribers.forEach((u) => u());
  activeUnsubscribers = [];

  if (user) {
    const uid = user.uid;
    // Apaga mensagens dentro das conversas antes das conversas e restantes subcoleções
    const convSnap = await getDocs(collection(db, 'users', uid, 'conversations'));
    for (const convDoc of convSnap.docs) {
      const msgSnap = await getDocs(collection(db, 'users', uid, 'conversations', convDoc.id, 'messages'));
      if (!msgSnap.empty) {
        const msgBatch = writeBatch(db);
        msgSnap.docs.forEach((m) => msgBatch.delete(m.ref));
        await msgBatch.commit();
      }
    }

    const subcollections = [
      ...COLLECTIONS,
      'conversations',
      'weeklyCheckIns',
      'studyLogs',
      'profile',
    ] as const;

    for (const sub of subcollections) {
      const snap = await getDocs(collection(db, 'users', uid, sub));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }

    await deleteDoc(doc(db, 'users', uid)).catch(() => {});
    await deleteCurrentFirebaseUser();
  }

  useStore.getState().clearAll();
  localStorage.removeItem('uni-erp-v5');
  localStorage.removeItem('unipedia-onboarding-v1');
  localStorage.removeItem('uni-checkin-drafts-v1');
  sessionStorage.clear();
}

export interface SharedCurriculumDoc {
  id: string;
  universityId: string;
  universityName: string;
  universityShortName?: string;
  degreeId: string;
  degreeName: string;
  degreeShortName?: string;
  courses: Array<{
    code: string;
    name: string;
    shortName: string;
    year: 1 | 2 | 3 | 4 | 5;
    semester: 1 | 2;
    ects: number;
    topics: string[];
  }>;
  createdBy: string;
  createdAt?: string;
}

/** Lê planos curriculares partilhados pela comunidade na coleção `/curricula`. */
export async function fetchSharedCurriculaFromCloud(): Promise<SharedCurriculumDoc[]> {
  if (!auth.currentUser) return [];
  const snap = await getDocs(collection(db, 'curricula'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SharedCurriculumDoc, 'id'>) }));
}

/** Publica/atualiza um plano curricular na coleção partilhada `/curricula/{id}`. */
export async function publishSharedCurriculum(
  payload: Omit<SharedCurriculumDoc, 'createdBy' | 'createdAt'>,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Inicia sessão para partilhar o plano curricular na nuvem.');
  const docId = payload.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 90);
  await setDoc(
    doc(db, 'curricula', docId),
    stripUndefined({
      ...payload,
      id: docId,
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
    }),
    { merge: true },
  );
}

/**
 * Migra todos os dados locais para o Firestore na primeira sincronização.
 */
export async function migrateLocalDataToCloud(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Precisas de ter sessão iniciada para sincronizar.');
  const state = useStore.getState();
  const batch = writeBatch(db);

  // Settings & Identidade
  batch.set(
    doc(db, 'users', user.uid),
    stripUndefined({
      uid: user.uid,
      ...(user.email ? { email: user.email } : {}),
      ...(user.displayName ? { displayName: user.displayName } : {}),
      ...sanitizeSettingsPayload(state.settings, false),
    }),
    { merge: true },
  );

  // Perfil Académico & Check-ins Semanais
  batch.set(
    doc(db, 'users', user.uid, 'profile', 'academic'),
    sanitizeAcademicProfile(state.academicProfile),
    { merge: true },
  );
  for (const checkIn of state.weeklyCheckIns) {
    batch.set(
      doc(db, 'users', user.uid, 'weeklyCheckIns', checkIn.id),
      sanitizeWeeklyCheckIn(checkIn),
      { merge: true },
    );
  }
  for (const log of state.studyLogs) {
    batch.set(
      doc(db, 'users', user.uid, 'studyLogs', log.id),
      sanitizeStudyLog(log),
      { merge: true },
    );
  }

  // Coleções principais
  for (const colKey of COLLECTIONS) {
    const items = state[colKey] as Array<{ id: ID }>;
    for (const item of items) {
      const ref = doc(db, 'users', user.uid, colKey, item.id);
      batch.set(ref, stripUndefined(item), { merge: true });
    }
  }

  await batch.commit();
}
