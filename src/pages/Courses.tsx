import { GraduationCap, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import CourseCard from '../components/courses/CourseCard';
import CourseFormModal from '../components/courses/CourseFormModal';
import ClipImportModal from '../components/settings/ClipImportModal';
import { Button, EmptyState, PageHeader } from '../components/ui';
import { upcomingAssessments, fmtGrade, gradeSummary, semesterAverage } from '../lib/selectors';
import { useStore } from '../store/useStore';
import type { Assessment, Course } from '../types';

export default function Courses() {
  const courses = useStore((s) => s.courses);
  const assessments = useStore((s) => s.assessments);
  const loadDemo = useStore((s) => s.loadDemo);
  const [form, setForm] = useState<Course | 'new' | null>(null);
  const [clipOpen, setClipOpen] = useState(false);

  const hasOldDemo = courses.some((c) => c.id === 'am2' || c.id === 'so');

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
    <>
      <PageHeader
        title="Cadeiras"
        subtitle={`${courses.length} cadeiras · ${totalEcts} ECTS · média ${fmtGrade(average)}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setClipOpen(true)}>
              <GraduationCap size={16} /> Importar do CLIP
            </Button>
            <Button variant="primary" onClick={() => setForm('new')}>
              <Plus size={16} /> Nova cadeira
            </Button>
          </div>
        }
      />

      {hasOldDemo && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-line bg-surface-2 p-4 text-sm">
          <p className="text-muted">
            Estás a visualizar o modelo de exemplo antigo. Desejas carregar as tuas 6 cadeiras reais de LEMc com os 18 PDFs e slides?
          </p>
          <Button variant="primary" size="sm" onClick={() => loadDemo()}>
            Carregar cadeiras de LEMc
          </Button>
        </div>
      )}

      {courses.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={28} />}
          title="Ainda não tens cadeiras"
          hint="Acrescenta as cadeiras deste semestre ou importa diretamente do CLIP."
          action={
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setClipOpen(true)}>
                <GraduationCap size={16} /> Importar do CLIP
              </Button>
              <Button variant="primary" onClick={() => setForm('new')}>
                <Plus size={16} /> Nova cadeira
              </Button>
            </div>
          }
        />
      ) : (
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
      )}

      {form && (
        <CourseFormModal course={form === 'new' ? undefined : form} onClose={() => setForm(null)} />
      )}

      {clipOpen && <ClipImportModal onClose={() => setClipOpen(false)} />}
    </>
  );
}
