import { ClipboardList, Pencil, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n/tr';
import type { KeyboardEvent } from 'react';
import { kindLabel } from '../../lib/colors';
import { GRADE_SCALES } from '../../lib/grading';
import { daysUntil, fmtGrade, gradeSummary, parsePtGrade } from '../../lib/selectors';
import { useStore } from '../../store/useStore';
import type { AppLanguage, Assessment, Course, GradingScale } from '../../types';
import { Badge, Button, Card, EmptyState, Input, Modal, Progress } from '../ui';
import AssessmentFormModal from './AssessmentFormModal';
import { DeleteButton } from './ConfirmModal';
import { dueLabel, fmtAssessmentDate, sortAssessments } from './helpers';

interface Props {
  course: Course;
}

export default function AssessmentsTab({ course }: Props) {
  const { t } = useTranslation('courses');
  const allAssessments = useStore((s) => s.assessments);
  const gradingScale = useStore((s) => s.settings.gradingScale) ?? 'pt20';
  const appLang = useStore((s) => s.settings.language) ?? 'pt-PT';
  const patch = useStore((s) => s.patch);
  const remove = useStore((s) => s.remove);
  const [form, setForm] = useState<Assessment | 'new' | null>(null);
  const [pendingFutureGrade, setPendingFutureGrade] = useState<{
    assessment: Assessment;
    grade: number;
    daysLeft: number;
  } | null>(null);

  const mine = useMemo(
    () => sortAssessments(allAssessments.filter((a) => a.courseId === course.id)),
    [allAssessments, course.id],
  );
  const summary = useMemo(() => gradeSummary(course, allAssessments), [course, allAssessments]);
  const weightOk = Math.round(summary.totalWeight) === 100;

  return (
    <div className="space-y-4">
      <Card title={t('assess.summary')} action={
        <Button variant="primary" size="sm" onClick={() => setForm('new')}>
          <Plus size={14} /> {t('assess.new')}
        </Button>
      }>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted">{t('assess.avg')}</p>
            <p className="mt-1 text-xl font-semibold tabular">
              {fmtGrade(summary.current, gradingScale, appLang)}
            </p>
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{t('assess.graded')}</span>
              <span className="tabular">{Math.round(summary.gradedWeight)}%</span>
            </div>
            <Progress value={summary.gradedWeight / 100} className="mt-2" />
          </div>
        </div>
        <div className="mt-4">
          {weightOk ? (
            <Badge tone="ok"><CheckCircle2 size={12} /> {t('assess.ok100')}</Badge>
          ) : (
            <Badge tone="warn"><AlertTriangle size={12} /> {t('assess.total', { n: Math.round(summary.totalWeight) })}</Badge>
          )}
        </div>
      </Card>

      {mine.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={28} />}
          title={t('assess.empty')}
          hint={t('assess.emptyHint')}
          action={<Button variant="primary" onClick={() => setForm('new')}><Plus size={16} /> {t('assess.new')}</Button>}
        />
      ) : (
        <ul className="space-y-2">
          {mine.map((a) => (
            <li key={a.id} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{kindLabel[a.kind]}</Badge>
                  <span className="truncate text-sm font-medium">{a.title}</span>
                </div>
                <p className="mt-1 text-xs text-muted tabular">
                  {fmtAssessmentDate(a.date)} · {dueLabel(a.date)} · {a.weight}% · {a.topicIds.length} tópicos
                  {a.location ? ` · ${a.location}` : ''}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <GradeInput
                  key={`${a.id}-${gradingScale}-${a.grade ?? ''}`}
                  value={a.grade}
                  scale={gradingScale}
                  lang={appLang}
                  onCommit={(grade) => {
                    const daysLeft = daysUntil(a.date);
                    if (grade !== undefined && daysLeft > 0) {
                      setPendingFutureGrade({ assessment: a, grade, daysLeft });
                      return;
                    }
                    patch('assessments', a.id, { grade });
                  }}
                />
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" aria-label={t('assess.edit')} title={t('assess.edit')} onClick={() => setForm(a)}>
                    <Pencil size={14} />
                  </Button>
                  <DeleteButton
                    message={t('assess.delete', { title: a.title })}
                    onConfirm={() => remove('assessments', a.id)}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <AssessmentFormModal
          course={course}
          assessment={form === 'new' ? undefined : form}
          onClose={() => setForm(null)}
        />
      )}

      <Modal
        open={Boolean(pendingFutureGrade)}
        onClose={() => setPendingFutureGrade(null)}
        title={t('assess.doneTitle')}
      >
        {pendingFutureGrade && (
          <div className="space-y-4 text-sm">
            <p className="text-muted leading-relaxed">
              {t('assess.futureBody', { title: pendingFutureGrade.assessment.title, n: pendingFutureGrade.daysLeft, grade: fmtGrade(pendingFutureGrade.grade) })}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setPendingFutureGrade(null)}>
                {t('assess.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  patch('assessments', pendingFutureGrade.assessment.id, { grade: pendingFutureGrade.grade });
                  setPendingFutureGrade(null);
                }}
              >
                {t('assess.yes')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** Nota inline na escala configurada. Vazio = ainda não avaliado. */
function GradeInput({
  value,
  scale,
  lang,
  onCommit,
}: {
  value?: number;
  scale: GradingScale;
  lang: AppLanguage;
  onCommit: (grade: number | undefined) => void;
}) {
  const max = GRADE_SCALES[scale]?.max ?? 20;
  const [text, setText] = useState(() => (value !== undefined ? fmtGrade(value, scale, lang) : ''));
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    const parsed = parsePtGrade(text.replace('%', ''), scale);
    if (parsed === 'invalid') {
      setError(`0–${max}`);
      return;
    }
    setError(null);
    if (parsed === null) {
      if (value !== undefined) onCommit(undefined);
      return;
    }
    setText(fmtGrade(parsed, scale, lang));
    if (parsed !== value) onCommit(parsed);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="flex items-center gap-2 text-xs text-muted">
        <span className="hidden sm:inline">Nota</span>
        <Input
          type="text"
          inputMode="decimal"
          aria-label={tr('courses:assess.gradeAria', { max })}
          aria-invalid={Boolean(error)}
          placeholder="—"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          className="min-h-[44px] w-20 text-right tabular sm:min-h-[36px]"
          onBlur={commit}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      </label>
      {error && (
        <span role="alert" className="text-xs font-medium text-coral-ink">
          {error}
        </span>
      )}
    </div>
  );
}
