import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { weekdayLong } from '../../lib/colors';
import { newId, useStore } from '../../store/useStore';
import type { ClassSlot, ClassType, Course } from '../../types';
import { showToast } from '../../lib/uiHelpers';
import { Button, Field, Input, Modal, Select, TimeField } from '../ui';
import { weekOrder } from './helpers';

interface Props {
  course: Course;
  initialSlot?: ClassSlot;
  onClose: () => void;
}

const classTypes: ClassType[] = ['T', 'TP', 'P', 'OT'];

export default function ClassFormModal({ course, initialSlot, onClose }: Props) {
  const { t } = useTranslation(['courses', 'common']);
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const [type, setType] = useState<ClassType>(initialSlot?.type ?? 'T');
  const [weekday, setWeekday] = useState(initialSlot?.weekday ?? 1);
  const [start, setStart] = useState(initialSlot?.start ?? '09:00');
  const [end, setEnd] = useState(initialSlot?.end ?? '10:30');
  const [room, setRoom] = useState(initialSlot?.room ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!start || !end) return setError(t('classModal.errTimes'));
    if (end <= start) return setError(t('classModal.errOrder'));
    setError(null);
    const item: ClassSlot = {
      id: initialSlot?.id ?? newId(),
      courseId: course.id,
      type,
      weekday,
      start,
      end,
      room: room.trim() || undefined,
      source: initialSlot?.source ?? 'local',
    };
    upsert('classes', item);
    showToast(t('toast.classSaved'), 'ok');
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initialSlot ? t('classModal.editTitle') : t('classModal.newTitle')}
      footer={
        <>
          {initialSlot && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                remove('classes', initialSlot.id);
                showToast(t('toast.classDeleted'), 'neutral');
                onClose();
              }}
            >
              {t('common:actions.delete')}
            </Button>
          )}
          <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
          <Button variant="primary" type="submit" form="class-form">{t('common:actions.save')}</Button>
        </>
      }
    >
      <form id="class-form" onSubmit={save} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('classModal.kind')}>
            <Select value={type} onChange={(e) => setType(e.target.value as ClassType)}>
              {classTypes.map((ct) => <option key={ct} value={ct}>{t(`classModal.types.${ct}`)}</option>)}
            </Select>
          </Field>
          <Field label={t('classModal.weekday')}>
            <Select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
              {weekOrder.map((d) => <option key={d} value={d}>{weekdayLong[d]}</option>)}
            </Select>
          </Field>
          <Field label={t('classModal.start')}>
            <TimeField aria-label={t('classModal.startAria')} value={start} onChange={setStart} />
          </Field>
          <Field label={t('classModal.end')}>
            <TimeField aria-label={t('classModal.endAria')} value={end} onChange={setEnd} />
          </Field>
          <Field label={t('classModal.room')}>
            <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder={t('classModal.roomPh')} />
          </Field>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
