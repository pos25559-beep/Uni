// Modal para criar um evento pessoal ou uma avaliação local.
import { useState } from 'react';
import { kindLabel } from '../../lib/colors';
import { newId, useStore } from '../../store/useStore';
import type { AssessmentKind } from '../../types';
import { Button, Field, Input, Modal, Select, cx } from '../ui';

type Mode = 'evento' | 'avaliacao';

const KINDS: AssessmentKind[] = ['teste', 'exame', 'trabalho', 'projeto', 'quiz'];

/** yyyy-MM-ddTHH:mm (valor de datetime-local) -> ISO com segundos. */
const toIso = (v: string) => (v.length === 16 ? `${v}:00` : v);

interface Props {
  defaultDate: string;
  onClose: () => void;
}

export default function NewEventModal({ defaultDate, onClose }: Props) {
  const courses = useStore((s) => s.courses);
  const upsert = useStore((s) => s.upsert);

  const [mode, setMode] = useState<Mode>('evento');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Evento
  const [start, setStart] = useState(`${defaultDate}T09:00`);
  const [end, setEnd] = useState(`${defaultDate}T10:00`);
  const [location, setLocation] = useState('');
  const [eventCourse, setEventCourse] = useState('');

  // Avaliação
  const [avCourse, setAvCourse] = useState(courses[0]?.id ?? '');
  const [kind, setKind] = useState<AssessmentKind>('teste');
  const [date, setDate] = useState(`${defaultDate}T09:00`);
  const [weight, setWeight] = useState('10');

  const save = () => {
    if (!title.trim()) { setError('Indica um título.'); return; }
    if (mode === 'evento') {
      if (!start || !end) { setError('Indica o início e o fim.'); return; }
      if (end < start) { setError('O fim tem de ser depois do início.'); return; }
      upsert('events', {
        id: newId(),
        title: title.trim(),
        start: toIso(start),
        end: toIso(end),
        source: 'local',
        location: location.trim() || undefined,
        courseId: eventCourse || undefined,
      });
    } else {
      if (!avCourse) { setError('Escolhe a cadeira da avaliação.'); return; }
      if (!date) { setError('Indica a data da avaliação.'); return; }
      const w = Number(weight);
      if (!Number.isFinite(w) || w < 0 || w > 100) { setError('O peso tem de estar entre 0 e 100%.'); return; }
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
      title="Novo evento"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save}>Guardar</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="group" aria-label="Tipo">
        {(['evento', 'avaliacao'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => { setMode(m); setError(null); }}
            className={cx(
              'h-8 rounded-lg text-sm font-medium transition',
              mode === m ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
            )}
          >
            {m === 'evento' ? 'Evento' : 'Avaliação'}
          </button>
        ))}
      </div>

      <Field label="Título">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={mode === 'evento' ? 'Ex.: Reunião de grupo' : 'Ex.: Teste 1'} autoFocus />
      </Field>

      {mode === 'evento' ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Início">
              <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Fim">
              <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
          <Field label="Local" hint="Opcional">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Biblioteca, sala 2.14" />
          </Field>
          <Field label="Cadeira" hint="Opcional">
            <Select value={eventCourse} onChange={(e) => setEventCourse(e.target.value)}>
              <option value="">Sem cadeira</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.shortName}</option>
              ))}
            </Select>
          </Field>
        </>
      ) : courses.length === 0 ? (
        <p className="text-sm text-muted">Cria primeiro uma cadeira para poderes registar avaliações.</p>
      ) : (
        <>
          <Field label="Cadeira">
            <Select value={avCourse} onChange={(e) => setAvCourse(e.target.value)}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.shortName}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tipo">
              <Select value={kind} onChange={(e) => setKind(e.target.value as AssessmentKind)}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>{kindLabel[k]}</option>
                ))}
              </Select>
            </Field>
            <Field label="Peso (%)">
              <Input type="number" min={0} max={100} step={1} value={weight} onChange={(e) => setWeight(e.target.value)} />
            </Field>
          </div>
          <Field label="Data e hora">
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </>
      )}

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
