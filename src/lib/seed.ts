import type { Collections, Settings } from '../types';
import { detectSystemLanguage } from './grading';

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
  geminiModel: 'gemini-4-hydrogen',
  googleClientId: '',
  msClientId: '',
  uniAccessory: 'auto',
  uniSkin: 'classic',
  uniSkinAutoRotate: true,
  uniPet: 'cat',
  uniPersona: 'amigo',
  // Primeira utilização: segue a língua do sistema. Depois fica a escolha guardada do estudante.
  language: detectSystemLanguage(),
  gradingScale: 'pt20',
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
