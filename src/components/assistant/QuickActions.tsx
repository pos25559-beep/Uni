import { BrainCircuit, CalendarRange, Lightbulb, ListChecks, Target, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { useStore } from '../../store/useStore';
import { Button, Select } from '../ui';
import { cx } from '../../lib/uiHelpers';

interface Props {
  disabled?: boolean;
  activeCourseId?: string;
  variant?: 'inline' | 'mobile-sheet';
  onSend: (prompt: string) => void;
  onAfterSend?: () => void;
}

const simple: { id: 'today' | 'week' | 'plan' | 'weak'; icon: ReactNode }[] = [
  { id: 'today', icon: <Target size={15} /> },
  { id: 'week', icon: <ListChecks size={15} /> },
  { id: 'plan', icon: <CalendarRange size={15} /> },
  { id: 'weak', icon: <TrendingDown size={15} /> },
];

export function QuickActions({
  disabled,
  activeCourseId,
  variant = 'inline',
  onSend,
  onAfterSend,
}: Props) {
  const { t: tq } = useTranslation('assistant');
  const courses = useStore((s) => s.courses);
  const [manualCourseId, setManualCourseId] = useState<string | null>(null);
  const [quizTopic, setQuizTopic] = useState('');
  const [explainTopic, setExplainTopic] = useState('');
  const [mobileMode, setMobileMode] = useState<'quiz' | 'explain'>('quiz');
  const [mobileTopic, setMobileTopic] = useState('');

  // Sincroniza automaticamente com a cadeira ativa do Tutor salvo se o utilizador escolher outra manualmente.
  const syncedCourseId =
    activeCourseId && activeCourseId !== 'all' && courses.some((c) => c.id === activeCourseId)
      ? activeCourseId
      : '';
  const effectiveCourseId =
    manualCourseId && courses.some((c) => c.id === manualCourseId)
      ? manualCourseId
      : syncedCourseId || courses[0]?.id || '';

  const course = courses.find((c) => c.id === effectiveCourseId) ?? courses[0];
  const topics = course?.topics ?? [];
  const effectiveQuiz = topics.some((t) => t.id === quizTopic) ? quizTopic : topics[0]?.id ?? '';
  const effectiveExplain = topics.some((t) => t.id === explainTopic) ? explainTopic : topics[0]?.id ?? '';
  const effectiveMobileTopic = topics.some((t) => t.id === mobileTopic) ? mobileTopic : topics[0]?.id ?? '';
  const quizTitle = topics.find((t) => t.id === effectiveQuiz)?.title;
  const explainTitle = topics.find((t) => t.id === effectiveExplain)?.title;
  const mobileTopicTitle = topics.find((t) => t.id === effectiveMobileTopic)?.title;
  const hasTopics = Boolean(course) && topics.length > 0;

  const triggerSend = (prompt: string) => {
    onSend(prompt);
    onAfterSend?.();
  };

  if (variant === 'mobile-sheet') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {simple.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={disabled}
              onClick={() => triggerSend(tq(`quick.${a.id}P`))}
              className="flex min-h-[56px] items-start gap-2.5 rounded-2xl border border-line bg-bg p-3 text-left text-xs font-semibold text-fg transition hover:border-accent/50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="mt-0.5 shrink-0 text-accent">{a.icon}</span>
              <span className="leading-snug">{tq(`quick.${a.id}L`)}</span>
            </button>
          ))}
        </div>

        <div className={cx('space-y-3 rounded-2xl border border-line bg-bg p-3.5', (disabled || !hasTopics) && 'opacity-70')}>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mobileMode === 'quiz'}
              onClick={() => setMobileMode('quiz')}
              className={cx(
                'flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition',
                mobileMode === 'quiz' ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg',
              )}
            >
              <BrainCircuit size={14} className="text-accent" />
              <span>{tq('quick.tabQuiz')}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileMode === 'explain'}
              onClick={() => setMobileMode('explain')}
              className={cx(
                'flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition',
                mobileMode === 'explain' ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg',
              )}
            >
              <Lightbulb size={14} className="text-accent" />
              <span>{tq('quick.tabExplain')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Select
              aria-label={tq('quick.course')}
              value={effectiveCourseId}
              onChange={(e) => setManualCourseId(e.target.value)}
              disabled={disabled || courses.length === 0}
              className="min-h-11 text-xs"
            >
              {courses.length === 0 && <option value="">{tq('quick.noCourses')}</option>}
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.shortName || c.name}</option>
              ))}
            </Select>
            <Select
              aria-label={tq('quick.topic')}
              value={effectiveMobileTopic}
              onChange={(e) => setMobileTopic(e.target.value)}
              disabled={disabled || topics.length === 0}
              className="min-h-11 text-xs"
            >
              {topics.length === 0 && <option value="">{tq('quick.noTopics')}</option>}
              {topics.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </Select>
          </div>

          <Button
            variant="primary"
            className="min-h-11 w-full"
            disabled={disabled || !hasTopics || !mobileTopicTitle}
            onClick={() => {
              if (!course || !mobileTopicTitle) return;
              triggerSend(
                tq(mobileMode === 'quiz' ? 'quick.quizP' : 'quick.explainP', {
                  topic: mobileTopicTitle,
                  course: course.name,
                }),
              );
            }}
          >
            {tq('quick.send')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {simple.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={disabled}
            onClick={() => triggerSend(tq(`quick.${a.id}P`))}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-xs font-medium text-fg shadow-card transition hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-accent">{a.icon}</span>
            {tq(`quick.${a.id}L`)}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <ParamCard
          icon={<BrainCircuit size={15} />}
          label={tq('quick.quizL')}
          disabled={disabled || !hasTopics}
          course={effectiveCourseId} setCourse={setManualCourseId} courses={courses}
          topic={effectiveQuiz} setTopic={setQuizTopic} topics={topics}
          onGo={() => course && quizTitle && triggerSend(
            tq('quick.quizP', { topic: quizTitle, course: course.name }),
          )}
        />
        <ParamCard
          icon={<Lightbulb size={15} />}
          label={tq('quick.explainL')}
          disabled={disabled || !hasTopics}
          course={effectiveCourseId} setCourse={setManualCourseId} courses={courses}
          topic={effectiveExplain} setTopic={setExplainTopic} topics={topics}
          onGo={() => course && explainTitle && triggerSend(
            tq('quick.explainP', { topic: explainTitle, course: course.name }),
          )}
        />
      </div>
    </div>
  );
}

function ParamCard({ icon, label, disabled, course, setCourse, courses, topic, setTopic, topics, onGo }: {
  icon: ReactNode; label: string; disabled: boolean;
  course: string; setCourse: (id: string) => void;
  courses: { id: string; shortName: string }[];
  topic: string; setTopic: (id: string) => void;
  topics: { id: string; title: string }[];
  onGo: () => void;
}) {
  const { t: tq } = useTranslation('assistant');
  return (
    <div className={cx('rounded-2xl border border-line bg-surface p-3', disabled && 'opacity-60')}>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
        <span className="text-accent">{icon}</span>
        {label}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          aria-label={tq('quick.course')}
          value={course || courses[0]?.id || ''}
          onChange={(e) => setCourse(e.target.value)}
          disabled={disabled || courses.length === 0}
          className="text-xs sm:w-40"
        >
          {courses.length === 0 && <option value="">{tq('quick.noCourses')}</option>}
          {courses.map((c) => <option key={c.id} value={c.id}>{c.shortName}</option>)}
        </Select>
        <Select
          aria-label={tq('quick.topic')}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={disabled || topics.length === 0}
          className="min-w-0 flex-1 text-xs"
        >
          {topics.length === 0 && <option value="">{tq('quick.noTopics')}</option>}
          {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </Select>
        <Button size="sm" disabled={disabled || topics.length === 0} onClick={onGo}>
          {tq('quick.send')}
        </Button>
      </div>
    </div>
  );
}
