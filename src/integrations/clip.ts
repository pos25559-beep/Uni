// O CLIP não tem API pública. Estas funções tratam dados que o aluno exporta
// (ficheiro .ics) ou copia (texto do horário) e convertem-nos em rascunhos
// que o utilizador revê antes de importar. Funções puras, sem efeitos.
import { format } from 'date-fns';
import { isCourseIdentityMatch } from '../lib/portugalCurriculum';
import type {
  AssessmentKind, CalendarEvent, ClassType, Course,
} from '../types';
import type { IcsEvent } from './ics';

export interface DraftClass {
  key: string;
  courseName: string;
  courseId?: string;
  type: ClassType;
  /** 0 = domingo … 6 = sábado. */
  weekday: number;
  /** HH:mm */
  start: string;
  /** HH:mm */
  end: string;
  room?: string;
  /** Nome curto da cadeira no CLIP (ex.: "MdF"). */
  shortName?: string;
  /** Id da unidade curricular no CLIP (unidadec). */
  clipId?: string;
  /** Turno no CLIP (ex.: "p.2", "tp.1"). */
  shift?: string;
}

/** Unidade curricular encontrada numa página do Horário do CLIP. */
export interface ClipCourse {
  clipId: string;
  name: string;
  shortName: string;
}

export interface ClipHtmlResult {
  classes: DraftClass[];
  courses: ClipCourse[];
  periodLabel?: string;
}

export interface DraftAssessment {
  key: string;
  courseName: string;
  courseId?: string;
  kind: AssessmentKind;
  title: string;
  /** ISO datetime local (yyyy-MM-ddTHH:mm:ss). */
  date: string;
  location?: string;
}

/** Evento de calendário com o nome da cadeira detetado (para o utilizador corrigir). */
export interface DraftEvent extends CalendarEvent {
  courseName: string;
}

export interface ClipImport {
  classes: DraftClass[];
  assessments: DraftAssessment[];
  events: DraftEvent[];
}

export interface PastedSchedule {
  classes: DraftClass[];
  /** Linhas que não foi possível interpretar, para mostrar ao utilizador. */
  rejected: string[];
}

/** Minúsculas, sem acentos, espaços normalizados. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Encontra a cadeira pelo código, nome curto, iniciais/sigla ou nome (exato primeiro, depois parcial). */
export function matchCourse(name: string, courses: Course[], codeHint?: string): Course | undefined {
  const n = normalize(name);
  const cHint = codeHint ? normalize(codeHint) : '';
  if (!n && !cHint) return undefined;
  const tokens = n.split(/[^a-z0-9]+/).filter(Boolean);
  const prepared = courses.map((c) => ({
    course: c,
    code: normalize(c.code),
    short: normalize(c.shortName),
    full: normalize(c.name),
  }));

  if (cHint) {
    const byHint = prepared.find((p) => p.code === cHint || p.short === cHint || p.full === cHint);
    if (byHint) return byHint.course;
  }

  const exactCode = prepared.find((p) => p.code === n);
  if (exactCode) return exactCode.course;
  const exact = prepared.find((p) => p.short === n || p.full === n);
  if (exact) return exact.course;

  const smartMatch = courses.find(
    (c) =>
      isCourseIdentityMatch({ code: codeHint, name }, { code: c.code, name: c.name }) ||
      isCourseIdentityMatch({ code: codeHint, name }, { code: c.shortName, name: c.name }),
  );
  if (smartMatch) return smartMatch;

  const partial = prepared.find((p) => tokens.includes(p.code));
  return partial?.course;
}

const TYPE_MAP: [RegExp, ClassType][] = [
  [/\b(tp|teorico pratica)\b/, 'TP'],
  [/\b(ot|orientacao)\b/, 'OT'],
  [/\b(pratica|praticas|p)\b/, 'P'],
  [/\b(teorica|teoricas|t)\b/, 'T'],
];

/** Tipo de aula a partir do texto (ex.: "AM2 TP", "Prática laboratorial"). */
export function guessClassType(text: string): ClassType {
  const n = normalize(text).replace(/[-–_]/g, ' ');
  for (const [re, type] of TYPE_MAP) if (re.test(n)) return type;
  return 'T';
}

export function guessAssessmentKind(summary: string): AssessmentKind {
  const n = normalize(summary);
  if (/exame/.test(n)) return 'exame';
  if (/projeto/.test(n)) return 'projeto';
  if (/quiz/.test(n)) return 'quiz';
  if (/entrega|trabalho/.test(n)) return 'trabalho';
  return 'teste';
}

const ASSESSMENT_RE = /exame|teste|frequ[êe]ncia|avalia|entrega/i;

/** Nome da cadeira: o resumo sem a sigla de tipo de aula nem texto de avaliação. */
function courseNameFromSummary(summary: string): string {
  return summary
    .replace(/\b(TP|OT|T|P)\b/g, ' ')
    .replace(/teórico-?\s*prática|teórica|prática|teorica|pratica/gi, ' ')
    .replace(/\s+[-–—|:]\s+.*$/, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Converte eventos .ics do CLIP em rascunhos de aulas, avaliações e eventos. */
export function icsToClipData(events: IcsEvent[], courses: Course[]): ClipImport {
  const classes: DraftClass[] = [];
  const assessments: DraftAssessment[] = [];
  const others: DraftEvent[] = [];

  // Contagem de (resumo, dia da semana, horas) para detetar aulas repetidas.
  const slotKey = (e: IcsEvent) =>
    `${e.summary}|${e.start.getDay()}|${hhmm(e.start)}|${hhmm(e.end)}`;
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.allDay) continue;
    counts.set(slotKey(e), (counts.get(slotKey(e)) ?? 0) + 1);
  }

  const seenSlots = new Set<string>();

  for (const e of events) {
    const summary = e.summary || '(sem título)';
    const courseName = courseNameFromSummary(summary) || summary;
    const courseId = matchCourse(courseName, courses)?.id;
    const k = slotKey(e);
    const repeated = !e.allDay && (counts.get(k) ?? 0) >= 3;

    if (ASSESSMENT_RE.test(summary) && !e.weekly) {
      assessments.push({
        key: `ass-${e.uid}`,
        courseName,
        courseId,
        kind: guessAssessmentKind(summary),
        title: summary,
        date: format(e.start, "yyyy-MM-dd'T'HH:mm:ss"),
        location: e.location,
      });
      continue;
    }

    if (e.weekly || repeated) {
      if (seenSlots.has(k)) continue;
      seenSlots.add(k);
      classes.push({
        key: `cls-${k}`,
        courseName,
        courseId,
        type: guessClassType(summary),
        weekday: e.start.getDay(),
        start: hhmm(e.start),
        end: hhmm(e.end),
        room: e.location,
      });
      continue;
    }

    others.push({
      id: `clip:${e.uid}`,
      title: summary,
      start: format(e.start, "yyyy-MM-dd'T'HH:mm:ss"),
      end: format(e.end, "yyyy-MM-dd'T'HH:mm:ss"),
      allDay: e.allDay || undefined,
      location: e.location,
      source: 'clip',
      courseId,
      courseName,
    });
  }

  return { classes, assessments, events: others };
}

const WEEKDAYS: Record<string, number> = {
  segunda: 1, seg: 1, terca: 2, ter: 2, quarta: 3, qua: 3,
  quinta: 4, qui: 4, sexta: 5, sex: 5, sabado: 6, sab: 6,
  domingo: 0, dom: 0,
};

const ROOM_RE = /^(sala|lab|laboratorio|edificio|anf|anfiteatro|gab|gabinete)\b|^ed(\.|$)/;
const TYPE_WORDS = new Set(['tp', 'ot', 'p', 't', 'pratica', 'praticas', 'teorica', 'teoricas', 'teorico']);

/** Interpreta um horário colado como texto, uma aula por linha. */
export function parsePastedSchedule(text: string, courses: Course[] = []): PastedSchedule {
  const classes: DraftClass[] = [];
  const rejected: string[] = [];

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const line = raw.trim();
    if (!line) continue;

    // Separa intervalos "09:00-11:00" / "09:00–11:00" e aceita ; | tab ou espaços.
    const spaced = line.replace(/(\d)\s*[-–—]\s*(?=\d)/g, '$1 ');
    const tokens = spaced.split(/[;|\t\s]+/).filter(Boolean);

    let weekday: number | undefined;
    const times: string[] = [];
    let type: ClassType | undefined;
    let roomStart = -1;
    const rest: string[] = [];

    for (let idx = 0; idx < tokens.length; idx++) {
      const tok = tokens[idx] ?? '';
      if (roomStart >= 0) break;
      const n = normalize(tok).replace(/[.,]$/, '');
      const clean = tok.replace(/[-–—]/g, '');
      if (weekday === undefined && Object.hasOwn(WEEKDAYS, n)) {
        weekday = WEEKDAYS[n];
        continue;
      }
      const tm = /^(\d{1,2})[:h.](\d{2})$/.exec(clean);
      if (tm) {
        times.push(`${(tm[1] ?? '').padStart(2, '0')}:${tm[2] ?? '00'}`);
        continue;
      }
      if (type === undefined && TYPE_WORDS.has(n)) {
        type = guessClassType(n);
        continue;
      }
      if (ROOM_RE.test(n)) { roomStart = idx; break; }
      if (n === 'as' || n === 'às') continue;
      rest.push(tok);
    }

    const room = roomStart >= 0 ? tokens.slice(roomStart).join(' ') : undefined;
    const courseName = rest.join(' ').replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();

    const start = times[0];
    const end = times[1];
    const valid = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h !== undefined && m !== undefined && h >= 0 && h <= 23 && m >= 0 && m <= 59;
    };
    if (weekday === undefined || !start || !end || !valid(start) || !valid(end)
      || start >= end || !courseName) {
      rejected.push(line);
      continue;
    }

    classes.push({
      key: `paste-${i}`,
      courseName,
      courseId: matchCourse(courseName, courses)?.id,
      type: type ?? 'T',
      weekday,
      start,
      end,
      room,
    });
  }

  return { classes, rejected };
}

const CLIP_TYPE: Record<string, ClassType> = { t: 'T', tp: 'TP', p: 'P', pl: 'P', ot: 'OT' };

/**
 * Lê a query string de um href do CLIP à mão. Os valores estão em latin-1
 * (ex.: %E1), por isso não se usa URLSearchParams nem decodeURIComponent.
 */
function clipParams(href: string): Record<string, string> {
  const out: Record<string, string> = {};
  const q = href.indexOf('?');
  if (q < 0) return out;
  for (const part of href.slice(q + 1).split('&')) {
    const eq = part.indexOf('=');
    if (eq > 0) out[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return out;
}

const hhmmFromParam = (value: string): number | null => {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 3 && digits.length !== 4) return null;
  const h = Number(digits.slice(0, digits.length - 2));
  const m = Number(digits.slice(-2));
  return h < 24 && m < 60 ? h * 60 + m : null;
};

const fmtMinutes = (total: number): string => {
  const t = Math.min(total, 23 * 60 + 59);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/**
 * Lê a página do Horário do CLIP (página guardada ou fragmento copiado) e devolve
 * as aulas. Cada aula é um td com title = nome completo, um link "detalhes" cujo
 * texto é o turno (ex.: "p.2") e cujos parâmetros dizem unidade, tipo, dia e início.
 */
export function parseClipScheduleHtml(html: string, courses: Course[]): ClipHtmlResult {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const classes: DraftClass[] = [];
  const seen = new Set<string>();
  const units = new Map<string, ClipCourse>();

  const links = doc.querySelectorAll<HTMLAnchorElement>('a[href*="detalhes"]');
  for (const link of links) {
    const href = link.getAttribute('href') ?? '';
    const params = clipParams(href);
    const clipId = params['unidadec'];
    if (!clipId || !/^\d+$/.test(clipId)) continue;

    const td = link.closest('td');
    if (!td) continue;

    const title = (td.getAttribute('title') ?? '').replace(/\s+/g, ' ').trim();
    const shortName = (td.querySelector('b')?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const name = title || shortName;
    if (!name) continue;

    const rowspan = Math.max(1, Number.parseInt(td.getAttribute('rowspan') ?? '1', 10) || 1);
    const shift = (link.textContent ?? '').replace(/\s+/g, ' ').trim();

    const tipo = (params['tipo'] ?? '').toLowerCase();
    const type: ClassType = CLIP_TYPE[tipo] ?? 'T';

    const dia = Number.parseInt(params['dia'] ?? '', 10);
    if (!Number.isFinite(dia)) continue;
    const weekday = dia === 8 ? 0 : dia - 1;
    if (weekday < 0 || weekday > 6) continue;

    const startParam = Object.entries(params).find(([k]) => k.endsWith('cio'))?.[1];
    const startMin = startParam === undefined ? null : hhmmFromParam(startParam);
    if (startMin === null) continue;
    const start = fmtMinutes(startMin);
    const end = fmtMinutes(startMin + rowspan * 30);

    const dedupe = `${clipId}|${tipo}|${shift}|${weekday}|${start}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const clone = td.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('b, a').forEach((n) => n.remove());
    const room = (clone.textContent ?? '').replace(/\s+/g, ' ').trim();

    if (!units.has(clipId)) {
      units.set(clipId, { clipId, name, shortName: shortName || name });
    }

    const courseId = matchCourse(name, courses)?.id ?? (shortName ? matchCourse(shortName, courses)?.id : undefined);

    classes.push({
      key: `clip-${dedupe}`,
      courseName: name,
      courseId,
      type,
      weekday,
      start,
      end,
      room: room || undefined,
      shortName: shortName || undefined,
      clipId,
      shift: shift || undefined,
    });
  }

  return { classes, courses: [...units.values()] };
}

/** Descodifica bytes de uma página: UTF-8 se for válido, senão windows-1252 (o que o CLIP usa). */
export function decodeHtmlBytes(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}
