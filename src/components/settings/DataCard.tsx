import { format } from 'date-fns';
import { Database, Download, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { applyBackupJson, buildBackupPayload } from '../../lib/backup';
import { useStore } from '../../store/useStore';
import { Badge, Button, Card, Modal, cx } from '../ui';
import AccountDeletionModal from './AccountDeletionModal';
import { errorMessage } from './shared';

type Pending = 'demo' | 'clear' | null;

export default function DataCard() {
  const isDemo = useStore((s) => s.isDemo);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
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
      setMessage(`Importados ${total} registos.`);
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível importar o ficheiro.'));
    }
  };

  const confirmPending = () => {
    if (pending === 'demo') {
      useStore.getState().loadDemo();
      setMessage('Dados de demonstração carregados.');
    } else if (pending === 'clear') {
      useStore.getState().clearAll();
      setMessage('Dados apagados. As definições mantêm-se.');
    }
    setError(null);
    setPending(null);
  };

  return (
    <Card title="Dados" action={isDemo ? <Badge tone="accent">Modo demonstração</Badge> : undefined}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">Cópia de segurança</h3>
            <p className="mt-0.5 text-xs text-muted">
              Guarda tudo num ficheiro JSON. A chave da Gemini não é incluída.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportBackup}>
              <Download size={16} />
              Exportar cópia de segurança
            </Button>
            <label className={cx(
              'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 px-4 text-sm font-medium text-fg transition hover:border-muted/50',
            )}>
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
          <p className="text-xs text-muted">
            A importação junta os registos aos que já existem (os de mesmo id são atualizados).
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">Dados de exemplo e reposição</h3>
            <p className="mt-0.5 text-xs text-muted">
              Estes botões substituem os dados atuais deste navegador.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setPending('demo')}>
              <Database size={16} />
              Carregar cadeiras e horário do Pedro (LEMc)
            </Button>
            <Button variant="danger" onClick={() => setPending('clear')}>
              <Trash2 size={16} />
              Limpar coleções locais
            </Button>
            <Button variant="danger" onClick={() => setDeleteAccountOpen(true)}>
              <ShieldAlert size={16} />
              Eliminar conta &amp; dados (RGPD)
            </Button>
          </div>
          <p className="text-xs text-muted">
            Conformidade europeia:{' '}
            <Link to="/privacidade" className="text-accent underline">Política de Privacidade</Link> ·{' '}
            <Link to="/termos" className="text-accent underline">Termos</Link> ·{' '}
            <Link to="/eliminar-conta" className="text-accent underline">Portal de Eliminação</Link>
          </p>
        </div>
      </div>

      {message && <p className="mt-4 text-sm text-ok">{message}</p>}
      {error && <p className="mt-4 break-words text-sm text-danger">{error}</p>}

      <AccountDeletionModal open={deleteAccountOpen} onClose={() => setDeleteAccountOpen(false)} />

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending === 'clear' ? 'Apagar todos os dados?' : 'Carregar horário do Pedro (LEMc)?'}
        footer={
          <>
            <Button onClick={() => setPending(null)}>Cancelar</Button>
            <Button variant={pending === 'clear' ? 'danger' : 'primary'} onClick={confirmPending}>
              {pending === 'clear' ? 'Apagar tudo' : 'Carregar horário LEMc'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {pending === 'clear'
            ? 'Remove cadeiras, avaliações, aulas, sessões, tarefas, materiais e eventos deste navegador. Não se pode desfazer: exporta uma cópia antes, se precisares. As definições mantêm-se.'
            : 'Substitui os dados atuais pelas 6 cadeiras, horários e datas de testes reais do teu 1.º Semestre de LEMc (CLIP).'}
        </p>
      </Modal>
    </Card>
  );
}
