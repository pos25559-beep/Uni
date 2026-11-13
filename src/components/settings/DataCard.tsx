import { format } from 'date-fns';
import { Download, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { applyBackupJson, buildBackupPayload } from '../../lib/backup';
import { useStore } from '../../store/useStore';
import { Button, Card, Modal } from '../ui';
import AccountDeletionModal from './AccountDeletionModal';
import { errorMessage } from './shared';

export default function DataCard() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

  const exportBackup = () => {
    setError(null);
    try {
      const payload = buildBackupPayload(useStore.getState());
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unipedia-copia-${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Cópia de segurança exportada.');
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível exportar os dados.'));
    }
  };

  const importBackup = async (file: File) => {
    setMessage(null);
    setError(null);
    try {
      const total = applyBackupJson(await file.text(), useStore.getState());
      setMessage(`Importados ${total} registos com sucesso.`);
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível importar o ficheiro JSON.'));
    }
  };

  const confirmClear = () => {
    useStore.getState().clearAll();
    setMessage('Dados apagados deste dispositivo. As tuas definições mantêm-se.');
    setError(null);
    setConfirmClearOpen(false);
  };

  return (
    <Card title="Cópia de segurança & Dados">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-fg">Backup em ficheiro JSON</h3>
            <p className="mt-0.5 text-xs text-muted">
              Guarda todas as cadeiras, notas e horários num ficheiro portátil. A tua chave Gemini não é exportada.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={exportBackup}>
              <Download size={16} />
              Exportar cópia
            </Button>
            <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-fg transition hover:bg-surface-2">
              <Upload size={16} />
              Importar cópia
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importBackup(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-fg">Reposição e limpeza</h3>
            <p className="mt-0.5 text-xs text-muted">
              Podes limpar o dispositivo ou eliminar definitivamente a tua conta na nuvem.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => setConfirmClearOpen(true)}>
              <Trash2 size={16} />
              Limpar dados locais
            </Button>
            <Button variant="danger" onClick={() => setDeleteAccountOpen(true)}>
              <ShieldAlert size={16} />
              Eliminar conta
            </Button>
          </div>
          <p className="text-xs text-muted">
            Documentos legais:{' '}
            <Link to="/privacidade" className="font-semibold text-accent underline">Privacidade</Link> ·{' '}
            <Link to="/termos" className="font-semibold text-accent underline">Termos</Link> ·{' '}
            <Link to="/eliminar-conta" className="font-semibold text-accent underline">Eliminar conta</Link>
          </p>
        </div>
      </div>

      {message && <p className="mt-4 text-sm font-medium text-ok">{message}</p>}
      {error && <p className="mt-4 break-words text-sm font-medium text-coral">{error}</p>}

      <AccountDeletionModal open={deleteAccountOpen} onClose={() => setDeleteAccountOpen(false)} />

      <Modal
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        title="Apagar todos os dados locais?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmClearOpen(false)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmClear}>
              Apagar tudo
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Esta ação remove cadeiras, avaliações, aulas, sessões, tarefas, materiais e eventos guardados neste dispositivo. Exporta primeiro uma cópia de segurança se precisares.
        </p>
      </Modal>
    </Card>
  );
}
