import { requestAiConsent } from '../../store/useAiConsentStore';
import { CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
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
      const msg = e instanceof Error ? e.message : 'Erro ao testar a chave.';
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
      title="Como ligar a tua chave gratuita do Gemini"
      maxWidthClass="sm:max-w-lg"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-xs text-muted">Guardada apenas no teu dispositivo</span>
          <Button variant="primary" onClick={onClose}>
            Concluir
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="rounded-2xl border border-line bg-surface-2 p-3.5 leading-relaxed">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
              <Sparkles size={14} className="text-accent" /> Uni Nativo vs Chave Própria
            </span>
            <Badge tone="accent">100% Opcional</Badge>
          </div>
          <p className="text-muted">
            O <strong className="text-fg">Uni Nativo</strong> inclui <strong className="text-fg">{DAILY_CHAT_LIMIT} mensagens/dia</strong> e{' '}
            <strong className="text-fg">{DAILY_NOTEBOOK_LIMIT} gerações no Caderno</strong> grátis (renova à meia-noite). Se precisares de estudar sem limite diário da app, basta usar uma chave gratuita da tua própria conta Google no AI Studio.
          </p>
        </div>

        <ol className="space-y-2.5">
          <li className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-xs font-bold text-accent">
              1
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="font-semibold text-fg">Abre o Google AI Studio com a tua conta Google</p>
              <p className="text-muted">É gratuito (não obriga cartão para o nível base em regiões elegíveis).</p>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 font-semibold text-accent transition hover:bg-accent/20"
              >
                <KeyRound size={13} /> Abrir aistudio.google.com/apikey <ExternalLink size={12} />
              </a>
            </div>
          </li>

          <li className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-xs font-bold text-accent">
              2
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-semibold text-fg">Clica em «Create API key» num projeto gratuito e copia</p>
              <p className="text-muted">
                Começa por <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">AIza...</code>. Se já tiveste créditos pagos/pré-pagos que acabaram, cria um <strong className="text-fg">projeto novo no nível gratuito (Free tier)</strong> para não levar erro de saldo esgotado.
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-xs font-bold text-accent">
              3
            </span>
            <div className="min-w-0 flex-1 space-y-2.5">
              <p className="font-semibold text-fg">Cola aqui em baixo e testa a ligação</p>
              <Field label="A tua chave Gemini API">
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
                    aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </Button>
                </div>
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" size="sm" onClick={() => void runTest()} disabled={testing}>
                  <Sparkles size={14} /> {testing ? 'A validar…' : 'Testar & Ativar sem limite'}
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
                    Voltar ao Uni Nativo (15/dia)
                  </Button>
                )}
              </div>
              {error && (
                <div className="space-y-1.5 rounded-xl border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger">
                  <p className="break-words">{error}</p>
                  {error.toLowerCase().includes('créditos pré-pagos') && (
                    <a
                      href="https://ai.studio/projects"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
                    >
                      Gerir projetos e faturação no AI Studio <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              )}
              {result && (
                <p className="flex items-center gap-1.5 rounded-xl bg-ok/10 px-2.5 py-2 text-xs font-medium text-ok">
                  <CheckCircle2 size={14} />
                  Chave validada ({result.total} modelos disponíveis). Limite diário local desativado!
                </p>
              )}
            </div>
          </li>
        </ol>

        <p className="flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck size={14} className="shrink-0 text-accent" />
          A chave é enviada diretamente do teu navegador/app para a Google API — nunca passa por servidores próprios da Unipedia.
        </p>
      </div>
    </Modal>
  );
}
