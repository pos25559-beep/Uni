import {
  BookOpen,
  FileText,
  FolderOpen,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Shield,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContextPanel } from '../components/assistant/ContextPanel';
import { Composer } from '../components/assistant/Composer';
import ConversationsModal from '../components/assistant/ConversationsModal';
import { Markdown } from '../components/assistant/Markdown';
import { QuickActions } from '../components/assistant/QuickActions';
import UniNotebookDrawer from '../components/assistant/UniNotebookDrawer';
import WeeklyTutorModal from '../components/assistant/WeeklyTutorModal';
import UniCollectiblesModal from '../components/brand/UniCollectiblesModal';
import { UniBuddy } from '../components/brand/UnipediaMarks';
import { TabGuideBanner, TabGuideHelpButton } from '../components/onboarding/TabGuideBanner';
import GeminiKeyGuideModal from '../components/settings/GeminiKeyGuideModal';
import { useNavigate } from 'react-router-dom';
import { ActionSheet, Badge, Button, Modal, PageHeader, PillSelect, cx } from '../components/ui';
import {
  buildDocumentContext,
  buildStudyContext,
  hasCustomGeminiKey,
  streamGeminiChat,
  SYSTEM_PROMPT,
  type ChatAttachment,
  type ChatMessage,
} from '../integrations/gemini';
import { getDailyQuotaSnapshot } from '../lib/aiQuota';
import { courseColors } from '../lib/colors';
import {
  TUTOR_SUBJECTS,
  appendMessage,
  deleteConversation,
  subjectLabel,
  subscribeConversations,
  subscribeMessages,
  upsertConversation,
  type Conversation,
} from '../lib/geminiConversations';
import { auth, onAuthStateChanged, type User } from '../lib/firebase';
import { resolveUniAccessory, UNI_PERSONAS } from '../lib/uniAccessories';
import { newId, useStore } from '../store/useStore';

const MAX_SENT = 20;

export default function Assistant() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const courses = useStore((s) => s.courses);
  const materials = useStore((s) => s.materials);
  const academicProfile = useStore((s) => s.academicProfile);
  const uniPreference = useStore((s) => s.settings.uniAccessory);
  const uniPersona = useStore((s) => s.settings.uniPersona ?? 'amigo');
  const aiConsent = useStore((s) => Boolean(s.settings.aiConsent));
  const hasCustomKey = useStore((s) => Boolean(s.settings.geminiApiKey?.trim()) || hasCustomGeminiKey());
  const updateSettings = useStore((s) => s.updateSettings);
  const userName = useStore((s) => s.settings.userName);
  const setIntegration = useStore((s) => s.setIntegration);

  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>('default');
  const [activeCourseId, setActiveCourseId] = useState<string>('all');
  const [activeSubject, setActiveSubject] = useState<string>('all');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [convsModalMode, setConvsModalMode] = useState<'list' | 'new' | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quotaTick, setQuotaTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const quota = useMemo(() => {
    void quotaTick;
    return getDailyQuotaSnapshot(hasCustomKey);
  }, [hasCustomKey, quotaTick]);
  const [confirmDeleteConv, setConfirmDeleteConv] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [keyGuideOpen, setKeyGuideOpen] = useState(false);
  const [collectiblesOpen, setCollectiblesOpen] = useState(false);
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
    if (messages.length === 0 && !loading && !error && !streamingText) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, loading, error, streamingText]);

  // Conversa ativa atual
  const currentConv = useMemo(
    () => conversations.find((c) => c.id === activeConvId),
    [conversations, activeConvId],
  );

  // Cadeira e visual ativo do Uni
  const activeCourse = useMemo(
    () => (activeCourseId === 'all' ? undefined : courses.find((c) => c.id === activeCourseId)),
    [courses, activeCourseId],
  );
  const uniAccessory = useMemo(
    () =>
      resolveUniAccessory(
        uniPreference,
        activeCourse?.name,
        activeCourse?.shortName,
        academicProfile?.degreeName,
      ),
    [uniPreference, activeCourse, academicProfile?.degreeName],
  );
  const uniWelcomeMood = loading
    ? 'thinking'
    : uniPersona === 'calmo'
      ? 'calm'
      : uniPersona === 'exigente'
        ? 'curious'
        : 'happy';

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

  const handleCreateConversation = async (opts?: {
    title?: string;
    courseId?: string;
    subject?: string;
  }) => {
    const id = newId();
    const resolvedCourseId =
      opts?.courseId !== undefined
        ? opts.courseId
        : activeCourseId !== 'all'
          ? activeCourseId
          : undefined;
    const resolvedSubject =
      opts?.subject ?? (activeSubject !== 'all' ? activeSubject : 'geral');
    const newConv: Conversation = {
      id,
      title: opts?.title?.trim() || 'Nova conversa',
      courseId: resolvedCourseId,
      subject: resolvedSubject,
      materialIds: selectedMaterialIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await upsertConversation(newConv);
    setActiveConvId(id);
    if (resolvedCourseId) setActiveCourseId(resolvedCourseId);
    setMessages([]);
  };

  const handleRenameConversation = async (conv: Conversation, title: string) => {
    await upsertConversation({
      ...conv,
      title,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDeleteConversationById = async (targetId: string) => {
    await deleteConversation(targetId);
    setConfirmDeleteConv(false);
    if (targetId === activeConvId) {
      const remaining = conversations.filter((c) => c.id !== targetId);
      if (remaining.length > 0) {
        setActiveConvId(remaining[0].id);
      } else {
        setActiveConvId('default');
        setMessages([]);
      }
    }
  };

  const handleDeleteActiveConv = async () => {
    if (!activeConvId) return;
    await handleDeleteConversationById(activeConvId);
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (activeCourseId !== 'all' && c.courseId !== activeCourseId) return false;
      if (activeSubject !== 'all' && (c.subject || 'geral') !== activeSubject) return false;
      return true;
    });
  }, [conversations, activeCourseId, activeSubject]);

  const run = useCallback(
    async (list: ChatMessage[], targetConvId: string, attachments?: ChatAttachment[]) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setStreamingText('');
      setError(null);
      try {
        const recent = list.slice(-MAX_SENT);
        const firstUser = recent.findIndex((m) => m.role === 'user');
        const payload = firstUser > 0 ? recent.slice(firstUser) : recent;

        // Contexto com resumo do semestre + personalidade e área do Uni
        const studyContext = buildStudyContext(useStore.getState());
        const docContext = buildDocumentContext(attachedMaterials);
        const system = SYSTEM_PROMPT(studyContext, docContext, {
          persona: uniPersona,
          accessory: uniAccessory,
          studentName: userName,
        });

        const reply = await streamGeminiChat({
          messages: payload,
          system,
          attachments,
          signal: controller.signal,
          onToken: (partial) => setStreamingText(partial),
        });
        const now = new Date().toISOString();
        const modelMsg: ChatMessage = {
          id: newId(),
          role: 'model',
          text: reply || 'Não consegui gerar texto desta vez. Podes tentar novamente?',
          at: now,
          sourceDocTitles: [
            ...attachedMaterials.map((m) => m.title),
            ...(attachments?.map((a) => a.name) ?? []),
          ],
        };

        setStreamingText(null);
        await appendMessage(targetConvId, modelMsg);
        setIntegration('gemini', { connected: true, lastSync: now, error: undefined });
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'O Uni teve um percalço ao responder.';
        setError(message);
        setIntegration('gemini', { error: message });
      } finally {
        setQuotaTick((n) => n + 1);
        if (abortRef.current === controller) {
          abortRef.current = null;
          setStreamingText(null);
          setLoading(false);
        }
      }
    },
    [attachedMaterials, setIntegration, uniAccessory, uniPersona, userName],
  );

  const send = async (text: string, attachments?: ChatAttachment[]) => {
    if (loading) return;

    let convId = activeConvId;
    if (!currentConv) {
      convId = newId();
      const newConv: Conversation = {
        id: convId,
        title: text.slice(0, 40) + (text.length > 40 ? '…' : ''),
        courseId: activeCourseId !== 'all' ? activeCourseId : undefined,
        subject: activeSubject !== 'all' ? activeSubject : 'geral',
        materialIds: selectedMaterialIds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await upsertConversation(newConv);
      setActiveConvId(convId);
    } else if (currentConv.title === 'Nova conversa') {
      await upsertConversation({
        ...currentConv,
        title: text.slice(0, 40) + (text.length > 40 ? '…' : ''),
        updatedAt: new Date().toISOString(),
      });
    }

    const userMsg: ChatMessage = {
      id: newId(),
      role: 'user',
      text,
      at: new Date().toISOString(),
      attachmentNames: attachments?.map((a) => a.name),
    };

    await appendMessage(convId, userMsg);
    void run([...messages, userMsg], convId, attachments);
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreamingText(null);
    setLoading(false);
  };

  const retry = () => {
    if (!loading && messages.length > 0) void run(messages, activeConvId);
  };

  return (
    <div className="flex h-[calc(100dvh-10rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col md:h-[calc(100dvh-4rem)]">
      {/* Cabeçalho */}
      <div className="shrink-0 space-y-3">
        <PageHeader
          eyebrow="O teu companheiro de estudo"
          title="Conversa com o"
          accentTitle="Uni"
          subtitle={user ? 'Sincronizado na tua conta' : 'Neste dispositivo'}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <TabGuideHelpButton tabKey="assistente" />
              <Button
                size="sm"
                variant="primary"
                onClick={() => setConvsModalMode('new')}
                className="min-h-[44px] px-3.5"
              >
                <Plus size={16} />
                Nova conversa
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setConvsModalMode('list')}
                className="min-h-[44px] px-3.5"
              >
                <FolderOpen size={15} />
                Conversas ({conversations.length})
              </Button>
              <Button
                variant="secondary"
                iconOnly
                onClick={() => setMenuOpen(true)}
                aria-label="Mais opções do Tutor"
                title="Opções"
              >
                <MoreHorizontal size={18} />
              </Button>
            </div>
          }
        />

        {/* Barra de Filtro Tátil, Caderno do Uni e Personalidade */}
        <div className="space-y-2 border-b border-line pb-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <PillSelect
              value={activeCourseId}
              onChange={setActiveCourseId}
              icon={<BookOpen size={14} />}
              ariaLabel="Filtrar por cadeira"
              options={[
                { value: 'all', label: 'Todas as cadeiras', hint: 'Vista geral do semestre' },
                ...courses.map((c) => ({
                  value: c.id,
                  label: c.shortName || c.name,
                  hint: c.name !== c.shortName ? c.name : undefined,
                  dotClass: courseColors[c.color]?.dot,
                })),
              ]}
            />

            <button
              type="button"
              onClick={() => setShowDocPicker(true)}
              className={cx(
                'flex min-h-[42px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition',
                attachedMaterials.length > 0
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line bg-surface text-muted hover:text-fg',
              )}
            >
              <FileText size={14} />
              <span>
                {attachedMaterials.length === 0
                  ? 'Anexar'
                  : `${attachedMaterials.length} anexado(s)`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setNotebookOpen(true)}
              className="flex min-h-[42px] items-center gap-1.5 rounded-full border border-[#141312]/10 bg-[#FCE99F]/85 px-3.5 py-1.5 text-xs font-semibold text-[#141312] transition hover:brightness-95 dark:border-white/10 dark:bg-surface-2 dark:text-[#FAF6EC]"
            >
              <Sparkles size={13} className="text-accent" />
              <span>Caderno</span>
            </button>

            <button
              type="button"
              onClick={() => setCollectiblesOpen(true)}
              className="flex min-h-[42px] items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-fg transition hover:border-accent"
            >
              <span>Coleção Uni</span>
            </button>
          </div>

          {/* Seletor rápido de tom/personalidade do Uni */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-surface-2/85 p-1">
              {UNI_PERSONAS.map((p) => {
                const active = uniPersona === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => updateSettings({ uniPersona: p.id })}
                    title={p.hint}
                    className={cx(
                      'min-h-[30px] rounded-full px-2.5 text-[11px] font-semibold transition',
                      active ? 'bg-ink-cta text-ink-cta-fg' : 'text-muted hover:text-fg',
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setKeyGuideOpen(true)}
              title="Ver como passar das 15 mensagens diárias com chave gratuita"
              className="rounded-full border border-line bg-surface-2/90 px-2.5 py-1 text-[11px] font-medium tabular text-muted transition hover:border-accent hover:text-fg"
            >
              {quota.bypassed
                ? 'Chave própria · Ilimitado'
                : `${quota.chatRemaining}/${quota.chatLimit} msgs · Desbloquear`}
            </button>

            {attachedMaterials.map((m) => (
              <span
                key={m.id}
                className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted"
              >
                <span className="max-w-[110px] truncate">{m.title}</span>
                <button
                  type="button"
                  onClick={() => toggleMaterial(m.id)}
                  aria-label={`Remover ${m.title}`}
                  className="hover:text-danger"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>

          {/* Filtro por assunto + conversas da cadeira/assunto com eliminação rápida */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {[{ id: 'all', label: 'Todos assuntos' }, ...TUTOR_SUBJECTS].map((subj) => {
              const active = activeSubject === subj.id;
              return (
                <button
                  key={subj.id}
                  type="button"
                  onClick={() => setActiveSubject(subj.id)}
                  className={cx(
                    'min-h-[34px] rounded-full border px-3 text-xs font-medium transition',
                    active
                      ? 'border-accent bg-accent-soft text-accent font-semibold'
                      : 'border-line bg-surface text-muted hover:text-fg',
                  )}
                >
                  {subj.label}
                </button>
              );
            })}
          </div>

          {filteredConversations.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {filteredConversations.slice(0, 6).map((c) => {
                const isActive = c.id === activeConvId;
                return (
                  <div
                    key={c.id}
                    className={cx(
                      'inline-flex shrink-0 items-center rounded-full border transition',
                      isActive
                        ? 'border-[#141312] bg-ink-cta text-ink-cta-fg dark:border-white/20'
                        : 'border-line bg-surface text-fg hover:border-accent/45',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveConvId(c.id)}
                      className="flex min-h-[36px] max-w-[200px] items-center gap-1.5 px-3 text-xs font-medium"
                    >
                      <span className="truncate">{c.title}</span>
                      <span
                        className={cx(
                          'shrink-0 rounded-full px-1.5 py-0.5 text-[10px]',
                          isActive ? 'bg-white/15' : 'bg-surface-2 text-muted',
                        )}
                      >
                        {subjectLabel(c.subject)}
                      </span>
                    </button>
                    {isActive && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteConv(true)}
                        aria-label={`Apagar conversa ${c.title}`}
                        title="Apagar esta conversa"
                        className="mr-1 grid size-7 place-items-center rounded-full text-ink-cta-fg/80 transition hover:bg-white/15 hover:text-ink-cta-fg"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Área de Mensagens */}
      <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-2">
        <TabGuideBanner
          tabKey="assistente"
          actions={
            !hasCustomKey ? (
              <Button size="sm" variant="primary" onClick={() => setKeyGuideOpen(true)}>
                Como pôr chave grátis (&gt;15 msgs)
              </Button>
            ) : undefined
          }
        />
        <ContextPanel />
        {messages.length === 0 && (
          <div className="flex flex-col items-center px-4 py-4 text-center sm:py-6">
            <div className="flex size-22 shrink-0 items-center justify-center rounded-full bg-pastel-sage/85 shadow-card dark:bg-surface-2">
              <UniBuddy
                mood={uniWelcomeMood}
                accessory={uniAccessory}
                size={62}
                onClick={() => setCollectiblesOpen(true)}
                ariaLabel="Uni — tocar para abrir a coleção de estilos"
              />
            </div>
            <h2 className="mt-4 font-display text-xl font-bold">
              Olá{userName ? `, ${userName}` : ''}! O que vamos rever?
            </h2>
            <p className="mt-1.5 max-w-sm text-sm text-muted">
              Sou o Uni! Posso explicar conceitos difíceis, criar perguntas de exame ou rever os teus apontamentos.
            </p>
            {attachedMaterials.length > 0 && (
              <p className="mt-2 text-xs font-medium text-ok">
                {attachedMaterials.length} documento(s) ativo(s) neste chat.
              </p>
            )}
          </div>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div
              key={m.id}
              className="rise ml-auto max-w-[85%] space-y-1.5 whitespace-pre-wrap break-words rounded-[22px] rounded-br-md bg-ink-cta px-4 py-3 text-sm text-ink-cta-fg shadow-card"
            >
              <p>{m.text}</p>
              {m.attachmentNames && m.attachmentNames.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5 text-[11px] opacity-85">
                  {m.attachmentNames.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5"
                    >
                      <FileText size={10} /> {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              key={m.id}
              className="rise max-w-[95%] rounded-[22px] rounded-bl-md bg-surface px-4 py-3.5 shadow-card"
            >
              <Markdown text={m.text} />
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-2 text-xs text-muted">
                <span>Sugestão do Uni · Valida sempre com a sebenta</span>
                {m.sourceDocTitles && m.sourceDocTitles.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <FileText size={12} />
                    {m.sourceDocTitles.join(', ')}
                  </span>
                )}
              </div>
            </div>
          ),
        )}

        {loading && streamingText && (
          <div className="rise max-w-[95%] rounded-[22px] rounded-bl-md bg-surface px-4 py-3.5 shadow-card">
            <Markdown text={streamingText} />
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-accent">
              <Sparkles size={11} className="animate-pulse" />
              <span>O Uni está a escrever…</span>
            </div>
          </div>
        )}

        {loading && !streamingText && (
          <div
            role="status"
            className="rise flex w-fit items-center gap-2.5 rounded-[22px] rounded-bl-md bg-surface px-4 py-2.5 text-sm text-muted shadow-card"
          >
            <UniBuddy mood="thinking" accessory={uniAccessory} size={30} interactive={false} />
            <span>O Uni está a pensar…</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rise flex max-w-[95%] flex-col items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            <span className="break-words">{error}</span>
            <div className="flex shrink-0 items-center gap-1.5">
              {error.includes('limite diário') && (
                <Button size="sm" variant="primary" onClick={() => setKeyGuideOpen(true)}>
                  Usar chave grátis
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={retry} disabled={loading}>
                <RotateCcw size={14} />
                Tentar de novo
              </Button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Aviso amigável de 1 toque para ativar o Uni nativo (zero chave obrigatória) */}
      {!aiConsent && (
        <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-[22px] bg-pastel-butter/75 px-4 py-3 text-xs text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles size={14} className="text-accent" />
              <span>Ativar o Uni</span>
              <Badge tone="accent">Incluído</Badge>
            </div>
            <p className="opacity-80">
              Pronto a usar com 1 toque (até {quota.chatLimit} mensagens/dia). Aceita apenas o envio das tuas perguntas para o Tutor responder.
            </p>
          </div>
          <Button size="sm" variant="primary" onClick={() => updateSettings({ aiConsent: true })}>
            Ativar Uni
          </Button>
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
            {showActions ? 'Ocultar sugestões' : 'Mostrar sugestões'}
          </button>
        </div>
        {showActions && <QuickActions disabled={loading} onSend={send} />}
        <Composer loading={loading} onSend={send} onStop={stop} />
      </div>

      <ActionSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Opções do Tutor"
        actions={[
          {
            id: 'checkin',
            label: 'Check-in semanal',
            hint: 'Avalia o ritmo e ajusta o planeador',
            icon: <MessageSquare size={16} />,
            onSelect: () => setTutorOpen(true),
          },
          {
            id: 'docs',
            label: 'Anexar documentos',
            hint: 'Seleciona PDFs ou links como contexto',
            icon: <FileText size={16} />,
            onSelect: () => setShowDocPicker(true),
          },
          {
            id: 'privacy',
            label: 'Preferências do Uni',
            hint: 'Gerir permissões e modelo do Uni',
            icon: <Shield size={16} />,
            onSelect: () => navigate('/definicoes/tutor'),
          },
          {
            id: 'clear',
            label: 'Apagar esta conversa',
            danger: true,
            icon: <Trash2 size={16} />,
            onSelect: () => setConfirmDeleteConv(true),
          },
        ]}
      />

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
      <GeminiKeyGuideModal open={keyGuideOpen} onClose={() => setKeyGuideOpen(false)} />
      <UniCollectiblesModal open={collectiblesOpen} onClose={() => setCollectiblesOpen(false)} />
      {convsModalMode && (
        <ConversationsModal
          open
          initialTab={convsModalMode}
          onClose={() => setConvsModalMode(null)}
          conversations={conversations}
          activeConvId={activeConvId}
          courses={courses}
          defaultCourseId={activeCourseId}
          defaultSubject={activeSubject}
          onSelectConversation={(conv) => {
            setActiveConvId(conv.id);
            if (conv.courseId) setActiveCourseId(conv.courseId);
          }}
          onCreateConversation={handleCreateConversation}
          onRenameConversation={handleRenameConversation}
          onDeleteConversation={handleDeleteConversationById}
        />
      )}
      <UniNotebookDrawer
        open={notebookOpen}
        onClose={() => setNotebookOpen(false)}
        courseName={activeCourse?.shortName || activeCourse?.name}
        attachedMaterials={attachedMaterials}
        accessory={uniAccessory}
        persona={uniPersona}
        onSendToChat={(markdown) => {
          void appendMessage(activeConvId, {
            id: newId(),
            role: 'model',
            text: markdown,
            at: new Date().toISOString(),
            sourceDocTitles: attachedMaterials.map((m) => m.title),
          });
        }}
      />
    </div>
  );
}
