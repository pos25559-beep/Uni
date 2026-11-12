import { CalendarDays, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
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
  const allClasses = useStore((s) => s.classes);
  const remove = useStore((s) => s.remove);
  const [adding, setAdding] = useState(false);

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
          <Plus size={14} /> Nova aula
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={28} />}
          title="Sem aulas no horário"
          hint="Acrescenta as aulas teóricas, práticas e tutoriais para as veres no calendário semanal."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map(({ day, slots }) => (
            <Card key={day} title={weekdayLong[day]} padded>
              <ul className="space-y-2">
                {slots.map((slot) => (
                  <SlotRow key={slot.id} slot={slot} onDelete={() => remove('classes', slot.id)} />
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {adding && <ClassFormModal course={course} onClose={() => setAdding(false)} />}
    </div>
  );
}

function SlotRow({ slot, onDelete }: { slot: ClassSlot; onDelete: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
      <Badge tone="accent">{slot.type}</Badge>
      <span className="text-sm font-medium tabular">{slot.start}–{slot.end}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted">{slot.room ?? 'Sem sala'}</span>
      <DeleteButton message="Apagar esta aula do horário?" onConfirm={onDelete} />
    </li>
  );
}
