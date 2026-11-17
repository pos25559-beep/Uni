import { BrainCircuit, CalendarRange, Lightbulb, ListChecks, Target, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { useStore } from '../../store/useStore';
import { Button, Select } from '../ui';
import { cx } from '../../lib/uiHelpers';

interface Props {
  disabled?: boolean;
  onSend: (prompt: string) => void;
}

const simple: { id: 'today' | 'week' | 'plan' | 'weak'; icon: ReactNode }[] = [
  { id: 'today', icon: <Target size={15} /> },
  { id: 'week', icon: <ListChecks size={15} /> },
  { id: 'plan', icon: <CalendarRange size={15} /> },
  { id: 'weak', icon: <TrendingDown size={15} /> },
];

export function QuickActions({ disabled, onSend }: Props) {
  const { t: tq } = useTranslation('assistant');
  const courses = useStore((s) => s.courses);
  const [courseId, setCourseId] = useState('');
  const [quizTopic, setQuizTopic] = useState('');
  const [explainTopic, setExplainTopic] = useState('');

  // Valores efetivos: se a seleção guardada deixou de existir, usa o primeiro da lista.
  const course = courses.find((c) => c.id === courseId) ?? courses[0];
  const topics = course?.topics ?? [];
  const effectiveQuiz = topics.some((t) => t.id === quizTopic) ? quizTopic : topics[0]?.id ?? '';
  const effectiveExplain = topics.some((t) => t.id === explainTopic) ? explainTopic : topics[0]?.id ?? '';
  const quizTitle = topics.find((t) => t.id === effectiveQuiz)?.title;
  const explainTitle = topics.find((t) => t.id === effectiveExplain)?.title;
  const hasTopics = Boolean(course) && topics.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {simple.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={disabled}
            onClick={() => onSend(tq(`quick.${a.id}P`))}
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
          course={courseId} setCourse={setCourseId} courses={courses}
          topic={effectiveQuiz} setTopic={setQuizTopic} topics={topics}
          onGo={() => course && quizTitle && onSend(
            tq('quick.quizP', { topic: quizTitle, course: course.name }),
          )}
        />
        <ParamCard
          icon={<Lightbulb size={15} />}
          label={tq('quick.explainL')}
          disabled={disabled || !hasTopics}
          course={courseId} setCourse={setCourseId} courses={courses}
          topic={effectiveExplain} setTopic={setExplainTopic} topics={topics}
          onGo={() => course && explainTitle && onSend(
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
