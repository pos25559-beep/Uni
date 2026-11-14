import { HardDrive, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { formatBytes } from '../../lib/fileStorage';
import { Badge, Button, Modal } from '../ui';
import DeviceImportModal from '../materials/DeviceImportModal';

export default function DeviceStorageCard() {
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
                Armazenamento no Disco / HD do Dispositivo
              </h3>
              <p className="text-xs text-muted">
                Ficheiros guardados localmente no dispositivo, disponíveis offline e no visualizador do site.
              </p>
            </div>
          </div>

          <Badge tone="accent">Ativo</Badge>
        </div>

        <div className="rounded-2xl border border-line/80 bg-surface-2/45 p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-fg text-sm tabular">
                {localMaterials.length} {localMaterials.length === 1 ? 'ficheiro guardado' : 'ficheiros guardados'}
              </p>
              <p className="text-muted text-xs tabular">
                Espaço total utilizado: {formatBytes(totalBytes)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={() => setImportOpen(true)}>
                <Upload size={13} />
                Importar do Computador (HD)
              </Button>

              {localMaterials.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmClear(true)}
                  className="text-danger hover:text-danger"
                >
                  <Trash2 size={13} />
                  Limpar
                </Button>
              )}
            </div>
          </div>

          <p className="text-muted leading-relaxed">
            Podes varrer pastas inteiras do teu disco com testes, sebentas e ficheiros descarregados do portal académico. <strong>Dica:</strong> divide os documentos em subpastas com o nome/sigla da cadeira (ex.: <span className="font-mono">{exampleFolders}</span>) para a varredura associar tudo lá dentro mesmo sem a sigla no nome do ficheiro.
          </p>
        </div>
      </section>

      {importOpen && <DeviceImportModal onClose={() => setImportOpen(false)} />}

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Remover ficheiros locais?"
        footer={
          <>
            <Button onClick={() => setConfirmClear(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleClearAll}>
              Remover Ficheiros
            </Button>
          </>
        }
      >
        <p className="text-xs text-muted">
          Esta ação remove os {localMaterials.length} ficheiros guardados no armazenamento local do navegador. Os materiais do Google Drive não serão afetados.
        </p>
      </Modal>
    </>
  );
}
