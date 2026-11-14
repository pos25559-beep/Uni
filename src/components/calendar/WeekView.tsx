// Vista semanal: eixo horário 08:00–22:00, itens posicionados por hora e uma faixa para os dias inteiros.
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useEffect, useState } from 'react';
import { weekdayShort } from '../../lib/colors';
import type { Course } from '../../types';
import { cx } from '../ui';
import { toMinutes } from './items';
import type { CalItem } from './items';
import { itemTone, timeLabel } from './shared';

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

  return (
    <div className="overflow-x-auto">
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
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{weekdayShort[d.getDay()]}</span>
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
          <div className="pr-2 pt-2 text-right text-[11px] text-muted">Dia todo</div>
          {days.map((d) => {
            const ds = format(d, 'yyyy-MM-dd');
            const strip = (byDay.get(ds) ?? []).filter((it) => place(it) === null);
            return (
              <div key={ds} className="flex min-h-10 min-w-0 flex-col gap-0.5 border-l border-line p-0.5">
                {strip.slice(0, 3).map((it) => (
                  <span
                    key={it.id}
                    title={it.title}
                    className={cx('truncate rounded px-1 py-0.5 text-[11px] leading-tight', itemTone(it, it.courseId ? courseById.get(it.courseId) : undefined), it.done && 'opacity-50')}
                  >
                    {it.start ? `${it.start} ` : ''}{it.title}
                  </span>
                ))}
                {strip.length > 3 && <span className="px-1 text-[11px] text-muted">+{strip.length - 3}</span>}
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
                className="absolute right-2 -translate-y-1/2 text-[11px] tabular text-muted"
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
                    'absolute overflow-hidden rounded-lg px-1.5 py-1 text-left text-[11px] leading-tight transition',
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
                      {item.location && height > 48 && <div className="truncate text-[11px] opacity-75">{item.location}</div>}
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
  );
}
