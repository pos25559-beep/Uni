import { HardDrive, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { formatBytes } from '../../lib/fileStorage';
import { Badge, Button, Modal } from '../ui';
import DeviceImportModal from '../materials/DeviceImportModal';

export default function DeviceStorageCard() {
  const { t } = useTranslation('settings');
  const materials = useStore((s) => s.materials);
  const courses = useStore((s) => s.courses);
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');
  const remove = useStore((s) => s.remove);

  const [importOpen, setImportOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const exampleFolders = useMemo(() => {
    if (courses.length === 0) return 'Calculo/, Fisica/, Economia/';
    return courses
      .slice(0, 3)
      .map((c) => `${c.shortName || c.name}/`)
      .join(', ');
  }, [courses]);

  const localMaterials = useMemo(
    () => (Array.isArray(materials) ? materials.filter((m) => m.provider === 'upload') : []),
    [materials],
  );

  const totalBytes = useMemo(
    () => localMaterials.reduce((acc, m) => acc + (m.fileSize || 0), 0),
    [localMaterials],
  );

  const handleClearAll = () => {
    for (const m of localMaterials) {
      remove('materials', m.id);
    }
    setConfirmClear(false);
  };

  return (
    <>
      <section
        className={
          isMinimal
            ? 'space-y-4 rounded-[22px] border border-line bg-surface p-5 shadow-card'
            : 'space-y-4 overflow-hidden rounded-[26px] border border-line/70 bg-surface p-5 shadow-card'
        }
      >
        <div
          className={
            isMinimal
              ? 'flex items-start justify-between gap-3'
              : '-mx-5 -mt-5 flex items-start justify-between gap-3 border-b border-line/60 bg-pastel-mint/45 px-5 py-4 dark:bg-surface-2'
          }
        >
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-surface text-accent-ink shadow-card dark:bg-black/25 dark:text-accent">
              <HardDrive size={20} />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-fg">
                {t('deviceStorage.title')}
              </h3>
              <p className="text-xs text-muted">
                {t('deviceStorage.desc')}
              </p>
            </div>
          </div>

          <Badge tone="accent">{t('deviceStorage.activeBadge')}</Badge>
        </div>

        <div className="rounded-2xl border border-line/80 bg-surface-2/45 p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-fg text-sm tabular">
                {t('deviceStorage.fileCount', { count: localMaterials.length })}
              </p>
              <p className="text-muted text-xs tabular">
                {t('deviceStorage.totalSpace', { size: formatBytes(totalBytes) })}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={() => setImportOpen(true)}>
                <Upload size={13} />
                {t('deviceStorage.importBtn')}
              </Button>

              {localMaterials.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmClear(true)}
                  className="text-danger hover:text-danger"
                >
                  <Trash2 size={13} />
                  {t('deviceStorage.clearBtn')}
                </Button>
              )}
            </div>
          </div>

          <p className="text-muted leading-relaxed">
            {t('deviceStorage.tipBefore')}{' '}
            <strong>{t('deviceStorage.tipStrong')}</strong>{' '}
            {t('deviceStorage.tipMiddle')} <span className="font-mono">{exampleFolders}</span>
            {t('deviceStorage.tipAfter')}
          </p>
        </div>
      </section>

      {importOpen && <DeviceImportModal onClose={() => setImportOpen(false)} />}

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title={t('deviceStorage.confirmTitle')}
        footer={
          <>
            <Button onClick={() => setConfirmClear(false)}>{t('deviceStorage.cancel')}</Button>
            <Button variant="danger" onClick={handleClearAll}>
              {t('deviceStorage.confirmRemove')}
            </Button>
          </>
        }
      >
        <p className="text-xs text-muted">
          {t('deviceStorage.confirmBody', { count: localMaterials.length })}
        </p>
      </Modal>
    </>
  );
}
