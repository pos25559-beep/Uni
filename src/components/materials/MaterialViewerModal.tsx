import { ExternalLink, HardDrive, FolderOpen, FileText, X } from 'lucide-react';
import { useEffect, useState } from 'react';
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
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (material.provider === 'upload') {
      setLoading(true);
      void getFileUrl(material.id).then((url) => {
        setBlobUrl(url);
        setLoading(false);
      });
    }
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
              <div className="flex items-center gap-2 text-[11px] text-muted">
                <Badge>{providerLabel[material.provider] ?? 'Ficheiro'}</Badge>
                {material.year && <span>{material.year}</span>}
                {material.epoch && <span>({material.epoch})</span>}
                {isGoogleFolder && <span className="text-accent font-medium">• Pasta Embutida</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {material.url && (
              <a
                href={material.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg transition hover:border-accent hover:text-accent"
              >
                Abrir em Nova Aba
                <ExternalLink size={12} />
              </a>
            )}
            <Button size="sm" variant="ghost" onClick={onClose} aria-label="Fechar visualizador">
              <X size={16} />
            </Button>
          </div>
        </div>

        {/* Corpo do Visualizador Embutido */}
        <div className="flex-1 relative bg-surface-2/30 overflow-hidden">
          {loading ? (
            <div className="flex h-full items-center justify-center text-xs text-muted">
              A carregar documento...
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
                <h4 className="text-base font-semibold text-fg">Pasta do Google Drive</h4>
                <p className="text-xs text-muted leading-relaxed">
                  Esta pasta contém provas e materiais do LEMc. Por políticas de segurança da Google, pastas completas abrem de forma direta e segura no Google Drive com a tua conta.
                </p>
              </div>
              {material.url && (
                <a
                  href={material.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-accent/90 transition"
                >
                  Abrir Pasta no Google Drive
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          ) : isSharepoint ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4">
              <div className="grid size-14 place-items-center rounded-2xl bg-amber-500/10 text-amber-500">
                <FolderOpen size={28} />
              </div>
              <div className="max-w-md space-y-1.5">
                <h4 className="text-base font-semibold text-fg">Pasta do OneDrive / SharePoint da FCT</h4>
                <p className="text-xs text-muted leading-relaxed">
                  Esta pasta pertence ao repositório institucional de provas e exercícios de LEMc. Devido às políticas de segurança da Microsoft UNL, ela abre diretamente com a tua sessão académica.
                </p>
              </div>
              <a
                href={material.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-accent/90 transition"
              >
                Abrir Repositório no SharePoint da Faculdade
                <ExternalLink size={13} />
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-3">
              <FileText size={32} className="text-muted" />
              <p className="text-xs text-muted max-w-sm">
                Este material está disponível diretamente através do link oficial.
              </p>
              {material.url && (
                <a
                  href={material.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg hover:border-accent"
                >
                  Abrir Material <ExternalLink size={12} />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
