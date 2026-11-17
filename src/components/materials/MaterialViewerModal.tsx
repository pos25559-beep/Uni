import { ExternalLink, HardDrive, FolderOpen, FileText, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Material } from '../../types';
import { Badge, Button } from '../ui';
import { providerLabel } from '../../lib/colors';
import { getFileUrl } from '../../lib/fileStorage';
import { googleService } from '../../services/googleService';

interface Props {
  material: Material;
  onClose: () => void;
}

export default function MaterialViewerModal({ material, onClose }: Props) {
  const { t } = useTranslation('courses');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => material.provider === 'upload');

  useEffect(() => {
    if (material.provider !== 'upload') return;
    let cancelled = false;
    void getFileUrl(material.id).then((url) => {
      if (cancelled) return;
      setBlobUrl(url);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [material]);

  // Extrai o ID e tipo se for Google Drive
  const rawUrl = material.url || '';
  const folderMatch = /\/folders\/([a-zA-Z0-9_-]+)/.exec(rawUrl);
  const fileMatch = /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(rawUrl) || /\/open\?id=([a-zA-Z0-9_-]+)/.exec(rawUrl);
  const detectedFolderId = folderMatch ? folderMatch[1] : googleService.driveFolderIdFromUrl(rawUrl);

  let embedUrl: string | null = null;
  let isGoogleFolder = false;

  if (fileMatch) {
    embedUrl = `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
  } else if (detectedFolderId || folderMatch || (material.provider === 'gdrive' && rawUrl.includes('folder'))) {
    // Pastas do Drive não devem usar iframe com embeddedfolderview (bloqueado pela Google com erro 400)
    isGoogleFolder = true;
    embedUrl = null;
  } else if (material.provider === 'upload' && blobUrl) {
    embedUrl = blobUrl;
  }

  const isSharepoint = rawUrl.includes('sharepoint.com') || rawUrl.includes('onedrive');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-5xl h-[90vh] rounded-2xl border border-line bg-surface shadow-2xl overflow-hidden">
        {/* Cabeçalho do Visualizador */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line bg-surface-2/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
              {isGoogleFolder ? (
                <HardDrive size={16} />
              ) : isSharepoint ? (
                <FolderOpen size={16} />
              ) : (
                <FileText size={16} />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-fg truncate">{material.title}</h3>
              <div className="flex items-center gap-2 text-xs text-muted">
                <Badge>{providerLabel[material.provider] ?? t('materialsModals.viewer.defaultBadge')}</Badge>
                {material.year && <span>{material.year}</span>}
                {material.epoch && <span>({material.epoch})</span>}
                {isGoogleFolder && <span className="text-accent font-medium">{t('materialsModals.viewer.embeddedFolder')}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {material.url && (
              <a
                href={material.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-medium text-fg transition hover:border-accent hover:text-accent"
              >
                {t('materialsModals.viewer.openNewTab')}
                <ExternalLink size={12} />
              </a>
            )}
            <Button size="sm" variant="ghost" onClick={onClose} aria-label={t('materialsModals.viewer.closeAria')}>
              <X size={16} />
            </Button>
          </div>
        </div>

        {/* Corpo do Visualizador Embutido */}
        <div className="flex-1 relative bg-surface-2/30 overflow-hidden">
          {loading ? (
            <div className="flex h-full items-center justify-center text-xs text-muted">
              {t('materialsModals.viewer.loading')}
            </div>
          ) : embedUrl ? (
            <iframe
              src={embedUrl}
              title={material.title}
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media; fullscreen"
            />
          ) : isGoogleFolder ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4">
              <div className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
                <HardDrive size={28} />
              </div>
              <div className="max-w-md space-y-1.5">
                <h4 className="text-base font-semibold text-fg">{t('materialsModals.viewer.gdriveFolderTitle')}</h4>
                <p className="text-xs text-muted leading-relaxed">
                  {t('materialsModals.viewer.gdriveFolderBody')}
                </p>
              </div>
              {material.url && (
                <a
                  href={material.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink-cta px-5 py-2 text-xs font-semibold text-ink-cta-fg shadow-card transition hover:opacity-90"
                >
                  {t('materialsModals.viewer.openGdriveFolder')}
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          ) : isSharepoint ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4">
              <div className="grid size-14 place-items-center rounded-2xl bg-pastel-butter/70 text-[#141312] dark:bg-surface-2 dark:text-warn">
                <FolderOpen size={28} />
              </div>
              <div className="max-w-md space-y-1.5">
                <h4 className="text-base font-semibold text-fg">{t('materialsModals.viewer.sharepointFolderTitle')}</h4>
                <p className="text-xs text-muted leading-relaxed">
                  {t('materialsModals.viewer.sharepointFolderBody')}
                </p>
              </div>
              <a
                href={material.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink-cta px-5 py-2 text-xs font-semibold text-ink-cta-fg shadow-card transition hover:opacity-90"
              >
                {t('materialsModals.viewer.openSharepointFolder')}
                <ExternalLink size={13} />
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-3">
              <FileText size={32} className="text-muted" />
              <p className="text-xs text-muted max-w-sm">
                {t('materialsModals.viewer.externalBody')}
              </p>
              {material.url && (
                <a
                  href={material.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-medium text-fg hover:border-accent"
                >
                  {t('materialsModals.viewer.openMaterial')} <ExternalLink size={12} />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
