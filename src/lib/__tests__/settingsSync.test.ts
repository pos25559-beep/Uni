import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
  writeBatch: vi.fn(),
}));
vi.mock('../firebase', () => ({ auth: { currentUser: null }, db: {} }));
vi.mock('../../store/useStore', () => ({
  defaultAcademicProfile: {},
  useStore: {
    getState: () => ({
      settings: {},
      clearAll: vi.fn(),
      updateSettings: vi.fn(),
    }),
    setState: vi.fn(),
  },
}));

describe('sincronização de definições', () => {
  let sanitizeSettingsPayload: (typeof import('../firestoreSync'))['sanitizeSettingsPayload'];
  let settingsWriteOptions: (typeof import('../firestoreSync'))['settingsWriteOptions'];

  beforeAll(async () => {
    ({ sanitizeSettingsPayload, settingsWriteOptions } = await import('../firestoreSync'));
  }, 20000);

  it('nunca envia a chave Gemini pessoal para o Firestore', () => {
    const payload = sanitizeSettingsPayload({ geminiApiKey: 'AIza-segredo', theme: 'dark' }, true);
    expect(payload).not.toHaveProperty('geminiApiKey');
    expect(payload).toHaveProperty('theme', 'dark');
  });

  it('preserva preferências do plano, notificações, setup do Hub e links partilhados na sincronização', () => {
    const payload = sanitizeSettingsPayload(
      {
        geminiApiKey: 'AIza-segredo',
        plannerPrefs: {
          horizonDays: 14,
          preferredPeriod: 'morning',
          blockMinutes: 50,
          strategy: 'exams_first',
          boostCourseIds: ['c1'],
          pausedCourseIds: [],
          exclusiveTestFocus: true,
        },
        notifications: {
          enabled: true,
          streakSaver: true,
          srsDue: true,
          assessments: true,
          classReminders: true,
          eveningCheckIn: false,
          sundayReview: true,
          classBeforeMinutes: 15,
          preferredHour: 19,
          quietStart: '22:30',
          quietEnd: '08:30',
          maxDailyNudges: 3,
        },
        hubSetupCompleted: true,
        sharedHubDriveUrls: ['https://drive.google.com/drive/folders/abc'],
        seenTabGuides: ['today', 'planner'],
        uniSkinAutoRotate: true,
      },
      true,
    );

    expect(payload).not.toHaveProperty('geminiApiKey');
    expect(payload).toHaveProperty('plannerPrefs');
    expect(payload).toHaveProperty('notifications');
    expect(payload).toHaveProperty('hubSetupCompleted', true);
    expect(payload).toHaveProperty('sharedHubDriveUrls', ['https://drive.google.com/drive/folders/abc']);
    expect(payload).toHaveProperty('seenTabGuides', ['today', 'planner']);
    expect(payload).toHaveProperty('uniSkinAutoRotate', true);
  });

  it('escreve com mergeFields das chaves de topo do payload', () => {
    const payload = sanitizeSettingsPayload({ theme: 'dark', plannerPrefs: { horizonDays: 7 } as never }, true);
    expect(settingsWriteOptions(payload)).toEqual({ mergeFields: ['theme', 'plannerPrefs'] });
  });

  it('limita courseNotes a 12 (mais tardias), com texto até 80 e descarta inválidas', () => {
    const courseNotes: Record<string, unknown> = {};
    for (let i = 1; i <= 15; i++) {
      courseNotes[`c${i}`] = {
        text: ` ${'x'.repeat(100)} `,
        until: `2026-12-${String(i).padStart(2, '0')}`,
        source: 'tool',
      };
    }
    courseNotes.mau = { text: '', until: '2026-12-30', source: 'tool' };
    courseNotes.mau2 = { text: 'ok', until: 'amanhã', source: 'tool' };
    const payload = sanitizeSettingsPayload({ plannerPrefs: { courseNotes } as never }, true);
    const notes = (payload.plannerPrefs as { courseNotes: Record<string, { text: string }> }).courseNotes;
    expect(Object.keys(notes)).toHaveLength(12);
    expect(notes.c15).toBeDefined();
    expect(notes.c4).toBeDefined();
    expect(notes.c3).toBeUndefined();
    expect(notes.mau).toBeUndefined();
    expect(notes.mau2).toBeUndefined();
    expect(notes.c15.text).toHaveLength(80);
  });

  it('limita dateOverrides a 21 (mais cedo primeiro), minutos 0-720, e courseModeUntil a 30', () => {
    const dateOverrides: Record<string, unknown> = { 'data-má': { minutes: 10 } };
    for (let i = 1; i <= 25; i++) {
      dateOverrides[`2026-11-${String(i).padStart(2, '0')}`] = { minutes: 5000, enabled: true };
    }
    dateOverrides['2026-10-01'] = { minutes: -20 };
    const courseModeUntil: Record<string, string> = {};
    for (let i = 0; i < 35; i++) courseModeUntil[`k${i}`] = '2026-12-01';
    courseModeUntil.mau = 'x';
    const payload = sanitizeSettingsPayload(
      { plannerPrefs: { dateOverrides, courseModeUntil, briefingAppliedAt: 3 } as never },
      true,
    );
    const p = payload.plannerPrefs as {
      dateOverrides: Record<string, { minutes?: number }>;
      courseModeUntil: Record<string, string>;
      briefingAppliedAt?: unknown;
    };
    const days = Object.keys(p.dateOverrides);
    expect(days).toHaveLength(21);
    expect(days[0]).toBe('2026-10-01');
    expect(p.dateOverrides['2026-10-01'].minutes).toBe(0);
    expect(p.dateOverrides['2026-11-01'].minutes).toBe(720);
    expect(p.dateOverrides['data-má']).toBeUndefined();
    expect(Object.keys(p.courseModeUntil)).toHaveLength(30);
    expect(p.courseModeUntil.mau).toBeUndefined();
    expect(p).not.toHaveProperty('briefingAppliedAt');
  });

  it('limpa estado local da conta após resetLocalAccountState e normaliza perfil académico', async () => {
    const prevStorage = globalThis.localStorage;
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
    try {
      localStorage.setItem('unipedia-tutor-session-state-v1', '{"activeConvId":"c1"}');
      localStorage.setItem('uni-checkin-drafts-v1', '{}');
      const mod = await import('../firestoreSync');
      await mod.resetLocalAccountState();
      expect(localStorage.getItem('unipedia-tutor-session-state-v1')).toBeNull();
      expect(localStorage.getItem('uni-checkin-drafts-v1')).toBeNull();

      const profile = mod.sanitizeAcademicProfile({
        onboardingCompleted: true,
        universityId: 'fct-nova',
        universityName: 'NOVA',
        degreeId: 'lemc',
        degreeName: 'LEMc',
        entryYear: 2024,
        currentAcademicYear: 3,
        currentSemester: 1,
        completedCourses: [],
        difficultCourseIds: [],
        difficultTopicsNotes: 'x'.repeat(5000),
      });
      expect(profile.difficultTopicsNotes).toHaveLength(4000);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: prevStorage });
    }
  });
});
