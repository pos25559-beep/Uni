import type { ID } from '../types';
import type { UniPersonaMode } from './uniAccessories';

export type TopicSheetMode = 'guide' | 'quiz' | 'summary';
export type UniFormId = 'nuvem' | 'gota' | 'estrela' | 'cristal' | 'folha';
export type UniStage = 0 | 1 | 2 | 3 | 4;

export interface TopicSheetRecord {
  id: string;
  courseId: ID | 'general';
  topicId?: ID;
  title: string;
  mode: TopicSheetMode;
  summary: string;
  keyConcepts: string[];
  materialIds?: ID[];
  updatedAt: string;
}

export interface UniMemoryFact {
  id: string;
  text: string;
  updatedAt: string;
  source?: string;
}

export interface UniMemoryRecord {
  id: string;
  courseId: ID | 'general';
  facts: UniMemoryFact[];
  updatedAt: string;
}

export interface UniAgentWeakSpot {
  topic: string;
  note: string;
  seen: number;
}

export interface UniAgentMilestone {
  id: string;
  label: string;
  at: string;
}

export interface UniAgentNotebook {
  goals: string[];
  learningStyle?: 'exemplos' | 'teoria' | 'exercicios';
  weakSpots: UniAgentWeakSpot[];
  strengths: string[];
  customNotes?: string[];
  nextAssessment?: { title: string; date: string };
  updatedAt: string;
}

export interface UniExpeditionQuestion {
  id: string;
  topicId?: ID;
  topicTitle: string;
  q: string;
  hint: string;
  sourceRef: string;
  answeredScore?: 1 | 2 | 3;
}

export interface UniAgentExpedition {
  preparedAt: string;
  /** yyyy-MM-dd */
  forDate: string;
  questions: UniExpeditionQuestion[];
}

export interface UniAgentDiploma {
  issuedAt: string;
  finalGrade?: number;
  masteredTopicCount: number;
  totalTopicCount: number;
  stageAtGraduation: UniStage;
}

export interface UniAgentRecord {
  courseId: ID;
  name: string;
  formId: UniFormId;
  personaId: UniPersonaMode;
  language: string;
  memoryEnabled: boolean;
  stage: UniStage;
  mastery: number;
  milestones: UniAgentMilestone[];
  items: string[];
  notebook: UniAgentNotebook;
  expedition?: UniAgentExpedition;
  diploma?: UniAgentDiploma;
  createdAt: string;
  updatedAt: string;
}

const DB_NAME = 'unipedia-local-v1';
const DB_VERSION = 2;
const STORE_TOPIC_SHEETS = 'topicSheets';
const STORE_UNI_MEMORIES = 'uniMemories';
const STORE_UNI_AGENTS = 'uniAgents';

type StoreName = typeof STORE_TOPIC_SHEETS | typeof STORE_UNI_MEMORIES | typeof STORE_UNI_AGENTS;

const fallbackTopicSheets = new Map<string, TopicSheetRecord>();
const fallbackUniMemories = new Map<string, UniMemoryRecord>();
const fallbackUniAgents = new Map<string, UniAgentRecord>();

let dbPromise: Promise<IDBDatabase | null> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_TOPIC_SHEETS)) {
          const sheetStore = db.createObjectStore(STORE_TOPIC_SHEETS, { keyPath: 'id' });
          sheetStore.createIndex('by-course', 'courseId', { unique: false });
          sheetStore.createIndex('by-topic', 'topicId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_UNI_MEMORIES)) {
          db.createObjectStore(STORE_UNI_MEMORIES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_UNI_AGENTS)) {
          db.createObjectStore(STORE_UNI_AGENTS, { keyPath: 'courseId' });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        dbPromise = null;
        resolve(null);
      };
      request.onblocked = () => {
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
}

async function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<{ usedDb: boolean; result?: T }> {
  const db = await openDb();
  if (!db) return { usedDb: false };

  return new Promise<{ usedDb: boolean; result?: T }>((resolve) => {
    try {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const req = run(store);
      let settled = false;
      let reqResult: T | undefined;

      req.onsuccess = () => {
        reqResult = req.result;
      };
      req.onerror = () => {
        if (!settled) {
          settled = true;
          resolve({ usedDb: false });
        }
      };
      tx.oncomplete = () => {
        if (!settled) {
          settled = true;
          resolve({ usedDb: true, result: reqResult });
        }
      };
      tx.onerror = () => {
        if (!settled) {
          settled = true;
          resolve({ usedDb: false });
        }
      };
      tx.onabort = () => {
        if (!settled) {
          settled = true;
          resolve({ usedDb: false });
        }
      };
    } catch {
      resolve({ usedDb: false });
    }
  });
}

function sortSheetsNewestFirst(items: TopicSheetRecord[]): TopicSheetRecord[] {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Save or update a local notebook sheet in IndexedDB (with in-memory fallback). */
export async function putTopicSheet(record: TopicSheetRecord): Promise<TopicSheetRecord> {
  const normalized: TopicSheetRecord = {
    ...record,
    updatedAt: record.updatedAt || new Date().toISOString(),
  };
  fallbackTopicSheets.set(normalized.id, normalized);
  await withStore(STORE_TOPIC_SHEETS, 'readwrite', (store) => store.put(normalized));
  return normalized;
}

/** Fetch a single notebook sheet by ID. */
export async function getTopicSheet(id: string): Promise<TopicSheetRecord | null> {
  const { usedDb, result } = await withStore<TopicSheetRecord | undefined>(
    STORE_TOPIC_SHEETS,
    'readonly',
    (store) => store.get(id),
  );
  if (usedDb && result) {
    fallbackTopicSheets.set(result.id, result);
    return result;
  }
  return fallbackTopicSheets.get(id) ?? null;
}

/** List all saved notebook sheets for a given course (newest first). */
export async function listTopicSheetsByCourse(courseId: ID | 'general'): Promise<TopicSheetRecord[]> {
  const { usedDb, result } = await withStore<TopicSheetRecord[]>(
    STORE_TOPIC_SHEETS,
    'readonly',
    (store) => store.index('by-course').getAll(courseId),
  );
  if (usedDb && Array.isArray(result)) {
    return sortSheetsNewestFirst(result);
  }
  return sortSheetsNewestFirst(
    Array.from(fallbackTopicSheets.values()).filter((item) => item.courseId === courseId),
  );
}

/** Delete a notebook sheet by ID. */
export async function deleteTopicSheet(id: string): Promise<void> {
  fallbackTopicSheets.delete(id);
  await withStore(STORE_TOPIC_SHEETS, 'readwrite', (store) => store.delete(id));
}

/** Retrieve long-term Uni memory record for a course (or 'general'). */
export async function getUniMemory(courseId: ID | 'general'): Promise<UniMemoryRecord | null> {
  const { usedDb, result } = await withStore<UniMemoryRecord | undefined>(
    STORE_UNI_MEMORIES,
    'readonly',
    (store) => store.get(courseId),
  );
  if (usedDb && result) {
    fallbackUniMemories.set(result.id, result);
    return result;
  }
  return fallbackUniMemories.get(courseId) ?? null;
}

/** Persist long-term Uni memory facts for a course (or 'general'). */
export async function putUniMemory(record: UniMemoryRecord): Promise<UniMemoryRecord> {
  const normalized: UniMemoryRecord = {
    ...record,
    updatedAt: record.updatedAt || new Date().toISOString(),
  };
  fallbackUniMemories.set(normalized.id, normalized);
  await withStore(STORE_UNI_MEMORIES, 'readwrite', (store) => store.put(normalized));
  return normalized;
}

/** Delete a course's local Uni memory record. */
export async function deleteUniMemory(courseId: ID | 'general'): Promise<void> {
  fallbackUniMemories.delete(courseId);
  await withStore(STORE_UNI_MEMORIES, 'readwrite', (store) => store.delete(courseId));
}

/** Persist a course specialist Uni agent record in IndexedDB (with in-memory fallback). */
export async function putUniAgent(agent: UniAgentRecord): Promise<UniAgentRecord> {
  const normalized: UniAgentRecord = {
    ...agent,
    updatedAt: agent.updatedAt || new Date().toISOString(),
  };
  fallbackUniAgents.set(normalized.courseId, normalized);
  await withStore(STORE_UNI_AGENTS, 'readwrite', (store) => store.put(normalized));
  return normalized;
}

/** Retrieve a course's specialist Uni agent record. */
export async function getUniAgent(courseId: ID): Promise<UniAgentRecord | null> {
  const { usedDb, result } = await withStore<UniAgentRecord | undefined>(
    STORE_UNI_AGENTS,
    'readonly',
    (store) => store.get(courseId),
  );
  if (usedDb && result) {
    fallbackUniAgents.set(result.courseId, result);
    return result;
  }
  return fallbackUniAgents.get(courseId) ?? null;
}

/** List all adopted specialist Uni agents stored locally. */
export async function listUniAgents(): Promise<UniAgentRecord[]> {
  const { usedDb, result } = await withStore<UniAgentRecord[]>(
    STORE_UNI_AGENTS,
    'readonly',
    (store) => store.getAll(),
  );
  if (usedDb && Array.isArray(result)) {
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }
  return Array.from(fallbackUniAgents.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Delete a course's specialist Uni agent record locally. */
export async function deleteUniAgent(courseId: ID): Promise<void> {
  fallbackUniAgents.delete(courseId);
  await withStore(STORE_UNI_AGENTS, 'readwrite', (store) => store.delete(courseId));
}

/** Clear all local IndexedDB and fallback stores (useful on reset/tests). */
export async function clearLocalDb(): Promise<void> {
  fallbackTopicSheets.clear();
  fallbackUniMemories.clear();
  fallbackUniAgents.clear();
  await withStore(STORE_TOPIC_SHEETS, 'readwrite', (store) => store.clear());
  await withStore(STORE_UNI_MEMORIES, 'readwrite', (store) => store.clear());
  await withStore(STORE_UNI_AGENTS, 'readwrite', (store) => store.clear());
}
