import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { normalizeAppLanguage } from '../lib/grading';
import type { AppLanguage } from '../types';

import ptAssistant from '../locales/pt-PT/assistant.json';
import ptCommon from '../locales/pt-PT/common.json';
import ptCourses from '../locales/pt-PT/courses.json';
import ptOnboarding from '../locales/pt-PT/onboarding.json';
import ptPlan from '../locales/pt-PT/plan.json';
import ptProgress from '../locales/pt-PT/progress.json';
import ptSettings from '../locales/pt-PT/settings.json';
import ptToday from '../locales/pt-PT/today.json';
import ptUni from '../locales/pt-PT/uni.json';

import ptBrAssistant from '../locales/pt-BR/assistant.json';
import ptBrCommon from '../locales/pt-BR/common.json';
import ptBrCourses from '../locales/pt-BR/courses.json';
import ptBrOnboarding from '../locales/pt-BR/onboarding.json';
import ptBrPlan from '../locales/pt-BR/plan.json';
import ptBrProgress from '../locales/pt-BR/progress.json';
import ptBrSettings from '../locales/pt-BR/settings.json';
import ptBrToday from '../locales/pt-BR/today.json';
import ptBrUni from '../locales/pt-BR/uni.json';

import esAssistant from '../locales/es/assistant.json';
import esCommon from '../locales/es/common.json';
import esCourses from '../locales/es/courses.json';
import esOnboarding from '../locales/es/onboarding.json';
import esPlan from '../locales/es/plan.json';
import esProgress from '../locales/es/progress.json';
import esSettings from '../locales/es/settings.json';
import esToday from '../locales/es/today.json';
import esUni from '../locales/es/uni.json';

import enAssistant from '../locales/en/assistant.json';
import enCommon from '../locales/en/common.json';
import enCourses from '../locales/en/courses.json';
import enOnboarding from '../locales/en/onboarding.json';
import enPlan from '../locales/en/plan.json';
import enProgress from '../locales/en/progress.json';
import enSettings from '../locales/en/settings.json';
import enToday from '../locales/en/today.json';
import enUni from '../locales/en/uni.json';

export const SUPPORTED_LANGUAGES: AppLanguage[] = ['pt-PT', 'pt-BR', 'es', 'en'];

export const resources = {
  'pt-PT': {
    common: ptCommon,
    uni: ptUni,
    today: ptToday,
    courses: ptCourses,
    plan: ptPlan,
    progress: ptProgress,
    assistant: ptAssistant,
    settings: ptSettings,
    onboarding: ptOnboarding,
  },
  'pt-BR': {
    common: ptBrCommon,
    uni: ptBrUni,
    today: ptBrToday,
    courses: ptBrCourses,
    plan: ptBrPlan,
    progress: ptBrProgress,
    assistant: ptBrAssistant,
    settings: ptBrSettings,
    onboarding: ptBrOnboarding,
  },
  es: {
    common: esCommon,
    uni: esUni,
    today: esToday,
    courses: esCourses,
    plan: esPlan,
    progress: esProgress,
    assistant: esAssistant,
    settings: esSettings,
    onboarding: esOnboarding,
  },
  en: {
    common: enCommon,
    uni: enUni,
    today: enToday,
    courses: enCourses,
    plan: enPlan,
    progress: enProgress,
    assistant: enAssistant,
    settings: enSettings,
    onboarding: enOnboarding,
  },
} as const;

export const I18N_NAMESPACES = Object.keys(resources['pt-PT']) as Array<
  keyof (typeof resources)['pt-PT']
>;

export { normalizeAppLanguage };

export function detectPreferredLanguage(explicit?: string | null): AppLanguage {
  if (explicit) return normalizeAppLanguage(explicit);
  if (typeof navigator !== 'undefined' && navigator.language) {
    const nav = navigator.language.toLowerCase();
    if (nav === 'pt-br') return 'pt-BR';
    if (nav.startsWith('es')) return 'es';
    if (nav.startsWith('en')) return 'en';
  }
  return 'pt-PT';
}

export function initAppI18n(initialLanguage: AppLanguage = 'pt-PT') {
  const normalized = normalizeAppLanguage(initialLanguage);
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources,
      lng: normalized,
      fallbackLng: 'pt-PT',
      defaultNS: 'common',
      ns: I18N_NAMESPACES,
      interpolation: {
        escapeValue: false,
      },
    });
  } else if (i18n.language !== normalized) {
    void i18n.changeLanguage(normalized);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = normalized;
    document.title = resources[normalized].common.docTitle;
  }
  return i18n;
}

export function setAppLanguage(language: AppLanguage | string) {
  const normalized = normalizeAppLanguage(language);
  if (i18n.language !== normalized) {
    void i18n.changeLanguage(normalized);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = normalized;
    document.title = resources[normalized].common.docTitle;
  }
}

export default i18n;
