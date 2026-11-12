// Funções puras: juntam todas as fontes num único calendário. Sem React.
import { addDays, eachDayOfInterval, format, parseISO } from 'date-fns';
import { kindLabel } from '../../lib/colors';
import type { AppState } from '../../store/useStore';
import type { Source } from '../../types';

export type CalKind = 'aula' | 'avaliacao' | 'estudo' | 'evento' | 'tarefa';

export interface CalItem {
  /** Chave única na lista (um evento de vários dias aparece uma vez por dia). */
  id: string;
  /** Id do registo original na coleção (para editar/apagar). */
  refId: string;
  kind: CalKind;
  title: string;
  /** yyyy-MM-dd */
  date: string;
  /** HH:mm */
  start?: string;
  /** HH:mm */
  end?: string;
  courseId?: string;
  source?: Source;
  location?: string;
  done?: boolean;
  /** Minutos planeados (sessões de estudo). */
  minutes?: number;
}

export type CalState = Pick<AppState, 'courses' | 'classes' | 'assessments' | 'sessions' | 'events' | 'tasks' | 'settings'>;

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
const dayOf = (iso: string) => iso.slice(0, 10);
const timeOf = (iso: string) => (iso.length >= 16 ? iso.slice(11, 16) : undefined);

const pad = (n: number) => String(n).padStart(2, '0');

/** 'HH:mm' -> minutos desde as 00:00. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Soma minutos a um 'HH:mm' (sem passar das 23:59). */
export function addMinutesTo(hhmm: string, mins: number): string {
  const total = Math.min(toMinutes(hhmm) + mins, 23 * 60 + 59);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function buildCalendarItems(state: CalState, rangeStart: Date, rangeEnd: Date): CalItem[] {
  const from = ymd(rangeStart);
  const to = ymd(rangeEnd);
  const inRange = (d: string) => d >= from && d <= to;
  const courses = new Map(state.courses.map((c) => [c.id, c]));
  const items: CalItem[] = [];

  // Aulas: repetem-se semanalmente, apenas entre o início e o fim do semestre.
  const { semesterStart, semesterEnd } = state.settings;
  const lo = from > semesterStart ? from : semesterStart;
  const hi = to < semesterEnd ? to : semesterEnd;
  if (lo <= hi && state.classes.length > 0) {
    for (const day of eachDayOfInterval({ start: parseISO(lo), end: parseISO(hi) })) {
      const weekday = day.getDay();
      const ds = ymd(day);
      for (const cl of state.classes) {
        if (cl.weekday !== weekday) continue;
        const course = courses.get(cl.courseId);
        items.push({
          id: `${cl.id}:${ds}`,
          refId: cl.id,
          kind: 'aula',
          title: course ? `${course.shortName} · ${cl.type}` : cl.type,
          date: ds,
          start: cl.start,
          end: cl.end,
          courseId: cl.courseId,
          source: cl.source,
          location: cl.room,
        });
      }
    }
  }

  // Avaliações: no dia (e hora) da data.
  for (const a of state.assessments) {
    const d = dayOf(a.date);
    if (!inRange(d)) continue;
    items.push({
      id: a.id,
      refId: a.id,
      kind: 'avaliacao',
      title: `${kindLabel[a.kind]} — ${a.title}`,
      date: d,
      start: timeOf(a.date),
      courseId: a.courseId,
      source: a.source,
      location: a.location,
      done: a.grade !== undefined,
    });
  }

  // Sessões de estudo.
  for (const s of state.sessions) {
    if (!inRange(s.date)) continue;
    const course = courses.get(s.courseId);
    const topic = course?.topics.find((t) => t.id === s.topicId);
    items.push({
      id: s.id,
      refId: s.id,
      kind: 'estudo',
      title: topic?.title ?? 'Estudo',
      date: s.date,
      start: s.start,
      end: s.start ? addMinutesTo(s.start, s.minutes) : undefined,
      courseId: s.courseId,
      done: s.done,
      minutes: s.minutes,
    });
  }

  // Eventos: multi-dia aparecem em cada dia.
  for (const e of state.events) {
    const sd = dayOf(e.start);
    let ed = dayOf(e.end);
    // Eventos de dia inteiro costumam terminar à meia-noite do dia seguinte (exclusivo).
    if (e.allDay && ed > sd && timeOf(e.end) === '00:00') ed = ymd(addDays(parseISO(ed), -1));
    if (ed < sd) ed = sd;
    const a = sd > from ? sd : from;
    const b = ed < to ? ed : to;
    if (a > b) continue;
    for (const day of eachDayOfInterval({ start: parseISO(a), end: parseISO(b) })) {
      const ds = ymd(day);
      const timed = !e.allDay;
      items.push({
        id: `${e.id}:${ds}`,
        refId: e.id,
        kind: 'evento',
        title: e.title,
        date: ds,
        start: timed && ds === sd ? timeOf(e.start) : undefined,
        end: timed && ds === ed ? timeOf(e.end) : undefined,
        courseId: e.courseId,
        source: e.source,
        location: e.location,
      });
    }
  }

  // Tarefas com data limite (ainda por fazer).
  for (const t of state.tasks) {
    if (t.done || !t.due || !inRange(t.due)) continue;
    items.push({
      id: t.id,
      refId: t.id,
      kind: 'tarefa',
      title: t.title,
      date: t.due,
      courseId: t.courseId,
      done: false,
    });
  }

  return items.sort(
    (x, y) =>
      x.date.localeCompare(y.date) ||
      (x.start ?? '').localeCompare(y.start ?? '') ||
      x.title.localeCompare(y.title, 'pt'),
  );
}
