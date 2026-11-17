import { CalendarDays, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { weekdayLong } from '../../lib/colors';
import { useStore } from '../../store/useStore';
import type { ClassSlot, Course } from '../../types';
import { Badge, Button, Card, EmptyState } from '../ui';
import ClassFormModal from './ClassFormModal';
import { DeleteButton } from './ConfirmModal';
import { sortSlots, weekOrder } from './helpers';

interface Props {
  course: Course;
}

export default function ScheduleTab({ course }: Props) {
  const { t } = useTranslation('courses');
  const allClasses = useStore((s) => s.classes);
  const remove = useStore((s) => s.remove);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ClassSlot | null>(null);

  // Agrupa as aulas por dia da semana (segunda a domingo), só dias com aulas.
  const groups = useMemo(() => {
    const mine = allClasses.filter((c) => c.courseId === course.id);
    return weekOrder
      .map((day) => ({ day, slots: sortSlots(mine.filter((c) => c.weekday === day)) }))
      .filter((g) => g.slots.length > 0);
  }, [allClasses, course.id]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
          <Plus size={14} /> {t('schedule.newClass')}
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={28} />}
          title={t('schedule.emptyTitle')}
          hint={t('schedule.emptyHint')}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map(({ day, slots }) => (
            <Card key={day} title={weekdayLong[day]} padded>
              <ul className="space-y-2">
                {slots.map((slot) => (
                  <SlotRow
                    key={slot.id}
                    slot={slot}
                    onEdit={() => setEditing(slot)}
                    onDelete={() => remove('classes', slot.id)}
                  />
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {(adding || editing) && (
        <ClassFormModal
          course={course}
          initialSlot={editing ?? undefined}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function SlotRow({
  slot,
  onEdit,
  onDelete,
}: {
  slot: ClassSlot;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation('courses');
  return (
    <li className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2">
      <Badge tone="accent">{slot.type}</Badge>
      <span className="text-sm font-medium tabular">{slot.start}–{slot.end}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted">{slot.room ?? t('schedule.noRoom')}</span>
      <button
        type="button"
        onClick={onEdit}
        aria-label={t('schedule.editAria')}
        title={t('schedule.editAria')}
        className="grid size-11 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-fg"
      >
        <Pencil size={15} />
      </button>
      <DeleteButton message={t('schedule.deleteConfirm')} onConfirm={onDelete} />
    </li>
  );
}
