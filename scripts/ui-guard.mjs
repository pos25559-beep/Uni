import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve(process.cwd(), 'src');
const STRICT = process.argv.includes('--strict');

/** Percorre recursivamente todos os ficheiros .ts/.tsx em src/ (excluindo testes). */
function collectSourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const RULES = [
  {
    id: 'no-native-select',
    message: 'Usar <Select> ou <PillSelect> de src/components/ui.tsx em vez de <select> nativo.',
    pattern: /<select\b/,
    strictOnly: false,
  },
  {
    id: 'no-10px-text',
    message: 'Evitar micro-tipografia text-[10px]; mínimo 12px (text-xs) ou text-[11px] temporário.',
    pattern: /\btext-\[10px\]/,
    strictOnly: false,
  },
  {
    id: 'no-11px-text',
    message: 'Tipografia abaixo de 12px proibida (--strict); usar text-xs (12px).',
    pattern: /\btext-\[11px\]/,
    strictOnly: true,
  },
  {
    id: 'no-native-datetime-inputs',
    message: 'Usar <TimeField>, <DateField> ou <DateTimeField> de src/components/ui.tsx em vez de input nativo.',
    pattern: /\btype=["'](?:time|date|datetime-local)["']/,
    strictOnly: true,
  },
];

const files = collectSourceFiles(SRC_DIR);
const failures = [];
const advisories = [];

for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/**')) return;
    for (const rule of RULES) {
      if (!rule.pattern.test(line)) continue;
      const item = `${rel}:${idx + 1} [${rule.id}] ${rule.message}`;
      if (rule.strictOnly && !STRICT) {
        advisories.push(item);
      } else {
        failures.push(item);
      }
    }
  });
}

if (advisories.length > 0) {
  console.log(`ui-guard avisos pendentes (ativos em --strict): ${advisories.length}`);
}

if (failures.length > 0) {
  console.error('ui-guard falhou:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}

console.log(`ui-guard OK (${files.length} ficheiros analisados${STRICT ? ', modo --strict' : ''}).`);
