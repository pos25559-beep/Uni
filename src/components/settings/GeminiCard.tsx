import { requestAiConsent } from '../../store/useAiConsentStore';
import { ChevronDown, Eye, EyeOff, ExternalLink, HelpCircle, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hasCustomGeminiKey } from '../../integrations/gemini';
import { getDailyQuotaSnapshot } from '../../lib/aiQuota';
import { useStore } from '../../store/useStore';
import { Badge, Button, Field, Input } from '../ui';
import { cx } from '../../lib/uiHelpers';
import { verifyGeminiApiKey, type GeminiKeyTestResult } from '../../integrations/geminiKeyVerify';
import GeminiKeyGuideModal from './GeminiKeyGuideModal';
import { IntegrationCard } from './shared';
import { errorMessage } from './helpers';

export default function GeminiCard() {
  const { t } = useTranslation('settings');
  const status = useStore((s) => s.integrations.gemini);
  const apiKey = useStore((s) => s.settings.geminiApiKey);
  const model = useStore((s) => s.settings.geminiModel);
  const aiConsent = Boolean(useStore((s) => s.settings.aiConsent));
  const updateSettings = useStore((s) => s.updateSettings);
  const setIntegration = useStore((s) => s.setIntegration);

  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<GeminiKeyTestResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const customKeyActive = hasCustomGeminiKey();
  const quota = getDailyQuotaSnapshot();
  const effectiveStatus = {
    ...status,
    connected: aiConsent && (!customKeyActive || status.connected),
  };

  const test = async () => {
    const key = apiKey.trim() || (import.meta.env.DEV ? (import.meta.env.VITE_GEMINI_API_KEY ?? '') : '');
    const wanted = model.trim() || 'gemini-4-hydrogen';
    if (!aiConsent) {
      setLocalError(t('gemini.needConsent'));
      return;
    }
    if (!key) {
      setLocalError(t('gemini.needKey'));
      return;
    }
    setTesting(true);
    setResult(null);
    setLocalError(null);
    try {
      setResult(await verifyGeminiApiKey(key, wanted));
      setIntegration('gemini', { connected: true, lastSync: new Date().toISOString(), error: undefined });
    } catch (e) {
      setIntegration('gemini', { connected: false, error: errorMessage(e) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <IntegrationCard
      icon={<Sparkles size={18} />}
      title={t('gemini.title')}
      description={t('gemini.desc')}
      status={effectiveStatus}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-xs">
        <div>
          <p className="font-semibold text-fg">
            {customKeyActive ? t('gemini.modeKey') : t('gemini.modeNative')}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {customKeyActive
              ? t('gemini.quotaKey')
              : t('gemini.quotaNative', {
                  chat: quota.chatRemaining,
                  chatLimit: quota.chatLimit,
                  nb: quota.notebookRemaining,
                  nbLimit: quota.notebookLimit,
                })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setGuideOpen(true)}>
            <HelpCircle size={13} /> {customKeyActive ? t('gemini.manageKey') : t('gemini.raiseLimit', { limit: quota.chatLimit })}
          </Button>
          <Badge tone={aiConsent ? 'ok' : 'neutral'}>
            {customKeyActive ? t('gemini.badgeKey') : t('gemini.badgeNative')}
          </Badge>
        </div>
      </div>

      <GeminiKeyGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />

      <label className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-xs">
        <input
          type="checkbox"
          checked={aiConsent}
          onChange={(e) => {
            const next = e.target.checked;
            if (next) {
              requestAiConsent();
              return;
            }
            updateSettings({ aiConsent: false });
            setIntegration('gemini', { connected: false });
          }}
          className="mt-0.5 size-4 rounded accent-accent"
        />
        <span>
          <strong className="text-fg">{t('gemini.enableStrong')}</strong> {t('gemini.enableBody')}
        </span>
      </label>

      <details className="group rounded-xl border border-line bg-surface-2/60 px-3 py-1">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-fg">
          <span>{t('gemini.advanced')}</span>
          <ChevronDown size={15} className="text-muted transition group-open:rotate-180" />
        </summary>

        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <p className="text-xs text-muted">
            {t('gemini.optional', { chatLimit: quota.chatLimit, nbLimit: quota.notebookLimit })}{' '}
            <a
              className="text-accent-ink underline-offset-2 hover:underline"
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
            >
              aistudio.google.com/apikey
            </a>
            .
          </p>

          <Field label={t('gemini.keyLabel')}>
            <div className="flex gap-2">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                placeholder={t('gemini.keyPlaceholder')}
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1"
                onChange={(e) => updateSettings({ geminiApiKey: e.target.value.trim() })}
              />
              <Button
                variant="secondary"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? t('gemini.hideKey') : t('gemini.showKey')}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted">{t('gemini.keyLocalOnly')}</p>
          </Field>

          <Field label={t('gemini.modelLabel')}>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {[
                { id: 'gemini-4-hydrogen', label: t('gemini.presetRecommended') },
                { id: 'gemini-4-argon', label: 'Gemini 4 Argon' },
                { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
                { id: 'gemini-3.5-flash-lite', label: t('gemini.presetBackup') },
              ].map((preset) => {
                const active = (model || 'gemini-4-hydrogen') === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => updateSettings({ geminiModel: preset.id })}
                    className={cx(
                      'min-h-11 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                      active
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-surface-2 text-muted hover:text-fg',
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <Input
              value={model}
              autoComplete="off"
              spellCheck={false}
              placeholder="gemini-4-hydrogen"
              onChange={(e) => updateSettings({ geminiModel: e.target.value })}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={test} disabled={testing}>
              <Sparkles size={15} />
              {testing ? t('gemini.testing') : t('gemini.test')}
            </Button>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1 px-2 text-xs font-medium text-accent-ink underline-offset-2 hover:underline"
            >
              {t('gemini.getKey')} <ExternalLink size={12} />
            </a>
          </div>

          {localError && <p className="break-words text-xs text-danger">{localError}</p>}

          {result && (
            <div className="space-y-2 rounded-xl border border-line bg-surface p-3">
              {result.available ? (
                <p className="text-xs text-ok">{t('gemini.okModel', { model })}</p>
              ) : (
                <p className="text-xs text-warn">
                  {t('gemini.okNoModel', { model, total: result.total })}
                </p>
              )}
              {result.suggestions.length > 0 && (
                <div>
                  <span className="text-xs text-muted">{t('gemini.available')}</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {result.suggestions.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => updateSettings({ geminiModel: name })}
                        className={cx(
                          'min-h-11 rounded-full border px-3 py-1.5 text-xs transition',
                          name === model
                            ? 'border-accent bg-accent-soft text-accent-ink'
                            : 'border-line bg-surface-2 text-muted hover:text-fg',
                        )}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-muted">
            {t('gemini.keyNeverShared')}
          </p>
        </div>
      </details>
    </IntegrationCard>
  );
}
