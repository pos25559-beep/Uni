import { ArrowLeft, Clock, ExternalLink, GraduationCap, Pencil, Target, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AssessmentsTab from '../components/courses/AssessmentsTab';
import CourseFormModal from '../components/courses/CourseFormModal';
import { DeleteButton } from '../components/courses/ConfirmModal';
import MaterialsTab from '../components/courses/MaterialsTab';
import ScheduleTab from '../components/courses/ScheduleTab';
import TasksTab from '../components/courses/TasksTab';
import TopicsTab from '../components/courses/TopicsTab';
import { Button, cx, EmptyState, Stat } from '../components/ui';
import { courseColors } from '../lib/colors';
import { fmtGrade, fmtMinutes, gradeSummary, sessionMinutes, topicProgress } from '../lib/selectors';
import { useStore } from '../store/useStore';

type TabKey = 'materia' | 'avaliacoes' | 'horario' | 'materiais' | 'tarefas';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'materia', label: 'Matéria' },
  { key: 'avaliacoes', label: 'Avaliações' },
  { key: 'horario', label: 'Horário' },
  { key: 'materiais', label: 'Materiais' },
  { key: 'tarefas', label: 'Tarefas' },
];

export default function CourseDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const course = useStore((s) => s.courses.find((c) => c.id === id));
  const assessments = useStore((s) => s.assessments);
  const sessions = useStore((s) => s.sessions);
  const remove = useStore((s) => s.remove);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<TabKey>('materia');

  const summary = useMemo(
    () => (course ? gradeSummary(course, assessments) : null),
    [course, assessments],
  );
  const studiedMinutes = useMemo(
    () => sessions.filter((s) => s.courseId === id).reduce((sum, s) => sum + sessionMinutes(s), 0),
    [sessions, id],
  );

  if (!course || !summary) {
    return (
      <EmptyState
        icon={<GraduationCap size={28} />}
        title="Esta cadeira não existe"
        hint="Pode ter sido apagada ou o link está incorreto."
        action={
          <Link to="/cadeiras" className="text-sm font-medium text-accent hover:underline">
            Voltar às cadeiras
          </Link>
        }
      />
    );
  }

  const colors = courseColors[course.color];
  const progress = topicProgress(course);
  const links = [
    { label: 'NotebookLM', url: course.notebookUrl },
    { label: 'Drive', url: course.driveFolderUrl },
    { label: 'OneDrive', url: course.oneDriveFolderUrl },
    { label: 'CLIP', url: course.clipUrl },
  ].filter((l): l is { label: string; url: string } => Boolean(l.url));

  const meta = [course.code, `${course.ects} ECTS`, course.teacher].filter(Boolean).join(' · ');

  return (
    <>
      <Link to="/cadeiras" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Cadeiras
      </Link>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
            <span className={cx('size-3 shrink-0 rounded-full', colors.dot)} aria-hidden />
            <span className="truncate">{course.name}</span>
          </h1>
          <p className="mt-1 text-sm text-muted">{meta}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setEditing(true)}>
            <Pencil size={14} /> Editar
          </Button>
          <DeleteButton
            label="Apagar"
            message={`Apagar "${course.name}"? Também são apagadas as avaliações, aulas, sessões, tarefas e materiais desta cadeira. Esta ação não pode ser desfeita.`}
            onConfirm={() => {
              remove('courses', course.id);
              navigate('/cadeiras');
            }}
          />
        </div>
      </header>

      {links.length > 0 && (
        <div className="-mt-3 mb-6 flex flex-wrap gap-2">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-xs font-medium text-fg transition hover:border-muted/50"
            >
              {l.label}
              <ExternalLink size={12} className="text-muted" />
            </a>
          ))}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Nota atual"
          value={fmtGrade(summary.current)}
          hint={`${Math.round(summary.gradedWeight)}% do peso avaliado`}
          icon={<TrendingUp size={14} />}
        />
        <Stat
          label="Nota necessária no que falta"
          value={
            summary.needed === null ? (
              '—'
            ) : (
              <span className={cx(summary.needed > 20 && 'text-danger')}>{fmtGrade(summary.needed)}</span>
            )
          }
          hint={
            summary.needed === null
              ? 'Tudo avaliado'
              : summary.needed > 20
                ? 'Objetivo fora de alcance'
                : `Objetivo ${fmtGrade(course.targetGrade)}`
          }
          icon={<Target size={14} />}
        />
        <Stat
          label="Progresso da matéria"
          value={`${Math.round(progress * 100)}%`}
          hint={`${course.topics.length} tópicos`}
        />
        <Stat
          label="Horas estudadas"
          value={fmtMinutes(studiedMinutes)}
          hint="Sessões concluídas"
          icon={<Clock size={14} />}
        />
      </div>

      <div role="tablist" aria-label="Secções da cadeira" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              '-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition',
              tab === t.key ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'materia' && <TopicsTab course={course} />}
        {tab === 'avaliacoes' && <AssessmentsTab course={course} />}
        {tab === 'horario' && <ScheduleTab course={course} />}
        {tab === 'materiais' && <MaterialsTab course={course} />}
        {tab === 'tarefas' && <TasksTab course={course} />}
      </div>

      {editing && <CourseFormModal course={course} onClose={() => setEditing(false)} />}
    </>
  );
}
