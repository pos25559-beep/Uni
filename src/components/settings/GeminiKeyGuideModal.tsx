import { requestAiConsent } from '../../store/useAiConsentStore';
import { CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { verifyGeminiApiKey, type GeminiKeyTestResult } from '../../integrations/geminiKeyVerify';
import { DAILY_CHAT_LIMIT, DAILY_NOTEBOOK_LIMIT } from '../../lib/aiQuota';
import { useStore } from '../../store/useStore';
import { Badge, Button, Field, Input, Modal } from '../ui';

export default function GeminiKeyGuideModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('settings');
  const apiKey = useStore((s) => s.settings.geminiApiKey);
  const model = useStore((s) => s.settings.geminiModel || 'gemini-4-hydrogen');
  const updateSettings = useStore((s) => s.updateSettings);
  const setIntegration = useStore((s) => s.setIntegration);

  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<GeminiKeyTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setTesting(true);
    setError(null);
    setResult(null);
    try {
      const checked = await verifyGeminiApiKey(apiKey, model);
      setResult(checked);
      if (!useStore.getState().settings.aiAgeConfirmed18Plus) requestAiConsent();
      else updateSettings({ aiConsent: true });
      setIntegration('gemini', {
        connected: true,
        lastSync: new Date().toISOString(),
        error: undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('geminiGuide.testError');
      setError(msg);
      setIntegration('gemini', { connected: false, error: msg });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('geminiGuide.title')}
      maxWidthClass="sm:max-w-lg"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-xs text-muted">{t('geminiGuide.storedLocalOnly')}</span>
          <Button variant="primary" onClick={onClose}>
            {t('geminiGuide.done')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="rounded-2xl border border-line bg-surface-2 p-3.5 leading-relaxed">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
              <Sparkles size={14} className="text-accent" /> {t('geminiGuide.compareTitle')}
            </span>
            <Badge tone="accent">{t('geminiGuide.optionalBadge')}</Badge>
          </div>
          <p className="text-muted">
            {t('geminiGuide.compareBodyPrefix') ? `${t('geminiGuide.compareBodyPrefix')} ` : ''}
            <strong className="text-fg">{t('geminiGuide.compareBodyNative')}</strong> {t('geminiGuide.compareBodyMiddle')}{' '}
            <strong className="text-fg">{t('geminiGuide.compareBodyMessages', { count: DAILY_CHAT_LIMIT })}</strong>{' '}
            {t('geminiGuide.compareBodyAnd')}{' '}
            <strong className="text-fg">{t('geminiGuide.compareBodyNotebooks', { count: DAILY_NOTEBOOK_LIMIT })}</strong>{' '}
            {t('geminiGuide.compareBodySuffix')}
          </p>
        </div>

        <ol className="space-y-2.5">
          <li className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-xs font-bold text-accent">
              1
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="font-semibold text-fg">{t('geminiGuide.step1Title')}</p>
              <p className="text-muted">{t('geminiGuide.step1Hint')}</p>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent-soft px-3.5 py-2 font-semibold text-accent transition hover:bg-accent/20"
              >
                <KeyRound size={13} /> {t('geminiGuide.step1Btn')} <ExternalLink size={12} />
              </a>
            </div>
          </li>

          <li className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-xs font-bold text-accent">
              2
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-semibold text-fg">{t('geminiGuide.step2Title')}</p>
              <p className="text-muted">
                {t('geminiGuide.step2HintA')} <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">AIza...</code>
                {t('geminiGuide.step2HintB')} <strong className="text-fg">{t('geminiGuide.step2HintFree')}</strong>{' '}
                {t('geminiGuide.step2HintC')}
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-xs font-bold text-accent">
              3
            </span>
            <div className="min-w-0 flex-1 space-y-2.5">
              <p className="font-semibold text-fg">{t('geminiGuide.step3Title')}</p>
              <Field label={t('geminiGuide.keyLabel')}>
                <div className="flex gap-2">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    placeholder="AIzaSy..."
                    autoComplete="off"
                    spellCheck={false}
                    className="min-w-0 flex-1"
                    onChange={(e) => {
                      updateSettings({ geminiApiKey: e.target.value.trim() });
                      setResult(null);
                      setError(null);
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowKey((v) => !v)}
                    aria-label={showKey ? t('geminiGuide.hideKey') : t('geminiGuide.showKey')}
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </Button>
                </div>
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" size="sm" onClick={() => void runTest()} disabled={testing}>
                  <Sparkles size={14} /> {testing ? t('geminiGuide.validating') : t('geminiGuide.testActivate')}
                </Button>
                {apiKey.trim() && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      updateSettings({ geminiApiKey: '' });
                      setResult(null);
                      setError(null);
                    }}
                  >
                    {t('geminiGuide.backToNative', { limit: DAILY_CHAT_LIMIT })}
                  </Button>
                )}
              </div>
              {error && (
                <div className="space-y-1.5 rounded-xl border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger">
                  <p className="break-words">{error}</p>
                  {(error.toLowerCase().includes('crédito') ||
                    error.toLowerCase().includes('credit') ||
                    error.toLowerCase().includes('quota') ||
                    error.toLowerCase().includes('cuota') ||
                    error.toLowerCase().includes('billing') ||
                    error.toLowerCase().includes('fatura') ||
                    error.toLowerCase().includes('factura')) && (
                    <a
                      href="https://ai.studio/projects"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center gap-1 font-semibold underline underline-offset-2"
                    >
                      {t('geminiGuide.manageProjectsLink')} <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              )}
              {result && (
                <p className="flex items-center gap-1.5 rounded-xl bg-ok/10 px-2.5 py-2 text-xs font-medium text-ok">
                  <CheckCircle2 size={14} />
                  {t('geminiGuide.validated', { total: result.total })}
                </p>
              )}
            </div>
          </li>
        </ol>

        <p className="flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck size={14} className="shrink-0 text-accent" />
          {t('geminiGuide.privacyNote')}
        </p>
      </div>
    </Modal>
  );
}
