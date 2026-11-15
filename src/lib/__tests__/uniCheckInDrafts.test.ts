import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Course, StudyLogEntry } from '../../types';
import {
  buildCheckInContextKey,
  buildTurnsFromSavedEntry,
  buildUnderstandingFromSavedEntry,
  clearCheckInDraft,
  findSavedCheckInEntry,
  loadCheckInDraft,
  saveCheckInDraft,
} from '../uniCheckInDrafts';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

const sampleCourse: Course = {
  id: 'tep',
  code: 'TEP',
  name: 'Tecnologia de Processos',
  shortName: 'TEP',
  ects: 6,
  color: 'emerald',
  targetGrade: 14,
  topics: [],
};

describe('uniCheckInDrafts', () => {
  const hadWindow = typeof globalThis.window !== 'undefined';
  const originalWindow = globalThis.window;

  beforeEach(() => {
    const localStorage = createMemoryStorage();
    if (!hadWindow) {
      (globalThis as unknown as { window: { localStorage: Storage } }).window = { localStorage };
    } else {
      Object.defineProperty(globalThis.window, 'localStorage', {
        value: localStorage,
        configurable: true,
      });
    }
  });

  afterEach(() => {
    if (!hadWindow) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true });
    }
  });

  it('persists and clears draft conversations per context key', () => {
    const tepKey = buildCheckInContextKey({
      kind: 'exam_prep',
      today: '2026-11-15',
      weekKey: '2026-11-09',
      courseId: 'tep',
      assessmentId: 'tep-test-1',
    });

    saveCheckInDraft(tepKey, {
      turns: [
        { id: 'g0', role: 'model', text: 'Olá!' },
        { id: 'u1', role: 'user', text: 'Cai até ao slide 8' },
      ],
      inputText: 'Já revi T02',
      understanding: null,
    });

    const restored = loadCheckInDraft(tepKey);
    expect(restored?.turns).toHaveLength(2);
    expect(restored?.turns[1]?.text).toBe('Cai até ao slide 8');
    expect(restored?.inputText).toBe('Já revi T02');

    clearCheckInDraft(tepKey);
    expect(loadCheckInDraft(tepKey)).toBeNull();
  });

  it('finds saved exam_prep entry by assessmentId and restores stored messages', () => {
    const saved: StudyLogEntry = {
      id: 'log-tep-1',
      kind: 'exam_prep',
      date: '2026-11-14',
      createdAt: '2026-11-14T21:00:00.000Z',
      courseId: 'tep',
      assessmentId: 'tep-test-1',
      feeling: 'ansioso',
      topicTitle: 'Laminagem',
      messages: [
        { id: 'm0', role: 'model', text: 'Saudação' },
        { id: 'm1', role: 'user', text: 'Cai até ao slide 8 e estou ansioso' },
        { id: 'm2', role: 'model', text: 'Plano focado até ao slide 8.' },
      ],
    };

    const match = findSavedCheckInEntry({
      studyLogs: [saved],
      kind: 'exam_prep',
      today: '2026-11-15',
      weekKey: '2026-11-09',
      courseId: 'tep',
      assessmentId: 'tep-test-1',
    });
    expect(match?.id).toBe('log-tep-1');

    const turns = buildTurnsFromSavedEntry(match!, 'Nova saudação', sampleCourse);
    expect(turns).toHaveLength(3);
    expect(turns[1]?.text).toContain('slide 8');
  });

  it('reconstructs readable turns for legacy saved entries without messages', () => {
    const legacy: StudyLogEntry = {
      id: 'log-legacy',
      kind: 'exam_prep',
      date: '2026-11-15',
      createdAt: '2026-11-15T18:00:00.000Z',
      courseId: 'tep',
      assessmentId: 'tep-test-1',
      feeling: 'confiante',
      topicTitle: 'Plasticidade',
      studiedSummary: 'Revi T01 a T03',
    };

    const turns = buildTurnsFromSavedEntry(legacy, 'Vamos alinhar 1.º Teste de TEP!', sampleCourse);
    expect(turns).toHaveLength(3);
    expect(turns[1]?.role).toBe('user');
    expect(turns[1]?.text).toContain('Plasticidade');
    expect(turns[1]?.text).toContain('Revi T01 a T03');
  });

  it('infere studyFocus de conversas guardadas anteriormente sem campo studyFocus', () => {
    const legacySaved: StudyLogEntry = {
      id: 'log-old-messages',
      kind: 'exam_prep',
      date: '2026-11-15',
      createdAt: '2026-11-15T19:55:00.000Z',
      courseId: 'tep',
      assessmentId: 'tep-test-1',
      feeling: 'estavel',
      messages: [
        { id: 'm1', role: 'model', text: 'Vamos alinhar o 1.º Teste!' },
        { id: 'm2', role: 'user', text: 'Quero focar em refazer os testes antigos' },
      ],
    };

    const restored = buildUnderstandingFromSavedEntry(legacySaved);
    expect(restored.studyFocus).toBe('Refazer testes antigos');
  });
});
