import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAiConsentStore } from '../store/useAiConsentStore';
import { useStore } from '../store/useStore';
import { Button, Modal } from './ui';

/**
 * Pedido único de consentimento de IA (ADR-001, ação 1): confirma 18+ e diz
 * para onde vão os dados antes de ligar o Uni. Montado uma vez no AppShell.
 */
export default function AiConsentDialog() {
  const { t } = useTranslation('common');
  const open = useAiConsentStore((s) => s.open);
  const onGranted = useAiConsentStore((s) => s.onGranted);
  const closeStore = useAiConsentStore((s) => s.close);
  const updateSettings = useStore((s) => s.updateSettings);
  const setIntegration = useStore((s) => s.setIntegration);
  const [adult, setAdult] = useState(false);

  // A caixa dos 18+ volta a vazio sempre que o pedido fecha.
  const close = () => {
    setAdult(false);
    closeStore();
  };

  const usesOwnKey = Boolean(useStore((s) => (s.settings.geminiApiKey ?? '').trim()));

  const confirm = () => {
    if (!adult) return;
    updateSettings({ aiConsent: true, aiAgeConfirmed18Plus: true });
    if (!usesOwnKey) {
      setIntegration('gemini', {
        connected: true,
        lastSync: new Date().toISOString(),
        error: undefined,
      });
    }
    const next = onGranted;
    close();
    next?.();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('aiConsent.title')}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {t('aiConsent.cancel')}
          </Button>
          <Button variant="primary" onClick={confirm} disabled={!adult}>
            {t('aiConsent.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm leading-relaxed text-fg">
        <p>{t('aiConsent.what')}</p>
        <p className="rounded-2xl bg-surface-2 px-3.5 py-3 text-xs text-fg">
          {usesOwnKey ? t('aiConsent.ownKey') : t('aiConsent.shared')}
        </p>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3">
          <input
            type="checkbox"
            checked={adult}
            onChange={(e) => setAdult(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-accent"
          />
          <span className="text-sm">
            <strong>{t('aiConsent.age')}</strong>{' '}
            <span className="text-muted">{t('aiConsent.ageWhy')}</span>
          </span>
        </label>
        <p className="text-xs text-muted">
          {t('aiConsent.off')}{' '}
          <Link to="/privacidade" onClick={close} className="font-semibold text-accent-ink underline">
            {t('aiConsent.privacy')}
          </Link>
        </p>
      </div>
    </Modal>
  );
}
