import type { Collections, Settings } from '../types';

export const defaultSettings: Settings = {
  userName: '',
  theme: 'system',
  themePalette: 'caderno',
  appTone: 'vibrante',
  uniLiveCompanions: 'all',
  semesterName: 'Semestre atual',
  semesterStart: '2026-09-14',
  semesterEnd: '2027-01-30',
  dailyStudyMinutes: 120,
  studyDays: [1, 2, 3, 4, 5, 6],
  geminiApiKey: '',
  geminiModel: 'gemini-3.8-flash',
  googleClientId: '',
  msClientId: '',
  uniAccessory: 'auto',
  uniSkin: 'classic',
  uniPersona: 'amigo',
  seenTabGuides: [],
  notifications: {
    enabled: false,
    streakSaver: true,
    srsDue: true,
    assessments: true,
    classReminders: true,
    classBeforeMinutes: 15,
    preferredHour: 19,
    quietStart: '22:30',
    quietEnd: '08:30',
    maxDailyNudges: 2,
  },
};

export const emptyCollections = (): Collections => ({
  courses: [],
  assessments: [],
  classes: [],
  sessions: [],
  tasks: [],
  materials: [],
  events: [],
});
