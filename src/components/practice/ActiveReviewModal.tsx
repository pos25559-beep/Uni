import { ArrowRight, BookCheck, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { courseColors } from '../../lib/colors';
import { todayStr } from '../../lib/selectors';
import { getDueReviewQueue, type DueReviewItem } from '../../lib/spacedRepetition';
import { cx } from '../../lib/uiHelpers';
import { useStore } from '../../store/useStore';
import { Button, EmptyState, Modal } from '../ui';
import ActivePracticeDeck from './ActivePracticeDeck';

interface ActiveReviewModalProps {
  open: boolean;
  onClose: () => void;
  /** Foca apenas numa cadeira ou num tópico específico quando iniciado a partir da ficha da cadeira. */
  courseId?: string;
  initialTopicId?: string;
}

export default function ActiveReviewModal({
  open,
  onClose,
  courseId,
  initialTopicId,
}: ActiveReviewModalProps) {
  const { t } = useTranslation('courses');
  const courses = useStore((s) => s.courses);
  const today = todayStr();

  const queue = useMemo<DueReviewItem[]>(() => {
    const due = getDueReviewQueue(courses, today, courseId);
    if (!initialTopicId) return due;

    const matchCourse = courseId ? courses.find((c) => c.id === courseId) : undefined;
    const explicitTopic = matchCourse?.topics.find((t) => t.id === initialTopicId);
    if (!matchCourse || !explicitTopic) return due;

    const alreadyInDue = due.some((item) => item.topic.id === initialTopicId);
    if (alreadyInDue) {
      const target = due.find((item) => item.topic.id === initialTopicId)!;
      return [target, ...due.filter((item) => item.topic.id !== initialTopicId)];
    }
    return [
      {
        course: matchCourse,
        topic: explicitTopic,
        retention: {
          retentionPct: 50,
          state: 'review_soon',
          daysSinceStudy: null,
          stabilityDays: explicitTopic.srsIntervalDays ?? 1,
          hitRatePct: null,
          due: false,
        },
      },
      ...due,
    ];
  }, [courses, courseId, initialTopicId, today]);

  // Congela a lista de IDs da sessão ao abrir para não saltar enquanto os tópicos são atualizados.
  const [sessionRefs, setSessionRefs] = useState<Array<{ courseId: string; topicId: string }>>([]);
  const [idx, setIdx] = useState(0);
  const [justCompletedCurrent, setJustCompletedCurrent] = useState(false);

  useEffect(() => {
    if (!open) {
      setSessionRefs([]);
      setIdx(0);
      setJustCompletedCurrent(false);
      return;
    }
    setSessionRefs(queue.map((q) => ({ courseId: q.course.id, topicId: q.topic.id })));
    setIdx(0);
    setJustCompletedCurrent(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, courseId, initialTopicId]);

  const currentRef = sessionRefs[idx];
  const currentCourse = currentRef
    ? courses.find((c) => c.id === currentRef.courseId)
    : undefined;
  const currentTopic =
    currentCourse && currentRef
      ? currentCourse.topics.find((t) => t.id === currentRef.topicId)
      : undefined;

  const hasNext = idx + 1 < sessionRefs.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('practiceModal.title')}
      maxWidthClass="max-w-xl"
    >
      {sessionRefs.length > 0 && (
        <p className="mb-3 text-xs text-muted">
          {t('practiceModal.progress', { current: Math.min(idx + 1, sessionRefs.length), total: sessionRefs.length })}
        </p>
      )}
      {!currentCourse || !currentTopic ? (
        <EmptyState
          icon={<BookCheck size={28} />}
          title={t('practiceModal.emptyTitle')}
          hint={t('practiceModal.emptyHint')}
          action={
            <Button variant="primary" onClick={onClose}>
              {t('practiceModal.back')}
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={cx(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                courseColors[currentCourse.color].soft,
              )}
            >
              <span className={cx('size-1.5 rounded-full', courseColors[currentCourse.color].dot)} />
              {currentCourse.shortName}
            </span>

            {sessionRefs.length > 1 && (
              <div className="flex items-center">
                {sessionRefs.map((ref, i) => (
                  <button
                    key={ref.topicId}
                    type="button"
                    onClick={() => {
                      setIdx(i);
                      setJustCompletedCurrent(false);
                    }}
                    aria-label={t('practiceModal.gotoTopic', { n: i + 1 })}
                    className="grid min-h-11 min-w-11 place-items-center rounded-full hover:bg-surface-2"
                  >
                    <span
                      className={cx(
                        'block h-2.5 rounded-full transition-all',
                        i === idx ? 'w-6 bg-accent' : 'w-2.5 bg-line hover:bg-muted',
                      )}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <ActivePracticeDeck
            course={currentCourse}
            topic={currentTopic}
            autoPrepare
            onOutcome={() => setJustCompletedCurrent(true)}
          />

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t('practiceModal.close')}
            </Button>
            {hasNext ? (
              <Button
                variant={justCompletedCurrent ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => {
                  setIdx((i) => i + 1);
                  setJustCompletedCurrent(false);
                }}
              >
                {t('practiceModal.nextTopic')} <ArrowRight size={14} />
              </Button>
            ) : justCompletedCurrent ? (
              <Button variant="primary" size="sm" onClick={onClose}>
                <Sparkles size={14} /> {t('practiceModal.finish')}
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </Modal>
  );
}
