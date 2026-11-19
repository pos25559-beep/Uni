import { LANGS, SITE_URL } from './i18n';
import { pagePath, type Route } from './routes';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const abs = (path: string) => SITE_URL + (path === '/' ? '/' : path);

/** Título e descrição da página (início ou área). */
export function pageMeta({ lang, page }: Route) {
  return page === 'home' ? lang.copy.meta : lang.copy.pages[page].meta;
}

/** Etiquetas do <head> de cada página (usadas no pré-render). */
export function headTags(route: Route): string {
  const { lang, page } = route;
  const meta = pageMeta(route);
  const url = abs(pagePath(lang, page));
  const alternates = LANGS.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${abs(pagePath(l, page))}" />`).join('\n    ');
  return [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    alternates,
    `<link rel="alternate" hreflang="x-default" href="${abs(pagePath(LANGS[0], page))}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Unipedia" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:locale" content="${lang.ogLocale}" />`,
    `<meta name="twitter:card" content="summary" />`,
  ].join('\n    ');
}
