import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';
import { headTags } from './head';
import { allRoutes, pagePath } from './routes';

/** Usado por scripts/site-prerender.mjs: HTML, <head> e caminho de cada página × língua. */
export function renderAll() {
  return allRoutes().map((route) => ({
    code: route.lang.code,
    page: route.page,
    path: pagePath(route.lang, route.page),
    head: headTags(route),
    html: renderToString(
      <StrictMode>
        <App route={route} />
      </StrictMode>,
    ),
  }));
}
