#!/usr/bin/env node
// Lista ficheiros com texto em português ainda escrito diretamente no código (fora dos ficheiros de tradução).
// Heurística: literais e texto JSX com acentos PT. Não bloqueia o build; serve para acompanhar o que falta traduzir.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';
const SKIP = [/locales\//, /__tests__\//, /LegalPages\.tsx$/, /portugalCurriculum\.ts$/, /curriculumParser\.ts$/];
const ACCENT = /[ãçõâêéáíóú]/;
const LITERAL = /'[^']*[ãçõâêéáíóú][^']*'|"[^"]*[ãçõâêéáíóú][^"]*"|`[^`]*[ãçõâêéáíóú][^`]*`|>[^<{]*[ãçõâêéáíóú][^<{]*</;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

const rows = [];
for (const file of walk(ROOT)) {
  if (SKIP.some((re) => re.test(file))) continue;
  let count = 0;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const s = line.trim();
    if (s.startsWith('//') || s.startsWith('*') || s.startsWith('/*') || s.startsWith('{/*')) continue;
    if (ACCENT.test(s) && (LITERAL.test(s) || /^[A-Za-zÀ-ú][^<>{}=;]*$/.test(s))) count += 1;
  }
  if (count > 0) rows.push([count, file]);
}
rows.sort((a, b) => b[0] - a[0]);
for (const [n, f] of rows) console.log(String(n).padStart(4), f);
console.log(`\n${rows.length} ficheiros, ${rows.reduce((s, r) => s + r[0], 0)} linhas com texto PT por traduzir (estimativa).`);
