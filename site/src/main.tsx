import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import './site.css';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App';
import { langFromPath } from './i18n';

const root = document.getElementById('root')!;
const lang = langFromPath(window.location.pathname);
// Sem StrictMode: o <Html> do drei (ecrã do telemóvel 3D) não suporta a montagem dupla.
const app = <App lang={lang} />;

// Em produção as páginas vêm pré-renderizadas; hidrata só se o HTML for o da mesma língua
// (um servidor que devolva a página errada não pode partir a hidratação). Senão monta do zero.
if (root.firstElementChild && document.documentElement.lang === lang.code) hydrateRoot(root, app);
else {
  root.replaceChildren();
  document.documentElement.lang = lang.code;
  document.title = lang.copy.meta.title;
  createRoot(root).render(app);
}
