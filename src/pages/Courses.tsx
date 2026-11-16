import { CalendarDays, Camera, GraduationCap, Layers, LayoutGrid, Plus, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import CourseCard from '../components/courses/CourseCard';
import CourseFormModal from '../components/courses/CourseFormModal';
import SmartScheduleImportModal, {
  type SmartImportInitialMode,
} from '../components/courses/SmartScheduleImportModal';
import { AnimatedPage, FolderCardDeck, StaggerContainer, StaggerItem } from '../components/motion/Primitives';
import { TabGuideBanner, TabGuideHelpButton } from '../components/onboarding/TabGuideBanner';
import ClipImportModal from '../components/settings/ClipImportModal';
import { Button, EmptyState, PageHeader, SegmentedControl } from '../components/ui';
import { normalizeAppLanguage } from '../lib/grading';
import { fmtGrade, gradeSummary, semesterAverage, upcomingAssessments } from '../lib/selectors';
import { useStore } from '../store/useStore';
import type { Assessment, Course } from '../types';

export default function Courses() {
  const { t, i18n } = useTranslation('courses');
  const appLang = normalizeAppLanguage(i18n.language);
  const navigate = useNavigate();
  const courses = useStore((s) => s.courses);
  const assessments = useStore((s) => s.assessments);
  const gradingScale = useStore((s) => s.settings.gradingScale) ?? 'pt20';
  const [form, setForm] = useState<Course | 'new' | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [smartImport, setSmartImport] = useState<SmartImportInitialMode | null>(null);
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
        eyebrow={t('eyebrow')}
        title={t('title')}
        accentTitle={t('accentTitle')}
        subtitle={`${courses.length} ${courses.length === 1 ? t('unitOne') : t('unitMany')} · ${totalEcts} ECTS · ${t('avgShort')} ${fmtGrade(average, gradingScale, appLang)}`}
        actions={
          <div className="flex items-center gap-2">
            <TabGuideHelpButton tabKey="cadeiras" />
            <Button variant="secondary" onClick={() => setSmartImport('photo')} aria-label={t('importCurriculum')}>
              <Upload size={16} aria-hidden="true" /> <span className="hidden sm:inline">{t('importCurriculum').split(' ')[0]}</span>
            </Button>
            <Button variant="primary" onClick={() => setForm('new')}>
              <Plus size={16} /> {t('newCourse')}
            </Button>
          </div>
        }
      />

      <TabGuideBanner
        tabKey="cadeiras"
        isEmpty={courses.length === 0}
        actions={
          courses.length === 0 ? (
            <>
              <Button size="sm" variant="primary" onClick={() => setSmartImport('photo')}>
                <Camera size={14} /> {t('empty.photoBannerBtn')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setSmartImport('gcal')}>
                <CalendarDays size={14} /> {t('empty.gcalBannerBtn')}
              </Button>
            </>
          ) : undefined
        }
      />

      {courses.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={28} />}
          title={t('empty.title')}
          hint={t('empty.hint')}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="primary" onClick={() => setSmartImport('photo')}>
                <Camera size={16} /> {t('empty.photoBtn')}
              </Button>
              <Button variant="secondary" onClick={() => setSmartImport('gcal')}>
                <CalendarDays size={16} /> {t('empty.gcalBtn')}
              </Button>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload size={16} /> {t('empty.icsBtn')}
              </Button>
              <Button variant="ghost" onClick={() => setForm('new')}>
                <Plus size={16} /> {t('empty.manualBtn')}
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
                  { id: 'deck', label: t('views.deck'), icon: <Layers size={14} />, count: courses.length },
                  { id: 'grid', label: t('views.grid'), icon: <LayoutGrid size={14} /> },
                ]}
              />
              <span className="hidden text-xs font-medium text-muted sm:inline">
                {t('views.deckHint')}
              </span>
            </div>
          </StaggerItem>

          {view === 'deck' ? (
            <StaggerItem>
              <FolderCardDeck
                courses={courses}
                onOpenCourse={(id) => navigate(`/cadeiras/${id}`)}
              />
            </StaggerItem>
          ) : (
            <StaggerItem>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-base font-bold">{t('views.allCourses')}</h2>
                <span className="text-xs text-muted">{t('ectsTotal', { ects: totalEcts })}</span>
              </div>
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
          )}
        </StaggerContainer>
      )}

      {form && (
        <CourseFormModal course={form === 'new' ? undefined : form} onClose={() => setForm(null)} />
      )}

      {smartImport && (
        <SmartScheduleImportModal
          initialMode={smartImport}
          onClose={() => setSmartImport(null)}
          onOpenClipModal={() => setImportOpen(true)}
        />
      )}

      {importOpen && <ClipImportModal onClose={() => setImportOpen(false)} />}
    </AnimatedPage>
  );
}
