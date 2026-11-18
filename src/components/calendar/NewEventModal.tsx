// Modal para criar um evento pessoal ou uma avaliação local.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { kindLabel } from '../../lib/colors';
import { newId, useStore } from '../../store/useStore';
import type { AssessmentKind, CalendarEvent } from '../../types';
import { Button, DateTimeField, Field, Input, Modal, Select } from '../ui';
import { cx } from '../../lib/uiHelpers';

type Mode = 'evento' | 'avaliacao';

const KINDS: AssessmentKind[] = ['teste', 'exame', 'trabalho', 'projeto', 'quiz'];

/** yyyy-MM-ddTHH:mm (valor de datetime-local) -> ISO com segundos. */
const toIso = (v: string) => (v.length === 16 ? `${v}:00` : v);
const toLocalInput = (iso: string | undefined, fallback: string) =>
  iso && iso.length >= 16 ? iso.slice(0, 16) : fallback;

interface Props {
  defaultDate: string;
  event?: CalendarEvent;
  onClose: () => void;
}

export default function NewEventModal({ defaultDate, event, onClose }: Props) {
  const { t } = useTranslation('plan');
  const courses = useStore((s) => s.courses);
  const upsert = useStore((s) => s.upsert);
  const editingEvent = Boolean(event);

  const [mode, setMode] = useState<Mode>('evento');
  const [title, setTitle] = useState(event?.title ?? '');
  const [error, setError] = useState<string | null>(null);

  // Evento
  const [start, setStart] = useState(() =>
    toLocalInput(event?.start, `${defaultDate}T09:00`),
  );
  const [end, setEnd] = useState(() =>
    toLocalInput(event?.end, `${defaultDate}T10:00`),
  );
  const [location, setLocation] = useState(event?.location ?? '');
  const [eventCourse, setEventCourse] = useState(event?.courseId ?? '');

  // Avaliação
  const [avCourse, setAvCourse] = useState(courses[0]?.id ?? '');
  const [kind, setKind] = useState<AssessmentKind>('teste');
  const [date, setDate] = useState(`${defaultDate}T09:00`);
  const [weight, setWeight] = useState('10');

  const save = () => {
    if (!title.trim()) { setError(t('newEvent.needTitle')); return; }
    if (mode === 'evento') {
      if (!start || !end) { setError(t('newEvent.needTimes')); return; }
      if (end < start) { setError(t('newEvent.endAfter')); return; }
      upsert('events', {
        id: event?.id ?? newId(),
        title: title.trim(),
        start: toIso(start),
        end: toIso(end),
        source: event?.source ?? 'local',
        location: location.trim() || undefined,
        courseId: eventCourse || undefined,
      });
    } else {
      if (!avCourse) { setError(t('newEvent.needCourse')); return; }
      if (!date) { setError(t('newEvent.needDate')); return; }
      const w = Number(weight);
      if (!Number.isFinite(w) || w < 0 || w > 100) { setError(t('newEvent.weightRange')); return; }
      upsert('assessments', {
        id: newId(),
        courseId: avCourse,
        kind,
        title: title.trim(),
        date: toIso(date),
        weight: w,
        topicIds: [],
        source: 'local',
      });
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editingEvent ? t('cal.editEvent') : t('newEvent.title')}
      footer={
        <>
          <Button onClick={onClose}>{t('newEvent.cancel')}</Button>
          <Button variant="primary" onClick={save}>{t('newEvent.save')}</Button>
        </>
      }
    >
      {!editingEvent && (
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="group" aria-label={t('newEvent.type')}>
          {(['evento', 'avaliacao'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => { setMode(m); setError(null); }}
              className={cx(
                'min-h-11 rounded-lg text-sm font-medium transition',
                mode === m ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
              )}
            >
              {m === 'evento' ? t('newEvent.event') : t('newEvent.assessment')}
            </button>
          ))}
        </div>
      )}

      <Field label={t('newEvent.titleLabel')}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={mode === 'evento' ? t('newEvent.phEvent') : t('newEvent.phTest')} autoFocus />
      </Field>

      {mode === 'evento' ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('newEvent.start')}>
              <DateTimeField aria-label={t('newEvent.startAria')} value={start} onChange={setStart} />
            </Field>
            <Field label={t('newEvent.end')}>
              <DateTimeField aria-label={t('newEvent.endAria')} value={end} onChange={setEnd} />
            </Field>
          </div>
          <Field label={t('newEvent.place')} hint={t('newEvent.optional')}>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('newEvent.placePh')} />
          </Field>
          <Field label={t('newEvent.course')} hint={t('newEvent.optional')}>
            <Select value={eventCourse} onChange={(e) => setEventCourse(e.target.value)}>
              <option value="">{t('newEvent.noCourse')}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.shortName}</option>
              ))}
            </Select>
          </Field>
        </>
      ) : courses.length === 0 ? (
        <p className="text-sm text-muted">{t('newEvent.createCourse')}</p>
      ) : (
        <>
          <Field label={t('newEvent.course')}>
            <Select value={avCourse} onChange={(e) => setAvCourse(e.target.value)}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.shortName}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('newEvent.type')}>
              <Select value={kind} onChange={(e) => setKind(e.target.value as AssessmentKind)}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>{kindLabel[k]}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('newEvent.weight')}>
              <Input type="number" min={0} max={100} step={1} value={weight} onChange={(e) => setWeight(e.target.value)} />
            </Field>
          </div>
          <Field label={t('newEvent.dateTime')}>
            <DateTimeField aria-label={t('newEvent.dateTimeAria')} value={date} onChange={setDate} />
          </Field>
        </>
      )}

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
