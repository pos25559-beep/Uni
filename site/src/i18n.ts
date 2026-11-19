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

/** Endereço da app (o site de apresentação vive num 2.º site do Hosting). */
export const APP_URL = 'https://campus-erp-84964.web.app';

export const LangContext = createContext<Lang>(LANGS[0]);
export const useLang = () => useContext(LangContext);
export const useCopy = () => useContext(LangContext).copy;

/** Endereço público do site (para canonical e hreflang). Muda-se com VITE_SITE_URL quando houver domínio próprio. */
export const SITE_URL = ((import.meta.env?.VITE_SITE_URL as string | undefined) || 'https://unipedia-site.web.app').replace(/\/$/, '');
