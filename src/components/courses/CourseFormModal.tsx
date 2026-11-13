import { useState } from 'react';
import type { FormEvent } from 'react';
import { courseColors, colorNames } from '../../lib/colors';
import { newId, useStore } from '../../store/useStore';
import type { Course, CourseColor } from '../../types';
import { Button, cx, Field, Input, Modal } from '../ui';

interface Props {
  /** Cadeira a editar; omitir para criar uma nova. */
  course?: Course;
  onClose: () => void;
}

const parseNumber = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')));

export default function CourseFormModal({ course, onClose }: Props) {
  const upsert = useStore((s) => s.upsert);
  const [code, setCode] = useState(course?.code ?? '');
  const [name, setName] = useState(course?.name ?? '');
  const [shortName, setShortName] = useState(course?.shortName ?? '');
  const [ects, setEcts] = useState(String(course?.ects ?? 6));
  const [teacher, setTeacher] = useState(course?.teacher ?? '');
  const [targetGrade, setTargetGrade] = useState(String(course?.targetGrade ?? 10));
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
    if (!name.trim()) next.name = 'Indique o nome da cadeira.';
    if (!shortName.trim()) next.shortName = 'Indique um nome curto.';
    if (!Number.isFinite(ectsNum) || ectsNum < 0) next.ects = 'Valor inválido.';
    if (!Number.isFinite(targetNum) || targetNum < 0 || targetNum > 20) next.targetGrade = 'Entre 0 e 20.';
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
      title={course ? 'Editar cadeira' : 'Nova cadeira'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="course-form">Guardar</Button>
        </>
      }
    >
      <form id="course-form" onSubmit={save} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome *">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Algoritmos e Estruturas de Dados" />
            {errors.name && <span className="mt-1 block text-xs text-danger">{errors.name}</span>}
          </Field>
          <Field label="Nome curto *">
            <Input value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="AED" />
            {errors.shortName && <span className="mt-1 block text-xs text-danger">{errors.shortName}</span>}
          </Field>
          <Field label="Código">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="M3112" />
          </Field>
          <Field label="ECTS">
            <Input inputMode="decimal" value={ects} onChange={(e) => setEcts(e.target.value)} />
            {errors.ects && <span className="mt-1 block text-xs text-danger">{errors.ects}</span>}
          </Field>
          <Field label="Docente">
            <Input value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="Prof. Nome" />
          </Field>
          <Field label="Objetivo (0–20)">
            <Input inputMode="decimal" value={targetGrade} onChange={(e) => setTargetGrade(e.target.value)} />
            {errors.targetGrade && <span className="mt-1 block text-xs text-danger">{errors.targetGrade}</span>}
          </Field>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted">Cor</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor da cadeira">
            {colorNames.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                onClick={() => setColor(c)}
                className={cx(
                  'size-7 rounded-full transition',
                  courseColors[c].dot,
                  color === c ? 'ring-2 ring-fg ring-offset-2 ring-offset-surface' : 'opacity-70 hover:opacity-100',
                )}
              />
            ))}
          </div>
        </div>

        <fieldset className="space-y-3 rounded-xl border border-line p-4">
          <legend className="px-1 text-xs font-medium text-muted">Ligações</legend>
          <Field label="NotebookLM">
            <Input type="url" value={notebookUrl} onChange={(e) => setNotebookUrl(e.target.value)} placeholder="https://notebooklm.google.com/…" />
          </Field>
          <Field label="Pasta no Google Drive">
            <Input type="url" value={driveFolderUrl} onChange={(e) => setDriveFolderUrl(e.target.value)} placeholder="https://drive.google.com/…" />
          </Field>
          <Field label="CLIP">
            <Input type="url" value={clipUrl} onChange={(e) => setClipUrl(e.target.value)} placeholder="https://clip.…" />
          </Field>
        </fieldset>
      </form>
    </Modal>
  );
}
