#!/usr/bin/env node
// Garante que as 4 línguas do site têm exatamente as mesmas chaves (e listas do mesmo tamanho) que pt-PT.
import { readFileSync } from 'node:fs';

const DIR = new URL('../site/src/locales/', import.meta.url);
const base = JSON.parse(readFileSync(new URL('pt-PT.json', DIR), 'utf8'));
const problems = [];

function shape(a, b, path, lang) {
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) problems.push(`${lang}: ${path} devia ser uma lista com ${a.length} itens`);
    else a.forEach((v, i) => shape(v, b[i], `${path}[${i}]`, lang));
  } else if (a && typeof a === 'object') {
    if (!b || typeof b !== 'object') return problems.push(`${lang}: ${path} em falta`);
    for (const k of Object.keys(a)) shape(a[k], b[k], path ? `${path}.${k}` : k, lang);
    for (const k of Object.keys(b)) if (!(k in a)) problems.push(`${lang}: ${path ? `${path}.` : ''}${k} a mais`);
  } else if (typeof b !== 'string' || !b.trim()) problems.push(`${lang}: ${path} vazio ou em falta`);
}

for (const lang of ['pt-BR', 'es', 'en']) {
  shape(base, JSON.parse(readFileSync(new URL(`${lang}.json`, DIR), 'utf8')), '', lang);
}
if (problems.length) {
  console.error(`Site: ${problems.length} diferença(s) entre línguas:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('Site: 4 línguas com as mesmas chaves.');
