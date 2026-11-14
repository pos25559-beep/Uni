import {
  Award,
  BookOpen,
  CalendarDays,
  Check,
  FileText,
  FolderOpen,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Shield,
  SlidersHorizontal,
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
import { ActionSheet, Badge, Button, Modal, PillSelect, cx, showToast } from '../components/ui';
import {
  buildDocumentContext,
  buildStudyContext,
  hasCustomGeminiKey,
  parseTimetableFromScreenshot,
  streamGeminiChat,
  SYSTEM_PROMPT,
  type ChatAttachment,
  type ChatMessage,
} from '../integrations/gemini';
import { getDailyQuotaSnapshot } from '../lib/aiQuota';
import { courseColors, kindLabel, weekdayLong } from '../lib/colors';
import {
  commitScheduleSyncToStore,
  resolveExtractedScheduleBundle,
  type ResolvedScheduleSyncBundle,
} from '../lib/scheduleSync';
import { extractUniSyncBlock } from '../lib/visionParsers';
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
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
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [pendingSyncByMsgId, setPendingSyncByMsgId] = useState<
    Record<string, ResolvedScheduleSyncBundle>
  >({});
  const abortRef = useRef<AbortController | null>(null);
  const lastAttachmentsRef = useRef<{
    convId: string;
    msgId: string;
    attachments: ChatAttachment[];
  } | null>(null);
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
          appTone: useStore.getState().settings.appTone,
        });

        const reply = await streamGeminiChat({
          messages: payload,
          system,
          attachments,
          signal: controller.signal,
          onToken: (partial) => setStreamingText(extractUniSyncBlock(partial).displayText),
        });
        const now = new Date().toISOString();
        const extractedFromReply = extractUniSyncBlock(reply);
        let syncPayload = extractedFromReply.payload;

        const lastUserText =
          [...list].reverse().find((m) => m.role === 'user')?.text ?? '';
        const imageAtt = attachments?.find((a) => a.mimeType.startsWith('image/'));
        if (
          !syncPayload &&
          imageAtt &&
          /(hor[aá]ri|test|exame|avalia[cç]|calend[aá]ri|atualiz|pauta|entrega|prazo|guarda|import|reconhec|site|app|resto)/i.test(
            lastUserText,
          )
        ) {
          try {
            const parsed = await parseTimetableFromScreenshot(
              imageAtt.dataBase64,
              imageAtt.mimeType,
              { focus: 'assessments' },
            );
            if (parsed.slots.length > 0 || parsed.assessments.length > 0) {
              syncPayload = parsed;
            }
          } catch {
            // Não bloqueia a resposta do chat se a extração secundária falhar
          }
        }

        const msgId = newId();
        const modelMsg: ChatMessage = {
          id: msgId,
          role: 'model',
          text:
            extractedFromReply.displayText ||
            'Não consegui gerar texto desta vez. Podes tentar novamente?',
          at: now,
          sourceDocTitles: [
            ...attachedMaterials.map((m) => m.title),
            ...(attachments?.map((a) => a.name) ?? []),
          ],
        };

        if (syncPayload && (syncPayload.slots.length > 0 || syncPayload.assessments.length > 0)) {
          const resolved = resolveExtractedScheduleBundle(syncPayload);
          if (resolved.slots.length > 0 || resolved.assessments.length > 0) {
            setPendingSyncByMsgId((prev) => ({ ...prev, [msgId]: resolved }));
          }
        }

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
    setError(null);

    const userMsg: ChatMessage = {
      id: newId(),
      role: 'user',
      text,
      at: new Date().toISOString(),
      ...(attachments && attachments.length > 0
        ? { attachmentNames: attachments.map((a) => a.name) }
        : {}),
    };

    let convId = activeConvId;
    try {
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

      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      lastAttachmentsRef.current =
        attachments && attachments.length > 0
          ? { convId, msgId: userMsg.id, attachments }
          : null;
      await appendMessage(convId, userMsg);
      void run(nextMessages, convId, attachments);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Não foi possível guardar ou enviar a mensagem agora. Tenta novamente.';
      setError(msg);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreamingText(null);
    setLoading(false);
  };

  const retry = () => {
    if (!loading && messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
      const retryAttachments =
        lastAttachmentsRef.current &&
        lastAttachmentsRef.current.convId === activeConvId &&
        lastAttachmentsRef.current.msgId === lastUserMsg?.id
          ? lastAttachmentsRef.current.attachments
          : undefined;
      void run(messages, activeConvId, retryAttachments);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-8.25rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)-var(--keyboard-height,0px))] min-h-0 flex-col md:h-[calc(100dvh-4rem)]">
      {/* Cabeçalho unificado */}
      <div className="shrink-0 space-y-2 md:space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="hidden text-xs font-medium tracking-wide text-muted md:block">
              O teu companheiro de estudo
            </p>
            <h1 className="truncate font-display text-[19px] font-bold leading-tight tracking-tight text-fg sm:text-xl md:text-2xl">
              Conversa com o{' '}
              <span className="font-serif font-medium italic text-accent-ink">Uni</span>
            </h1>
            <p className="truncate text-xs font-medium text-muted">
              {user ? 'Sincronizado na tua conta' : 'Neste dispositivo'} ·{' '}
              {quota.bypassed
                ? 'Ilimitado'
                : `${quota.chatRemaining}/${quota.chatLimit} msgs`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
            <TabGuideHelpButton tabKey="assistente" />
            <Button
              size="sm"
              variant="primary"
              onClick={() => setConvsModalMode('new')}
              aria-label="Nova conversa"
              title="Nova conversa"
              className="min-h-[44px] px-2.5 md:px-3.5"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Nova conversa</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setConvsModalMode('list')}
              aria-label={`Conversas (${conversations.length})`}
              className="min-h-[44px] px-2.5 font-mono text-xs tabular-nums md:px-3.5 md:font-sans"
            >
              <FolderOpen size={15} />
              <span className="md:hidden">{conversations.length}</span>
              <span className="hidden md:inline">Conversas ({conversations.length})</span>
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
        </div>

        {/* Barra compacta de tom, Caderno do Uni e quota */}
        <div className="space-y-1.5 border-b border-line pb-2 text-xs md:space-y-2 md:pb-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setNotebookOpen(true)}
                className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-[#141312]/10 bg-[#FCE99F]/85 px-3 py-1.5 text-xs font-semibold text-[#141312] transition hover:brightness-95 dark:border-white/10 dark:bg-surface-2 dark:text-[#FAF6EC] md:px-3.5"
              >
                <Sparkles size={13} className="text-accent-ink dark:text-accent" />
                <span>Caderno</span>
              </button>

              <button
                type="button"
                onClick={() => setCollectiblesOpen(true)}
                className="hidden min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-fg transition hover:border-accent md:flex"
              >
                <span>Coleção Uni</span>
              </button>
            </div>

            <div className="hidden items-center gap-2 md:flex">
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
                        'min-h-[34px] rounded-full px-3 text-xs font-semibold transition',
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
                className="min-h-[36px] rounded-full border border-line bg-surface-2/90 px-3 py-1 text-xs font-medium tabular text-muted transition hover:border-accent hover:text-fg"
              >
                {quota.bypassed
                  ? 'Chave própria · Ilimitado'
                  : `${quota.chatRemaining}/${quota.chatLimit} msgs · Desbloquear`}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMobileFiltersOpen((v) => !v)}
              aria-expanded={mobileFiltersOpen}
              aria-label="Personalidade, coleção e mensagens do Uni"
              className={cx(
                'flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition md:hidden',
                mobileFiltersOpen
                  ? 'border-accent bg-accent-soft text-accent-ink'
                  : 'border-line bg-surface text-muted hover:text-fg',
              )}
            >
              <SlidersHorizontal size={14} />
              <span>Tom</span>
            </button>
          </div>

          {mobileFiltersOpen && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 md:hidden">
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
                        'min-h-[36px] rounded-full px-2.5 text-xs font-semibold transition',
                        active ? 'bg-ink-cta text-ink-cta-fg' : 'text-muted hover:text-fg',
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCollectiblesOpen(true)}
                  className="flex min-h-[36px] items-center gap-1 rounded-full border border-line bg-surface px-2.5 text-xs font-semibold text-fg transition hover:border-accent"
                >
                  <Award size={13} className="text-accent-ink" />
                  <span>Coleção</span>
                </button>
                <button
                  type="button"
                  onClick={() => setKeyGuideOpen(true)}
                  title="Ver como passar das 15 mensagens diárias com chave gratuita"
                  className="min-h-[36px] rounded-full border border-line bg-surface-2/90 px-2.5 py-1 text-xs font-medium tabular text-muted transition hover:border-accent hover:text-fg"
                >
                  {quota.bypassed
                    ? 'Chave própria · Ilimitado'
                    : `${quota.chatRemaining}/${quota.chatLimit} msgs`}
                </button>
              </div>
            </div>
          )}

          {/* Filtro por assunto só antes de iniciar a conversa */}
          {messages.length === 0 && (
            <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5 md:flex-wrap md:overflow-visible">
              {[{ id: 'all', label: 'Todos assuntos' }, ...TUTOR_SUBJECTS].map((subj) => {
                const active = activeSubject === subj.id;
                return (
                  <button
                    key={subj.id}
                    type="button"
                    onClick={() => setActiveSubject(subj.id)}
                    className={cx(
                      'min-h-[36px] shrink-0 rounded-full border px-3 text-xs font-medium transition',
                      active
                        ? 'border-accent bg-accent-soft font-semibold text-accent-ink'
                        : 'border-line bg-surface text-muted hover:text-fg',
                    )}
                  >
                    {subj.label}
                  </button>
                );
              })}
            </div>
          )}

          {filteredConversations.length > 0 && (
            <div
              className={cx(
                'items-center gap-1.5 overflow-x-auto pb-0.5',
                filteredConversations.length > 1 ? 'flex' : 'hidden md:flex',
              )}
            >
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
                      className="flex min-h-[36px] max-w-[210px] items-center gap-1.5 px-3 text-xs font-medium"
                    >
                      <span className="truncate">{c.title}</span>
                      <span
                        className={cx(
                          'shrink-0 rounded-full px-2 py-0.5 text-xs',
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
                        className="mr-1 grid size-8 place-items-center rounded-full text-ink-cta-fg/80 transition hover:bg-white/15 hover:text-ink-cta-fg"
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
      <div className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto px-0.5 py-1.5 md:mt-3 md:space-y-4 md:px-1 md:py-2">
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
        {messages.length === 0 && (
          <div className="flex flex-col items-center px-3 py-2 text-center sm:px-4 sm:py-6">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-pastel-sage/85 shadow-card dark:bg-surface-2 sm:size-22">
              <UniBuddy
                mood={uniWelcomeMood}
                accessory={uniAccessory}
                size={52}
                onClick={() => setCollectiblesOpen(true)}
                ariaLabel="Uni — tocar para abrir a coleção de estilos"
              />
            </div>
            <h2 className="mt-3 font-display text-lg font-bold sm:mt-4 sm:text-xl">
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
                <div className="flex flex-wrap gap-1 pt-0.5 text-xs opacity-90">
                  {m.attachmentNames.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5"
                    >
                      <FileText size={11} /> {name}
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
              {pendingSyncByMsgId[m.id] && (
                <UniSyncCard
                  bundle={pendingSyncByMsgId[m.id]}
                  onChange={(next) =>
                    setPendingSyncByMsgId((prev) => ({ ...prev, [m.id]: next }))
                  }
                  onApply={() => {
                    const current = pendingSyncByMsgId[m.id];
                    if (!current) return;
                    const res = commitScheduleSyncToStore(current);
                    const parts: string[] = [];
                    if (res.assessmentsCount > 0) {
                      parts.push(`${res.assessmentsCount} avaliação(ões)`);
                    }
                    if (res.classesCount > 0) {
                      parts.push(`${res.classesCount} aula(s)`);
                    }
                    if (res.createdCoursesCount > 0) {
                      parts.push(`${res.createdCoursesCount} cadeira(s)`);
                    }
                    const summary =
                      parts.length > 0
                        ? `Atualizado: ${parts.join(', ')} no Calendário e Plano.`
                        : 'Nada novo para adicionar — tudo já existia na app.';
                    setPendingSyncByMsgId((prev) => ({
                      ...prev,
                      [m.id]: { ...current, applied: true, appliedSummary: summary },
                    }));
                    showToast(summary);
                  }}
                  onOpenCalendar={() => navigate('/calendario')}
                />
              )}
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
            <div className="mt-2 flex items-center gap-1.5 text-xs text-accent-ink">
              <Sparkles size={12} className="animate-pulse" />
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

      {/* Contexto do compositor + sugestões + entrada de mensagem */}
      <div className="shrink-0 space-y-2 pt-2 md:space-y-2.5 md:pt-3">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <PillSelect
              value={activeCourseId}
              onChange={setActiveCourseId}
              icon={<BookOpen size={14} />}
              ariaLabel="Contexto da cadeira"
              className="min-w-0 [&>button]:max-w-[140px] [&>button]:px-2.5 sm:[&>button]:max-w-[210px] sm:[&>button]:px-3"
              options={[
                { value: 'all', label: 'Todas as cadeiras', shortLabel: 'Todas', hint: 'Vista geral do semestre' },
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
              aria-label="Anexar apontamentos"
              className={cx(
                'flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition sm:px-3',
                attachedMaterials.length > 0
                  ? 'border-accent bg-accent-soft text-accent-ink'
                  : 'border-line bg-surface text-muted hover:text-fg',
              )}
            >
              <FileText size={14} />
              <span className="sm:hidden">
                {attachedMaterials.length === 0 ? 'Anexar' : `${attachedMaterials.length} anex.`}
              </span>
              <span className="hidden sm:inline">
                {attachedMaterials.length === 0
                  ? 'Anexar apontamentos'
                  : `${attachedMaterials.length} anexado(s)`}
              </span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowActions((v) => !v)}
            aria-expanded={showActions}
            className="min-h-[44px] shrink-0 whitespace-nowrap px-2 text-xs font-medium text-muted hover:text-fg"
          >
            <span className="sm:hidden">{showActions ? 'Ocultar' : 'Sugestões'}</span>
            <span className="hidden sm:inline">{showActions ? 'Ocultar sugestões' : 'Mostrar sugestões'}</span>
          </button>
        </div>

        {attachedMaterials.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attachedMaterials.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs text-muted"
              >
                <span className="max-w-[140px] truncate">{m.title}</span>
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
        )}

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
            id: 'collectibles',
            label: 'Coleção do Uni',
            hint: 'Estilos e acessórios desbloqueados',
            icon: <Award size={16} />,
            onSelect: () => setCollectiblesOpen(true),
          },
          {
            id: 'privacy',
            label: 'Preferências do Uni',
            hint: 'Gerir permissões e modelo do Uni',
            icon: <Shield size={16} />,
            onSelect: () => navigate('/definicoes/tutor'),
          },
          {
            id: 'context-view',
            label: 'O que o Uni sabe',
            hint: 'Ver resumo enviado com as perguntas',
            icon: <Shield size={16} />,
            onSelect: () => setContextModalOpen(true),
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
      {contextModalOpen && (
        <Modal
          open
          onClose={() => setContextModalOpen(false)}
          title="O que o Uni sabe"
          footer={
            <Button variant="primary" onClick={() => setContextModalOpen(false)}>
              Fechar
            </Button>
          }
        >
          <ContextPanel defaultOpen />
        </Modal>
      )}
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

interface UniSyncCardProps {
  bundle: ResolvedScheduleSyncBundle;
  onChange: (next: ResolvedScheduleSyncBundle) => void;
  onApply: () => void;
  onOpenCalendar: () => void;
}

/** Cartão interativo dentro da resposta do Uni para aplicar aulas e avaliações no Calendário e Plano. */
function UniSyncCard({ bundle, onChange, onApply, onOpenCalendar }: UniSyncCardProps) {
  const selectedCount =
    bundle.slots.filter((s) => s.selected).length +
    bundle.assessments.filter((a) => a.selected).length;

  return (
    <div
      data-testid="uni-sync-card"
      className="mt-3 rounded-2xl border border-accent/25 bg-surface-2/80 p-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="text-accent" />
          <span className="text-xs font-semibold text-fg">
            Sincronizar com o resto da app
          </span>
        </div>
        <Badge tone={bundle.applied ? 'accent' : 'neutral'}>
          {bundle.applied
            ? 'Aplicado'
            : `${bundle.assessments.length} aval. · ${bundle.slots.length} aula(s)`}
        </Badge>
      </div>

      {bundle.applied ? (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-accent-soft/60 px-3 py-2 text-xs text-accent">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Check size={14} />
            {bundle.appliedSummary || 'Informação aplicada ao Calendário e Plano.'}
          </span>
          <button
            type="button"
            onClick={onOpenCalendar}
            className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-accent-fg transition hover:opacity-90"
          >
            Abrir Calendário
          </button>
        </div>
      ) : (
        <>
          <div className="mt-2.5 max-h-60 space-y-1.5 overflow-y-auto pr-0.5">
            {bundle.assessments.map((a, idx) => (
              <div
                key={a.id}
                onClick={() => {
                  const next = bundle.assessments.map((item, i) =>
                    i === idx ? { ...item, selected: !item.selected } : item,
                  );
                  onChange({ ...bundle, assessments: next });
                }}
                role="checkbox"
                aria-checked={a.selected}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    const next = bundle.assessments.map((item, i) =>
                      i === idx ? { ...item, selected: !item.selected } : item,
                    );
                    onChange({ ...bundle, assessments: next });
                  }
                }}
                className={cx(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 transition',
                  a.selected
                    ? 'border-accent/40 bg-surface'
                    : 'border-line bg-surface/50 opacity-60',
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cx(
                      'grid h-4 w-4 shrink-0 place-items-center rounded-full border transition',
                      a.selected
                        ? 'border-accent bg-accent text-accent-fg'
                        : 'border-muted/40 bg-surface',
                    )}
                  >
                    {a.selected && <Check size={10} />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-fg">
                      {a.courseName} · {a.title || kindLabel[a.kind]}
                    </p>
                    <p className="truncate text-[11px] text-muted">
                      {a.date}
                      {a.location ? ` · Sala ${a.location}` : ''}
                    </p>
                  </div>
                </div>
                <Badge tone={a.matchedCourse ? 'accent' : 'neutral'}>
                  {a.matchedCourse
                    ? `Liga a ${a.matchedCourse.shortName || a.matchedCourse.name}`
                    : 'Cria cadeira'}
                </Badge>
              </div>
            ))}

            {bundle.slots.map((s, idx) => (
              <div
                key={s.id}
                onClick={() => {
                  const next = bundle.slots.map((item, i) =>
                    i === idx ? { ...item, selected: !item.selected } : item,
                  );
                  onChange({ ...bundle, slots: next });
                }}
                role="checkbox"
                aria-checked={s.selected}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    const next = bundle.slots.map((item, i) =>
                      i === idx ? { ...item, selected: !item.selected } : item,
                    );
                    onChange({ ...bundle, slots: next });
                  }
                }}
                className={cx(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 transition',
                  s.selected
                    ? 'border-accent/40 bg-surface'
                    : 'border-line bg-surface/50 opacity-60',
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cx(
                      'grid h-4 w-4 shrink-0 place-items-center rounded-full border transition',
                      s.selected
                        ? 'border-accent bg-accent text-accent-fg'
                        : 'border-muted/40 bg-surface',
                    )}
                  >
                    {s.selected && <Check size={10} />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-fg">
                      {s.courseName} · {s.type}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                      <select
                        aria-label={`Dia da semana para ${s.courseName}`}
                        value={s.weekday}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const nextWeekday = Number(e.target.value);
                          const next = bundle.slots.map((item, i) =>
                            i === idx ? { ...item, weekday: nextWeekday } : item,
                          );
                          onChange({ ...bundle, slots: next });
                        }}
                        className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-fg outline-none focus:border-accent"
                      >
                        {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
                          <option key={wd} value={wd}>
                            {weekdayLong[wd]}
                          </option>
                        ))}
                      </select>
                      <span>
                        {s.start}–{s.end}
                        {s.room ? ` · Sala ${s.room}` : ''}
                      </span>
                    </div>
                  </div>
                </div>
                <Badge tone={s.matchedCourse ? 'accent' : 'neutral'}>
                  {s.matchedCourse
                    ? `Liga a ${s.matchedCourse.shortName || s.matchedCourse.name}`
                    : 'Cria cadeira'}
                </Badge>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-muted">
              Podes ajustar o dia da semana ou desmarcar itens antes de guardar.
            </span>
            <Button
              size="sm"
              variant="primary"
              disabled={selectedCount === 0}
              onClick={onApply}
              className="gap-1.5"
            >
              <Check size={13} />
              Aplicar no Calendário e Plano ({selectedCount})
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
