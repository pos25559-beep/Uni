import { Eye, EyeOff, ExternalLink, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Button, Field, Input, cx } from '../ui';
import { HowTo, IntegrationCard, errorMessage } from './shared';

interface TestResult {
  available: boolean;
  suggestions: string[];
  total: number;
}

const MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=50';

export default function GeminiCard() {
  const status = useStore((s) => s.integrations.gemini);
  const apiKey = useStore((s) => s.settings.geminiApiKey);
  const model = useStore((s) => s.settings.geminiModel);
  const updateSettings = useStore((s) => s.updateSettings);
  const setIntegration = useStore((s) => s.setIntegration);

  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const test = async () => {
    const key = apiKey.trim();
    const wanted = model.trim();
    if (!key) {
      setLocalError('Falta a chave API.');
      return;
    }
    setTesting(true);
    setResult(null);
    setLocalError(null);
    try {
      // A chave vai no cabeçalho, nunca no URL.
      const res = await fetch(MODELS_URL, { headers: { 'x-goog-api-key': key } });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `Erro ${res.status} ao contactar a API Gemini.`);
      }
      const data = (await res.json()) as { models?: { name?: string }[] };
      const names = (data.models ?? [])
        .map((m) => (m.name ?? '').replace(/^models\//, ''))
        .filter(Boolean);
      setResult({
        available: names.includes(wanted),
        suggestions: names.filter((n) => n.includes('gemini')).slice(0, 8),
        total: names.length,
      });
      setIntegration('gemini', { connected: true, lastSync: new Date().toISOString(), error: undefined });
    } catch (e) {
      // O erro aparece no cartão de estado (IntegrationCard).
      setIntegration('gemini', { connected: false, error: errorMessage(e) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <IntegrationCard
      icon={<Sparkles size={18} />}
      title="Gemini"
      description="Assistente e resumos com o modelo da Google."
      status={status}
    >
      <HowTo
        steps={[
          <>Cria uma chave API em <a className="text-accent underline-offset-2 hover:underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>.</>,
          <>Cola a chave abaixo. Fica guardada apenas neste navegador.</>,
          <>Confirma o nome do modelo (ex.: gemini-2.5-flash) e clica em «Testar ligação».</>,
        ]}
      />

      <Field label="Chave API">
        <div className="flex gap-2">
          <Input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
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

      <Field label="Modelo">
        <Input
          value={model}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => updateSettings({ geminiModel: e.target.value })}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={test} disabled={testing}>
          <Sparkles size={16} />
          {testing ? 'A testar…' : 'Testar ligação'}
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

      {localError && <p className="break-words text-sm text-danger">{localError}</p>}

      {result && (
        <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3">
          {result.available ? (
            <p className="text-sm text-ok">Ligação ok. O modelo «{model}» está disponível.</p>
          ) : (
            <p className="text-sm text-warn">
              Ligação ok, mas o modelo «{model}» não aparece na lista ({result.total} modelos).
            </p>
          )}
          {result.suggestions.length > 0 && (
            <div>
              <span className="text-xs text-muted">Modelos Gemini disponíveis (clica para usar):</span>
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
                        : 'border-line bg-surface text-muted hover:text-fg',
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
        A chave fica guardada só neste navegador (localStorage) e só é enviada à API da Google.
      </p>
    </IntegrationCard>
  );
}
