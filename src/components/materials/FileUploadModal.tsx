import { Upload } from 'lucide-react';
import { useState } from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toFriendlyError } from '../../lib/errorMessages';
import { saveFile, formatBytes } from '../../lib/fileStorage';
import { showToast } from '../../lib/uiHelpers';
import { newId, useStore } from '../../store/useStore';
import type { Course, Material } from '../../types';
import LoadingUnis from '../brand/LoadingUnis';
import { Button, Field, Input, Modal, Select } from '../ui';

interface Props {
  initialCourseId?: string;
  onClose: () => void;
}

export default function FileUploadModal({ initialCourseId, onClose }: Props) {
  const { t } = useTranslation('courses');
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
      setError(t('materialsModals.upload.missingFile'));
      return;
    }
    if (!title.trim()) {
      setError(t('materialsModals.upload.missingTitle'));
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
      showToast(t('toast.fileUploaded', { title: material.title }), { tone: 'ok', effect: 'celebrate' });
      onClose();
    } catch (err: unknown) {
      const msg = toFriendlyError(err, t('materialsModals.upload.saveError'));
      setError(msg);
      showToast(msg, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={busy ? () => {} : onClose} title={t('materialsModals.upload.title')}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Zona de Drag & Drop */}
        <div
          role="button"
          tabIndex={0}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              document.getElementById('file-upload-input')?.click();
            }
          }}
          className={`flex min-h-11 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition cursor-pointer ${
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
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.markdown,.csv,.tsv,.json,.tex"
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
                {t('materialsModals.upload.dropTitle')}
              </p>
              <p className="text-xs text-muted">{t('materialsModals.upload.dropHint')}</p>
            </div>
          )}
        </div>

        <Field label={t('materialsModals.upload.titleLabel')}>
          <Input
            value={title}
            placeholder={t('materialsModals.upload.titlePlaceholder')}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <Field label={t('materialsModals.upload.courseLabel')}>
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">{t('materialsModals.upload.noCourse')}</option>
            {courses.map((c: Course) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        {busy && (
          <div className="rounded-2xl border border-line bg-surface-2/65 px-3 py-1.5">
            <LoadingUnis variant="materials" compact label={t('materialsModals.upload.saving')} />
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs font-medium text-coral-ink">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onClose} disabled={busy}>
            {t('materialsModals.upload.cancel')}
          </Button>
          <Button type="submit" variant="primary" loading={busy} disabled={busy || !file}>
            {busy ? t('materialsModals.upload.saving') : t('materialsModals.upload.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
