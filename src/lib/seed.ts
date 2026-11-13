import type { Collections, Settings } from '../types';

export const defaultSettings: Settings = {
  userName: '',
  theme: 'system',
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
  uniPersona: 'amigo',
  seenTabGuides: [],
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
