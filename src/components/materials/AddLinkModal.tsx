import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Field, Input, Modal, Select } from '../ui';
import { newId, useStore } from '../../store/useStore';
import { providerLabel } from '../../lib/colors';
import { detectProvider, parseWebUrl } from './meta';

export default function AddLinkModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('courses');
  const courses = useStore((s) => s.courses);
  const upsert = useStore((s) => s.upsert);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const trimmed = url.trim();
  const parsed = trimmed ? parseWebUrl(trimmed) : null;
  const provider = parsed ? detectProvider(trimmed) : null;
  const urlError = trimmed && !parsed ? t('materialsModals.addLink.invalidUrl') : null;
  const canSave = !!parsed && title.trim().length > 0;

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!parsed || !provider) {
      setError(t('materialsModals.addLink.invalidUrl'));
      return;
    }
    if (!title.trim()) {
      setError(t('materialsModals.addLink.missingTitle'));
      return;
    }
    upsert('materials', {
      id: newId(),
      courseId: courseId || undefined,
      title: title.trim(),
      url: parsed.toString(),
      provider,
      pinned: false,
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t('materialsModals.addLink.title')}
      footer={(
        <>
          <Button onClick={onClose}>{t('materialsModals.addLink.cancel')}</Button>
          <Button variant="primary" type="submit" form="add-link-form" disabled={!canSave}>{t('materialsModals.addLink.save')}</Button>
        </>
      )}
    >
      <form id="add-link-form" onSubmit={save} className="space-y-4">
        <Field label={t('materialsModals.addLink.urlLabel')} hint={urlError ? <span className="text-danger">{urlError}</span> : t('materialsModals.addLink.urlHint')}>
          <div className="flex items-center gap-2">
            <Input
              type="url"
              inputMode="url"
              autoFocus
              placeholder="https://"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(null); }}
              aria-invalid={!!urlError}
            />
          </div>
        </Field>
        {provider && (
          <div className="flex items-center gap-2 text-xs text-muted">
            {t('materialsModals.addLink.detectedProvider')} <Badge tone="accent">{providerLabel[provider]}</Badge>
          </div>
        )}
        <Field label={t('materialsModals.addLink.titleLabel')}>
          <Input placeholder={t('materialsModals.addLink.titlePlaceholder')} value={title} onChange={(e) => { setTitle(e.target.value); setError(null); }} />
        </Field>
        <Field label={t('materialsModals.addLink.courseLabel')}>
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">{t('materialsModals.addLink.noCourse')}</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
