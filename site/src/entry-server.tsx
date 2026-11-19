import { renderToString } from 'react-dom/server';
import App from './App';
import { headTags, LANGS } from './i18n';

/** Usado por scripts/site-prerender.mjs: devolve o HTML e o <head> de cada língua. */
export function renderAll() {
  return LANGS.map((lang) => ({
    code: lang.code,
    path: lang.path,
    head: headTags(lang),
    html: renderToString(<App lang={lang} />),
  }));
}
