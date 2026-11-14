// Painel do dia selecionado: lista completa com ações (apagar eventos locais, concluir sessões, abrir avaliações).
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarPlus, ChevronRight, Check, MapPin, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import type { ClassSlot, Course } from '../../types';
import { Badge, Button, Card, CourseChip, EmptyState, cx } from '../ui';
import { capitalizeFirst } from '../../lib/selectors';
import ClassFormModal from '../courses/ClassFormModal';
import { ConfirmModal } from '../courses/ConfirmModal';
import type { CalItem } from './items';
import { KIND_META, SOURCE_LABEL, isImported, itemTone, timeLabel } from './shared';

interface Props {
  date: string;
  items: CalItem[];
  courseById: Map<string, Course>;
  onNewEvent: () => void;
}

export default function DayPanel({ date, items, courseById, onNewEvent }: Props) {
  const classes = useStore((s) => s.classes);
  const remove = useStore((s) => s.remove);
  const patch = useStore((s) => s.patch);
  const heading = format(parseISO(date), "EEEE, d 'de' MMMM", { locale: pt });
  const [toDelete, setToDelete] = useState<{ storeKey: 'events' | 'classes'; refId: string; title: string } | null>(null);
  const [editingClass, setEditingClass] = useState<{ slot: ClassSlot; course: Course } | null>(null);

  return (
    <>
    <Card
      className="lg:sticky lg:top-4"
      title={capitalizeFirst(heading)}
      action={items.length > 0 ? <Badge>{items.length}</Badge> : undefined}
    >
      {items.length === 0 ? (
        <EmptyState
          title="Nada neste dia"
          hint="Seleciona outro dia ou cria um evento ou avaliação."
          action={
            <Button size="sm" onClick={onNewEvent}>
              <CalendarPlus size={14} /> Novo evento
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const course = it.courseId ? courseById.get(it.courseId) : undefined;
            const Icon = KIND_META[it.kind].icon;
            const localEvent = it.kind === 'evento' && it.source === 'local';
            const classSlot =
              it.kind === 'aula' ? classes.find((c) => c.id === it.refId) : undefined;
            return (
              <li
                key={it.id}
                className={cx('flex items-start gap-3 rounded-xl border border-line bg-surface-2/40 p-3', it.done && 'opacity-60')}
              >
                <span className={cx('grid size-8 shrink-0 place-items-center rounded-lg', itemTone(it, course))}>
                  <Icon size={15} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[11px] tabular text-muted">{timeLabel(it)} · {KIND_META[it.kind].label}</p>
                  <p className={cx('truncate text-sm font-medium', it.done && 'line-through')}>{it.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {course && <CourseChip course={course} />}
                    {it.location && (
                      <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted">
                        <MapPin size={12} className="shrink-0" />
                        <span className="truncate">{it.location}</span>
                      </span>
                    )}
                    {isImported(it) && it.source && <Badge tone="accent">{SOURCE_LABEL[it.source]}</Badge>}
                  </div>
                </div>

                {localEvent && (
                  <button
                    type="button"
                    aria-label="Apagar evento"
                    title="Apagar evento"
                    onClick={() =>
                      setToDelete({ storeKey: 'events', refId: it.refId, title: it.title })
                    }
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-danger/12 hover:text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                )}

                {classSlot && course && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Editar aula ${it.title}`}
                      title="Alterar dia ou hora da aula"
                      onClick={() => setEditingClass({ slot: classSlot, course })}
                      className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-fg"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Apagar aula ${it.title}`}
                      title="Apagar aula"
                      onClick={() =>
                        setToDelete({ storeKey: 'classes', refId: classSlot.id, title: it.title })
                      }
                      className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-danger/12 hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}

                {it.kind === 'estudo' && (
                  <button
                    type="button"
                    aria-label={it.done ? 'Desmarcar sessão' : 'Marcar sessão como concluída'}
                    title={it.done ? 'Desmarcar sessão' : 'Marcar como concluída'}
                    onClick={() =>
                      it.done
                        ? patch('sessions', it.refId, { done: false })
                        : patch('sessions', it.refId, { done: true, actualMinutes: it.minutes ?? 0 })
                    }
                    className={cx(
                      'grid size-8 shrink-0 place-items-center rounded-lg border transition',
                      it.done ? 'border-ok/40 bg-ok/12 text-ok' : 'border-line bg-surface text-muted hover:text-fg',
                    )}
                  >
                    <Check size={15} />
                  </button>
                )}

                {it.kind === 'avaliacao' && it.courseId && (
                  <Link
                    to={`/cadeiras/${it.courseId}`}
                    aria-label="Abrir cadeira"
                    title="Abrir cadeira"
                    className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-lg border border-line bg-surface px-2 text-xs font-medium text-fg transition hover:border-muted/50"
                  >
                    Abrir <ChevronRight size={14} />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
    {editingClass && (
      <ClassFormModal
        course={editingClass.course}
        initialSlot={editingClass.slot}
        onClose={() => setEditingClass(null)}
      />
    )}
    {toDelete && (
      <ConfirmModal
        title={toDelete.storeKey === 'classes' ? 'Apagar aula' : 'Apagar evento'}
        message={`Apagar "${toDelete.title}"? Esta ação não se pode desfazer.`}
        confirmLabel="Apagar"
        onConfirm={() => remove(toDelete.storeKey, toDelete.refId)}
        onClose={() => setToDelete(null)}
      />
    )}
    </>
  );
}
