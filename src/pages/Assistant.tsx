import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { AssistantComposerArea } from '../components/assistant/AssistantComposerArea';
import { AssistantHeader } from '../components/assistant/AssistantHeader';
import { AssistantMessageList } from '../components/assistant/AssistantMessageList';
import { AssistantWelcome } from '../components/assistant/AssistantWelcome';
import { QuickActions } from '../components/assistant/QuickActions';
import { SourcesSheet } from '../components/assistant/SourcesSheet';
import {
  readStoredTutorSessionState,
  useAssistantChat,
} from '../components/assistant/useAssistantChat';
import { TabGuideBanner } from '../components/onboarding/TabGuideBanner';
import { Button, Modal } from '../components/ui';
import { hasCustomGeminiKey } from '../integrations/gemini';
import { normalizeAppLanguage } from '../lib/grading';
import { getLocalizedPersonas, resolveUniAccessory } from '../lib/uniAccessories';
import { saveUniAgent, useUniAgent } from '../lib/uniAgents';
import { useStore } from '../store/useStore';

const AssistantModals = lazy(() => import('../components/assistant/AssistantModals'));
const UniLiveVoiceModal = lazy(() => import('../components/assistant/UniLiveVoiceModal'));
const UniNotebookMemoryModal = lazy(() =>
  import('../components/courses/modals/UniNotebookMemoryModal').then((m) => ({
    default: m.UniNotebookMemoryModal,
  })),
);

export default function Assistant() {
  const { t, i18n } = useTranslation('assistant');
  const appLang = normalizeAppLanguage(i18n.language);
  const personas = getLocalizedPersonas(appLang);
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { prefillPrompt?: string; courseId?: string } | null;

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileComposerToolsOpen, setMobileComposerToolsOpen] = useState(false);
  const courses = useStore((s) => s.courses);
  const materials = useStore((s) => s.materials);
  const studyLogs = useStore((s) => s.studyLogs);
  const academicProfile = useStore((s) => s.academicProfile);
  const uniPreference = useStore((s) => s.settings.uniAccessory);
  const globalUniSkin = useStore((s) => s.settings.uniSkin ?? 'classic');
  const globalUniPet = useStore((s) => s.settings.uniPet ?? 'cat');
  const uniPersona = useStore((s) => s.settings.uniPersona ?? 'amigo');
  const appTone = useStore((s) => s.settings.appTone ?? 'vibrante');
  const isMinimal = appTone === 'serio';
  const aiConsent = useStore((s) => Boolean(s.settings.aiConsent));
  const hasCustomKey = useStore((s) => Boolean(s.settings.geminiApiKey?.trim()) || hasCustomGeminiKey());
  const updateSettings = useStore((s) => s.updateSettings);
  const userName = useStore((s) => s.settings.userName);
  const setIntegration = useStore((s) => s.setIntegration);

  const [activeCourseId, setActiveCourseId] = useState<string>(() => {
    const queryCourse = new URLSearchParams(location.search).get('course');
    if (routeState?.courseId) return routeState.courseId;
    if (queryCourse) return queryCourse;
    const saved = readStoredTutorSessionState()?.activeCourseId;
    return saved || 'all';
  });
  const [activeSubject, setActiveSubject] = useState<string>(
    () => readStoredTutorSessionState()?.activeSubject || 'all',
  );
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [convsModalMode, setConvsModalMode] = useState<'list' | 'new' | null>(null);
  const [confirmDeleteConv, setConfirmDeleteConv] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [mobileSuggestionsOpen, setMobileSuggestionsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [keyGuideOpen, setKeyGuideOpen] = useState(false);
  const [collectiblesOpen, setCollectiblesOpen] = useState(false);
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [courseUniMemoryOpen, setCourseUniMemoryOpen] = useState(false);
  const [liveVoiceOpen, setLiveVoiceOpen] = useState(false);
  const [flaggedWrongIds, setFlaggedWrongIds] = useState<Record<string, boolean>>({});
  const [dismissedPrompt, setDismissedPrompt] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeCourse = useMemo(
    () => (activeCourseId === 'all' ? undefined : courses.find((c) => c.id === activeCourseId)),
    [courses, activeCourseId],
  );
  const { agent: courseUniAgent } = useUniAgent(activeCourse?.id);
  const effectivePersona = courseUniAgent?.personaId ?? uniPersona;
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

  const chat = useAssistantChat({
    activeCourseId,
    setActiveCourseId,
    activeSubject,
    activeCourse,
    courses,
    materials,
    academicProfile,
    hasCustomKey,
    uniAccessory,
    uniPersona: effectivePersona,
    uniAgent: courseUniAgent,
    userName,
    setIntegration,
  });

  useEffect(() => {
    if (chat.messages.length === 0 && !chat.loading && !chat.error && !chat.streamingText) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.messages.length, chat.loading, chat.error, chat.streamingText]);

  const uniWelcomeMood = chat.loading
    ? 'thinking'
    : uniPersona === 'calmo'
      ? 'calm'
      : uniPersona === 'exigente'
        ? 'curious'
        : 'happy';

  const rawRoutePrompt = routeState?.prefillPrompt?.trim() || null;
  const pendingSeedPrompt =
    rawRoutePrompt && rawRoutePrompt !== dismissedPrompt ? rawRoutePrompt : null;

  const dismissPendingSeedPrompt = () => {
    if (rawRoutePrompt) setDismissedPrompt(rawRoutePrompt);
    navigate(location.pathname, { replace: true, state: null });
  };

  const recentLogSuggestion = useMemo(() => {
    const scopedLogs = activeCourse
      ? studyLogs.filter((l) => l.courseId === activeCourse.id)
      : studyLogs;
    const latestExam = scopedLogs.find((l) => l.kind === 'exam_prep');
    if (latestExam) {
      const c = courses.find((x) => x.id === latestExam.courseId);
      return c ? t('page.sugExamCourse', { course: c.shortName }) : t('page.sugExam');
    }
    const hardClass = scopedLogs.find(
      (l) => l.kind === 'class' && (l.feeling === 'dificil' || l.feeling === 'mais_ou_menos'),
    );
    if (hardClass) {
      const c = courses.find((x) => x.id === hardClass.courseId);
      return hardClass.topicTitle
        ? t('page.sugExplain', { topic: hardClass.topicTitle, course: c ? ` (${c.shortName})` : '' })
        : t('page.sugLastClass', { course: c ? ` (${c.shortName})` : '' });
    }
    return null;
  }, [studyLogs, courses, activeCourse, t]);

  const anyAssistantModalOpen =
    menuOpen ||
    showDocPicker ||
    confirmDeleteConv ||
    tutorOpen ||
    keyGuideOpen ||
    collectiblesOpen ||
    contextModalOpen ||
    Boolean(convsModalMode) ||
    notebookOpen;

  const firstName = userName?.trim().split(/\s+/)[0] || '';

  return (
    <div className="flex h-[calc(100dvh-5.25rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)-var(--keyboard-height,0px))] min-h-0 flex-col md:h-[calc(100dvh-3.5rem)]">
      <AssistantHeader
        personas={personas}
        uniPersona={uniPersona}
        effectivePersona={effectivePersona}
        onChangePersona={(next) => updateSettings({ uniPersona: next })}
        courseUniAgent={courseUniAgent}
        activeCourse={activeCourse}
        currentConv={chat.currentConv}
        messagesCount={chat.messages.length}
        conversationsCount={chat.conversations.length}
        filteredConversations={chat.filteredConversations}
        activeConvId={chat.activeConvId}
        onSelectConv={chat.setActiveConvId}
        onRequestDeleteConv={() => setConfirmDeleteConv(true)}
        activeSubject={activeSubject}
        onChangeSubject={setActiveSubject}
        loading={chat.loading}
        isMinimal={isMinimal}
        isSignedIn={Boolean(chat.user)}
        quota={chat.quota}
        mobileFiltersOpen={mobileFiltersOpen}
        setMobileFiltersOpen={setMobileFiltersOpen}
        onCreateConversation={() => void chat.handleCreateConversation()}
        onOpenConvsModal={() => setConvsModalMode('list')}
        onOpenMenu={() => setMenuOpen(true)}
        onOpenKeyGuide={() => setKeyGuideOpen(true)}
        onOpenNotebook={() => setNotebookOpen(true)}
        onOpenLiveVoice={() => setLiveVoiceOpen(true)}
      />

      {/* Área de Mensagens */}
      <div className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto px-0.5 py-1.5 md:mt-3 md:space-y-4 md:px-1 md:py-2">
        <TabGuideBanner
          tabKey="assistente"
          actions={
            !hasCustomKey ? (
              <Button size="sm" variant="primary" onClick={() => setKeyGuideOpen(true)}>
                {t('page.keyHowTo')}
              </Button>
            ) : undefined
          }
        />
        {chat.messages.length === 0 && (
          <AssistantWelcome
            isMinimal={isMinimal}
            loading={chat.loading}
            uniWelcomeMood={uniWelcomeMood}
            courseUniAgent={courseUniAgent}
            activeCourse={activeCourse}
            globalUniSkin={globalUniSkin}
            globalUniPet={globalUniPet}
            uniAccessory={uniAccessory}
            firstName={firstName}
            appLang={appLang}
            activeSubject={activeSubject}
            onChangeSubject={setActiveSubject}
            attachedCount={chat.attachedMaterials.length}
            recentLogSuggestion={recentLogSuggestion}
            onSendStarter={(starter) => void chat.send(starter)}
            onOpenCourseUniMemory={() => setCourseUniMemoryOpen(true)}
            onOpenCollectibles={() => setCollectiblesOpen(true)}
          />
        )}

        <AssistantMessageList
          messages={chat.messages}
          pendingToolsByMsgId={chat.pendingToolsByMsgId}
          pendingSyncByMsgId={chat.pendingSyncByMsgId}
          busyToolId={chat.busyToolId}
          syncingMsgId={chat.syncingMsgId}
          onConfirmToolProposal={(msgId, proposalId) => void chat.confirmToolProposal(msgId, proposalId)}
          onCancelToolProposal={chat.cancelToolProposal}
          onUpdatePendingSync={chat.updatePendingSyncForMsg}
          onExtractSync={(m) => void chat.extractSyncFromExistingMessage(m)}
          onOpenCalendar={() => navigate('/calendario')}
          flaggedWrongIds={flaggedWrongIds}
          onFlagWrong={(id) => setFlaggedWrongIds((prev) => ({ ...prev, [id]: true }))}
          courseUniAgent={courseUniAgent}
          onOpenCourseUniMemory={() => setCourseUniMemoryOpen(true)}
          loading={chat.loading}
          streamingText={chat.streamingText}
          error={chat.error}
          quota={chat.quota}
          hasCustomKey={hasCustomKey}
          onOpenKeyGuide={() => setKeyGuideOpen(true)}
          onClearCustomKeyAndRetry={() => {
            updateSettings({ geminiApiKey: '' });
            chat.setError(null);
            chat.retry();
          }}
          onRetry={chat.retry}
          bottomRef={bottomRef}
        />
      </div>

      <AssistantComposerArea
        aiConsent={aiConsent}
        chatLimit={chat.quota.chatLimit}
        driveAuthNeeded={chat.driveAuthNeeded}
        onDismissDriveAuth={() => chat.setDriveAuthNeeded(false)}
        courses={courses}
        activeCourse={activeCourse}
        activeCourseId={activeCourseId}
        onChangeCourseId={setActiveCourseId}
        attachedCount={chat.attachedMaterials.length}
        onOpenSources={() => setSourcesOpen(true)}
        showActions={showActions}
        onToggleActions={() => setShowActions((v) => !v)}
        onOpenMobileSuggestions={() => setMobileSuggestionsOpen(true)}
        pendingSeedPrompt={pendingSeedPrompt}
        onSendSeedPrompt={() => {
          if (!pendingSeedPrompt) return;
          const text = pendingSeedPrompt;
          if (routeState?.courseId) setActiveCourseId(routeState.courseId);
          dismissPendingSeedPrompt();
          void chat.send(text);
        }}
        onDismissSeedPrompt={dismissPendingSeedPrompt}
        loading={chat.loading}
        onSend={chat.send}
        onStop={chat.stop}
        mobileComposerToolsOpen={mobileComposerToolsOpen}
        setMobileComposerToolsOpen={setMobileComposerToolsOpen}
        onOpenNotebook={() => setNotebookOpen(true)}
        onOpenLiveVoice={() => setLiveVoiceOpen(true)}
      />

      <SourcesSheet
        open={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
        materials={chat.availableMaterials}
        selectedIds={chat.selectedMaterialIds}
        onToggle={chat.toggleMaterial}
        onSelectMany={chat.selectAllMaterials}
        onOpenAttach={() => setShowDocPicker(true)}
      />

      <Modal
        open={mobileSuggestionsOpen}
        onClose={() => setMobileSuggestionsOpen(false)}
        title={t('quick.sheetTitle')}
      >
        <QuickActions
          variant="mobile-sheet"
          disabled={chat.loading || !aiConsent}
          activeCourseId={activeCourseId}
          onSend={chat.send}
          onAfterSend={() => setMobileSuggestionsOpen(false)}
        />
      </Modal>

      {anyAssistantModalOpen && (
        <Suspense fallback={null}>
          <AssistantModals
            menuOpen={menuOpen}
            onCloseMenu={() => setMenuOpen(false)}
            onOpenWeeklyTutor={() => setTutorOpen(true)}
            onOpenDocPicker={() => setShowDocPicker(true)}
            onOpenCollectibles={() => setCollectiblesOpen(true)}
            onNavigateSettings={() => navigate('/definicoes/tutor')}
            onOpenContextModal={() => setContextModalOpen(true)}
            onRequestDeleteConv={() => setConfirmDeleteConv(true)}
            showDocPicker={showDocPicker}
            onCloseDocPicker={() => setShowDocPicker(false)}
            hasCustomKey={hasCustomKey}
            maxAiFiles={chat.maxAiFiles}
            availableMaterials={chat.availableMaterials}
            selectedMaterialIds={chat.selectedMaterialIds}
            onToggleMaterial={chat.toggleMaterial}
            onSelectAllMaterials={chat.selectAllMaterials}
            onClearAttachedMaterials={chat.clearAttachedMaterials}
            confirmDeleteConv={confirmDeleteConv}
            onCloseDeleteConv={() => setConfirmDeleteConv(false)}
            onConfirmDeleteConv={() => {
              setConfirmDeleteConv(false);
              if (chat.activeConvId) void chat.handleDeleteConversationById(chat.activeConvId);
            }}
            tutorOpen={tutorOpen}
            onCloseTutor={() => setTutorOpen(false)}
            keyGuideOpen={keyGuideOpen}
            onCloseKeyGuide={() => setKeyGuideOpen(false)}
            collectiblesOpen={collectiblesOpen}
            onCloseCollectibles={() => setCollectiblesOpen(false)}
            contextModalOpen={contextModalOpen}
            onCloseContextModal={() => setContextModalOpen(false)}
            convsModalMode={convsModalMode}
            onCloseConvsModal={() => setConvsModalMode(null)}
            conversations={chat.conversations}
            activeConvId={chat.activeConvId}
            courses={courses}
            activeCourse={activeCourse}
            activeCourseId={activeCourseId}
            activeSubject={activeSubject}
            onSelectConversation={(conv) => {
              chat.setActiveConvId(conv.id);
              if (conv.courseId) setActiveCourseId(conv.courseId);
            }}
            onCreateConversation={chat.handleCreateConversation}
            onRenameConversation={chat.handleRenameConversation}
            onDeleteConversation={chat.handleDeleteConversationById}
            notebookOpen={notebookOpen}
            onCloseNotebook={() => setNotebookOpen(false)}
            attachedMaterials={chat.attachedMaterials}
            uniAccessory={uniAccessory}
            uniPersona={effectivePersona}
          />
        </Suspense>
      )}
      {courseUniAgent && activeCourse && courseUniMemoryOpen && (
        <Suspense fallback={null}>
          <UniNotebookMemoryModal
            open={courseUniMemoryOpen}
            onClose={() => setCourseUniMemoryOpen(false)}
            agent={courseUniAgent}
            courseName={activeCourse.shortName || activeCourse.name}
            onUpdateAgent={async (next) => {
              await saveUniAgent(next);
            }}
          />
        </Suspense>
      )}
      {liveVoiceOpen && (
        <Suspense fallback={null}>
          <UniLiveVoiceModal
            open={liveVoiceOpen}
            onClose={() => setLiveVoiceOpen(false)}
            onOpenKeyGuide={() => setKeyGuideOpen(true)}
            activeCourse={activeCourse}
            uniAgent={courseUniAgent}
            persona={effectivePersona}
            accessory={uniAccessory}
            studentName={userName}
            language={courseUniAgent?.language ?? appLang}
          />
        </Suspense>
      )}
    </div>
  );
}
