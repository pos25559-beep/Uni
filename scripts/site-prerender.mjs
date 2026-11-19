#!/usr/bin/env node
// Pré-render do site: escreve dist-site/index.html (pt-PT), /br, /es e /en com HTML e <head> próprios.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist-site');
const ssrDir = join(root, 'dist-site-ssr');
const template = readFileSync(join(dist, 'index.html'), 'utf8');
const { renderAll } = await import(pathToFileURL(join(ssrDir, 'entry-server.js')).href);

for (const page of renderAll()) {
  const html = template
    .replace('<html lang="pt-PT">', `<html lang="${page.code}">`)
    .replace('<!--head-->', page.head)
    .replace('<!--app-->', page.html);
  const dir = page.path === '/' ? dist : join(dist, page.path.slice(1));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
  // /es → es.html com cleanUrls (sem redirecionar para /es/).
  if (page.path !== '/') writeFileSync(join(dist, `${page.path.slice(1)}.html`), html);
  console.log(`  ✓ ${page.code.padEnd(5)} → ${page.path === '/' ? '/' : `${page.path}/`} (${Math.round(html.length / 1024)} kB)`);
}
rmSync(ssrDir, { recursive: true, force: true });
