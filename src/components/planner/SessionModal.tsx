// Criar (manual) ou editar uma sessão de estudo.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { newId, useStore } from '../../store/useStore';
import type { Course, StudySession } from '../../types';
import { Button, DateField, Field, Input, Modal, Select, TimeField } from '../ui';

interface SessionModalProps {
  courses: Course[];
  /** Sessão a editar; omitido = nova sessão manual. */
  session?: StudySession;
  defaultDate: string;
  onClose: () => void;
}

export default function SessionModal({ courses, session, defaultDate, onClose }: SessionModalProps) {
  const { t } = useTranslation('plan');
  const upsert = useStore((s) => s.upsert);
  const editing = Boolean(session);

  const [courseId, setCourseId] = useState(session?.courseId ?? courses[0]?.id ?? '');
  const [topicId, setTopicId] = useState(session?.topicId ?? '');
  const [date, setDate] = useState(session?.date ?? defaultDate);
  const [start, setStart] = useState(session?.start ?? '17:00');
  const [minutesText, setMinutesText] = useState(String(session?.minutes ?? 50));

  const course = courses.find((c) => c.id === courseId);
  const minutes = Number(minutesText);
  const minutesOk = Number.isInteger(minutes) && minutes >= 5 && minutes <= 480;
  const valid = Boolean(course) && minutesOk && date.length === 10;

  const save = () => {
    if (!valid || !course) return;
    const base: StudySession = session ?? {
      id: newId(),
      courseId: course.id,
      date,
      minutes,
      done: false,
      generated: false,
    };
    upsert('sessions', {
      ...base,
      courseId: course.id,
      topicId: editing ? base.topicId : (topicId || undefined),
      date,
      start: start || undefined,
      minutes,
      // Uma sessão editada passa a ser "manual": não é substituída ao regenerar o plano.
      generated: false,
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? t('session.edit') : t('session.new')}
      footer={
        <>
          <Button onClick={onClose}>{t('session.cancel')}</Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            {t('session.save')}
          </Button>
        </>
      }
    >
      {!editing && (
        <>
          <Field label={t('session.course')}>
            <Select
              value={courseId}
              onChange={(e) => { setCourseId(e.target.value); setTopicId(''); }}
            >
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label={t('session.topic')} hint={t('session.topicHint')}>
            <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">{t('session.general')}</option>
              {course?.topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </Select>
          </Field>
        </>
      )}
      {editing && course && (
        <p className="text-sm text-muted">
          <span className="font-medium text-fg">{course.name}</span>
          {session?.topicId && course.topics.find((t) => t.id === session.topicId)
            ? ` · ${course.topics.find((t) => t.id === session.topicId)?.title}`
            : ''}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('session.date')}>
          <DateField aria-label={t('session.dateAria')} value={date} onChange={setDate} />
        </Field>
        <Field label={t('session.start')}>
          <TimeField aria-label={t('session.startAria')} value={start} onChange={setStart} />
        </Field>
      </div>
      <Field label={t('session.duration')} hint={minutesText && !minutesOk ? t('session.durationHint') : undefined}>
        <Input
          type="number"
          inputMode="numeric"
          min={5}
          max={480}
          step={5}
          value={minutesText}
          onChange={(e) => setMinutesText(e.target.value)}
        />
      </Field>
    </Modal>
  );
}
