// Calendário unificado: aulas, avaliações, sessões de estudo, eventos e tarefas num só sítio.
import {
  addDays, addMonths, addWeeks, format, startOfDay, startOfMonth, startOfWeek,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import AgendaView from '../components/calendar/AgendaView';
import DayPanel from '../components/calendar/DayPanel';
import MonthView from '../components/calendar/MonthView';
import NewEventModal from '../components/calendar/NewEventModal';
import { buildCalendarItems } from '../components/calendar/items';
import type { CalItem, CalKind, CalState } from '../components/calendar/items';
import { KIND_META, KIND_ORDER } from '../components/calendar/shared';
import WeekView from '../components/calendar/WeekView';
import { Button, PageHeader, cx } from '../components/ui';
import { toDateStr } from '../lib/selectors';
import { useStore } from '../store/useStore';
import type { Course } from '../types';

type View = 'mes' | 'semana' | 'agenda';

const VIEWS: { key: View; label: string }[] = [
  { key: 'mes', label: 'Mês' },
  { key: 'semana', label: 'Semana' },
  { key: 'agenda', label: 'Agenda' },
];

const ALL_ON: Record<CalKind, boolean> = { aula: true, avaliacao: true, estudo: true, evento: true, tarefa: true };

export default function Calendar() {
  const courses = useStore((s) => s.courses);
  const classes = useStore((s) => s.classes);
  const assessments = useStore((s) => s.assessments);
  const sessions = useStore((s) => s.sessions);
  const events = useStore((s) => s.events);
  const tasks = useStore((s) => s.tasks);
  const settings = useStore((s) => s.settings);

  const [view, setView] = useState<View>('mes');
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState(() => toDateStr(new Date()));
  const [kinds, setKinds] = useState<Record<CalKind, boolean>>(ALL_ON);
  const [newOpen, setNewOpen] = useState(false);

  const today = toDateStr(new Date());

  const range = useMemo(() => {
    if (view === 'mes') {
      const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
      return { start, end: addDays(start, 41), days: Array.from({ length: 42 }, (_, i) => addDays(start, i)) };
    }
    if (view === 'semana') {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      return { start, end: addDays(start, 6), days: Array.from({ length: 7 }, (_, i) => addDays(start, i)) };
    }
    return { start: cursor, end: addDays(cursor, 29), days: [] as Date[] };
  }, [view, cursor]);

  const calState: CalState = useMemo(
    () => ({ courses, classes, assessments, sessions, events, tasks, settings }),
    [courses, classes, assessments, sessions, events, tasks, settings],
  );

  const allItems = useMemo(
    () => buildCalendarItems(calState, range.start, range.end),
    [calState, range],
  );

  const visible = useMemo(() => allItems.filter((it) => kinds[it.kind]), [allItems, kinds]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    for (const it of visible) {
      const list = map.get(it.date);
      if (list) list.push(it);
      else map.set(it.date, [it]);
    }
    return map;
  }, [visible]);

  const courseById = useMemo(
    () => new Map<string, Course>(courses.map((c) => [c.id, c])),
    [courses],
  );

  const label = (() => {
    if (view === 'mes') return format(cursor, 'MMMM yyyy', { locale: pt });
    if (view === 'semana') {
      return `${format(range.start, 'd MMM', { locale: pt })} – ${format(range.end, 'd MMM yyyy', { locale: pt })}`;
    }
    return `${format(cursor, 'd MMM', { locale: pt })} – ${format(addDays(cursor, 29), 'd MMM yyyy', { locale: pt })}`;
  })();

  const step = (dir: 1 | -1) =>
    setCursor((c) => (view === 'mes' ? addMonths(c, dir) : view === 'semana' ? addWeeks(c, dir) : addDays(c, 30 * dir)));

  const goToday = () => {
    const t = startOfDay(new Date());
    setCursor(t);
    setSelected(toDateStr(t));
  };

  const toggleKind = (k: CalKind) => setKinds((prev) => ({ ...prev, [k]: !prev[k] }));

  return (
    <>
      <PageHeader
        title="Calendário"
        subtitle="Aulas, avaliações, estudo, eventos e tarefas num só lugar."
        actions={
          <Button variant="primary" onClick={() => setNewOpen(true)}>
            <CalendarPlus size={16} /> Novo evento
          </Button>
        }
      />

      {/* Navegação e vista */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" className="px-2" aria-label="Anterior" onClick={() => step(-1)}>
            <ChevronLeft size={16} />
          </Button>
          <Button size="sm" variant="secondary" onClick={goToday}>Hoje</Button>
          <Button size="sm" variant="secondary" className="px-2" aria-label="Seguinte" onClick={() => step(1)}>
            <ChevronRight size={16} />
          </Button>
          <span className="ml-1 min-w-0 truncate text-sm font-semibold capitalize tabular">{label}</span>
        </div>

        <div role="group" aria-label="Vista" className="inline-flex rounded-xl border border-line bg-surface-2 p-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              aria-pressed={view === v.key}
              onClick={() => setView(v.key)}
              className={cx(
                'h-7 rounded-lg px-3 text-xs font-medium transition',
                view === v.key ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {KIND_ORDER.map((k) => {
          const on = kinds[k];
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => toggleKind(k)}
              className={cx(
                'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition',
                on ? 'border-line bg-surface text-fg' : 'border-transparent bg-surface-2 text-muted',
              )}
            >
              <span className={cx('size-2 rounded-full', KIND_META[k].dot, !on && 'opacity-30')} />
              {KIND_META[k].plural}
            </button>
          );
        })}
        <p className="ml-auto hidden text-xs text-muted lg:block">
          Cor = cadeira · borda forte = avaliação · tracejado = tarefa
        </p>
      </div>

      {view === 'mes' && (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-5">
          <div className="rise min-w-0 rounded-2xl border border-line bg-surface p-2 sm:p-3">
            <MonthView
              days={range.days}
              anchor={cursor}
              byDay={byDay}
              courseById={courseById}
              selected={selected}
              today={today}
              onSelect={setSelected}
            />
          </div>
          <div className="mt-4 lg:mt-0">
            <DayPanel
              date={selected}
              items={byDay.get(selected) ?? []}
              courseById={courseById}
              onNewEvent={() => setNewOpen(true)}
            />
          </div>
        </div>
      )}

      {view === 'semana' && (
        <div className="rise rounded-2xl border border-line bg-surface p-2 sm:p-3">
          <WeekView
            days={range.days}
            byDay={byDay}
            courseById={courseById}
            today={today}
            selected={selected}
            onSelect={setSelected}
          />
        </div>
      )}

      {view === 'agenda' && (
        <AgendaView items={visible} courseById={courseById} today={today} />
      )}

      {newOpen && (
        <NewEventModal
          defaultDate={selected}
          onClose={() => setNewOpen(false)}
        />
      )}
    </>
  );
}
