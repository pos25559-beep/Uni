import { CalendarDays, CheckSquare, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { newId, useStore } from '../../store/useStore';
import type { Course, Task } from '../../types';
import { Badge, Button, cx, EmptyState, Input } from '../ui';
import { DeleteButton } from './ConfirmModal';
import { dueLabel, fmtShortDate } from './helpers';

interface Props {
  course: Course;
}

const priorityLabel: Record<Task['priority'], string> = { 1: 'Alta', 2: 'Média', 3: 'Baixa' };
const priorityTone: Record<Task['priority'], 'danger' | 'warn' | 'neutral'> = { 1: 'danger', 2: 'warn', 3: 'neutral' };

export default function TasksTab({ course }: Props) {
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
        <Input aria-label="Nova tarefa" placeholder="Nova tarefa…" value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1" />
        <Input aria-label="Data de entrega" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="sm:w-44" />
        <Button type="submit" variant="primary" disabled={!title.trim()}>
          <Plus size={16} /> Adicionar
        </Button>
      </form>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare size={28} />}
          title="Sem tarefas"
          hint="Regista trabalhos e tarefas desta cadeira com data de entrega para não te esqueceres."
        />
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
              <input
                type="checkbox"
                aria-label={`Concluir ${t.title}`}
                checked={t.done}
                onChange={() => patch('tasks', t.id, { done: !t.done })}
                className="size-4 shrink-0 accent-[var(--accent)]"
              />
              <div className="min-w-0 flex-1">
                <p className={cx('truncate text-sm font-medium', t.done && 'text-muted line-through')}>{t.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {t.due && (
                    <span className="inline-flex items-center gap-1 tabular">
                      <CalendarDays size={12} /> {fmtShortDate(t.due)} · {dueLabel(t.due)}
                    </span>
                  )}
                </div>
              </div>
              <Badge tone={priorityTone[t.priority]}>{priorityLabel[t.priority]}</Badge>
              <DeleteButton message={`Apagar a tarefa "${t.title}"?`} onConfirm={() => remove('tasks', t.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
