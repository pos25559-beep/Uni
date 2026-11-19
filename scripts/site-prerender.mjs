#!/usr/bin/env node
// Pré-render do site: uma página HTML por língua × página (início, plano, foco, prática, progresso, uni).
// Escreve <caminho>/index.html e <caminho>.html (para /foco servir sem redirecionar para /foco/).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist-site');
const ssrDir = join(root, 'dist-site-ssr');
const template = readFileSync(join(dist, 'index.html'), 'utf8');
const { renderAll } = await import(pathToFileURL(join(ssrDir, 'entry-server.js')).href);

const pages = renderAll();
for (const page of pages) {
  const html = template
    .replace('<html lang="pt-PT">', `<html lang="${page.code}">`)
    .replace('<!--head-->', page.head)
    .replace('<div id="root"><!--app--></div>', `<div id="root" data-page="${page.code}:${page.page}">${page.html}</div>`);
  if (page.path === '/') {
    writeFileSync(join(dist, 'index.html'), html);
  } else {
    const rel = page.path.slice(1);
    mkdirSync(join(dist, rel), { recursive: true });
    writeFileSync(join(dist, rel, 'index.html'), html);
    mkdirSync(dirname(join(dist, `${rel}.html`)), { recursive: true });
    writeFileSync(join(dist, `${rel}.html`), html);
  }
}
console.log(`  ✓ ${pages.length} páginas pré-renderizadas (${[...new Set(pages.map((p) => p.code))].join(', ')})`);
rmSync(ssrDir, { recursive: true, force: true });
