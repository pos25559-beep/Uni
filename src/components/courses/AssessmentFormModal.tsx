import { format, addDays } from 'date-fns';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { kindLabel } from '../../lib/colors';
import { newId, useStore } from '../../store/useStore';
import type { Assessment, AssessmentKind, Course } from '../../types';
import { Button, Field, Input, Modal, Select, Textarea } from '../ui';
import { fromDatetimeLocal, toDatetimeLocal } from './helpers';

interface Props {
  course: Course;
  /** Avaliação a editar; omitir para criar uma nova. */
  assessment?: Assessment;
  onClose: () => void;
}

const kinds = Object.keys(kindLabel) as AssessmentKind[];

export default function AssessmentFormModal({ course, assessment, onClose }: Props) {
  const upsert = useStore((s) => s.upsert);
  const [kind, setKind] = useState<AssessmentKind>(assessment?.kind ?? 'teste');
  const [title, setTitle] = useState(assessment?.title ?? '');
  const [date, setDate] = useState(
    assessment ? toDatetimeLocal(assessment.date) : format(addDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm"),
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
    if (!title.trim()) return setError('Indique o título da avaliação.');
    if (!date) return setError('Indique a data.');
    if (!Number.isFinite(w) || w < 0 || w > 100) return setError('O peso deve estar entre 0 e 100%.');
    setError(null);
    const opt = (v: string) => v.trim() || undefined;
    const item: Assessment = {
      id: assessment?.id ?? newId(),
      courseId: course.id,
      kind,
      title: title.trim(),
      date: fromDatetimeLocal(date),
      weight: w,
      grade: assessment?.grade,
      topicIds,
      location: opt(location),
      notes: opt(notes),
      source: assessment?.source ?? 'local',
    };
    upsert('assessments', item);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={assessment ? 'Editar avaliação' : 'Nova avaliação'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="assessment-form">Guardar</Button>
        </>
      }
    >
      <form id="assessment-form" onSubmit={save} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <Select value={kind} onChange={(e) => setKind(e.target.value as AssessmentKind)}>
              {kinds.map((k) => <option key={k} value={k}>{kindLabel[k]}</option>)}
            </Select>
          </Field>
          <Field label="Peso (%)">
            <Input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </Field>
          <Field label="Título *">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Teste 1" />
          </Field>
          <Field label="Data e hora *">
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Local">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Anf. III" />
          </Field>
        </div>

        <Field label="Notas">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-muted">Tópicos cobertos</legend>
          {course.topics.length === 0 ? (
            <p className="text-xs text-muted">Ainda não há tópicos. Acrescenta-os no separador Matéria.</p>
          ) : (
            <div className="grid max-h-48 gap-1.5 overflow-y-auto rounded-xl border border-line p-2 sm:grid-cols-2">
              {course.topics.map((t) => (
                <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                  <input
                    type="checkbox"
                    checked={topicIds.includes(t.id)}
                    onChange={() => toggleTopic(t.id)}
                    className="size-4 accent-[var(--accent)]"
                  />
                  <span className="truncate">{t.title}</span>
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
