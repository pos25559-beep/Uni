import { format, addDays } from 'date-fns';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { kindLabel } from '../../lib/colors';
import { newId, useStore } from '../../store/useStore';
import type { Assessment, AssessmentKind, Course } from '../../types';
import { showToast } from '../../lib/uiHelpers';
import { Button, DateField, Field, Input, Modal, Select, Textarea, TimeField } from '../ui';
import { fromDatetimeLocal } from './helpers';

interface Props {
  course: Course;
  /** Avaliação a editar; omitir para criar uma nova. */
  assessment?: Assessment;
  onClose: () => void;
}

const kinds = Object.keys(kindLabel) as AssessmentKind[];

export default function AssessmentFormModal({ course, assessment, onClose }: Props) {
  const { t } = useTranslation(['courses', 'common']);
  const upsert = useStore((s) => s.upsert);
  const [kind, setKind] = useState<AssessmentKind>(assessment?.kind ?? 'teste');
  const [title, setTitle] = useState(assessment?.title ?? '');
  const [datePart, setDatePart] = useState(() =>
    assessment ? assessment.date.slice(0, 10) : format(addDays(new Date(), 7), 'yyyy-MM-dd'),
  );
  const [timePart, setTimePart] = useState(() =>
    assessment && assessment.date.includes('T') && /^([01]\d|2[0-3]):([0-5]\d)$/.test(assessment.date.slice(11, 16))
      ? assessment.date.slice(11, 16)
      : '09:00',
  );
  const [weight, setWeight] = useState(String(assessment?.weight ?? 20));
  const [location, setLocation] = useState(assessment?.location ?? '');
  const [notes, setNotes] = useState(assessment?.notes ?? '');
  const [topicIds, setTopicIds] = useState<string[]>(assessment?.topicIds ?? []);
  const [error, setError] = useState<string | null>(null);

  const toggleTopic = (id: string) =>
    setTopicIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const save = (e: FormEvent) => {
    e.preventDefault();
    const w = Number(weight.replace(',', '.'));
    if (!title.trim()) return setError(t('assessForm.errTitle'));
    if (!datePart) return setError(t('assessForm.errDate'));
    if (!Number.isFinite(w) || w < 0 || w > 100) return setError(t('assessForm.errWeight'));
    setError(null);
    const opt = (v: string) => v.trim() || undefined;
    const item: Assessment = {
      id: assessment?.id ?? newId(),
      courseId: course.id,
      kind,
      title: title.trim(),
      date: fromDatetimeLocal(`${datePart}T${timePart || '09:00'}`),
      weight: w,
      grade: assessment?.grade,
      topicIds,
      location: opt(location),
      notes: opt(notes),
      source: assessment?.source ?? 'local',
    };
    upsert('assessments', item);
    showToast(
      t(assessment ? 'toast.assessUpdated' : 'toast.assessCreated', { title: item.title }),
      { tone: 'ok', effect: 'celebrate' },
    );
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={assessment ? t('assessForm.editTitle') : t('assessForm.newTitle')}
      footer={
        <>
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button variant="primary" type="submit" form="assessment-form">{t('common:actions.save')}</Button>
        </>
      }
    >
      <form id="assessment-form" onSubmit={save} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('assessForm.kind')}>
            <Select value={kind} onChange={(e) => setKind(e.target.value as AssessmentKind)}>
              {kinds.map((k) => <option key={k} value={k}>{kindLabel[k]}</option>)}
            </Select>
          </Field>
          <Field label={t('assessForm.weight')}>
            <Input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('assessForm.titleLabel')}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('assessForm.titlePh')} />
            </Field>
          </div>
          <Field label={t('assessForm.dateOnly')}>
            <DateField aria-label={t('assessForm.dateAria')} value={datePart} onChange={setDatePart} />
          </Field>
          <Field label={t('assessForm.time')}>
            <TimeField aria-label={t('assessForm.timeAria')} value={timePart} onChange={setTimePart} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('assessForm.location')}>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('assessForm.locationPh')} />
            </Field>
          </div>
        </div>

        <Field label={t('assessForm.notes')}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-muted">{t('assessForm.topicsLegend')}</legend>
          {course.topics.length === 0 ? (
            <p className="text-xs text-muted">{t('assessForm.noTopicsHint')}</p>
          ) : (
            <div className="grid max-h-48 gap-1.5 overflow-y-auto rounded-xl border border-line p-2 sm:grid-cols-2">
              {course.topics.map((topic) => (
                <label key={topic.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                  <input
                    type="checkbox"
                    checked={topicIds.includes(topic.id)}
                    onChange={() => toggleTopic(topic.id)}
                    className="size-4 accent-[var(--accent)]"
                  />
                  <span className="truncate">{topic.title}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
