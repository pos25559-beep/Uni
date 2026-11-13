import { Upload } from 'lucide-react';
import { useState } from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import { saveFile, formatBytes } from '../../lib/fileStorage';
import { newId, useStore } from '../../store/useStore';
import type { Course, Material } from '../../types';
import { Button, Field, Input, Modal, Select } from '../ui';

interface Props {
  initialCourseId?: string;
  onClose: () => void;
}

export default function FileUploadModal({ initialCourseId, onClose }: Props) {
  const courses = useStore((s) => s.courses);
  const upsert = useStore((s) => s.upsert);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState(initialCourseId || (courses[0]?.id ?? ''));
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFileSelected = (selected: File | null) => {
    if (!selected) return;
    setFile(selected);
    if (!title.trim()) {
      // Remove extensão do nome por omissão
      setTitle(selected.name.replace(/\.[^/.]+$/, ''));
    }
    setError(null);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Seleciona um ficheiro (PDF, slides, etc.).');
      return;
    }
    if (!title.trim()) {
      setError('Indica um título para o material.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const id = newId();
      await saveFile(id, file);

      const material: Material = {
        id,
        courseId: courseId || undefined,
        title: title.trim(),
        url: `blob:${id}`,
        provider: 'upload',
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        modifiedAt: new Date().toISOString(),
      };

      upsert('materials', material);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao guardar ficheiro.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Carregar ficheiro (PDF, Slides, Ficha)">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Zona de Drag & Drop */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition cursor-pointer ${
            isDragging
              ? 'border-accent bg-accent-soft'
              : 'border-line bg-surface-2 hover:border-muted'
          }`}
          onClick={() => document.getElementById('file-upload-input')?.click()}
        >
          <input
            id="file-upload-input"
            type="file"
            className="hidden"
            accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.zip"
            onChange={(e: ChangeEvent<HTMLInputElement>) => onFileSelected(e.target.files?.[0] ?? null)}
          />

          <div className="grid size-10 place-items-center rounded-xl bg-surface border border-line text-accent mb-2">
            <Upload size={20} />
          </div>

          {file ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-fg">{file.name}</p>
              <p className="text-xs text-muted">{formatBytes(file.size)}</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-medium text-fg">
                Arrasta um PDF ou apresentação para aqui
              </p>
              <p className="text-xs text-muted">ou clica para escolher do teu computador</p>
            </div>
          )}
        </div>

        <Field label="Título">
          <Input
            value={title}
            placeholder="Ex.: Slides Aula 4 - Mecânica de Fluidos"
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <Field label="Cadeira">
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Sem cadeira (Geral)</option>
            {courses.map((c: Course) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !file}>
            {busy ? 'A guardar…' : 'Adicionar ficheiro'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
