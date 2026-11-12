// Grelha mensal (6 semanas, Seg–Dom). Em ecrãs pequenos mostra apenas pontos coloridos.
import { format, isSameMonth } from 'date-fns';
import { pt } from 'date-fns/locale';
import { weekdayShort } from '../../lib/colors';
import type { Course } from '../../types';
import { cx } from '../ui';
import type { CalItem } from './items';
import { KIND_META, itemDot, itemTone } from './shared';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface Props {
  days: Date[];
  anchor: Date;
  byDay: Map<string, CalItem[]>;
  courseById: Map<string, Course>;
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}

export default function MonthView({ days, anchor, byDay, courseById, selected, today, onSelect }: Props) {
  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-muted">
        {WEEK_ORDER.map((i) => (
          <div key={i} className="py-1.5">{weekdayShort[i]}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-line bg-line">
        {days.map((day) => {
          const ds = format(day, 'yyyy-MM-dd');
          const list = byDay.get(ds) ?? [];
          const inMonth = isSameMonth(day, anchor);
          const isToday = ds === today;
          const isSel = ds === selected;
          const pills = list.slice(0, 3);
          const more = list.length - pills.length;
          return (
            <button
              key={ds}
              type="button"
              onClick={() => onSelect(ds)}
              aria-pressed={isSel}
              aria-label={`${format(day, 'd MMMM', { locale: pt })}, ${list.length} itens`}
              className={cx(
                'flex min-h-14 min-w-0 flex-col gap-1 p-1 text-left transition hover:bg-surface-2 sm:min-h-28 sm:p-1.5',
                isSel ? 'bg-accent-soft' : 'bg-surface',
                !inMonth && 'opacity-40',
              )}
            >
              <span
                className={cx(
                  'grid size-6 shrink-0 place-items-center self-center rounded-full text-xs tabular sm:self-start',
                  isToday ? 'bg-accent font-semibold text-accent-fg' : 'text-fg',
                )}
              >
                {format(day, 'd')}
              </span>

              {list.length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                  {list.slice(0, 4).map((it) => (
                    <span key={it.id} className={cx('size-1.5 rounded-full', itemDot(it, it.courseId ? courseById.get(it.courseId) : undefined))} />
                  ))}
                </div>
              )}

              <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {pills.map((it) => {
                  const course = it.courseId ? courseById.get(it.courseId) : undefined;
                  const Icon = KIND_META[it.kind].icon;
                  return (
                    <span
                      key={it.id}
                      className={cx(
                        'flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] leading-tight',
                        itemTone(it, course),
                        it.done && 'opacity-50',
                      )}
                    >
                      {it.kind === 'avaliacao' && <Icon size={10} className="shrink-0" />}
                      <span className="truncate">{it.title}</span>
                    </span>
                  );
                })}
                {more > 0 && <span className="px-1 text-[11px] text-muted">+{more}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
