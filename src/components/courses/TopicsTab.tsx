import { BookOpen, CheckCircle2, Plus } from 'lucide-react';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { statusLabel } from '../../lib/colors';
import { todayStr } from '../../lib/selectors';
import { computeNextSrsState } from '../../lib/spacedRepetition';
import { newId, useStore } from '../../store/useStore';
import type { Course, Topic, TopicStatus } from '../../types';
import { Button, cx, EmptyState, Input, Select } from '../ui';
import { DeleteButton } from './ConfirmModal';
import { lastStudiedLabel, topicStatuses } from './helpers';

interface Props {
  course: Course;
}

export default function TopicsTab({ course }: Props) {
  const updateTopic = useStore((s) => s.updateTopic);
  const patch = useStore((s) => s.patch);
  const [draft, setDraft] = useState('');

  const topics = course.topics;

  const addTopic = () => {
    const title = draft.trim();
    if (!title) return;
    const topic: Topic = { id: newId(), title, status: 'todo', confidence: 1 };
    patch('courses', course.id, { topics: [...topics, topic] });
    setDraft('');
  };

  const removeTopic = (topicId: string) =>
    patch('courses', course.id, { topics: topics.filter((t) => t.id !== topicId) });

  const onAddKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') { e.preventDefault(); addTopic(); }
  };

  return (
    <div className="space-y-4">
      {topics.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={28} />}
          title="Ainda não há matéria"
          hint="Acrescenta os tópicos da cadeira para acompanhar o progresso e a confiança em cada um."
        />
      ) : (
        <ul className="space-y-2">
          {topics.map((t) => (
            <li key={t.id} className="rounded-xl border border-line bg-surface-2/50 p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <input
                  aria-label="Título do tópico"
                  defaultValue={t.title}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (!v) { e.target.value = t.title; return; }
                    if (v !== t.title) updateTopic(course.id, t.id, { title: v });
                  }}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-0.5 text-sm font-medium text-fg hover:bg-surface focus:bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Select
                    aria-label="Estado"
                    className="h-8 w-auto min-w-36 text-xs"
                    value={t.status}
                    onChange={(e) => {
                      const status = e.target.value as TopicStatus;
                      updateTopic(course.id, t.id, { status });
                    }}
                  >
                    {topicStatuses.map((s) => (
                      <option key={s} value={s}>{statusLabel[s]}</option>
                    ))}
                  </Select>

                  <div className="flex items-center gap-1" role="group" aria-label="Confiança">
                    {([1, 2, 3, 4, 5] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-label={`Confiança ${n} de 5`}
                        aria-pressed={t.confidence >= n}
                        onClick={() => updateTopic(course.id, t.id, { confidence: n })}
                        className={cx(
                          'size-3.5 rounded-full border transition hover:scale-110',
                          t.confidence >= n ? 'border-accent bg-accent' : 'border-line bg-surface',
                        )}
                      />
                    ))}
                  </div>

                  <span className="w-32 text-xs text-muted tabular">
                    {lastStudiedLabel(t.lastStudied)}
                    {t.nextReviewDate ? ` · rev ${t.nextReviewDate.slice(5)}` : ''}
                  </span>

                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      size="sm"
                      onClick={() => {
                        const srs = computeNextSrsState(
                          t,
                          t.confidence >= 4 ? 3 : 2,
                          t.confidence,
                          todayStr(),
                        );
                        updateTopic(course.id, t.id, {
                          ...srs,
                          status: t.status === 'todo' ? 'learning' : srs.status,
                        });
                      }}
                    >
                      <CheckCircle2 size={14} /> Estudei hoje
                    </Button>
                    <DeleteButton
                      message={`Apagar o tópico "${t.title}"?`}
                      onConfirm={() => removeTopic(t.id)}
                    />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          aria-label="Novo tópico"
          placeholder="Novo tópico… (Enter para adicionar)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onAddKey}
        />
        <Button onClick={addTopic} disabled={!draft.trim()}>
          <Plus size={16} /> Adicionar
        </Button>
      </div>
    </div>
  );
}
