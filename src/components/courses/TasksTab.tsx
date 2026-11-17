import { CalendarDays, CheckSquare, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { newId, useStore } from '../../store/useStore';
import type { Course, Task } from '../../types';
import { Badge, Button, DateField, EmptyState, Input } from '../ui';
import { cx } from '../../lib/uiHelpers';
import { DeleteButton } from './ConfirmModal';
import { dueLabel, fmtShortDate } from './helpers';

interface Props {
  course: Course;
}

const priorityTone: Record<Task['priority'], 'danger' | 'warn' | 'neutral'> = { 1: 'danger', 2: 'warn', 3: 'neutral' };

export default function TasksTab({ course }: Props) {
  const { t: tc, i18n } = useTranslation('courses');
  const allTasks = useStore((s) => s.tasks);
  const upsert = useStore((s) => s.upsert);
  const patch = useStore((s) => s.patch);
  const remove = useStore((s) => s.remove);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');

  // Por fazer primeiro, depois por data de entrega (sem data no fim).
  const tasks = useMemo(() => {
    const mine = allTasks.filter((t) => t.courseId === course.id);
    return [...mine].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (a.due ?? '9999').localeCompare(b.due ?? '9999');
    });
  }, [allTasks, course.id]);

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const item: Task = {
      id: newId(),
      courseId: course.id,
      title: title.trim(),
      due: due || undefined,
      done: false,
      priority: 2,
    };
    upsert('tasks', item);
    setTitle('');
    setDue('');
  };

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row" noValidate>
        <Input aria-label={tc('tasks.newAria')} placeholder={tc('tasks.newPh')} value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1" />
        <DateField aria-label={tc('tasks.dueAria')} clearable placeholder={tc('tasks.duePh')} value={due} onChange={setDue} className="sm:w-44" />
        <Button type="submit" variant="primary" disabled={!title.trim()}>
          <Plus size={16} /> {tc('tasks.add')}
        </Button>
      </form>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare size={28} />}
          title={tc('tasks.emptyTitle')}
          hint={tc('tasks.emptyHint')}
        />
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2 py-2 sm:px-3">
              <label className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg hover:bg-surface-2">
                <input
                  type="checkbox"
                  aria-label={tc('tasks.completeAria', { title: task.title })}
                  checked={task.done}
                  onChange={() => patch('tasks', task.id, { done: !task.done })}
                  className="size-4 accent-[var(--accent)]"
                />
              </label>
              <div className="min-w-0 flex-1">
                <p className={cx('truncate text-sm font-medium', task.done && 'text-muted line-through')}>{task.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {task.due && (
                    <span className="inline-flex items-center gap-1 tabular">
                      <CalendarDays size={12} /> {fmtShortDate(task.due, i18n.language)} · {dueLabel(task.due, i18n.language)}
                    </span>
                  )}
                </div>
              </div>
              <Badge tone={priorityTone[task.priority]}>{tc(`tasks.priority.${task.priority}`)}</Badge>
              <DeleteButton message={tc('tasks.deleteConfirm', { title: task.title })} onConfirm={() => remove('tasks', task.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
