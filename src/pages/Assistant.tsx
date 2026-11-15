import {
  Award,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  FileText,
  FolderOpen,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  RotateCcw,
  Shield,
  Sparkles,
  SquarePen,
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
import { ActionSheet, Badge, Button, Modal, PillSelect, SegmentedControl, cx, showToast } from '../components/ui';
import {
  buildDocumentContext,
  buildStudyContext,
  extractScheduleFromText,
  hasCustomGeminiKey,
  parseTimetableFromScreenshot,
  streamGeminiChat,
  SYSTEM_PROMPT,
  type ChatAttachment,
  type ChatMessage,
} from '../integrations/gemini';
import { getDailyQuotaSnapshot } from '../lib/aiQuota';
import { courseColors, kindLabel, weekdayLong } from '../lib/colors';
import { collectKnownCourseCandidates, getDegreeCurriculum } from '../lib/portugalCurriculum';
import {
  commitScheduleSyncToStore,
  resolveExtractedScheduleBundle,
  type ResolvedScheduleSyncBundle,
} from '../lib/scheduleSync';
import { extractUniSyncBlock, looksSyncableReply } from '../lib/visionParsers';
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
import { MAX_AI_MATERIAL_FILES, resolveMaterialsForAI } from '../lib/materialContent';
import { googleService } from '../services/googleService';
import { newId, useStore } from '../store/useStore';

const MAX_SENT = 20;
const PENDING_SYNC_STORAGE_KEY = 'unipedia-pending-sync-v1';

function readStoredPendingSync(): Record<string, ResolvedScheduleSyncBundle> {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, ResolvedScheduleSyncBundle>)
      : {};
  } catch {
    return {};
  }
}

function getKnownCourseHintsFromStore() {
  const state = useStore.getState();
  const profile = state.academicProfile;
  const degreeTemplates =
    profile?.universityId && profile?.degreeId
      ? (getDegreeCurriculum(profile.universityId, profile.degreeId)?.courses ?? [])
      : [];
  return collectKnownCourseCandidates({
    courses: state.courses,
    completedCourses: profile?.completedCourses ?? [],
    degreeTemplates,
  });
}

export default function Assistant() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileComposerToolsOpen, setMobileComposerToolsOpen] = useState(false);
  const courses = useStore((s) => s.courses);
  const materials = useStore((s) => s.materials);
  const academicProfile = useStore((s) => s.academicProfile);
  const uniPreference = useStore((s) => s.settings.uniAccessory);
  const uniPersona = useStore((s) => s.settings.uniPersona ?? 'amigo');
  const appTone = useStore((s) => s.settings.appTone ?? 'vibrante');
  const isMinimal = appTone === 'serio';
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
  const [dismissedAutoMaterialIds, setDismissedAutoMaterialIds] = useState<string[]>([]);
  const autoPinnedIdsRef = useRef<string[]>([]);
  const [driveAuthNeeded, setDriveAuthNeeded] = useState(false);
  const [authorizingDrive, setAuthorizingDrive] = useState(false);
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
  >(readStoredPendingSync);
  const [syncingMsgId, setSyncingMsgId] = useState<string | null>(null);
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

  // Pré-anexa até 3 materiais fixados da cadeira ativa (sem sobrescrever dispensas do utilizador)
  useEffect(() => {
    const prevAuto = new Set(autoPinnedIdsRef.current);
    const nextPinnedIds =
      activeCourseId === 'all'
        ? []
        : materials
            .filter(
              (m) =>
                m.courseId === activeCourseId &&
                m.pinned &&
                !dismissedAutoMaterialIds.includes(m.id),
            )
            .slice(0, MAX_AI_MATERIAL_FILES)
            .map((m) => m.id);

    autoPinnedIdsRef.current = nextPinnedIds;
    setSelectedMaterialIds((prev) => {
      const preserved = prev.filter((id) => !prevAuto.has(id) || nextPinnedIds.includes(id));
      const merged = [...preserved];
      for (const id of nextPinnedIds) {
        if (!merged.includes(id)) merged.push(id);
      }
      if (merged.length === prev.length && merged.every((id, i) => id === prev[i])) {
        return prev;
      }
      return merged;
    });
  }, [activeCourseId, materials, dismissedAutoMaterialIds]);

  const toggleMaterial = (id: string) => {
    setSelectedMaterialIds((prev) => {
      const removing = prev.includes(id);
      setDismissedAutoMaterialIds((dismissed) =>
        removing
          ? dismissed.includes(id)
            ? dismissed
            : [...dismissed, id]
          : dismissed.filter((x) => x !== id),
      );
      return removing ? prev.filter((x) => x !== id) : [...prev, id];
    });
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

        // Contexto com resumo do semestre + leitura real dos materiais anexados + personalidade do Uni
        const resolvedMaterials =
          attachedMaterials.length > 0
            ? await resolveMaterialsForAI(attachedMaterials, {
                maxFiles: MAX_AI_MATERIAL_FILES,
                signal: controller.signal,
              })
            : {
                attachments: [] as ChatAttachment[],
                textExcerpts: [],
                readTitles: [],
                skipped: [],
                needsDriveAuth: false,
              };
        setDriveAuthNeeded(resolvedMaterials.needsDriveAuth);

        const mergedAttachments: ChatAttachment[] = [
          ...resolvedMaterials.attachments,
          ...(attachments ?? []),
        ].slice(0, 4);

        const studyContext = buildStudyContext(useStore.getState());
        const activeCourseName = activeCourse?.shortName || activeCourse?.name;
        const docContext = buildDocumentContext(attachedMaterials, {
          activeCourseName,
          courseMaterials: availableMaterials,
          resolvedExcerpts: resolvedMaterials.textExcerpts,
        });
        const system = SYSTEM_PROMPT(studyContext, docContext, {
          persona: uniPersona,
          accessory: uniAccessory,
          studentName: userName,
          appTone: useStore.getState().settings.appTone,
        });

        const reply = await streamGeminiChat({
          messages: payload,
          system,
          attachments: mergedAttachments.length > 0 ? mergedAttachments : undefined,
          signal: controller.signal,
          onToken: (partial) => setStreamingText(extractUniSyncBlock(partial).displayText),
        });
        const now = new Date().toISOString();
        const extractedFromReply = extractUniSyncBlock(reply);
        let syncPayload = extractedFromReply.payload;

        const lastUserText =
          [...list].reverse().find((m) => m.role === 'user')?.text ?? '';
        const imageAtt = attachments?.find((a) => a.mimeType.startsWith('image/'));
        const displayText =
          extractedFromReply.displayText ||
          'Não consegui gerar texto desta vez. Podes tentar novamente?';

        const shouldAutoExtract =
          !syncPayload &&
          (Boolean(imageAtt) ||
            looksSyncableReply(displayText) ||
            /(atualiz|calend[aá]ri|agenda|plano|guarda|sincroniz|adiciona.*(teste|exame|aula)|p[õo]e.*(teste|exame|hor[aá]rio))/i.test(
              lastUserText,
            ));

        if (shouldAutoExtract) {
          const knownCourses = getKnownCourseHintsFromStore();
          try {
            if (looksSyncableReply(displayText)) {
              const fromText = await extractScheduleFromText(displayText, knownCourses);
              if (fromText.slots.length > 0 || fromText.assessments.length > 0) {
                syncPayload = fromText;
              }
            }
            if (!syncPayload && imageAtt) {
              const parsed = await parseTimetableFromScreenshot(
                imageAtt.dataBase64,
                imageAtt.mimeType,
                { focus: 'assessments', knownCourses },
              );
              if (parsed.slots.length > 0 || parsed.assessments.length > 0) {
                syncPayload = parsed;
              }
            }
          } catch {
            // Não bloqueia a resposta do chat se a extração secundária falhar; o botão manual mantém-se disponível
          }
        }

        const msgId = newId();
        const modelMsg: ChatMessage = {
          id: msgId,
          role: 'model',
          text: displayText,
          at: now,
          sourceDocTitles: [
            ...resolvedMaterials.readTitles,
            ...attachedMaterials
              .filter(
                (m) =>
                  !resolvedMaterials.readTitles.includes(m.title) &&
                  m.provider !== 'notebooklm',
              )
              .slice(0, MAX_AI_MATERIAL_FILES)
              .map((m) => m.title),
            ...(attachments?.map((a) => a.name) ?? []),
          ].filter((title, i, arr) => Boolean(title) && arr.indexOf(title) === i),
        };

        if (syncPayload && (syncPayload.slots.length > 0 || syncPayload.assessments.length > 0)) {
          const resolved = resolveExtractedScheduleBundle(syncPayload);
          if (resolved.slots.length > 0 || resolved.assessments.length > 0) {
            setPendingSyncByMsgId((prev) => {
              const next = { ...prev, [msgId]: resolved };
              try {
                const entries = Object.entries(next).slice(-25);
                localStorage.setItem(
                  PENDING_SYNC_STORAGE_KEY,
                  JSON.stringify(Object.fromEntries(entries)),
                );
              } catch {
                // ignore storage quota errors
              }
              return next;
            });
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
    [
      activeCourse,
      attachedMaterials,
      availableMaterials,
      setIntegration,
      uniAccessory,
      uniPersona,
      userName,
    ],
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

  const updatePendingSyncForMsg = useCallback(
    (msgId: string, nextBundle: ResolvedScheduleSyncBundle) => {
      setPendingSyncByMsgId((prev) => {
        const next = { ...prev, [msgId]: nextBundle };
        try {
          const entries = Object.entries(next).slice(-25);
          localStorage.setItem(
            PENDING_SYNC_STORAGE_KEY,
            JSON.stringify(Object.fromEntries(entries)),
          );
        } catch {
          // ignore
        }
        return next;
      });
    },
    [],
  );

  const extractSyncFromExistingMessage = useCallback(
    async (msg: ChatMessage) => {
      if (syncingMsgId) return;
      setSyncingMsgId(msg.id);
      try {
        const inline = extractUniSyncBlock(msg.text).payload;
        const knownCourses = getKnownCourseHintsFromStore();
        const parsed =
          inline ?? (await extractScheduleFromText(msg.text, knownCourses));
        const resolved = resolveExtractedScheduleBundle(parsed);
        if (resolved.slots.length === 0 && resolved.assessments.length === 0) {
          showToast('Não encontrei datas exatas de provas ou aulas nesta resposta.', 'neutral');
          return;
        }
        updatePendingSyncForMsg(msg.id, resolved);
      } catch (err) {
        showToast(
          err instanceof Error
            ? err.message
            : 'Não foi possível preparar a sincronização agora.',
          'danger',
        );
      } finally {
        setSyncingMsgId(null);
      }
    },
    [syncingMsgId, updatePendingSyncForMsg],
  );

  const firstName = userName?.trim().split(/\s+/)[0] || '';

  return (
    <div className="flex h-[calc(100dvh-5.25rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)-var(--keyboard-height,0px))] min-h-0 flex-col md:h-[calc(100dvh-3.5rem)]">
      {/* Cabeçalho minimalista estilo app Gemini no telemóvel (< md) */}
      <div className="shrink-0 space-y-2 pb-1 md:hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setConvsModalMode('list')}
              aria-label={`Conversas (${conversations.length})`}
              className="relative grid size-10 shrink-0 place-items-center rounded-full text-fg transition hover:bg-surface-2"
            >
              <Menu size={20} />
              {conversations.length > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent"
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileFiltersOpen((v) => !v)}
              aria-expanded={mobileFiltersOpen}
              aria-label="Mudar estilo e ver estado do Uni"
              className="flex min-h-[40px] min-w-0 items-center gap-1.5 rounded-full px-2 text-left transition hover:bg-surface-2"
            >
              <span className="truncate font-display text-lg font-bold tracking-tight text-fg">
                {currentConv && messages.length > 0 ? (
                  currentConv.title
                ) : (
                  <>
                    Uni{' '}
                    <span className="font-normal text-muted">
                      {UNI_PERSONAS.find((p) => p.id === uniPersona)?.label ?? 'Amigo'}
                    </span>
                  </>
                )}
              </span>
              <ChevronDown
                size={15}
                className={cx('shrink-0 text-muted transition-transform', mobileFiltersOpen && 'rotate-180')}
              />
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => setConvsModalMode('new')}
              aria-label="Nova conversa"
              title="Nova conversa"
              className="grid size-10 place-items-center rounded-full text-fg transition hover:bg-surface-2"
            >
              <SquarePen size={18} />
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Mais opções do Tutor"
              title="Opções"
              className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg"
            >
              <MoreHorizontal size={19} />
            </button>
          </div>
        </div>

        {mobileFiltersOpen && (
          <div className="space-y-2 rounded-2xl border border-line bg-surface p-2.5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SegmentedControl
                layoutId="tutor-persona-pill-mobile"
                value={uniPersona}
                onChange={(v) => updateSettings({ uniPersona: v as typeof uniPersona })}
                items={UNI_PERSONAS.map((p) => ({ id: p.id, label: p.label }))}
              />
              <button
                type="button"
                onClick={() => setKeyGuideOpen(true)}
                className="min-h-[38px] rounded-full border border-line bg-surface-2 px-3 text-xs font-medium tabular text-muted"
              >
                {quota.bypassed ? 'Ilimitado' : `${quota.chatRemaining}/${quota.chatLimit} msgs`}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setMobileFiltersOpen(false);
                  setNotebookOpen(true);
                }}
                className="flex min-h-[38px] items-center gap-1.5 rounded-full bg-pastel-butter/80 px-3 text-xs font-semibold text-[#141312] dark:bg-[#352D14] dark:text-[#FAF6EC]"
              >
                <Sparkles size={13} /> Caderno do Uni
              </button>
              {!isMinimal && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileFiltersOpen(false);
                    setCollectiblesOpen(true);
                  }}
                  className="flex min-h-[38px] items-center gap-1.5 rounded-full bg-pastel-sage/65 px-3 text-xs font-semibold text-[#141312] dark:bg-[#23311B] dark:text-[#FAF6EC]"
                >
                  <Award size={13} /> Coleção
                </button>
              )}
              <TabGuideHelpButton tabKey="assistente" />
            </div>
          </div>
        )}
      </div>

      {/* Cabeçalho completo (Desktop md+) */}
      <div className="hidden shrink-0 space-y-2.5 md:block">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-muted">
              O teu companheiro de estudo
            </p>
            <h1 className="truncate font-display text-2xl font-bold leading-tight tracking-tight text-fg">
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
          <div className="flex shrink-0 items-center gap-2">
            <TabGuideHelpButton tabKey="assistente" />
            <Button
              size="sm"
              variant="primary"
              onClick={() => setConvsModalMode('new')}
              aria-label="Nova conversa"
              title="Nova conversa"
              className="min-h-[44px] px-3.5"
            >
              <Plus size={16} />
              <span>Nova conversa</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setConvsModalMode('list')}
              aria-label={`Conversas (${conversations.length})`}
              className="min-h-[44px] px-3.5 text-xs"
            >
              <FolderOpen size={15} />
              <span>Conversas ({conversations.length})</span>
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
        <div className="space-y-2 border-b border-line/80 pb-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setNotebookOpen(true)}
                className={cx(
                  'flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                  isMinimal
                    ? 'border border-line bg-surface text-fg hover:bg-surface-2'
                    : 'bg-pastel-butter/85 text-[#141312] shadow-card hover:brightness-95 dark:bg-[#352D14] dark:text-[#FAF6EC]',
                )}
              >
                <Sparkles size={13} className="text-accent-ink dark:text-accent" />
                <span>Caderno</span>
              </button>

              {!isMinimal && (
                <button
                  type="button"
                  onClick={() => setCollectiblesOpen(true)}
                  className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-pastel-sage/65 px-3.5 py-1.5 text-xs font-semibold text-[#141312] transition hover:brightness-95 dark:bg-[#23311B] dark:text-[#FAF6EC]"
                >
                  <Award size={13} className="text-accent-ink dark:text-accent" />
                  <span>Coleção Uni</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <SegmentedControl
                layoutId="tutor-persona-pill"
                value={uniPersona}
                onChange={(v) => updateSettings({ uniPersona: v as typeof uniPersona })}
                items={UNI_PERSONAS.map((p) => ({ id: p.id, label: p.label }))}
              />
              <button
                type="button"
                onClick={() => setKeyGuideOpen(true)}
                title="Ver como passar das 15 mensagens diárias com chave gratuita"
                className="min-h-[40px] rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium tabular text-muted transition hover:border-accent hover:text-fg"
              >
                {quota.bypassed
                  ? 'Chave própria · Ilimitado'
                  : `${quota.chatRemaining}/${quota.chatLimit} msgs · Desbloquear`}
              </button>
            </div>
          </div>

          {messages.length === 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
              {[{ id: 'all', label: 'Todos assuntos' }, ...TUTOR_SUBJECTS].map((subj) => {
                const active = activeSubject === subj.id;
                return (
                  <button
                    key={subj.id}
                    type="button"
                    onClick={() => setActiveSubject(subj.id)}
                    className={cx(
                      'min-h-[38px] shrink-0 rounded-full border px-3.5 text-xs font-medium transition',
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
                      className="flex min-h-[40px] max-w-[210px] items-center gap-1.5 px-3 text-xs font-medium"
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
                        className="mr-1 grid size-9 place-items-center rounded-full text-ink-cta-fg/80 transition hover:bg-white/15 hover:text-ink-cta-fg"
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
          <section
            className={cx(
              'mx-auto flex min-h-full w-full max-w-xl flex-col items-center justify-center px-2 py-4 text-center sm:px-6 sm:py-8',
              !isMinimal &&
                'bg-[radial-gradient(ellipse_at_50%_42%,rgba(201,220,159,0.22),transparent_68%)] dark:bg-[radial-gradient(ellipse_at_50%_42%,rgba(21,127,88,0.16),transparent_65%)]',
            )}
          >
            {!isMinimal ? (
              <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-pastel-butter/75 shadow-card dark:bg-surface-2 sm:size-20">
                <UniBuddy
                  mood={uniWelcomeMood}
                  accessory={uniAccessory}
                  size={44}
                  onClick={() => setCollectiblesOpen(true)}
                  ariaLabel="Uni — tocar para abrir a coleção de estilos"
                />
              </div>
            ) : (
              <div className="grid size-12 shrink-0 place-items-center rounded-full border border-line bg-surface text-accent">
                <Sparkles size={20} />
              </div>
            )}

            <h2 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight text-fg sm:mt-5 sm:text-3xl">
              Olá{firstName ? `, ${firstName}` : ''}!{' '}
              <span className="block sm:inline">
                No que estás{' '}
                <span className={cx(!isMinimal && 'font-serif font-medium italic text-accent-ink dark:text-accent')}>
                  a pensar
                </span>
                ?
              </span>
            </h2>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted sm:text-sm">
              Explica matéria, gera planos até ao próximo teste ou revê os teus apontamentos.
            </p>

            {/* Seletor discreto de assunto inline no mobile sem roubar espaço ao chat */}
            <div className="mt-4 flex max-w-full items-center gap-1.5 overflow-x-auto pb-0.5 md:hidden">
              {[{ id: 'all', label: 'Todos' }, ...TUTOR_SUBJECTS].map((subj) => {
                const active = activeSubject === subj.id;
                return (
                  <button
                    key={subj.id}
                    type="button"
                    onClick={() => setActiveSubject(subj.id)}
                    className={cx(
                      'min-h-[34px] shrink-0 rounded-full px-3 text-xs font-medium transition',
                      active
                        ? 'bg-accent-soft font-semibold text-accent-ink'
                        : 'bg-surface/80 text-muted hover:text-fg',
                    )}
                  >
                    {subj.label}
                  </button>
                );
              })}
            </div>

            {attachedMaterials.length > 0 && (
              <p className="mt-2.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-ink">
                {attachedMaterials.length} documento(s) ativo(s) neste chat
              </p>
            )}

            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:mt-5">
              {[
                'O que devo estudar hoje?',
                'Cria um plano até ao próximo teste',
                'Faz-me um quiz rápido',
              ].map((starter) => (
                <button
                  key={starter}
                  type="button"
                  disabled={loading}
                  onClick={() => void send(starter)}
                  className="min-h-10 rounded-full border border-line/80 bg-surface/90 px-3.5 py-1.5 text-xs font-medium text-fg shadow-sm transition hover:border-accent hover:bg-accent-soft/45 disabled:opacity-50"
                >
                  {starter}
                </button>
              ))}
            </div>
          </section>
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
              {pendingSyncByMsgId[m.id] ? (
                <UniSyncCard
                  bundle={pendingSyncByMsgId[m.id]}
                  onChange={(next) => updatePendingSyncForMsg(m.id, next)}
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
                    updatePendingSyncForMsg(m.id, {
                      ...current,
                      applied: true,
                      appliedSummary: summary,
                    });
                    showToast(summary);
                  }}
                  onOpenCalendar={() => navigate('/calendario')}
                />
              ) : (
                looksSyncableReply(m.text) && (
                  <div
                    data-testid="uni-sync-trigger"
                    className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-accent/25 bg-surface-2/75 px-3.5 py-2.5"
                  >
                    <span className="inline-flex items-center gap-2 text-xs text-fg">
                      <CalendarDays size={14} className="text-accent" />
                      Queres guardar estas datas no Calendário e Plano?
                    </span>
                    <Button
                      size="sm"
                      variant="primary"
                      loading={syncingMsgId === m.id}
                      onClick={() => void extractSyncFromExistingMessage(m)}
                      className="gap-1.5"
                    >
                      <CalendarDays size={13} />
                      Sincronizar com a app
                    </Button>
                  </div>
                )
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
            <div className="flex flex-wrap items-center gap-1.5">
              {error.includes('limite diário') && (
                <Button size="sm" variant="primary" onClick={() => setKeyGuideOpen(true)}>
                  Usar chave grátis
                </Button>
              )}
              {hasCustomKey && (
                <>
                  <Button size="sm" variant="primary" onClick={() => setKeyGuideOpen(true)}>
                    Gerir chave
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      updateSettings({ geminiApiKey: '' });
                      setError(null);
                      retry();
                    }}
                    disabled={loading}
                  >
                    Voltar ao Uni Nativo (grátis)
                  </Button>
                </>
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

      {/* Aviso de reautorização silenciosa do Google Drive para leitura real de PDFs */}
      {driveAuthNeeded && (
        <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2.5 rounded-[20px] border border-line bg-surface-2/90 px-3.5 py-2.5 text-xs text-fg">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="font-semibold">Autoriza o Google Drive para o Uni ler os PDFs anexados</div>
            <p className="text-[11px] text-muted">
              A sessão do Google Drive expirou neste dispositivo — liga em 1 toque para extrair texto e fórmulas reais dos teus apontamentos.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              size="sm"
              variant="primary"
              disabled={authorizingDrive}
              onClick={async () => {
                setAuthorizingDrive(true);
                try {
                  await googleService.connectPersonalAccount(false);
                  setDriveAuthNeeded(false);
                  showToast('Google Drive autorizado. Envia ou repete a pergunta para ler o PDF.');
                } catch (e) {
                  showToast((e as Error)?.message || 'Não foi possível autorizar o Google Drive.');
                } finally {
                  setAuthorizingDrive(false);
                }
              }}
            >
              {authorizingDrive ? 'A ligar…' : 'Autorizar Drive'}
            </Button>
            <button
              type="button"
              onClick={() => setDriveAuthNeeded(false)}
              aria-label="Dispensar aviso do Google Drive"
              className="grid size-7 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Contexto do compositor + sugestões + entrada de mensagem (compacto estilo Gemini no mobile) */}
      <div className="shrink-0 space-y-2 pt-1.5 md:space-y-2.5 md:pt-3">
        {/* Desktop (md+): faixa fixa de cadeira / anexos / sugestões */}
        <div className="hidden items-center justify-between gap-2 md:flex">
          <div className="flex min-w-0 items-center gap-1.5">
            <PillSelect
              value={activeCourseId}
              onChange={setActiveCourseId}
              placement="up"
              icon={<BookOpen size={14} />}
              ariaLabel="Contexto da cadeira"
              className="min-w-0 [&>button]:max-w-[210px] [&>button]:px-3"
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
                'flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                attachedMaterials.length > 0
                  ? 'border-accent bg-accent-soft text-accent-ink'
                  : 'border-line bg-surface text-muted hover:text-fg',
              )}
            >
              <FileText size={14} />
              <span>
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
            {showActions ? 'Ocultar sugestões' : 'Mostrar sugestões'}
          </button>
        </div>

        {(activeCourse || attachedMaterials.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {activeCourse && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-ink md:hidden">
                <span className="max-w-[140px] truncate">{activeCourse.shortName || activeCourse.name}</span>
                <button
                  type="button"
                  onClick={() => setActiveCourseId('all')}
                  aria-label="Limpar filtro de cadeira"
                  className="hover:text-danger"
                >
                  <X size={12} />
                </button>
              </span>
            )}
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
        <Composer
          loading={loading}
          onSend={send}
          onStop={stop}
          hidePaperclipOnMobile
          placeholder="Pergunta ao Uni…"
          leadingSlot={
            <button
              type="button"
              onClick={() => setMobileComposerToolsOpen((v) => !v)}
              aria-expanded={mobileComposerToolsOpen}
              aria-label="Anexar e ferramentas do Tutor"
              className={cx(
                'grid size-10 shrink-0 place-items-center rounded-full transition md:hidden',
                mobileComposerToolsOpen
                  ? 'bg-accent-soft text-accent-ink'
                  : 'text-fg/80 hover:bg-surface-2 hover:text-fg',
              )}
            >
              <Plus
                size={20}
                className={cx('transition-transform duration-150', mobileComposerToolsOpen && 'rotate-45')}
              />
            </button>
          }
          topSlot={({ openFilePicker }) =>
            mobileComposerToolsOpen ? (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-line/70 px-1 pb-2 md:hidden">
                <button
                  type="button"
                  onClick={() => {
                    setMobileComposerToolsOpen(false);
                    openFilePicker();
                  }}
                  aria-label="Anexar foto ou PDF de apontamentos"
                  className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-fg"
                >
                  <Paperclip size={13} />
                  <span>Foto / PDF</span>
                </button>
                <PillSelect
                  value={activeCourseId}
                  onChange={setActiveCourseId}
                  placement="up"
                  icon={<BookOpen size={13} />}
                  ariaLabel="Contexto da cadeira"
                  className="min-w-0 [&>button]:min-h-[36px] [&>button]:max-w-[140px] [&>button]:px-2.5"
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
                  onClick={() => {
                    setMobileComposerToolsOpen(false);
                    setShowDocPicker(true);
                  }}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-fg"
                >
                  <FileText size={13} />
                  <span>Apontamentos</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileComposerToolsOpen(false);
                    setShowActions((v) => !v);
                  }}
                  className="flex min-h-[36px] items-center gap-1 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-fg"
                >
                  <Sparkles size={13} />
                  <span>{showActions ? 'Ocultar' : 'Sugestões'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileComposerToolsOpen(false);
                    setNotebookOpen(true);
                  }}
                  className="flex min-h-[36px] items-center gap-1 rounded-full bg-pastel-butter/80 px-3 text-xs font-semibold text-[#141312] dark:bg-[#352D14] dark:text-[#FAF6EC]"
                >
                  <span>Caderno</span>
                </button>
              </div>
            ) : null
          }
        />
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
          Seleciona os materiais que o Uni deve consultar. Até {MAX_AI_MATERIAL_FILES} PDFs, Google Docs
          ou ficheiros locais têm o seu conteúdo real lido em cada pergunta; materiais{' '}
          <span className="font-medium text-fg">Fixados</span> da cadeira entram automaticamente.
        </p>
        {availableMaterials.length === 0 ? (
          <p className="text-xs text-muted py-4 text-center">
            Nenhum material encontrado para esta cadeira. Podes adicionar na página Materiais.
          </p>
        ) : (
          <ul className="divide-y divide-line max-h-60 overflow-y-auto">
            {availableMaterials.map((mat) => {
              const checked = selectedMaterialIds.includes(mat.id);
              const isNotebookLink = mat.provider === 'notebooklm';
              return (
                <li
                  key={mat.id}
                  onClick={() => toggleMaterial(mat.id)}
                  className="flex items-center justify-between p-2 hover:bg-surface-2 rounded-xl cursor-pointer"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-fg">
                      <span className="truncate">{mat.title}</span>
                      {mat.pinned && (
                        <Badge tone="accent" className="shrink-0 text-[10px]">
                          Fixado
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted">
                      {isNotebookLink
                        ? 'LINK NOTEBOOK · cola resumos no Caderno do Uni'
                        : mat.provider === 'gdrive'
                          ? 'GOOGLE DRIVE · leitura direta de PDF/Doc'
                          : mat.provider === 'upload'
                            ? 'FICHEIRO LOCAL · leitura direta'
                            : mat.provider.toUpperCase()}
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
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');
  const selectedCount =
    bundle.slots.filter((s) => s.selected).length +
    bundle.assessments.filter((a) => a.selected).length;

  return (
    <div
      data-testid="uni-sync-card"
      className={cx(
        'mt-3 rounded-[20px] p-4',
        isMinimal
          ? 'border border-accent/25 bg-surface-2/80'
          : 'bg-pastel-mint/55 text-[#141312] dark:bg-[#17312B] dark:text-[#FAF6EC]',
      )}
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
                    <p className="truncate text-xs text-muted">
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
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
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
                        className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-xs text-fg outline-none focus:border-accent"
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
            <span className="text-xs text-muted">
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
