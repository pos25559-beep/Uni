import { HardDrive, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { formatBytes } from '../../lib/fileStorage';
import { Badge, Button, Modal } from '../ui';
import DeviceImportModal from '../materials/DeviceImportModal';

export default function DeviceStorageCard() {
  const materials = useStore((s) => s.materials);
  const remove = useStore((s) => s.remove);

  const [importOpen, setImportOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

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
      <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
              <HardDrive size={20} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-fg">
                Armazenamento no Disco / HD do Dispositivo
              </h3>
              <p className="text-xs text-muted">
                Ficheiros guardados localmente no IndexedDB, disponíveis offline e no visualizador do site.
              </p>
            </div>
          </div>

          <Badge tone="accent">Ativo</Badge>
        </div>

        <div className="rounded-xl border border-line bg-surface-2/40 p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-fg text-sm">
                {localMaterials.length} {localMaterials.length === 1 ? 'ficheiro guardado' : 'ficheiros guardados'}
              </p>
              <p className="text-muted text-xs">
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
            Podes arrastar pastas inteiras do teu disco com testes, exames e slides descarregados. O sistema analisa os nomes dos ficheiros, categoriza-os e associa-os à cadeira correta autonomamente.
          </p>
        </div>
      </div>

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
