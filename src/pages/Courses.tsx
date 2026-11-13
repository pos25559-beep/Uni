import { GraduationCap, Layers, LayoutGrid, Plus, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CourseCard from '../components/courses/CourseCard';
import CourseFormModal from '../components/courses/CourseFormModal';
import { AnimatedPage, FolderCardDeck, StaggerContainer, StaggerItem } from '../components/motion/Primitives';
import ClipImportModal from '../components/settings/ClipImportModal';
import { Button, EmptyState, PageHeader, SegmentedControl } from '../components/ui';
import { fmtGrade, gradeSummary, semesterAverage, upcomingAssessments } from '../lib/selectors';
import { useStore } from '../store/useStore';
import type { Assessment, Course } from '../types';

export default function Courses() {
  const navigate = useNavigate();
  const courses = useStore((s) => s.courses);
  const assessments = useStore((s) => s.assessments);
  const [form, setForm] = useState<Course | 'new' | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [view, setView] = useState<'deck' | 'grid'>('deck');

  const summaries = useMemo(
    () => new Map(courses.map((c) => [c.id, gradeSummary(c, assessments)])),
    [courses, assessments],
  );

  const nextByCourse = useMemo(() => {
    const map = new Map<string, Assessment>();
    for (const a of upcomingAssessments(assessments)) {
      if (!map.has(a.courseId)) map.set(a.courseId, a);
    }
    return map;
  }, [assessments]);

  const totalEcts = useMemo(() => courses.reduce((sum, c) => sum + c.ects, 0), [courses]);
  const average = useMemo(() => semesterAverage(courses, assessments), [courses, assessments]);

  return (
    <AnimatedPage className="space-y-6">
      <PageHeader
        eyebrow="Caderno académico"
        title="As tuas"
        accentTitle="cadeiras"
        subtitle={`${courses.length} ${courses.length === 1 ? 'cadeira' : 'cadeiras'} · ${totalEcts} ECTS · média ${fmtGrade(average)}`}
        actions={
          <Button variant="primary" onClick={() => setForm('new')}>
            <Plus size={16} /> Nova cadeira
          </Button>
        }
      />

      {courses.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={28} />}
          title="Ainda não tens cadeiras"
          hint="Adiciona as tuas cadeiras ou disciplinas à mão, ou importa o teu horário (.ics) para começar."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload size={16} /> Importar horário
              </Button>
              <Button variant="primary" onClick={() => setForm('new')}>
                <Plus size={16} /> Nova cadeira
              </Button>
            </div>
          }
        />
      ) : (
        <StaggerContainer className="space-y-5">
          <StaggerItem>
            <div className="flex items-center justify-between gap-3">
              <SegmentedControl
                layoutId="courses-view-tabs"
                value={view}
                onChange={(id) => setView(id as 'deck' | 'grid')}
                items={[
                  { id: 'deck', label: 'Pastas', icon: <Layers size={14} />, count: courses.length },
                  { id: 'grid', label: 'Grelha', icon: <LayoutGrid size={14} /> },
                ]}
              />
              <span className="hidden text-xs font-medium text-muted sm:inline">
                Toca numa pasta para abrir notas, tópicos e exames
              </span>
            </div>
          </StaggerItem>

          {view === 'deck' && (
            <StaggerItem>
              <FolderCardDeck
                courses={courses}
                onOpenCourse={(id) => navigate(`/cadeiras/${id}`)}
              />
            </StaggerItem>
          )}

          <StaggerItem className={view === 'deck' ? 'pt-2' : ''}>
            {view === 'deck' && (
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-base font-bold">Todas as cadeiras</h2>
                <span className="text-xs text-muted">{totalEcts} ECTS no total</span>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {courses.map((c) => (
                <CourseCard
                  key={c.id}
                  course={c}
                  summary={summaries.get(c.id) ?? gradeSummary(c, [])}
                  next={nextByCourse.get(c.id)}
                />
              ))}
            </div>
          </StaggerItem>
        </StaggerContainer>
      )}

      {form && (
        <CourseFormModal course={form === 'new' ? undefined : form} onClose={() => setForm(null)} />
      )}

      {importOpen && <ClipImportModal onClose={() => setImportOpen(false)} />}
    </AnimatedPage>
  );
}
