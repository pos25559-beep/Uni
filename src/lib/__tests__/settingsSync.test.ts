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
  useStore: {
    getState: () => ({ settings: {} }),
    setState: vi.fn(),
  },
}));

describe('sincronização de definições', () => {
  let sanitizeSettingsPayload: (typeof import('../firestoreSync'))['sanitizeSettingsPayload'];

  beforeAll(async () => {
    ({ sanitizeSettingsPayload } = await import('../firestoreSync'));
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
});

