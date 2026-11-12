// Criar (manual) ou editar uma sessão de estudo.
import { useState } from 'react';
import { newId, useStore } from '../../store/useStore';
import type { Course, StudySession } from '../../types';
import { Button, Field, Input, Modal, Select } from '../ui';

interface SessionModalProps {
  courses: Course[];
  /** Sessão a editar; omitido = nova sessão manual. */
  session?: StudySession;
  defaultDate: string;
  onClose: () => void;
}

export default function SessionModal({ courses, session, defaultDate, onClose }: SessionModalProps) {
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
      title={editing ? 'Editar sessão' : 'Nova sessão'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            Guardar
          </Button>
        </>
      }
    >
      {!editing && (
        <>
          <Field label="Cadeira">
            <Select
              value={courseId}
              onChange={(e) => { setCourseId(e.target.value); setTopicId(''); }}
            >
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Tópico" hint="Opcional. Sem tópico, a sessão fica como estudo geral da cadeira.">
            <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">Estudo geral</option>
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
        <Field label="Data">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Início">
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
      </div>
      <Field label="Duração (minutos)" hint={minutesText && !minutesOk ? 'Indica entre 5 e 480 minutos.' : undefined}>
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
