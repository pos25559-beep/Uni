import { createContext, useContext } from 'react';
import en from './locales/en.json';
import es from './locales/es.json';
import ptBR from './locales/pt-BR.json';
import ptPT from './locales/pt-PT.json';

export type Copy = typeof ptPT;

export type LangCode = 'pt-PT' | 'pt-BR' | 'es' | 'en';

export interface Lang {
  code: LangCode;
  /** Caminho público da página (sem barra final, exceto a raiz). */
  path: string;
  label: string;
  short: string;
  ogLocale: string;
  copy: Copy;
}

export const LANGS: Lang[] = [
  { code: 'pt-PT', path: '/', label: 'Português (Portugal)', short: 'PT', ogLocale: 'pt_PT', copy: ptPT },
  { code: 'pt-BR', path: '/br', label: 'Português (Brasil)', short: 'BR', ogLocale: 'pt_BR', copy: ptBR },
  { code: 'es', path: '/es', label: 'Español', short: 'ES', ogLocale: 'es_ES', copy: es },
  { code: 'en', path: '/en', label: 'English', short: 'EN', ogLocale: 'en_GB', copy: en },
];

export function langFromPath(pathname: string): Lang {
  const seg = pathname.split('/').filter(Boolean)[0] ?? '';
  return LANGS.find((l) => l.path === `/${seg}`) ?? LANGS[0];
}

/** Endereço da app (o site de apresentação vive num 2.º site do Hosting). */
export const APP_URL = 'https://campus-erp-84964.web.app';

export const LangContext = createContext<Lang>(LANGS[0]);
export const useLang = () => useContext(LangContext);
export const useCopy = () => useContext(LangContext).copy;

/** Endereço público do site (para canonical e hreflang). Muda-se com VITE_SITE_URL quando houver domínio próprio. */
export const SITE_URL = ((import.meta.env?.VITE_SITE_URL as string | undefined) || 'https://unipedia-site.web.app').replace(/\/$/, '');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Etiquetas do <head> por língua (usadas no pré-render). */
export function headTags(lang: Lang): string {
  const { meta } = lang.copy;
  const url = SITE_URL + (lang.path === '/' ? '/' : `${lang.path}/`);
  const alternates = LANGS.map(
    (l) => `<link rel="alternate" hreflang="${l.code}" href="${SITE_URL}${l.path === '/' ? '/' : `${l.path}/`}" />`,
  ).join('\n    ');
  return [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    alternates,
    `<link rel="alternate" hreflang="x-default" href="${SITE_URL}/" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Unipedia" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:locale" content="${lang.ogLocale}" />`,
    `<meta name="twitter:card" content="summary" />`,
  ].join('\n    ');
}
