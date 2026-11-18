import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { detectSystemLanguage, normalizeAppLanguage } from '../lib/grading';
import type { AppLanguage } from '../types';
import { ptPTPack } from './packs/pt-PT';

export const SUPPORTED_LANGUAGES: AppLanguage[] = ['pt-PT', 'pt-BR', 'es', 'en'];

export type I18nResourcePack = typeof ptPTPack;
export type I18nNamespace = keyof I18nResourcePack;
export type I18nResourcesMap = Record<AppLanguage, I18nResourcePack>;

/**
 * Apenas `pt-PT` é carregado no arranque para reduzir o bundle inicial;
 * `pt-BR`, `es` e `en` são injetados aqui sob demanda por `loadLanguageResources`.
 */
export const resources = {
  'pt-PT': ptPTPack,
} as unknown as I18nResourcesMap;

export const I18N_NAMESPACES = Object.keys(ptPTPack) as I18nNamespace[];

const pendingLanguageLoads = new Map<AppLanguage, Promise<I18nResourcePack>>();

const LANGUAGE_LOADERS: Record<Exclude<AppLanguage, 'pt-PT'>, () => Promise<I18nResourcePack>> = {
  'pt-BR': () => import('./packs/pt-BR').then((m) => m.ptBRPack as unknown as I18nResourcePack),
  es: () => import('./packs/es').then((m) => m.esPack as unknown as I18nResourcePack),
  en: () => import('./packs/en').then((m) => m.enPack as unknown as I18nResourcePack),
};

function registerPackInI18n(lang: AppLanguage, pack: I18nResourcePack) {
  (resources as Record<string, I18nResourcePack>)[lang] = pack;
  if (!i18n.isInitialized) return;
  for (const ns of I18N_NAMESPACES) {
    if (!i18n.hasResourceBundle(lang, ns)) {
      i18n.addResourceBundle(lang, ns, pack[ns], true, true);
    }
  }
}

export async function loadLanguageResources(language: AppLanguage | string): Promise<I18nResourcePack> {
  const normalized = normalizeAppLanguage(language);
  const loaded = (resources as Partial<Record<AppLanguage, I18nResourcePack>>)[normalized];
  if (loaded) {
    registerPackInI18n(normalized, loaded);
    return loaded;
  }
  const pending = pendingLanguageLoads.get(normalized);
  if (pending) return pending;

  if (normalized === 'pt-PT') {
    registerPackInI18n('pt-PT', ptPTPack);
    return ptPTPack;
  }

  const promise = LANGUAGE_LOADERS[normalized]()
    .then((pack) => {
      registerPackInI18n(normalized, pack);
      return pack;
    })
    .finally(() => {
      pendingLanguageLoads.delete(normalized);
    });
  pendingLanguageLoads.set(normalized, promise);
  return promise;
}

export async function preloadAllLanguages(): Promise<void> {
  await Promise.all(SUPPORTED_LANGUAGES.map((lang) => loadLanguageResources(lang)));
}

export { normalizeAppLanguage };

export function detectPreferredLanguage(explicit?: string | null): AppLanguage {
  if (explicit) return normalizeAppLanguage(explicit);
  return detectSystemLanguage();
}

function applyDocumentMeta(normalized: AppLanguage) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = normalized;
  const pack = (resources as Partial<Record<AppLanguage, I18nResourcePack>>)[normalized] ?? ptPTPack;
  document.title = pack.common.docTitle;
}

function buildInitialResourcesSnapshot(): Partial<Record<AppLanguage, I18nResourcePack>> {
  const out: Partial<Record<AppLanguage, I18nResourcePack>> = { 'pt-PT': ptPTPack };
  for (const lang of SUPPORTED_LANGUAGES) {
    const pack = (resources as Partial<Record<AppLanguage, I18nResourcePack>>)[lang];
    if (pack) out[lang] = pack;
  }
  return out;
}

export function initAppI18n(initialLanguage: AppLanguage = 'pt-PT') {
  const normalized = normalizeAppLanguage(initialLanguage);
  const hasNormalizedPack = Boolean(
    (resources as Partial<Record<AppLanguage, I18nResourcePack>>)[normalized],
  );

  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources: buildInitialResourcesSnapshot(),
      lng: hasNormalizedPack ? normalized : 'pt-PT',
      fallbackLng: 'pt-PT',
      defaultNS: 'common',
      ns: I18N_NAMESPACES,
      interpolation: {
        escapeValue: false,
      },
    });
  } else if (hasNormalizedPack && i18n.language !== normalized) {
    void i18n.changeLanguage(normalized);
  }

  applyDocumentMeta(hasNormalizedPack ? normalized : 'pt-PT');

  if (!hasNormalizedPack && normalized !== 'pt-PT') {
    void loadLanguageResources(normalized).then(() => {
      if (i18n.language !== normalized) {
        void i18n.changeLanguage(normalized);
      }
      applyDocumentMeta(normalized);
    });
  }

  return i18n;
}

export async function initAppI18nAsync(initialLanguage: AppLanguage = 'pt-PT') {
  const normalized = normalizeAppLanguage(initialLanguage);
  if (normalized !== 'pt-PT') {
    await loadLanguageResources(normalized).catch(() => ptPTPack);
  }
  return initAppI18n(normalized);
}

export function setAppLanguage(language: AppLanguage | string) {
  const normalized = normalizeAppLanguage(language);
  const existing = (resources as Partial<Record<AppLanguage, I18nResourcePack>>)[normalized];
  if (existing) {
    registerPackInI18n(normalized, existing);
    if (i18n.language !== normalized) {
      void i18n.changeLanguage(normalized);
    }
    applyDocumentMeta(normalized);
    return;
  }

  void loadLanguageResources(normalized).then(() => {
    if (i18n.language !== normalized) {
      void i18n.changeLanguage(normalized);
    }
    applyDocumentMeta(normalized);
  });
}

export default i18n;
