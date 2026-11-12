import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { defaultSettings, demoData } from '../lib/seed';
import type {
  Collections, ID, IntegrationKey, IntegrationStatus, Settings, Source, Topic,
} from '../types';

type Key = keyof Collections;
type Item<K extends Key> = Collections[K][number];

const emptyData = (): Collections => ({
  courses: [], assessments: [], classes: [], sessions: [], tasks: [], materials: [], events: [],
});

const defaultIntegrations: Record<IntegrationKey, IntegrationStatus> = {
  google: { connected: false },
  microsoft: { connected: false },
  gemini: { connected: false },
  clip: { connected: false },
};

export interface AppState extends Collections {
  settings: Settings;
  integrations: Record<IntegrationKey, IntegrationStatus>;
  /** true enquanto a app mostra os dados de demonstração. */
  isDemo: boolean;

  /** Cria ou atualiza (por id) um registo numa coleção. */
  upsert: <K extends Key>(key: K, item: Item<K>) => void;
  upsertMany: <K extends Key>(key: K, items: Item<K>[]) => void;
  /** Atualiza parcialmente um registo existente. */
  patch: <K extends Key>(key: K, id: ID, changes: Partial<Item<K>>) => void;
  remove: (key: Key, id: ID) => void;
  /**
   * Substitui todos os registos de uma fonte (ex.: re-sincronizar o CLIP) sem
   * tocar nos de outras fontes. Só para coleções com campo `source`.
   */
  replaceSource: <K extends 'assessments' | 'classes' | 'events'>(
    key: K, source: Source, items: Item<K>[],
  ) => void;
  /** Substitui as sessões geradas pelo plano a partir de `fromDate` (yyyy-MM-dd), mantendo as concluídas e as manuais. */
  replaceGeneratedSessions: (fromDate: string, sessions: Collections['sessions']) => void;
  updateTopic: (courseId: ID, topicId: ID, changes: Partial<Topic>) => void;
  updateSettings: (changes: Partial<Settings>) => void;
  setIntegration: (key: IntegrationKey, status: Partial<IntegrationStatus>) => void;
  loadDemo: () => void;
  clearAll: () => void;
}

export const newId = (): ID => crypto.randomUUID();

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      ...demoData(),
      settings: defaultSettings,
      integrations: defaultIntegrations,
      isDemo: true,

      upsert: (key, item) =>
        set((s) => {
          const list = s[key] as { id: ID }[];
          const exists = list.some((x) => x.id === item.id);
          return {
            [key]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item],
          } as Partial<AppState>;
        }),
      upsertMany: (key, items) =>
        set((s) => {
          const map = new Map((s[key] as { id: ID }[]).map((x) => [x.id, x]));
          for (const it of items) map.set(it.id, it);
          return { [key]: [...map.values()] } as Partial<AppState>;
        }),
      patch: (key, id, changes) =>
        set((s) => ({
          [key]: (s[key] as { id: ID }[]).map((x) => (x.id === id ? { ...x, ...changes } : x)),
        }) as Partial<AppState>),
      remove: (key, id) =>
        set((s) => {
          const next: Partial<Collections> = {
            [key]: (s[key] as { id: ID }[]).filter((x) => x.id !== id),
          };
          if (key === 'courses') {
            // Apagar uma cadeira leva consigo tudo o que depende dela.
            next.assessments = s.assessments.filter((x) => x.courseId !== id);
            next.classes = s.classes.filter((x) => x.courseId !== id);
            next.sessions = s.sessions.filter((x) => x.courseId !== id);
            next.tasks = s.tasks.filter((x) => x.courseId !== id);
            next.materials = s.materials.filter((x) => x.courseId !== id);
          }
          return next as Partial<AppState>;
        }),
      replaceSource: (key, source, items) =>
        set((s) => ({
          [key]: [...(s[key] as { source: Source }[]).filter((x) => x.source !== source), ...items],
        }) as Partial<AppState>),
      replaceGeneratedSessions: (fromDate, sessions) =>
        set((s) => ({
          sessions: [
            ...s.sessions.filter((x) => !x.generated || x.done || x.date < fromDate),
            ...sessions,
          ],
        })),
      updateTopic: (courseId, topicId, changes) =>
        set((s) => ({
          courses: s.courses.map((c) =>
            c.id !== courseId
              ? c
              : { ...c, topics: c.topics.map((t) => (t.id === topicId ? { ...t, ...changes } : t)) },
          ),
        })),
      updateSettings: (changes) => set((s) => ({ settings: { ...s.settings, ...changes } })),
      setIntegration: (key, status) =>
        set((s) => ({
          integrations: { ...s.integrations, [key]: { ...s.integrations[key], ...status } },
        })),
      loadDemo: () => set({ ...demoData(), isDemo: true }),
      clearAll: () => set({ ...emptyData(), isDemo: false }),
    }),
    { name: 'uni-erp-v1' },
  ),
);
