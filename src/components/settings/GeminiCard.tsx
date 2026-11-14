import { ChevronDown, Eye, EyeOff, ExternalLink, HelpCircle, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { hasCustomGeminiKey } from '../../integrations/gemini';
import { getDailyQuotaSnapshot } from '../../lib/aiQuota';
import { useStore } from '../../store/useStore';
import { Badge, Button, Field, Input, cx } from '../ui';
import GeminiKeyGuideModal, { verifyGeminiApiKey, type GeminiKeyTestResult } from './GeminiKeyGuideModal';
import { IntegrationCard, errorMessage } from './shared';

export default function GeminiCard() {
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
    const wanted = model.trim() || 'gemini-3.8-flash';
    if (!aiConsent) {
      setLocalError('Ativa primeiro a autorização para o Uni abaixo.');
      return;
    }
    if (!key) {
      setLocalError('Insere uma chave pessoal do Google AI Studio ou abre o guia passo-a-passo.');
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
      title="Uni & Gemini"
      description="Tutor nativo com Firebase AI Logic — pronto a usar sem chave API."
      status={effectiveStatus}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-xs">
        <div>
          <p className="font-semibold text-fg">
            {customKeyActive ? 'Modo Avançado (Chave Pessoal)' : 'Uni Nativo Incluído'}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {customKeyActive
              ? 'Sem limite diário da app · a usar a tua quota AI Studio.'
              : `${quota.chatRemaining}/${quota.chatLimit} mensagens e ${quota.notebookRemaining}/${quota.notebookLimit} cadernos disponíveis hoje.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setGuideOpen(true)}>
            <HelpCircle size={13} /> {customKeyActive ? 'Gerir chave' : 'Passar de 15/dia (grátis)'}
          </Button>
          <Badge tone={aiConsent ? 'ok' : 'neutral'}>
            {customKeyActive ? 'Chave própria' : 'Nativo'}
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
            updateSettings({ aiConsent: next });
            setIntegration('gemini', {
              connected: next,
              ...(next ? { lastSync: new Date().toISOString(), error: undefined } : {}),
            });
          }}
          className="mt-0.5 size-4 rounded accent-accent"
        />
        <span>
          <strong className="text-fg">Ativar o Uni:</strong> permito o processamento das perguntas, imagens e PDFs escolhidos por mim através da IA do Uni.
        </span>
      </label>

      <details className="group rounded-xl border border-line bg-surface-2/60 p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-fg">
          <span>Avançado: usar chave pessoal (AI Studio) ou trocar modelo</span>
          <ChevronDown size={15} className="text-muted transition group-open:rotate-180" />
        </summary>

        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <p className="text-xs text-muted">
            Opcional: para uso intensivo sem limite diário de {quota.chatLimit} mensagens/{quota.notebookLimit} cadernos, podes colar uma chave gratuita em{' '}
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

          <Field label="Chave API Gemini pessoal (opcional)">
            <div className="flex gap-2">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                placeholder="Deixa vazio para usar o Uni Nativo"
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1"
                onChange={(e) => updateSettings({ geminiApiKey: e.target.value.trim() })}
              />
              <Button
                variant="secondary"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
            </div>
          </Field>

          <Field label="Modelo do Uni (predefinido: Gemini 3.8 Flash)">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {[
                { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Recomendado)' },
                { id: 'gemini-4-argon', label: 'Gemini 4 Argon' },
                { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (Suplente)' },
              ].map((preset) => {
                const active = (model || 'gemini-3.8-flash') === preset.id;
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
              placeholder="gemini-3.8-flash"
              onChange={(e) => updateSettings({ geminiModel: e.target.value })}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={test} disabled={testing}>
              <Sparkles size={15} />
              {testing ? 'A testar…' : 'Testar chave pessoal'}
            </Button>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-accent underline-offset-2 hover:underline"
            >
              Obter chave <ExternalLink size={12} />
            </a>
          </div>

          {localError && <p className="break-words text-xs text-danger">{localError}</p>}

          {result && (
            <div className="space-y-2 rounded-xl border border-line bg-surface p-3">
              {result.available ? (
                <p className="text-xs text-ok">Ligação ok. O modelo «{model}» está disponível.</p>
              ) : (
                <p className="text-xs text-warn">
                  Ligação ok, mas o modelo «{model}» não aparece na lista ({result.total} modelos).
                </p>
              )}
              {result.suggestions.length > 0 && (
                <div>
                  <span className="text-[11px] text-muted">Modelos disponíveis (clica para usar):</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {result.suggestions.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => updateSettings({ geminiModel: name })}
                        className={cx(
                          'rounded-full border px-2.5 py-1 text-xs transition',
                          name === model
                            ? 'border-accent bg-accent-soft text-accent'
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

          <p className="text-[11px] text-muted">
            Qualquer chave pessoal fica guardada apenas neste dispositivo (localStorage) e nunca é partilhada.
          </p>
        </div>
      </details>
    </IntegrationCard>
  );
}
