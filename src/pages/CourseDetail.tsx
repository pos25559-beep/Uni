import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  GraduationCap,
  HardDrive,
  Mail,
  Pencil,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AssessmentsTab from '../components/courses/AssessmentsTab';
import CourseFormModal from '../components/courses/CourseFormModal';
import CourseUniCard from '../components/courses/CourseUniCard';
import ScheduleTab from '../components/courses/ScheduleTab';
import TasksTab from '../components/courses/TasksTab';
import TopicsTab from '../components/courses/TopicsTab';
import CourseRulesTab from '../components/courses/CourseRulesTab';
import CourseRepositoryTab from '../components/courses/CourseRepositoryTab';
import CourseEmailsTab from '../components/courses/CourseEmailsTab';
import ClipCourseModal from '../components/courses/ClipCourseModal';
import FileUploadModal from '../components/materials/FileUploadModal';
import { AnimatedPage } from '../components/motion/Primitives';
import { TabGuideBanner, TabGuideHelpButton } from '../components/onboarding/TabGuideBanner';
import { Button, EmptyState, Stat, SubpageHeader } from '../components/ui';
import { cx } from '../lib/uiHelpers';
import { courseColors } from '../lib/colors';
import {
  fmtGrade,
  fmtMinutes,
  gradeSummary,
  sessionMinutes,
  topicProgress,
  upcomingAssessments,
  daysUntil,
} from '../lib/selectors';
import { useStore } from '../store/useStore';

type TabKey = 'visao' | 'materia' | 'materiais' | 'horario' | 'tarefas';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'visao', label: 'Visão & Regras' },
  { key: 'materia', label: 'Matéria & Notas' },
  { key: 'materiais', label: 'Materiais' },
  { key: 'horario', label: 'Horário' },
  { key: 'tarefas', label: 'Tarefas' },
];

export default function CourseDetail() {
  const { t, i18n } = useTranslation('courses');
  const appLang = i18n.language?.startsWith('en') ? ('en' as const) : ('pt-PT' as const);
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const course = useStore((s) => s.courses.find((c) => c.id === id));
  const assessments = useStore((s) => s.assessments);
  const sessions = useStore((s) => s.sessions);
  const gradingScale = useStore((s) => s.settings.gradingScale) ?? 'pt20';
  const remove = useStore((s) => s.remove);

  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<TabKey>('visao');
  const [emailsExpanded, setEmailsExpanded] = useState(false);
  const [clipModalOpen, setClipModalOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const summary = useMemo(
    () => (course ? gradeSummary(course, assessments) : null),
    [course, assessments],
  );

  const studiedMinutes = useMemo(
    () => sessions.filter((s) => s.courseId === id).reduce((sum, s) => sum + sessionMinutes(s), 0),
    [sessions, id],
  );

  const nextAssessment = useMemo(() => {
    if (!course) return null;
    const upcoming = upcomingAssessments(assessments).filter((a) => a.courseId === course.id);
    return upcoming[0] ?? null;
  }, [assessments, course]);

  if (!course || !summary) {
    return (
      <EmptyState
        icon={<GraduationCap size={28} />}
        title={t('courseNotFound')}
        hint="Pode ter sido apagada ou o link está incorreto."
        action={
          <Link to="/cadeiras" className="text-sm font-medium text-accent hover:underline">
            {t('backToCourses')}
          </Link>
        }
      />
    );
  }

  const colors = courseColors[course.color];
  const progress = topicProgress(course);

  const links = [
    { label: 'Portal da cadeira', url: course.clipUrl, icon: GraduationCap },
    { label: 'Pasta de materiais', url: course.sharedDriveUrl || course.driveFolderUrl, icon: HardDrive },
    { label: 'Gemini Notebook', url: course.notebookUrl, icon: BookOpen },
  ].filter((l): l is { label: string; url: string; icon: typeof HardDrive } => Boolean(l.url));

  const meta = [course.code, `${course.ects} ECTS`, course.teacher].filter(Boolean).join(' · ');

  return (
    <AnimatedPage className="space-y-5">
      <SubpageHeader
        backTo="/cadeiras"
        title={
          <span className="inline-flex min-w-0 items-center gap-2.5">
            <span className={cx('size-3 shrink-0 rounded-full', colors.dot)} aria-hidden />
            <span className="truncate">{course.name}</span>
          </span>
        }
        subtitle={meta || 'Detalhes da cadeira'}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <TabGuideHelpButton tabKey="cadeiras" />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/assistente?course=${encodeURIComponent(course.id)}`)}
              className="gap-1.5"
            >
              <Sparkles size={14} className="text-accent" />
              <span className="hidden sm:inline">Tutor Gemini</span>
              <span className="sm:hidden">Tutor</span>
            </Button>
            <Button size="sm" onClick={() => setEditing(true)} aria-label="Editar cadeira">
              <Pencil size={14} aria-hidden="true" /> <span className="hidden sm:inline">Editar</span>
            </Button>
          </div>
        }
      />

      <TabGuideBanner tabKey="cadeiras" />

      {/* Links Diretos do Repositório e Plataformas */}
      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <a
                key={l.label}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-xs font-medium text-fg transition hover:border-muted/50"
              >
                <Icon size={14} className="text-muted" />
                {l.label}
                <ExternalLink size={12} className="text-muted" />
              </a>
            );
          })}
        </div>
      )}

      {/* Estatísticas e Painel Superior */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t('currentGrade')}
          value={fmtGrade(summary.current, gradingScale, appLang)}
          hint={`${Math.round(summary.gradedWeight)}% ${appLang === 'en' ? 'weight graded' : 'do peso avaliado'}`}
          icon={<TrendingUp size={14} />}
        />
        <Stat
          label={t('nextAssessment')}
          value={
            nextAssessment ? (
              <span className="text-accent">{nextAssessment.title}</span>
            ) : (
              'Sem testes marcados'
            )
          }
          hint={
            nextAssessment
              ? `Em ${daysUntil(nextAssessment.date)} dias (peso ${nextAssessment.weight}%)`
              : 'Todas as avaliações concluídas'
          }
          icon={<Clock size={14} />}
        />
        <Stat
          label="Progresso da matéria"
          value={`${Math.round(progress * 100)}%`}
          hint={`${course.topics.length} tópicos`}
          icon={<Target size={14} />}
        />
        <Stat
          label="Horas estudadas"
          value={fmtMinutes(studiedMinutes)}
          hint="Sessões concluídas"
          icon={<Clock size={14} />}
        />
      </div>

      {/* Navegação por Separadores (5 abas consolidadas UI v4) */}
      <div
        role="tablist"
        aria-label="Secções da cadeira"
        className="flex gap-1.5 overflow-x-auto pb-1"
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              'min-h-11 shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition sm:text-sm',
              tab === t.key
                ? 'bg-ink-cta text-ink-cta-fg shadow-sm'
                : 'bg-surface-2 text-muted hover:text-fg',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Conteúdo dos Separadores */}
      <div role="tabpanel">
        {tab === 'visao' && (
          <div className="space-y-6">
            <CourseUniCard course={course} />
            <CourseRulesTab
              course={course}
              onOpenClipModal={() => setClipModalOpen(true)}
            />
            <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
              <button
                type="button"
                aria-expanded={emailsExpanded}
                onClick={() => setEmailsExpanded((v) => !v)}
                className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-xl bg-surface-2 text-accent">
                    <Mail size={16} />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-fg sm:text-base">
                      Avisos Gmail da Cadeira
                    </h2>
                    <p className="text-xs text-muted">
                      Mensagens de docentes e atualizações ligadas a {course.shortName}
                    </p>
                  </div>
                </div>
                {emailsExpanded ? (
                  <ChevronUp size={16} className="shrink-0 text-muted" />
                ) : (
                  <ChevronDown size={16} className="shrink-0 text-muted" />
                )}
              </button>
              {emailsExpanded && (
                <div className="mt-4 border-t border-line pt-4">
                  <CourseEmailsTab course={course} />
                </div>
              )}
            </section>
          </div>
        )}
        {tab === 'materia' && (
          <div className="space-y-8">
            <TopicsTab course={course} />
            <AssessmentsTab course={course} />
          </div>
        )}
        {tab === 'materiais' && (
          <CourseRepositoryTab
            course={course}
            assessments={assessments}
            onUploadFile={() => setUploadOpen(true)}
          />
        )}
        {tab === 'horario' && <ScheduleTab course={course} />}
        {tab === 'tarefas' && <TasksTab course={course} />}
      </div>

      {editing && (
        <CourseFormModal
          course={course}
          onClose={() => setEditing(false)}
          onDelete={() => {
            remove('courses', course.id);
            navigate('/cadeiras');
          }}
        />
      )}
      {clipModalOpen && <ClipCourseModal course={course} onClose={() => setClipModalOpen(false)} />}
      {uploadOpen && <FileUploadModal initialCourseId={course.id} onClose={() => setUploadOpen(false)} />}
    </AnimatedPage>
  );
}
