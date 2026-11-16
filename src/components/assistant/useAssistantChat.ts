import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildDocumentContext,
  buildStudyContext,
  extractScheduleFromText,
  parseTimetableFromScreenshot,
  streamGeminiChat,
  summarizeNotebookMemoryDelta,
  SYSTEM_PROMPT,
  type ChatAttachment,
  type ChatMessage,
} from '../../integrations/gemini';
import { getDailyQuotaSnapshot } from '../../lib/aiQuota';
import { listTopicSheetsByCourse, type UniAgentRecord } from '../../lib/localDb';
import { saveUniAgent } from '../../lib/uniAgents';
import { retrieveRelevantSheets, sanitizeNotebookDelta } from '../../lib/uniMastery';
import { auth, onAuthStateChanged, type User } from '../../lib/firebase';
import {
  appendMessage,
  deleteConversation,
  subscribeConversations,
  subscribeMessages,
  upsertConversation,
  type Conversation,
} from '../../lib/geminiConversations';
import { getAiMaterialLimit, resolveMaterialsForAI } from '../../lib/materialContent';
import { collectKnownCourseCandidates, getDegreeCurriculum } from '../../lib/portugalCurriculum';
import {
  resolveExtractedScheduleBundle,
  type ResolvedScheduleSyncBundle,
} from '../../lib/scheduleSync';
import type { UniAccessoryId, UniPersonaMode } from '../../lib/uniAccessories';
import { showToast } from '../../lib/uiHelpers';
import { extractUniSyncBlock, looksSyncableReply } from '../../lib/visionParsers';
import { newId, useStore } from '../../store/useStore';
import type { AcademicProfile, Course, IntegrationKey, IntegrationStatus, Material } from '../../types';

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

interface UseAssistantChatArgs {
  activeCourseId: string;
  setActiveCourseId: (id: string) => void;
  activeSubject: string;
  activeCourse: Course | undefined;
  courses: Course[];
  materials: Material[];
  academicProfile: AcademicProfile | undefined;
  hasCustomKey: boolean;
  uniAccessory: UniAccessoryId;
  uniPersona: UniPersonaMode;
  uniAgent?: UniAgentRecord | null;
  userName: string;
  setIntegration: (key: IntegrationKey, patch: Partial<IntegrationStatus>) => void;
}

/** Gere o estado completo do chat do Tutor (Firestore, anexos, streaming Gemini e blocos UNI_SYNC). */
export function useAssistantChat({
  activeCourseId,
  setActiveCourseId,
  activeSubject,
  activeCourse,
  materials,
  hasCustomKey,
  uniAccessory,
  uniPersona,
  uniAgent,
  userName,
  setIntegration,
}: UseAssistantChatArgs) {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>('default');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [dismissedAutoMaterialIds, setDismissedAutoMaterialIds] = useState<string[]>([]);
  const autoPinnedIdsRef = useRef<string[]>([]);
  const [driveAuthNeeded, setDriveAuthNeeded] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quotaTick, setQuotaTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
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

  const quota = useMemo(() => {
    void quotaTick;
    return getDailyQuotaSnapshot(hasCustomKey);
  }, [hasCustomKey, quotaTick]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeConversations((list) => {
      setConversations(list);
      if (list.length > 0 && !list.some((c) => c.id === activeConvId)) {
        setActiveConvId(list[0].id);
      }
    });
    return () => unsub();
  }, [activeConvId]);

  useEffect(() => {
    if (!activeConvId) return;
    const unsub = subscribeMessages(activeConvId, (msgs) => {
      setMessages(msgs);
    });
    return () => unsub();
  }, [activeConvId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const currentConv = useMemo(
    () => conversations.find((c) => c.id === activeConvId),
    [conversations, activeConvId],
  );

  const availableMaterials = useMemo(() => {
    if (activeCourseId === 'all') return materials;
    return materials.filter((m) => m.courseId === activeCourseId);
  }, [materials, activeCourseId]);

  const maxAiFiles = getAiMaterialLimit(hasCustomKey);
  const attachedMaterials = useMemo(
    () => materials.filter((m) => selectedMaterialIds.includes(m.id)),
    [materials, selectedMaterialIds],
  );

  // Pré-anexa até maxAiFiles materiais fixados da cadeira ativa
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
            .slice(0, maxAiFiles)
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
  }, [activeCourseId, materials, dismissedAutoMaterialIds, maxAiFiles]);

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

  const selectAllMaterials = (picked: string[]) => {
    setDismissedAutoMaterialIds((prev) => prev.filter((id) => !picked.includes(id)));
    setSelectedMaterialIds(picked);
  };

  const clearAttachedMaterials = () => {
    if (selectedMaterialIds.length === 0) return;
    setDismissedAutoMaterialIds((prev) => [...new Set([...prev, ...selectedMaterialIds])]);
    setSelectedMaterialIds([]);
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

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (activeCourseId !== 'all' && c.courseId !== activeCourseId) return false;
      if (activeSubject !== 'all' && (c.subject || 'geral') !== activeSubject) return false;
      return true;
    });
  }, [conversations, activeCourseId, activeSubject]);

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

        const resolvedMaterials =
          attachedMaterials.length > 0
            ? await resolveMaterialsForAI(attachedMaterials, {
                maxFiles: maxAiFiles,
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
        ].slice(0, hasCustomKey ? maxAiFiles + 2 : 4);

        const studyContext = buildStudyContext(useStore.getState());
        const activeCourseName = activeCourse?.shortName || activeCourse?.name;
        const lastUserText = [...list].reverse().find((m) => m.role === 'user')?.text ?? '';
        const courseSheets = activeCourse ? await listTopicSheetsByCourse(activeCourse.id) : [];
        const retrievedSheets = retrieveRelevantSheets(lastUserText, courseSheets, undefined, 4);
        const docContext = buildDocumentContext(attachedMaterials, {
          activeCourseName,
          courseMaterials: availableMaterials,
          resolvedExcerpts: resolvedMaterials.textExcerpts,
          maxFiles: maxAiFiles,
        });
        const system = SYSTEM_PROMPT(studyContext, docContext, {
          persona: uniPersona,
          accessory: uniAccessory,
          studentName: userName,
          appTone: useStore.getState().settings.appTone,
          language: useStore.getState().settings.language ?? 'pt-PT',
          uniAgent,
          retrievedSheets,
          courseName: activeCourseName,
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
            // Mantém a resposta mesmo se a extração secundária falhar
          }
        }

        const msgId = newId();
        const modelMsg: ChatMessage = {
          id: msgId,
          role: 'model',
          text: displayText,
          at: now,
          sourceDocTitles: [
            ...retrievedSheets.map((s) => `Ficha: ${s.title}`),
            ...resolvedMaterials.readTitles,
            ...attachedMaterials
              .filter(
                (m) =>
                  !resolvedMaterials.readTitles.includes(m.title) &&
                  m.provider !== 'notebooklm',
              )
              .slice(0, maxAiFiles)
              .map((m) => m.title),
            ...(attachments?.map((a) => a.name) ?? []),
          ].filter((title, i, arr) => Boolean(title) && arr.indexOf(title) === i),
        };

        if (syncPayload && (syncPayload.slots.length > 0 || syncPayload.assessments.length > 0)) {
          const resolved = resolveExtractedScheduleBundle(syncPayload);
          if (resolved.slots.length > 0 || resolved.assessments.length > 0) {
            updatePendingSyncForMsg(msgId, resolved);
          }
        }

        setStreamingText(null);
        await appendMessage(targetConvId, modelMsg);
        setIntegration('gemini', { connected: true, lastSync: now, error: undefined });

        if (uniAgent?.memoryEnabled && activeCourse && !syncPayload && lastUserText.trim().length >= 25) {
          void summarizeNotebookMemoryDelta({
            courseName: activeCourse.shortName || activeCourse.name,
            userMessage: lastUserText,
            assistantReply: displayText,
            agent: uniAgent,
          })
            .then(async (delta) => {
              if (!delta.weakSpot && !delta.strength) return;
              const nextNotebook = sanitizeNotebookDelta(uniAgent.notebook, delta);
              await saveUniAgent({
                ...uniAgent,
                notebook: nextNotebook,
                updatedAt: nextNotebook.updatedAt,
              });
            })
            .catch(() => {});
        }
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
      hasCustomKey,
      maxAiFiles,
      setIntegration,
      uniAccessory,
      uniAgent,
      uniPersona,
      updatePendingSyncForMsg,
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

  return {
    user,
    conversations,
    filteredConversations,
    activeConvId,
    setActiveConvId,
    currentConv,
    selectedMaterialIds,
    availableMaterials,
    attachedMaterials,
    maxAiFiles,
    driveAuthNeeded,
    setDriveAuthNeeded,
    messages,
    streamingText,
    loading,
    quota,
    error,
    setError,
    pendingSyncByMsgId,
    syncingMsgId,
    toggleMaterial,
    selectAllMaterials,
    clearAttachedMaterials,
    handleCreateConversation,
    handleRenameConversation,
    handleDeleteConversationById,
    send,
    stop,
    retry,
    updatePendingSyncForMsg,
    extractSyncFromExistingMessage,
  };
}
