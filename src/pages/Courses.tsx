import { GraduationCap, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import CourseCard from '../components/courses/CourseCard';
import CourseFormModal from '../components/courses/CourseFormModal';
import { Button, EmptyState, PageHeader } from '../components/ui';
import { upcomingAssessments, fmtGrade, gradeSummary, semesterAverage } from '../lib/selectors';
import { useStore } from '../store/useStore';
import type { Assessment, Course } from '../types';

export default function Courses() {
  const courses = useStore((s) => s.courses);
  const assessments = useStore((s) => s.assessments);
  const [form, setForm] = useState<Course | 'new' | null>(null);

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
          <Button variant="primary" onClick={() => setForm('new')}>
            <Plus size={16} /> Nova cadeira
          </Button>
        }
      />

      {courses.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={28} />}
          title="Ainda não tens cadeiras"
          hint="Acrescenta as cadeiras deste semestre para acompanhar notas, matéria e avaliações."
          action={
            <Button variant="primary" onClick={() => setForm('new')}>
              <Plus size={16} /> Nova cadeira
            </Button>
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
    </>
  );
}
