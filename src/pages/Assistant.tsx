import {
  BookOpen,
  FileText,
  MessageSquare,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContextPanel } from '../components/assistant/ContextPanel';
import { Composer } from '../components/assistant/Composer';
import { Markdown } from '../components/assistant/Markdown';
import { QuickActions } from '../components/assistant/QuickActions';
import WeeklyTutorModal from '../components/assistant/WeeklyTutorModal';
import { Link } from 'react-router-dom';
import { Badge, Button, Modal, PageHeader, cx } from '../components/ui';
import {
  askGemini,
  buildDocumentContext,
  buildStudyContext,
  SYSTEM_PROMPT,
} from '../integrations/gemini';
import type { ChatMessage } from '../integrations/gemini';
import {
  appendMessage,
  deleteConversation,
  subscribeConversations,
  subscribeMessages,
  upsertConversation,
  type Conversation,
} from '../lib/geminiConversations';
import { auth, onAuthStateChanged, type User } from '../lib/firebase';
import { newId, useStore } from '../store/useStore';

const MAX_SENT = 20;

export default function Assistant() {
  const courses = useStore((s) => s.courses);
  const materials = useStore((s) => s.materials);
  const model = useStore((s) => s.settings.geminiModel) || 'gemini-2.5-flash';
  const aiConsent = useStore((s) => Boolean(s.settings.aiConsent));
  const hasApiKey = useStore((s) => Boolean(s.settings.geminiApiKey?.trim()));
  const updateSettings = useStore((s) => s.updateSettings);
  const userName = useStore((s) => s.settings.userName);
  const setIntegration = useStore((s) => s.setIntegration);

  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>('default');
  const [activeCourseId, setActiveCourseId] = useState<string>('all');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [showDocPicker, setShowDocPicker] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteConv, setConfirmDeleteConv] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Escuta estado de autenticação
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Escuta lista de conversas
  useEffect(() => {
    const unsub = subscribeConversations((list) => {
      setConversations(list);
      if (list.length > 0 && !list.some((c) => c.id === activeConvId)) {
        setActiveConvId(list[0].id);
      }
    });
    return () => unsub();
  }, [activeConvId]);

  // Escuta mensagens da conversa ativa
  useEffect(() => {
    if (!activeConvId) return;
    const unsub = subscribeMessages(activeConvId, (msgs) => {
      setMessages(msgs);
    });
    return () => unsub();
  }, [activeConvId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, loading, error]);

  // Conversa ativa atual
  const currentConv = useMemo(
    () => conversations.find((c) => c.id === activeConvId),
    [conversations, activeConvId],
  );

  // Materiais filtrados pela cadeira selecionada
  const availableMaterials = useMemo(() => {
    if (activeCourseId === 'all') return materials;
    return materials.filter((m) => m.courseId === activeCourseId);
  }, [materials, activeCourseId]);

  // Documentos anexados à conversa
  const attachedMaterials = useMemo(() => {
    return materials.filter((m) => selectedMaterialIds.includes(m.id));
  }, [materials, selectedMaterialIds]);

  const toggleMaterial = (id: string) => {
    setSelectedMaterialIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleCreateNewConv = async () => {
    const id = newId();
    const newConv: Conversation = {
      id,
      title: 'Nova conversa',
      courseId: activeCourseId !== 'all' ? activeCourseId : undefined,
      materialIds: selectedMaterialIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await upsertConversation(newConv);
    setActiveConvId(id);
    setMessages([]);
  };

  const handleDeleteActiveConv = async () => {
    if (!activeConvId) return;
    await deleteConversation(activeConvId);
    setConfirmDeleteConv(false);
    const remaining = conversations.filter((c) => c.id !== activeConvId);
    if (remaining.length > 0) {
      setActiveConvId(remaining[0].id);
    } else {
      handleCreateNewConv();
    }
  };

  const run = useCallback(
    async (list: ChatMessage[]) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const recent = list.slice(-MAX_SENT);
        const firstUser = recent.findIndex((m) => m.role === 'user');
        const payload = firstUser > 0 ? recent.slice(firstUser) : recent;

        // Contexto com resumo do semestre + contexto dos documentos
        const studyContext = buildStudyContext(useStore.getState());
        const docContext = buildDocumentContext(attachedMaterials);
        const system = SYSTEM_PROMPT(studyContext, docContext);

        const reply = await askGemini({ messages: payload, system, signal: controller.signal });
        const now = new Date().toISOString();
        const modelMsg: ChatMessage = {
          id: newId(),
          role: 'model',
          text: reply,
          at: now,
          sourceDocTitles: attachedMaterials.map((m) => m.title),
        };

        await appendMessage(activeConvId, modelMsg);
        setIntegration('gemini', { connected: true, lastSync: now, error: undefined });
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Erro ao contactar a Gemini.';
        setError(message);
        setIntegration('gemini', { error: message });
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setLoading(false);
        }
      }
    },
    [activeConvId, attachedMaterials, setIntegration],
  );

  const send = async (text: string) => {
    if (loading) return;

    let convId = activeConvId;
    if (!currentConv && conversations.length === 0) {
      convId = newId();
      const newConv: Conversation = {
        id: convId,
        title: text.slice(0, 36) + (text.length > 36 ? '…' : ''),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await upsertConversation(newConv);
      setActiveConvId(convId);
    } else if (currentConv && currentConv.title === 'Nova conversa') {
      await upsertConversation({
        ...currentConv,
        title: text.slice(0, 36) + (text.length > 36 ? '…' : ''),
        updatedAt: new Date().toISOString(),
      });
    }

    const userMsg: ChatMessage = {
      id: newId(),
      role: 'user',
      text,
      at: new Date().toISOString(),
    };

    await appendMessage(convId, userMsg);
    void run([...messages, userMsg]);
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  };

  const retry = () => {
    if (!loading && messages.length > 0) void run(messages);
  };

  return (
    <div className="flex h-[calc(100dvh-10rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col md:h-[calc(100dvh-4rem)]">
      {/* Cabeçalho */}
      <div className="shrink-0 space-y-3">
        <PageHeader
          title="Assistente Gemini"
          subtitle={`Modelo ${model} · ${user ? 'Sincronizado na cloud' : 'Modo local'}`}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTutorOpen(true)}
                title="Fazer check-in semanal com o tutor"
              >
                <MessageSquare size={15} />
                Check-in semanal
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCreateNewConv}
                title="Criar nova conversa"
              >
                <Plus size={15} />
                Nova conversa
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDeleteConv(true)}
                disabled={messages.length === 0 && conversations.length <= 1}
              >
                <Trash2 size={15} />
                Limpar
              </Button>
            </div>
          }
        />

        {/* Barra de Filtro de Cadeira e Documentos */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3 text-xs">
          {/* Seletor de Cadeira */}
          <div className="flex items-center gap-1.5">
            <BookOpen size={14} className="text-muted" />
            <select
              value={activeCourseId}
              onChange={(e) => setActiveCourseId(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-fg focus:outline-none"
            >
              <option value="all">Todas as cadeiras</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Botão de Documentos Anexados */}
          <button
            type="button"
            onClick={() => setShowDocPicker(true)}
            className={cx(
              'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition',
              attachedMaterials.length > 0
                ? 'border-accent bg-accent-soft text-accent font-medium'
                : 'border-line bg-surface text-muted hover:text-fg',
            )}
          >
            <FileText size={14} />
            <span>
              {attachedMaterials.length === 0
                ? 'Anexar documentos'
                : `${attachedMaterials.length} ${attachedMaterials.length === 1 ? 'documento anexado' : 'documentos anexados'}`}
            </span>
          </button>

          {/* Lista de tags de documentos anexados */}
          {attachedMaterials.map((m) => (
            <span
              key={m.id}
              className="flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[11px] text-muted border border-line"
            >
              <span className="truncate max-w-[120px]">{m.title}</span>
              <button
                type="button"
                onClick={() => toggleMaterial(m.id)}
                className="hover:text-danger"
              >
                <X size={12} />
              </button>
            </span>
          ))}

          {/* Lista rápida de conversas se existirem mais que 1 */}
          {conversations.length > 1 && (
            <div className="ml-auto flex items-center gap-1 overflow-x-auto max-w-[300px]">
              {conversations.slice(0, 4).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveConvId(c.id)}
                  className={cx(
                    'truncate max-w-[100px] rounded-lg px-2 py-1 text-[11px] transition',
                    c.id === activeConvId
                      ? 'bg-accent text-accent-fg font-medium'
                      : 'text-muted hover:bg-surface-2',
                  )}
                >
                  {c.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Área de Mensagens */}
      <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-2">
        <ContextPanel />
        {messages.length === 0 && (
          <div className="flex flex-col items-center px-4 py-8 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
              <Sparkles size={22} />
            </div>
            <h2 className="mt-4 text-base font-semibold">Olá{userName ? `, ${userName}` : ''}!</h2>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Posso responder a dúvidas sobre a matéria, criar perguntas de exame ou rever os teus
              apontamentos do Google Drive e materiais de estudo.
            </p>
            {attachedMaterials.length > 0 && (
              <p className="mt-2 text-xs text-ok">
                {attachedMaterials.length} documento(s) ativo(s) no contexto deste chat.
              </p>
            )}
          </div>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div
              key={m.id}
              className="rise ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-accent-fg"
            >
              {m.text}
            </div>
          ) : (
            <div
              key={m.id}
              className="rise max-w-[95%] rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3"
            >
              <Markdown text={m.text} />
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-2 text-[11px] text-muted">
                <span>Gerado por IA ({model}) · Valida informações académicas</span>
                {m.sourceDocTitles && m.sourceDocTitles.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <FileText size={11} />
                    {m.sourceDocTitles.join(', ')}
                  </span>
                )}
              </div>
            </div>
          ),
        )}

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
          <div
            role="alert"
            className="rise flex max-w-[95%] flex-col items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            <span className="break-words">{error}</span>
            <Button size="sm" variant="secondary" onClick={retry} disabled={loading}>
              <RotateCcw size={14} />
              Tentar de novo
            </Button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Aviso explícito EU AI Act Art. 50 & RGPD antes de usar IA */}
      {(!aiConsent || !hasApiKey) && (
        <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent-soft/60 px-4 py-3 text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 font-semibold text-fg">
              <Sparkles size={14} className="text-accent" />
              <span>Tutor IA (EU AI Act Art. 50)</span>
              <Badge tone="neutral">Opcional</Badge>
            </div>
            <p className="text-muted">
              {!aiConsent
                ? 'Para enviar perguntas ao Google Gemini tens primeiro de autorizar o processamento por IA.'
                : 'Consentimento ativo! Adiciona agora a tua chave pessoal Gemini (gratuita) nas Definições.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!aiConsent && (
              <Button size="sm" variant="primary" onClick={() => updateSettings({ aiConsent: true })}>
                Autorizar IA
              </Button>
            )}
            {!hasApiKey && (
              <Link
                to="/definicoes"
                className="inline-flex h-8 items-center rounded-xl border border-line bg-surface px-3 text-xs font-medium text-fg hover:bg-surface-2"
              >
                Configurar chave Gemini
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Compositor com espaço para teclado nativo */}
      <div
        className="shrink-0 space-y-3 pt-3"
        style={{ paddingBottom: 'var(--keyboard-height, 0px)' }}
      >
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
        {showActions && <QuickActions disabled={loading} onSend={send} />}
        <Composer loading={loading} onSend={send} onStop={stop} />
      </div>

      {/* Modal Seletor de Documentos/Materiais */}
      <Modal
        open={showDocPicker}
        onClose={() => setShowDocPicker(false)}
        title="Anexar Documentos de Estudo"
        footer={
          <Button variant="primary" onClick={() => setShowDocPicker(false)}>
            Concluir
          </Button>
        }
      >
        <p className="text-xs text-muted mb-3">
          Seleciona os documentos e resumos (do Google Drive, PDFs ou links) que o Gemini deve
          consultar nesta conversa.
        </p>
        {availableMaterials.length === 0 ? (
          <p className="text-xs text-muted py-4 text-center">
            Nenhum material encontrado para esta cadeira. Podes adicionar na página Materiais.
          </p>
        ) : (
          <ul className="divide-y divide-line max-h-60 overflow-y-auto">
            {availableMaterials.map((mat) => {
              const checked = selectedMaterialIds.includes(mat.id);
              return (
                <li
                  key={mat.id}
                  onClick={() => toggleMaterial(mat.id)}
                  className="flex items-center justify-between p-2 hover:bg-surface-2 rounded-xl cursor-pointer"
                >
                  <div className="min-w-0 pr-3">
                    <div className="text-xs font-medium text-fg truncate">{mat.title}</div>
                    <div className="text-[11px] text-muted uppercase tracking-wide">
                      {mat.provider}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {}}
                    className="size-4 rounded border-line"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      {/* Confirmação de Apagar Conversa */}
      <Modal
        open={confirmDeleteConv}
        onClose={() => setConfirmDeleteConv(false)}
        title="Apagar conversa?"
        footer={
          <>
            <Button onClick={() => setConfirmDeleteConv(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDeleteActiveConv}>
              Apagar
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Apaga o histórico de mensagens desta conversa. Os teus dados de estudo e outras conversas
          não são afetados.
        </p>
      </Modal>

      <WeeklyTutorModal open={tutorOpen} onClose={() => setTutorOpen(false)} />
    </div>
  );
}
