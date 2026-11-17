import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { courseColors, colorNames } from '../../lib/colors';
import { GRADE_SCALES } from '../../lib/grading';
import { newId, useStore } from '../../store/useStore';
import type { Course, CourseColor } from '../../types';
import { DeleteButton } from './ConfirmModal';
import { Button, Field, Input, Modal } from '../ui';
import { cx } from '../../lib/uiHelpers';

interface Props {
  /** Cadeira a editar; omitir para criar uma nova. */
  course?: Course;
  onClose: () => void;
  onDelete?: () => void;
}

const parseNumber = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')));

export default function CourseFormModal({ course, onClose, onDelete }: Props) {
  const { t } = useTranslation(['courses', 'common']);
  const upsert = useStore((s) => s.upsert);
  const gradingScale = useStore((s) => s.settings.gradingScale) ?? 'pt20';
  const maxGrade = GRADE_SCALES[gradingScale]?.max ?? 20;
  const defaultTarget = gradingScale === 'pct100' ? 60 : gradingScale === 'scale10' ? 7 : 10;
  const [code, setCode] = useState(course?.code ?? '');
  const [name, setName] = useState(course?.name ?? '');
  const [shortName, setShortName] = useState(course?.shortName ?? '');
  const [ects, setEcts] = useState(String(course?.ects ?? 6));
  const [teacher, setTeacher] = useState(course?.teacher ?? '');
  const [targetGrade, setTargetGrade] = useState(String(course?.targetGrade ?? defaultTarget));
  const [color, setColor] = useState<CourseColor>(course?.color && course.color !== 'violet' ? course.color : 'emerald');
  const [notebookUrl, setNotebookUrl] = useState(course?.notebookUrl ?? '');
  const [driveFolderUrl, setDriveFolderUrl] = useState(course?.driveFolderUrl ?? '');
  const [clipUrl, setClipUrl] = useState(course?.clipUrl ?? '');
  const [errors, setErrors] = useState<{ name?: string; shortName?: string; ects?: string; targetGrade?: string }>({});

  const save = (e: FormEvent) => {
    e.preventDefault();
    const ectsNum = parseNumber(ects);
    const targetNum = parseNumber(targetGrade);
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('courseModal.errName');
    if (!shortName.trim()) next.shortName = t('courseModal.errShort');
    if (!Number.isFinite(ectsNum) || ectsNum < 0) next.ects = t('courseModal.errInvalid');
    if (!Number.isFinite(targetNum) || targetNum < 0 || targetNum > maxGrade) {
      next.targetGrade = `0–${maxGrade}`;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const opt = (v: string) => v.trim() || undefined;
    upsert('courses', {
      ...(course ?? { id: newId(), topics: [] }),
      code: code.trim(),
      name: name.trim(),
      shortName: shortName.trim(),
      ects: ectsNum,
      teacher: opt(teacher),
      targetGrade: targetNum,
      color,
      notebookUrl: opt(notebookUrl),
      driveFolderUrl: opt(driveFolderUrl),
      clipUrl: opt(clipUrl),
    } satisfies Course);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={course ? t('courseModal.editTitle') : t('courseModal.newTitle')}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div>
            {course && onDelete && (
              <DeleteButton
                label={t('common:actions.delete')}
                message={t('courseModal.deleteConfirm', { name: course.name })}
                onConfirm={() => {
                  onClose();
                  onDelete();
                }}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
            <Button variant="primary" type="submit" form="course-form">{t('common:actions.save')}</Button>
          </div>
        </div>
      }
    >
      <form id="course-form" onSubmit={save} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('courseModal.name')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('courseModal.namePh')} />
            {errors.name && <span className="mt-1 block text-xs text-danger">{errors.name}</span>}
          </Field>
          <Field label={t('courseModal.shortName')}>
            <Input value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder={t('courseModal.shortNamePh')} />
            {errors.shortName && <span className="mt-1 block text-xs text-danger">{errors.shortName}</span>}
          </Field>
          <Field label={t('courseModal.code')}>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('courseModal.codePh')} />
          </Field>
          <Field label={t('courseModal.ects')}>
            <Input inputMode="decimal" value={ects} onChange={(e) => setEcts(e.target.value)} />
            {errors.ects && <span className="mt-1 block text-xs text-danger">{errors.ects}</span>}
          </Field>
          <Field label={t('courseModal.teacher')}>
            <Input value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder={t('courseModal.teacherPh')} />
          </Field>
          <Field label={t('courseModal.target', { max: maxGrade })}>
            <Input inputMode="decimal" value={targetGrade} onChange={(e) => setTargetGrade(e.target.value)} />
            {errors.targetGrade && <span className="mt-1 block text-xs text-danger">{errors.targetGrade}</span>}
          </Field>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted">{t('courseModal.color')}</span>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t('courseModal.colorAria')}>
            {colorNames.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={courseColors[c].label}
                title={courseColors[c].label}
                onClick={() => setColor(c)}
                className="grid size-11 place-items-center rounded-full transition hover:bg-surface-2"
              >
                <span
                  className={cx(
                    'size-7 rounded-full transition',
                    courseColors[c].dot,
                    color === c ? 'ring-2 ring-fg ring-offset-2 ring-offset-surface' : 'opacity-75 hover:opacity-100',
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        <fieldset className="space-y-3 rounded-xl border border-line p-4">
          <legend className="px-1 text-xs font-medium text-muted">{t('courseModal.links')}</legend>
          <Field label={t('courseModal.notebook')}>
            <Input type="url" value={notebookUrl} onChange={(e) => setNotebookUrl(e.target.value)} placeholder={t('courseModal.notebookPh')} />
          </Field>
          <Field label={t('courseModal.drive')}>
            <Input type="url" value={driveFolderUrl} onChange={(e) => setDriveFolderUrl(e.target.value)} placeholder="https://drive.google.com/…" />
          </Field>
          <Field label={t('courseModal.portal')}>
            <Input type="url" value={clipUrl} onChange={(e) => setClipUrl(e.target.value)} placeholder="https://…" />
          </Field>
        </fieldset>
      </form>
    </Modal>
  );
}
