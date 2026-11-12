import { BrainCircuit, CalendarRange, Lightbulb, ListChecks, Target, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../../store/useStore';
import { Button, Select, cx } from '../ui';

interface Props {
  disabled?: boolean;
  onSend: (prompt: string) => void;
}

const simple: { label: string; prompt: string; icon: ReactNode }[] = [
  { label: 'O que devo estudar hoje?', prompt: 'O que devo estudar hoje? Dá-me uma ordem concreta de prioridades para a minha sessão.', icon: <Target size={15} /> },
  { label: 'Resumo da minha semana', prompt: 'Faz um resumo da minha semana: o que estudei, o que está atrasado e o que falta.', icon: <ListChecks size={15} /> },
  { label: 'Plano para a próxima avaliação', prompt: 'Cria um plano de estudo dia a dia para a minha próxima avaliação, até à data dela.', icon: <CalendarRange size={15} /> },
  { label: 'Onde estou mais fraco?', prompt: 'Onde estou mais fraco? Diz-me que matérias devo reforçar primeiro e porquê.', icon: <TrendingDown size={15} /> },
];

export function QuickActions({ disabled, onSend }: Props) {
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
            key={a.label}
            type="button"
            disabled={disabled}
            onClick={() => onSend(a.prompt)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-medium text-fg transition hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-accent">{a.icon}</span>
            {a.label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <ParamCard
          icon={<BrainCircuit size={15} />}
          label="Faz-me um quiz sobre…"
          disabled={disabled || !hasTopics}
          course={courseId} setCourse={setCourseId} courses={courses}
          topic={effectiveQuiz} setTopic={setQuizTopic} topics={topics}
          onGo={() => course && quizTitle && onSend(
            `Faz-me um quiz sobre "${quizTitle}" de ${course.name}. Faz uma pergunta de cada vez e espera pela minha resposta antes de a corrigires.`,
          )}
        />
        <ParamCard
          icon={<Lightbulb size={15} />}
          label="Explica-me…"
          disabled={disabled || !hasTopics}
          course={courseId} setCourse={setCourseId} courses={courses}
          topic={effectiveExplain} setTopic={setExplainTopic} topics={topics}
          onGo={() => course && explainTitle && onSend(
            `Explica-me "${explainTitle}" (${course.name}) de forma clara, com um exemplo concreto e um erro comum a evitar.`,
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
  return (
    <div className={cx('rounded-2xl border border-line bg-surface p-3', disabled && 'opacity-60')}>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
        <span className="text-accent">{icon}</span>
        {label}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          aria-label="Cadeira"
          value={course || courses[0]?.id || ''}
          onChange={(e) => setCourse(e.target.value)}
          disabled={disabled || courses.length === 0}
          className="text-xs sm:w-40"
        >
          {courses.length === 0 && <option value="">Sem cadeiras</option>}
          {courses.map((c) => <option key={c.id} value={c.id}>{c.shortName}</option>)}
        </Select>
        <Select
          aria-label="Matéria"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={disabled || topics.length === 0}
          className="min-w-0 flex-1 text-xs"
        >
          {topics.length === 0 && <option value="">Sem matéria</option>}
          {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </Select>
        <Button size="sm" disabled={disabled || topics.length === 0} onClick={onGo}>
          Enviar
        </Button>
      </div>
    </div>
  );
}
