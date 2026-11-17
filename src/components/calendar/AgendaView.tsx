// Agenda: lista dos próximos 30 dias agrupada por dia (dias vazios são omitidos).
import { format, parseISO } from 'date-fns';
import { appDateLocale as pt, longDatePattern } from '../../lib/dateLocale';
import { MapPin, Pencil, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Course } from '../../types';
import { Badge, CourseChip, EmptyState } from '../ui';
import { cx } from '../../lib/uiHelpers';
import { capitalizeFirst } from '../../lib/selectors';
import type { CalItem } from './items';
import { KIND_META, SOURCE_LABEL, isImported, itemDot, timeLabel } from './shared';

interface Props {
  items: CalItem[];
  courseById: Map<string, Course>;
  today: string;
  onEditClass?: (item: CalItem) => void;
  onDeleteClass?: (item: CalItem) => void;
}

export default function AgendaView({ items, courseById, today, onEditClass, onDeleteClass }: Props) {
  const { t } = useTranslation('plan');
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
        title={t('cal.agendaEmpty')}
        hint={t('cal.agendaEmptyHint')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(({ date, list }) => (
        <section key={date} className="rise">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            {capitalizeFirst(format(parseISO(date), longDatePattern(), { locale: pt }))}
            {date === today && <Badge tone="accent">{t('calendar.today')}</Badge>}
          </h3>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {list.map((it) => {
              const course = it.courseId ? courseById.get(it.courseId) : undefined;
              const Icon = KIND_META[it.kind].icon;
              return (
                <li key={it.id} className={cx('flex gap-3 p-3.5', it.done && 'bg-surface-2/45')}>
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
                  {it.kind === 'aula' && (onEditClass || onDeleteClass) && (
                    <div className="flex shrink-0 items-center gap-1 self-center">
                      {onEditClass && (
                        <button
                          type="button"
                          onClick={() => onEditClass(it)}
                          aria-label={t('cal.editClassAria', { title: it.title })}
                          title={t('cal.editClassHint')}
                          className="grid size-11 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                      {onDeleteClass && (
                        <button
                          type="button"
                          onClick={() => onDeleteClass(it)}
                          aria-label={t('cal.deleteClassAria', { title: it.title })}
                          title={t('cal.deleteClass')}
                          className="grid size-11 place-items-center rounded-lg text-muted transition hover:bg-danger/12 hover:text-danger"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
