import { KeyRound, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ContextPanel } from '../components/assistant/ContextPanel';
import { Composer } from '../components/assistant/Composer';
import { Markdown } from '../components/assistant/Markdown';
import { QuickActions } from '../components/assistant/QuickActions';
import { Button, EmptyState, Modal, PageHeader } from '../components/ui';
import { askGemini, buildStudyContext, SYSTEM_PROMPT } from '../integrations/gemini';
import type { ChatMessage } from '../integrations/gemini';
import { newId, useStore } from '../store/useStore';

const STORAGE_KEY = 'uni-erp-chat';
const MAX_STORED = 60;
const MAX_SENT = 20;

function isChatMessage(v: unknown): v is ChatMessage {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  return typeof m.id === 'string' && (m.role === 'user' || m.role === 'model')
    && typeof m.text === 'string' && typeof m.at === 'string';
}

// Storage pode estar bloqueado (modo privado, quota): a app funciona na mesma sem ele.
function loadChat(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isChatMessage).slice(-MAX_STORED) : [];
  } catch {
    return [];
  }
}

function saveChat(messages: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
  } catch {
    // Ignora: a conversa continua em memória.
  }
}

export default function Assistant() {
  const apiKey = useStore((s) => s.settings.geminiApiKey);
  const model = useStore((s) => s.settings.geminiModel);
  const userName = useStore((s) => s.settings.userName);
  const setIntegration = useStore((s) => s.setIntegration);
  const hasKey = apiKey.trim().length > 0;

  const [messages, setMessages] = useState<ChatMessage[]>(loadChat);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showActions, setShowActions] = useState(messages.length === 0);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { saveChat(messages); }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, loading, error]);

  const run = useCallback(async (list: ChatMessage[]) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      // Só envia as últimas mensagens e começa sempre por uma do utilizador.
      const recent = list.slice(-MAX_SENT);
      const firstUser = recent.findIndex((m) => m.role === 'user');
      const payload = firstUser > 0 ? recent.slice(firstUser) : recent;
      // Contexto reconstruído a cada envio para estar sempre atual.
      const system = SYSTEM_PROMPT(buildStudyContext(useStore.getState()));
      const reply = await askGemini({ messages: payload, system, signal: controller.signal });
      const now = new Date().toISOString();
      const modelMsg: ChatMessage = { id: newId(), role: 'model', text: reply, at: now };
      setMessages((prev) => [...prev, modelMsg].slice(-MAX_STORED));
      setIntegration('gemini', { connected: true, lastSync: now, error: undefined });
    } catch (err) {
      if (controller.signal.aborted) return; // Parado pelo utilizador ou conversa limpa.
      const message = err instanceof Error ? err.message : 'Erro desconhecido ao contactar a Gemini.';
      setError(message);
      setIntegration('gemini', { error: message });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  }, [setIntegration]);

  const send = (text: string) => {
    if (loading || !hasKey) return;
    const userMsg: ChatMessage = { id: newId(), role: 'user', text, at: new Date().toISOString() };
    const next = [...messages, userMsg].slice(-MAX_STORED);
    setMessages(next);
    void run(next);
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  };

  const clearChat = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setMessages([]);
    setError(null);
    setConfirmClear(false);
  };

  const retry = () => { if (!loading) void run(messages); };

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col md:h-[calc(100dvh-4rem)]">
      <div className="shrink-0">
        <PageHeader
          title="Assistente"
          subtitle={`Modelo ${model}${hasKey ? '' : ' · sem chave configurada'}`}
          actions={
            <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)} disabled={messages.length === 0}>
              <Trash2 size={15} />
              Limpar conversa
            </Button>
          }
        />
        <ContextPanel />
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-2">
        {!hasKey && (
          <EmptyState
            icon={<KeyRound size={22} />}
            title="Precisas de uma chave da API Gemini"
            hint="Cria uma chave no Google AI Studio e cola-a nas Definições. Fica guardada apenas neste navegador."
            action={
              <Link
                to="/definicoes"
                className="inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg hover:opacity-90"
              >
                Ir para as Definições
              </Link>
            }
          />
        )}

        {hasKey && messages.length === 0 && (
          <div className="flex flex-col items-center px-4 py-8 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
              <Sparkles size={22} />
            </div>
            <h2 className="mt-4 text-base font-semibold">Olá{userName ? `, ${userName}` : ''}!</h2>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Conheço as tuas cadeiras, avaliações e plano de estudo. Escolhe uma ação ou escreve a tua pergunta.
            </p>
          </div>
        )}

        {messages.map((m) => (
          m.role === 'user'
            ? (
              <div
                key={m.id}
                className="rise ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-accent-fg"
              >
                {m.text}
              </div>
            )
            : (
              <div key={m.id} className="rise max-w-[95%] rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3">
                <Markdown text={m.text} />
              </div>
            )
        ))}

        {loading && (
          <div
            role="status"
            className="rise flex w-fit items-center gap-2.5 rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3 text-sm text-muted"
          >
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 animate-bounce rounded-full bg-accent"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </span>
            a pensar…
          </div>
        )}

        {error && (
          <div role="alert" className="rise flex max-w-[95%] flex-col items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            <span className="break-words">{error}</span>
            <Button size="sm" variant="secondary" onClick={retry} disabled={loading}>
              <RotateCcw size={14} />
              Tentar de novo
            </Button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 space-y-3 pt-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowActions((v) => !v)}
            aria-expanded={showActions}
            className="text-xs font-medium text-muted hover:text-fg"
          >
            {showActions ? 'Ocultar ações rápidas' : 'Mostrar ações rápidas'}
          </button>
        </div>
        {showActions && <QuickActions disabled={!hasKey || loading} onSend={send} />}
        <Composer disabled={!hasKey} loading={loading} onSend={send} onStop={stop} />
      </div>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Limpar conversa?"
        footer={
          <>
            <Button onClick={() => setConfirmClear(false)}>Cancelar</Button>
            <Button variant="danger" onClick={clearChat}>Limpar</Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Apaga o histórico desta conversa neste navegador. Os teus dados de estudo não são afetados.
        </p>
      </Modal>
    </div>
  );
}
