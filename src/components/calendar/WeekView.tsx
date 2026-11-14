// Vista semanal: eixo horário 08:00–22:00, itens posicionados por hora e uma faixa para os dias inteiros.
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Clock, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { weekdayLong, weekdayShort } from '../../lib/colors';
import type { Course } from '../../types';
import { CourseChip, cx } from '../ui';
import { toMinutes } from './items';
import type { CalItem } from './items';
import { KIND_META, itemDot, itemTone, timeLabel } from './shared';

const DAY_START = 8 * 60;
const DAY_END = 22 * 60;
const HOUR_H = 56;
const GRID_H = ((DAY_END - DAY_START) / 60) * HOUR_H;
const HOURS = Array.from({ length: 15 }, (_, i) => 8 + i);
const COLS = '3rem repeat(7, minmax(0, 1fr))';

interface Placed {
  item: CalItem;
  top: number;
  height: number;
  lane: number;
}

/** Posição vertical de um item com hora de início dentro do horário. null = vai para a faixa. */
function place(item: CalItem): { top: number; height: number } | null {
  if (!item.start) return null;
  const s = toMinutes(item.start);
  if (s < DAY_START || s >= DAY_END) return null;
  const e = item.end ? Math.min(toMinutes(item.end), DAY_END) : Math.min(s + 60, DAY_END);
  const dur = Math.max(e - s, 30);
  return { top: ((s - DAY_START) / 60) * HOUR_H, height: Math.max((dur / 60) * HOUR_H, 24) };
}

/** Atribui faixas (colunas) a itens que se sobrepõem. */
function lanesOf(items: { item: CalItem; top: number; height: number }[]): { placed: Placed[]; lanes: number } {
  const sorted = [...items].sort((a, b) => a.top - b.top || b.height - a.height);
  const ends: number[] = [];
  const placed = sorted.map((p) => {
    let lane = ends.findIndex((end) => end <= p.top);
    if (lane === -1) { lane = ends.length; ends.push(p.top + p.height); } else { ends[lane] = p.top + p.height; }
    return { ...p, lane };
  });
  return { placed, lanes: Math.max(1, ends.length) };
}

interface Props {
  days: Date[];
  byDay: Map<string, CalItem[]>;
  courseById: Map<string, Course>;
  today: string;
  selected: string;
  onSelect: (date: string) => void;
  onEditClass?: (item: CalItem) => void;
}

export default function WeekView({ days, byDay, courseById, today, selected, onSelect, onEditClass }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = nowMin >= DAY_START && nowMin < DAY_END ? ((nowMin - DAY_START) / 60) * HOUR_H : null;

  const dayKeys = days.map((d) => format(d, 'yyyy-MM-dd'));
  const activeMobileDs = dayKeys.includes(selected)
    ? selected
    : dayKeys.includes(today)
      ? today
      : (dayKeys[0] ?? selected);
  const activeMobileDate = days.find((d) => format(d, 'yyyy-MM-dd') === activeMobileDs) ?? days[0];
  const mobileDayItems = [...(byDay.get(activeMobileDs) ?? [])].sort((a, b) =>
    (a.start ?? '99:99').localeCompare(b.start ?? '99:99'),
  );
  const mobileAllDay = mobileDayItems.filter((it) => !it.start);
  const mobileTimed = mobileDayItems.filter((it) => Boolean(it.start));

  return (
    <div className="min-w-0">
      {/* Vista Móvel (< md): seletor 7 dias + lista horária legível sem corte horizontal */}
      <div className="space-y-3 md:hidden">
        <div className="grid grid-cols-7 gap-1 rounded-2xl border border-line bg-surface-2/50 p-1">
          {days.map((d) => {
            const ds = format(d, 'yyyy-MM-dd');
            const isToday = ds === today;
            const isSel = ds === activeMobileDs;
            const count = (byDay.get(ds) ?? []).length;
            return (
              <button
                key={ds}
                type="button"
                onClick={() => onSelect(ds)}
                aria-pressed={isSel}
                className={cx(
                  'flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-1.5 transition',
                  isSel
                    ? 'bg-ink-cta text-ink-cta-fg shadow-card'
                    : isToday
                      ? 'bg-accent-soft text-accent-ink'
                      : 'text-fg hover:bg-surface',
                )}
              >
                <span className={cx('text-xs font-medium uppercase leading-none', isSel ? 'opacity-80' : 'text-muted')}>
                  {weekdayShort[d.getDay()].slice(0, 3)}
                </span>
                <span className="font-mono text-sm font-bold leading-none tabular">
                  {format(d, 'd', { locale: pt })}
                </span>
                <span
                  className={cx(
                    'size-1.5 rounded-full',
                    count > 0
                      ? isSel
                        ? 'bg-accent'
                        : 'bg-accent'
                      : 'bg-transparent',
                  )}
                />
              </button>
            );
          })}
        </div>

        {activeMobileDate && (
          <div className="flex items-center justify-between px-1 text-xs font-semibold text-muted">
            <span className="capitalize">
              {weekdayLong[activeMobileDate.getDay()]} · {format(activeMobileDate, "d 'de' MMMM", { locale: pt })}
            </span>
            <span className="font-mono tabular">
              {mobileDayItems.length} {mobileDayItems.length === 1 ? 'item' : 'itens'}
            </span>
          </div>
        )}

        {mobileAllDay.length > 0 && (
          <div className="flex flex-wrap gap-1.5 rounded-2xl border border-line bg-surface-2/40 p-2.5">
            {mobileAllDay.map((it) => {
              const course = it.courseId ? courseById.get(it.courseId) : undefined;
              return (
                <span
                  key={it.id}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium',
                    itemTone(it, course),
                    it.done && 'opacity-50',
                  )}
                >
                  <span className={cx('size-1.5 rounded-full', itemDot(it, course))} />
                  {it.title}
                </span>
              );
            })}
          </div>
        )}

        {mobileTimed.length === 0 && mobileAllDay.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface-2/30 px-4 py-8 text-center text-xs text-muted">
            Sem aulas ou eventos marcados neste dia.
          </div>
        ) : (
          <div className="space-y-2">
            {mobileTimed.map((it) => {
              const course = it.courseId ? courseById.get(it.courseId) : undefined;
              const Icon = KIND_META[it.kind].icon;
              const isEditableClass = it.kind === 'aula' && Boolean(onEditClass);
              const content = (
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex w-16 shrink-0 flex-col pt-0.5 font-mono text-xs font-semibold tabular">
                    <span>{it.start}</span>
                    {it.end && <span className="text-xs font-normal opacity-75">{it.end}</span>}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Icon size={13} className="shrink-0 opacity-80" />
                      <p className="truncate text-sm font-semibold leading-snug">{it.title}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {course && <CourseChip course={course} />}
                      {it.location && (
                        <span className="inline-flex items-center gap-1 text-xs opacity-80">
                          <MapPin size={11} className="shrink-0" />
                          {it.location}
                        </span>
                      )}
                      {!course && (
                        <span className="inline-flex items-center gap-1 text-xs opacity-75">
                          <Clock size={11} />
                          {KIND_META[it.kind].label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );

              return isEditableClass ? (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => onEditClass?.(it)}
                  className={cx(
                    'w-full rounded-2xl p-3 text-left transition active:scale-[0.99]',
                    itemTone(it, course),
                    it.done && 'opacity-50',
                  )}
                >
                  {content}
                </button>
              ) : (
                <div
                  key={it.id}
                  className={cx(
                    'rounded-2xl p-3',
                    itemTone(it, course),
                    it.done && 'opacity-50',
                  )}
                >
                  {content}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Vista Desktop (md+): grelha completa Seg–Dom */}
      <div className="hidden overflow-x-auto md:block">
        <div className="min-w-[640px]">
          {/* Cabeçalho dos dias */}
          <div className="grid border-b border-line" style={{ gridTemplateColumns: COLS }}>
            <div />
            {days.map((d) => {
              const ds = format(d, 'yyyy-MM-dd');
              const isToday = ds === today;
              return (
                <button
                  key={ds}
                  type="button"
                  onClick={() => onSelect(ds)}
                  aria-pressed={selected === ds}
                  className={cx('flex flex-col items-center gap-0.5 py-2 transition hover:bg-surface-2', selected === ds && 'bg-accent-soft')}
                >
                  <span className="text-xs font-medium uppercase tracking-wide text-muted">{weekdayShort[d.getDay()]}</span>
                  <span
                    className={cx(
                      'grid size-7 place-items-center rounded-full text-sm tabular',
                      isToday ? 'bg-accent font-semibold text-accent-fg' : 'text-fg',
                    )}
                  >
                    {format(d, 'd', { locale: pt })}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Faixa de dias inteiros / fora do horário */}
          <div className="grid border-b border-line" style={{ gridTemplateColumns: COLS }}>
            <div className="py-2 pr-2 text-right text-xs text-muted">Dia todo</div>
            {days.map((d) => {
              const ds = format(d, 'yyyy-MM-dd');
              const strip = (byDay.get(ds) ?? []).filter((it) => place(it) === null);
              return (
                <div key={ds} className="flex min-h-10 min-w-0 flex-col gap-0.5 border-l border-line p-0.5">
                  {strip.slice(0, 3).map((it) => (
                    <span
                      key={it.id}
                      title={it.title}
                      className={cx('truncate rounded px-1 py-0.5 text-xs leading-tight', itemTone(it, it.courseId ? courseById.get(it.courseId) : undefined), it.done && 'opacity-50')}
                    >
                      {it.start ? `${it.start} ` : ''}{it.title}
                    </span>
                  ))}
                  {strip.length > 3 && <span className="px-1 text-xs text-muted">+{strip.length - 3}</span>}
                </div>
              );
            })}
          </div>

          {/* Grelha horária */}
          <div className="grid" style={{ gridTemplateColumns: COLS }}>
            <div className="relative" style={{ height: GRID_H }}>
              {HOURS.map((h) => (
                <div
                  key={h}
                  className={cx(
                    'absolute right-2 text-xs tabular text-muted',
                    h === 8 ? 'translate-y-0.5' : '-translate-y-1/2',
                  )}
                  style={{ top: (h - 8) * HOUR_H }}
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {days.map((d) => {
              const ds = format(d, 'yyyy-MM-dd');
              const timed = (byDay.get(ds) ?? []).flatMap((item) => {
                const p = place(item);
                return p ? [{ item, ...p }] : [];
              });
              const { placed, lanes } = lanesOf(timed);
              const isToday = ds === today;
              return (
                <div key={ds} className="relative min-w-0 border-l border-line" style={{ height: GRID_H }}>
                  {HOURS.map((h) => (
                    <div key={h} className="absolute inset-x-0 border-t border-line" style={{ top: (h - 8) * HOUR_H }} />
                  ))}

                  {placed.map(({ item, top, height, lane }) => {
                    const course = item.courseId ? courseById.get(item.courseId) : undefined;
                    const width = 100 / lanes;
                    const isEditableClass = item.kind === 'aula' && Boolean(onEditClass);
                    const cls = cx(
                      'absolute overflow-hidden rounded-lg px-1.5 py-1 text-left text-xs leading-tight transition',
                      itemTone(item, course),
                      item.done && 'opacity-50',
                      isEditableClass && 'cursor-pointer hover:ring-2 hover:ring-accent/60',
                    );
                    const style = {
                      top,
                      height,
                      left: `calc(${lane * width}% + 2px)`,
                      width: `calc(${width}% - 4px)`,
                    };
                    const inner = (
                      <>
                        <div className="truncate font-medium tabular">{item.start}{item.end ? `–${item.end}` : ''}</div>
                        <div className="truncate">{item.title}</div>
                        {item.location && height > 48 && <div className="truncate text-xs opacity-75">{item.location}</div>}
                      </>
                    );
                    return isEditableClass ? (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onEditClass?.(item)}
                        title={`${timeLabel(item)} · ${item.title} (Clica para alterar dia/hora)`}
                        className={cls}
                        style={style}
                      >
                        {inner}
                      </button>
                    ) : (
                      <div
                        key={item.id}
                        title={`${timeLabel(item)} · ${item.title}`}
                        className={cls}
                        style={style}
                      >
                        {inner}
                      </div>
                    );
                  })}

                  {isToday && nowTop !== null && (
                    <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: nowTop }}>
                      <span className="-ml-1 size-2 shrink-0 rounded-full bg-danger" />
                      <span className="h-px flex-1 bg-danger" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
