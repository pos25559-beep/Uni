import { Download, ExternalLink, Pin, PinOff, Trash2 } from 'lucide-react';
import { createElement, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Select } from '../ui';
import { cx, showToast } from '../../lib/uiHelpers';
import { ConfirmModal } from '../courses/ConfirmModal';
import { useStore } from '../../store/useStore';
import { courseColors, providerLabel } from '../../lib/colors';
import { getFileUrl, formatBytes, deleteFile } from '../../lib/fileStorage';
import type { Course, Material } from '../../types';
import { materialIcon, relativeDate, safeHref } from './meta';

export default function MaterialRow({ material: m, courses, course, onView }: {
  material: Material;
  courses: Course[];
  course: Course | undefined;
  onView?: (m: Material) => void;
}) {
  const { t } = useTranslation('courses');
  const patch = useStore((s) => s.patch);
  const remove = useStore((s) => s.remove);

  const [confirming, setConfirming] = useState(false);

  const href = safeHref(m.url);
  const modified = relativeDate(m.modifiedAt);

  const handleOpen = async () => {
    if (onView) {
      onView(m);
      return;
    }
    if (m.url && (m.url.startsWith('/') || m.url.startsWith('http://') || m.url.startsWith('https://'))) {
      window.open(m.url, '_blank');
      return;
    }
    if (m.provider === 'upload') {
      const blobUrl = await getFileUrl(m.id);
      if (blobUrl) window.open(blobUrl, '_blank');
      else showToast(t('materialsModals.row.fileNotFound'), 'danger');
    } else if (href) {
      window.open(href, '_blank');
    }
  };

  const handleRemove = async () => {
    if (m.provider === 'upload') {
      await deleteFile(m.id).catch(() => {});
    }
    remove('materials', m.id);
  };

  return (
    <li className="flex gap-3 px-4 py-3">
      <div className={cx(
        'grid size-10 shrink-0 place-items-center rounded-xl',
        course ? courseColors[course.color].soft : 'bg-surface-2 text-muted',
      )}
      >
        {createElement(materialIcon(m), { size: 18 })}
      </div>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={handleOpen}
          className="group flex min-h-11 min-w-0 items-center gap-1.5 text-left text-sm font-medium text-fg hover:text-accent"
        >
          <span className="truncate">{m.title}</span>
          {m.provider === 'upload' ? (
            <Download size={12} className="shrink-0 text-muted opacity-70 group-hover:opacity-100" />
          ) : (
            <ExternalLink size={12} className="shrink-0 text-muted opacity-0 transition group-hover:opacity-100" />
          )}
        </button>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <Badge>{providerLabel[m.provider]}</Badge>
          {m.fileName && <span className="text-fg/80">{m.fileName}</span>}
          {m.fileSize && <span>({formatBytes(m.fileSize)})</span>}
          {modified && <span>{t('materialsModals.row.modified', { time: modified })}</span>}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="w-44 max-w-full">
            <Select
              aria-label={t('materialsModals.row.courseAria', { title: m.title })}
              value={m.courseId ?? ''}
              onChange={(e) => patch('materials', m.id, { courseId: e.target.value || undefined })}
            >
              <option value="">{t('materialsModals.row.noCourse')}</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => patch('materials', m.id, { pinned: !m.pinned })}
            aria-pressed={!!m.pinned}
          >
            {m.pinned ? <PinOff size={14} /> : <Pin size={14} />}
            {m.pinned ? t('materialsModals.row.unpin') : t('materialsModals.row.pin')}
          </Button>
          <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
            <Trash2 size={14} />
            {t('materialsModals.row.remove')}
          </Button>
        </div>
      </div>

      {confirming && (
        <ConfirmModal
          title={t('materialsModals.row.removeTitle')}
          message={t('materialsModals.row.removeConfirm', { title: m.title })}
          confirmLabel={t('materialsModals.row.remove')}
          onConfirm={handleRemove}
          onClose={() => setConfirming(false)}
        />
      )}
    </li>
  );
}
