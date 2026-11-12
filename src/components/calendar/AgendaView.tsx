// Agenda: lista dos próximos 30 dias agrupada por dia (dias vazios são omitidos).
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { MapPin } from 'lucide-react';
import { useMemo } from 'react';
import type { Course } from '../../types';
import { Badge, CourseChip, EmptyState, cx } from '../ui';
import type { CalItem } from './items';
import { KIND_META, SOURCE_LABEL, isImported, itemDot, timeLabel } from './shared';

interface Props {
  items: CalItem[];
  courseById: Map<string, Course>;
  today: string;
}

export default function AgendaView({ items, courseById, today }: Props) {
  const groups = useMemo(() => {
    const out: { date: string; list: CalItem[] }[] = [];
    for (const it of items) {
      const last = out[out.length - 1];
      if (last && last.date === it.date) last.list.push(it);
      else out.push({ date: it.date, list: [it] });
    }
    return out;
  }, [items]);

  if (groups.length === 0) {
    return (
      <EmptyState
        title="Nada agendado nos próximos 30 dias"
        hint="Aulas, avaliações, sessões de estudo, eventos e tarefas com data aparecem aqui."
      />
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(({ date, list }) => (
        <section key={date} className="rise">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold capitalize">
            {format(parseISO(date), "EEEE, d 'de' MMMM", { locale: pt })}
            {date === today && <Badge tone="accent">Hoje</Badge>}
          </h3>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {list.map((it) => {
              const course = it.courseId ? courseById.get(it.courseId) : undefined;
              const Icon = KIND_META[it.kind].icon;
              return (
                <li key={it.id} className={cx('flex gap-3 p-3.5', it.done && 'opacity-60')}>
                  <div className="w-14 shrink-0 pt-0.5 text-xs tabular text-muted">{timeLabel(it)}</div>
                  <span className={cx('mt-1 h-8 w-1 shrink-0 rounded-full', itemDot(it, course))} />
                  <div className="min-w-0 flex-1">
                    <p className={cx('flex items-center gap-1.5 text-sm font-medium', it.done && 'line-through')}>
                      <Icon size={14} className="shrink-0 text-muted" />
                      <span className="truncate">{it.title}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                      {course && <CourseChip course={course} />}
                      <span className="text-xs text-muted">{KIND_META[it.kind].label}</span>
                      {it.location && (
                        <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted">
                          <MapPin size={12} className="shrink-0" />
                          <span className="truncate">{it.location}</span>
                        </span>
                      )}
                      {isImported(it) && it.source && <Badge tone="accent">{SOURCE_LABEL[it.source]}</Badge>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
