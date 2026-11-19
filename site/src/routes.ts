import { createContext, useContext } from 'react';
import { LANGS, type Lang, type LangCode } from './i18n';

/** Páginas do site. «home» é a página inicial; as outras explicam uma área da app. */
export const PAGES = ['home', 'plano', 'foco', 'pratica', 'progresso', 'uni'] as const;
export type PageId = (typeof PAGES)[number];
export type FeatureId = Exclude<PageId, 'home'>;
export const FEATURES: FeatureId[] = ['plano', 'foco', 'pratica', 'progresso', 'uni'];

/** Endereço traduzido de cada página (o mesmo conteúdo, com o slug na língua). */
const SLUGS: Record<LangCode, Record<FeatureId, string>> = {
  'pt-PT': { plano: 'plano', foco: 'foco', pratica: 'pratica', progresso: 'progresso', uni: 'uni' },
  'pt-BR': { plano: 'plano', foco: 'foco', pratica: 'pratica', progresso: 'progresso', uni: 'uni' },
  es: { plano: 'plan', foco: 'foco', pratica: 'practica', progresso: 'progreso', uni: 'uni' },
  en: { plano: 'plan', foco: 'focus', pratica: 'practice', progresso: 'progress', uni: 'uni' },
};

/** Caminho público de uma página numa língua (sem barra final; a raiz de pt-PT é «/»). */
export function pagePath(lang: Lang, page: PageId): string {
  const base = lang.path === '/' ? '' : lang.path;
  if (page === 'home') return base || '/';
  return `${base}/${SLUGS[lang.code][page]}`;
}

export interface Route {
  lang: Lang;
  page: PageId;
}

export function parseRoute(pathname: string): Route {
  const segs = pathname.replace(/\.html$/, '').split('/').filter(Boolean);
  const lang = LANGS.find((l) => l.path !== '/' && l.path === `/${segs[0]}`) ?? LANGS[0];
  const rest = lang.path === '/' ? segs : segs.slice(1);
  const slug = rest[0];
  if (!slug || slug === 'index') return { lang, page: 'home' };
  const page = (Object.entries(SLUGS[lang.code]) as [FeatureId, string][]).find(([, s]) => s === slug)?.[0];
  return { lang, page: page ?? 'home' };
}

/** Todas as combinações língua × página (para o pré-render). */
export function allRoutes(): Route[] {
  return LANGS.flatMap((lang) => PAGES.map((page) => ({ lang, page })));
}

export const RouteContext = createContext<Route>({ lang: LANGS[0], page: 'home' });
export const useRoute = () => useContext(RouteContext);
