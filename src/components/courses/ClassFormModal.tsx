import { useState } from 'react';
import type { FormEvent } from 'react';
import { weekdayLong } from '../../lib/colors';
import { newId, useStore } from '../../store/useStore';
import type { ClassSlot, ClassType, Course } from '../../types';
import { Button, Field, Input, Modal, Select } from '../ui';
import { weekOrder } from './helpers';

interface Props {
  course: Course;
  initialSlot?: ClassSlot;
  onClose: () => void;
}

const classTypes: ClassType[] = ['T', 'TP', 'P', 'OT'];
const classTypeLabel: Record<ClassType, string> = {
  T: 'Teórica (T)', TP: 'Teórico-prática (TP)', P: 'Prática (P)', OT: 'Orientação tutorial (OT)',
};

export default function ClassFormModal({ course, initialSlot, onClose }: Props) {
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
    if (!start || !end) return setError('Indique a hora de início e de fim.');
    if (end <= start) return setError('A hora de fim tem de ser depois do início.');
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
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initialSlot ? 'Editar aula' : 'Nova aula'}
      footer={
        <>
          {initialSlot && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                remove('classes', initialSlot.id);
                onClose();
              }}
            >
              Apagar
            </Button>
          )}
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="class-form">Guardar</Button>
        </>
      }
    >
      <form id="class-form" onSubmit={save} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <Select value={type} onChange={(e) => setType(e.target.value as ClassType)}>
              {classTypes.map((t) => <option key={t} value={t}>{classTypeLabel[t]}</option>)}
            </Select>
          </Field>
          <Field label="Dia da semana">
            <Select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
              {weekOrder.map((d) => <option key={d} value={d}>{weekdayLong[d]}</option>)}
            </Select>
          </Field>
          <Field label="Início">
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Fim">
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
          <Field label="Sala">
            <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="B2.04" />
          </Field>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
