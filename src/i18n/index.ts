import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
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

import enAssistant from '../locales/en/assistant.json';
import enCommon from '../locales/en/common.json';
import enCourses from '../locales/en/courses.json';
import enOnboarding from '../locales/en/onboarding.json';
import enPlan from '../locales/en/plan.json';
import enProgress from '../locales/en/progress.json';
import enSettings from '../locales/en/settings.json';
import enToday from '../locales/en/today.json';
import enUni from '../locales/en/uni.json';

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

export function initAppI18n(initialLanguage: AppLanguage = 'pt-PT') {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources,
      lng: initialLanguage,
      fallbackLng: 'pt-PT',
      defaultNS: 'common',
      ns: I18N_NAMESPACES,
      interpolation: {
        escapeValue: false,
      },
    });
  } else if (i18n.language !== initialLanguage) {
    void i18n.changeLanguage(initialLanguage);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = initialLanguage;
  }
  return i18n;
}

export function setAppLanguage(language: AppLanguage) {
  if (i18n.language !== language) {
    void i18n.changeLanguage(language);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
  }
}

export default i18n;
