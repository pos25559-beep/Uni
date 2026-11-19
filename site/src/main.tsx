import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import './site.css';
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App';
import { pageMeta } from './head';
import { parseRoute } from './routes';

const root = document.getElementById('root')!;
const route = parseRoute(window.location.pathname);
const app = (
  <StrictMode>
    <App route={route} />
  </StrictMode>
);

// As páginas vêm pré-renderizadas; hidrata só se o HTML for da mesma página e língua
// (um servidor que devolva outra página não pode partir a hidratação). Senão monta do zero.
const prerendered = root.dataset.page;
if (root.firstElementChild && prerendered === `${route.lang.code}:${route.page}`) hydrateRoot(root, app);
else {
  root.replaceChildren();
  document.documentElement.lang = route.lang.code;
  document.title = pageMeta(route).title;
  createRoot(root).render(app);
}
