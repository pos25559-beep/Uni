// Lê janelas de datas escritas pelo estudante numa frase de foco
// («sprint de sexta a segunda», «até quarta», «este fim de semana», «amanhã»),
// para a nota só aparecer nesses dias e não em todos até ao teste. Puro e testável.
import { addDays, format } from 'date-fns';
import { parseDay } from './slots';

export interface FocusWindow {
  /** yyyy-MM-dd, inclusive */
  from: string;
  /** yyyy-MM-dd, inclusive */
  until: string;
}

const WEEKDAY_WORDS: Array<[RegExp, number]> = [
  [/^domingo/, 0],
  [/^segunda/, 1],
  [/^terca/, 2],
  [/^quarta/, 3],
  [/^quinta/, 4],
  [/^sexta/, 5],
  [/^sabado/, 6],
  // Espanhol e inglês (as frases do Uni podem vir noutras línguas da app)
  [/^lunes/, 1],
  [/^martes/, 2],
  [/^miercoles/, 3],
  [/^jueves/, 4],
  [/^viernes/, 5],
  [/^monday/, 1],
  [/^tuesday/, 2],
  [/^wednesday/, 3],
  [/^thursday/, 4],
  [/^friday/, 5],
  [/^saturday/, 6],
  [/^sunday/, 0],
];

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

function weekdayOf(word: string): number | undefined {
  for (const [re, d] of WEEKDAY_WORDS) if (re.test(word)) return d;
  return undefined;
}

/** Próxima data (inclusive) a partir de `from` que cai no dia da semana `weekday`. */
function nextOnOrAfter(from: Date, weekday: number): Date {
  const delta = (weekday - from.getDay() + 7) % 7;
  return addDays(from, delta);
}

const key = (d: Date) => format(d, 'yyyy-MM-dd');

/**
 * Devolve a janela de datas descrita na frase, contada a partir do dia em que foi escrita.
 * Sem janela reconhecível → undefined (quem chama decide a validade por omissão).
 */
export function parseFocusWindow(text: string, writtenOn: string): FocusWindow | undefined {
  if (!text?.trim()) return undefined;
  let base: Date;
  try {
    base = parseDay(writtenOn.slice(0, 10));
  } catch {
    return undefined;
  }
  if (Number.isNaN(base.getTime())) return undefined;
  const t = normalize(text);
  const word = '([a-z]+)(?:-feira)?';

  // «de sexta a segunda», «entre quarta e sexta», «from friday to monday», «del viernes al lunes»
  const range = t.match(new RegExp(`(?:\\bde|\\bentre|\\bfrom|\\bdel?)\\s+${word}\\s+(?:a|ao|e|to|al|hasta)\\s+${word}`));
  if (range) {
    const a = weekdayOf(range[1]);
    const b = weekdayOf(range[2]);
    if (a !== undefined && b !== undefined) {
      const start = nextOnOrAfter(base, a);
      const end = nextOnOrAfter(start, b);
      return { from: key(start), until: key(end) };
    }
  }

  // «até quarta», «until wednesday», «hasta el miércoles»
  const until = t.match(new RegExp(`(?:\\bate|\\buntil|\\bhasta(?:\\s+el)?)\\s+(?:a\\s+|o\\s+)?${word}`));
  if (until) {
    const b = weekdayOf(until[1]);
    if (b !== undefined) return { from: key(base), until: key(nextOnOrAfter(base, b)) };
  }

  // «fim de semana», «fds», «weekend», «fin de semana»
  if (/\bfim[- ]de[- ]semana\b|\bfds\b|\bweekend\b|\bfin de semana\b/.test(t)) {
    const sat = nextOnOrAfter(base, 6);
    return { from: key(sat), until: key(addDays(sat, 1)) };
  }

  if (/\bamanha\b|\btomorrow\b|\bmanana\b/.test(t)) {
    const d = addDays(base, 1);
    return { from: key(d), until: key(d) };
  }
  if (/\bhoje\b|\btoday\b|\bhoy\b/.test(t)) {
    return { from: key(base), until: key(base) };
  }
  return undefined;
}

/** A data `dayKey` (yyyy-MM-dd) está dentro da janela? (inclusive) */
export function isWithinWindow(dayKey: string, w: { from?: string; until: string }): boolean {
  return (!w.from || dayKey >= w.from) && dayKey <= w.until;
}
