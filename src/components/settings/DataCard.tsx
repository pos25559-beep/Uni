import { format } from 'date-fns';
import { Download, Sparkles, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { applyBackupJson, buildBackupPayload } from '../../lib/backup';
import { loadDemoData } from '../../lib/demoSeed';
import { clearLocalDb, listUniAgents } from '../../lib/localDb';
import { notifyUniAgentsChanged } from '../../lib/uniAgents';
import { useStore } from '../../store/useStore';
import { Button, Card, Modal } from '../ui';
import { errorMessage } from './helpers';

export default function DataCard() {
  const { t } = useTranslation('settings');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmDemoOpen, setConfirmDemoOpen] = useState(false);

  const exportBackup = async () => {
    setError(null);
    try {
      const agents = await listUniAgents();
      const payload = buildBackupPayload(useStore.getState(), agents);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unipedia-copia-${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(t('data.exported'));
    } catch (e) {
      setError(errorMessage(e, t('data.exportFail')));
    }
  };

  const importBackup = async (file: File) => {
    setMessage(null);
    setError(null);
    try {
      const total = applyBackupJson(await file.text(), useStore.getState());
      setMessage(t('data.imported', { n: total }));
    } catch (e) {
      setError(errorMessage(e, t('data.importFail')));
    }
  };

  const confirmClear = () => {
    useStore.getState().clearAll();
    void clearLocalDb().then(() => notifyUniAgentsChanged());
    setMessage(t('data.cleared'));
    setError(null);
    setConfirmClearOpen(false);
  };

  const applyDemo = () => {
    loadDemoData();
    setMessage(t('data.demoLoaded'));
    setError(null);
    setConfirmDemoOpen(false);
  };

  const handleLoadDemo = () => {
    if (useStore.getState().courses.length > 0) {
      setConfirmDemoOpen(true);
      return;
    }
    applyDemo();
  };

  return (
    <Card title={t('data.title')}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-fg">Backup e dados de exemplo</h3>
            <p className="mt-0.5 text-xs text-muted">
              {t('data.intro')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={exportBackup}>
              <Download size={16} />
              {t('data.export')}
            </Button>
            <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-fg transition hover:bg-surface-2">
              <Upload size={16} />
              {t('data.import')}
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
            <Button variant="secondary" onClick={handleLoadDemo}>
              <Sparkles size={16} />
              {t('data.loadDemo')}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-fg">Limpeza local &amp; documentos legais</h3>
            <p className="mt-0.5 text-xs text-muted">
              {t('data.clearInfo')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => setConfirmClearOpen(true)}>
              <Trash2 size={16} />
              {t('data.clearLocal')}
            </Button>
          </div>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span>{t('data.legal')}</span>
            <Link to="/privacidade" className="inline-flex min-h-11 items-center font-semibold text-accent-ink underline">
              {t('data.privacy')}
            </Link>
            <span aria-hidden="true">·</span>
            <Link to="/termos" className="inline-flex min-h-11 items-center font-semibold text-accent-ink underline">
              {t('data.terms')}
            </Link>
            <span aria-hidden="true">·</span>
            <Link to="/eliminar-conta" className="inline-flex min-h-11 items-center font-semibold text-coral-ink underline">
              {t('data.deleteAccount')}
            </Link>
          </p>
        </div>
      </div>

      {message && <p className="mt-4 text-sm font-medium text-ok">{message}</p>}
      {error && <p className="mt-4 break-words text-sm font-medium text-coral-ink">{error}</p>}

      <Modal
        open={confirmDemoOpen}
        onClose={() => setConfirmDemoOpen(false)}
        title={t('data.demoTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDemoOpen(false)}>{t('data.cancel')}</Button>
            <Button variant="primary" onClick={applyDemo}>
              {t('data.loadDemo')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {t('data.demoBody')}
        </p>
      </Modal>

      <Modal
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        title={t('data.clearTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmClearOpen(false)}>{t('data.cancel')}</Button>
            <Button variant="danger" onClick={confirmClear}>
              {t('data.deleteAll')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {t('data.clearBody')}
        </p>
      </Modal>
    </Card>
  );
}
