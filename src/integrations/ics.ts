// Parser de iCalendar (RFC 5545) mínimo e sem dependências.
// Hora com TZID é tratada como hora local; UTC (sufixo Z) é convertida para Date.

export interface IcsEvent {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string;
  description?: string;
  /** true quando o evento tem RRULE com FREQ=WEEKLY. */
  weekly?: boolean;
}

interface RawProp {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** Junta as linhas dobradas (continuação começa por espaço ou tabulação). */
function unfold(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else if (line.length > 0) {
      out.push(line);
    }
  }
  return out;
}

function parseProp(line: string): RawProp | null {
  // O valor começa no primeiro ":" fora de aspas nos parâmetros.
  let inQuotes = false;
  let idx = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ':' && !inQuotes) { idx = i; break; }
  }
  if (idx < 0) return null;
  const [name = '', ...paramParts] = line.slice(0, idx).split(';');
  const params: Record<string, string> = {};
  for (const p of paramParts) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(idx + 1) };
}

/** Converte AAAAMMDD[THHMMSS[Z]] em Date. */
function parseDate(prop: RawProp): { date: Date; allDay: boolean } | null {
  const v = prop.value.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/i.exec(v);
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0', z] = m;
  const year = Number(y), month = Number(mo) - 1, day = Number(d);
  const allDay = prop.params['VALUE'] === 'DATE' || !m[4];
  if (allDay) return { date: new Date(year, month, day), allDay: true };
  const hh = Number(h), mm = Number(mi), ss = Number(s);
  const date = z
    ? new Date(Date.UTC(year, month, day, hh, mm, ss))
    : new Date(year, month, day, hh, mm, ss);
  return { date, allDay: false };
}

/** Desfaz o escape de texto iCalendar (\n, \\, \;, \,). */
function unescapeText(value: string): string {
  return value.replace(/\\(.)/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

/** Duração ISO 8601 simples (PT1H30M, P1D, PT45M). Devolve milissegundos ou null. */
function parseDuration(value: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(value.trim());
  if (!m) return null;
  const [, sign, w = '0', d = '0', h = '0', mi = '0', s = '0'] = m;
  const ms = ((Number(w) * 7 + Number(d)) * 24 + Number(h)) * 3600_000 + Number(mi) * 60_000 + Number(s) * 1000;
  return sign === '-' ? -ms : ms;
}

export function parseIcs(text: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let current: RawProp[] | null = null;

  for (const line of unfold(text)) {
    const prop = parseProp(line);
    if (!prop) continue;

    if (prop.name === 'BEGIN' && prop.value.toUpperCase() === 'VEVENT') {
      current = [];
      continue;
    }
    if (prop.name === 'END' && prop.value.toUpperCase() === 'VEVENT') {
      if (current) {
        const ev = buildEvent(current, events.length);
        if (ev) events.push(ev);
      }
      current = null;
      continue;
    }
    if (current) current.push(prop);
  }
  return events;
}

function buildEvent(props: RawProp[], index: number): IcsEvent | null {
  const first = (name: string) => props.find((p) => p.name === name);

  const startProp = first('DTSTART');
  const startParsed = startProp ? parseDate(startProp) : null;
  if (!startParsed) return null;
  const { date: start, allDay } = startParsed;

  let end: Date;
  const endProp = first('DTEND');
  const endParsed = endProp ? parseDate(endProp) : null;
  const durationProp = first('DURATION');
  const durationMs = durationProp ? parseDuration(durationProp.value) : null;
  if (endParsed) {
    end = endParsed.date;
  } else if (durationMs !== null) {
    end = new Date(start.getTime() + durationMs);
  } else {
    end = new Date(start.getTime() + (allDay ? 24 * 3600_000 : 3600_000));
  }

  const uidProp = first('UID');
  const summaryProp = first('SUMMARY');
  const locationProp = first('LOCATION');
  const descProp = first('DESCRIPTION');
  const rrule = first('RRULE');

  const event: IcsEvent = {
    uid: uidProp ? unescapeText(uidProp.value).trim() : `ics-${index}`,
    summary: summaryProp ? unescapeText(summaryProp.value).trim() : '',
    start,
    end,
    allDay,
  };
  const location = locationProp ? unescapeText(locationProp.value).trim() : '';
  if (location) event.location = location;
  const description = descProp ? unescapeText(descProp.value).trim() : '';
  if (description) event.description = description;
  if (rrule && /FREQ=WEEKLY/i.test(rrule.value)) event.weekly = true;
  return event;
}
