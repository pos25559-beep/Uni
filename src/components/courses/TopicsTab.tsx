import { BookOpen, Brain, CheckCircle2, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { KeyboardEvent } from 'react';
import { statusLabel } from '../../lib/colors';
import { todayStr } from '../../lib/selectors';
import { computeNextSrsState, estimateTopicRetention } from '../../lib/spacedRepetition';
import { newId, useStore } from '../../store/useStore';
import type { Course, Topic, TopicStatus } from '../../types';
import ActiveReviewModal from '../practice/ActiveReviewModal';
import { Button, EmptyState, Input, Select } from '../ui';
import { cx, showToast } from '../../lib/uiHelpers';
import { DeleteButton } from './ConfirmModal';
import { lastStudiedLabel, topicStatuses } from './helpers';

interface Props {
  course: Course;
}

export default function TopicsTab({ course }: Props) {
  const { t: tc, i18n } = useTranslation('courses');
  const updateTopic = useStore((s) => s.updateTopic);
  const patch = useStore((s) => s.patch);
  const [draft, setDraft] = useState('');
  const [practiceTopicId, setPracticeTopicId] = useState<string | null>(null);
  const today = todayStr();

  const topics = course.topics;

  const addTopic = () => {
    const title = draft.trim();
    if (!title) return;
    const topic: Topic = { id: newId(), title, status: 'todo', confidence: 1 };
    patch('courses', course.id, { topics: [...topics, topic] });
    setDraft('');
    showToast(tc('toast.topicAdded', { title }), 'ok');
  };

  const removeTopic = (topicId: string, title: string) => {
    patch('courses', course.id, { topics: topics.filter((t) => t.id !== topicId) });
    showToast(tc('toast.topicDeleted', { title }), 'neutral');
  };

  const onAddKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') { e.preventDefault(); addTopic(); }
  };

  return (
    <div className="space-y-4">
      {topics.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={28} />}
          title={tc('topics.empty')}
          hint={tc('topics.emptyHint')}
        />
      ) : (
        <ul className="space-y-2">
          {topics.map((t) => {
            const ret = estimateTopicRetention(t, today);
            const retToneClass =
              ret.state === 'at_risk'
                ? 'bg-bad/12 text-bad border-bad/25'
                : ret.state === 'review_soon'
                  ? 'bg-warn/12 text-warn border-warn/25'
                  : 'bg-ok/12 text-ok border-ok/25';
            const retLabel =
              ret.state === 'at_risk'
                ? tc('topics.atRisk', { n: ret.retentionPct })
                : ret.state === 'review_soon'
                  ? tc('topics.review', { n: ret.retentionPct })
                  : tc('topics.retention', { n: ret.retentionPct });

            return (
              <li key={t.id} className="rounded-xl border border-line bg-surface-2/50 p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <input
                  aria-label={tc('topics.titleAria')}
                  defaultValue={t.title}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (!v) { e.target.value = t.title; return; }
                    if (v !== t.title) {
                      updateTopic(course.id, t.id, { title: v });
                      showToast(tc('toast.topicUpdated'), 'ok');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-0.5 text-sm font-medium text-fg hover:bg-surface focus:bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Select
                    aria-label={tc('topics.status')}
                    className="w-auto min-w-36 text-xs"
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

                  <div className="flex items-center" role="group" aria-label={tc('topics.confidence')}>
                    {([1, 2, 3, 4, 5] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-label={tc('topics.confN', { n })}
                        aria-pressed={t.confidence >= n}
                        onClick={() => updateTopic(course.id, t.id, { confidence: n })}
                        className="group grid size-11 -mx-1 place-items-center rounded-full"
                      >
                        <span
                          className={cx(
                            'size-4 rounded-full border transition group-hover:scale-110',
                            t.confidence >= n ? 'border-accent bg-accent' : 'border-line bg-surface',
                          )}
                        />
                      </button>
                    ))}
                  </div>

                  <span className="text-xs text-muted tabular">
                    {lastStudiedLabel(t.lastStudied, i18n.language)}
                    {t.nextReviewDate ? tc('topics.rev', { d: t.nextReviewDate.slice(5) }) : ''}
                  </span>

                  {(t.lastStudied || t.status !== 'todo') && (
                    <span
                      className={cx(
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium tabular',
                        retToneClass,
                      )}
                      title={
                        ret.due
                          ? tc('topics.due')
                          : tc('topics.stability', { n: ret.stabilityDays })
                      }
                    >
                      {retLabel}
                    </span>
                  )}

                  <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPracticeTopicId(t.id)}
                    >
                      <Brain size={14} /> {tc('topics.practice')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        const srs = computeNextSrsState(
                          t,
                          t.confidence >= 4 ? 3 : 2,
                          t.confidence,
                          today,
                        );
                        updateTopic(course.id, t.id, {
                          ...srs,
                          status: t.status === 'todo' ? 'learning' : srs.status,
                        });
                        showToast(tc('toast.topicStudied'), { tone: 'ok', effect: 'celebrate' });
                      }}
                    >
                      <CheckCircle2 size={14} /> {tc('topics.studied')}
                    </Button>
                    <DeleteButton
                      message={tc('topics.delete', { title: t.title })}
                      onConfirm={() => removeTopic(t.id, t.title)}
                    />
                  </div>
                </div>
              </div>
            </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          aria-label={tc('topics.newAria')}
          placeholder={tc('topics.newPh')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onAddKey}
        />
        <Button onClick={addTopic} disabled={!draft.trim()}>
          <Plus size={16} /> {tc('topics.add')}
        </Button>
      </div>

      <ActiveReviewModal
        open={practiceTopicId !== null}
        onClose={() => setPracticeTopicId(null)}
        courseId={course.id}
        initialTopicId={practiceTopicId ?? undefined}
      />
    </div>
  );
}
