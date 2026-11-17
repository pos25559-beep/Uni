import { requestAiConsent } from '../store/useAiConsentStore';
import {
  BookOpen,
  BookOpenCheck,
  Brain,
  CalendarDays,
  ChevronDown,
  FileText,
  Flag,
  FolderOpen,
  Menu,
  Mic,
  MoreHorizontal,
  Paperclip,
  Plus,
  RotateCcw,
  Sparkles,
  SquarePen,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import AssistantModals from '../components/assistant/AssistantModals';
import { Composer } from '../components/assistant/Composer';
import { ListenButton } from '../components/audio/ListenButton';
import { AnswerSources, SourcesPill, SourcesSheet } from '../components/assistant/SourcesSheet';
import { Markdown } from '../components/assistant/Markdown';
import { QuickActions } from '../components/assistant/QuickActions';
import UniLiveVoiceModal from '../components/assistant/UniLiveVoiceModal';
import UniSyncCard from '../components/assistant/UniSyncCard';
import UniToolProposalCard from '../components/assistant/UniToolProposalCard';
import {
  readStoredTutorSessionState,
  useAssistantChat,
} from '../components/assistant/useAssistantChat';
import { UniBuddy, UniPetBuddy } from '../components/brand/UnipediaMarks';
import { UniNotebookMemoryModal } from '../components/courses/CourseUniModals';
import { TabGuideBanner, TabGuideHelpButton } from '../components/onboarding/TabGuideBanner';
import { Badge, Button, Modal, PillSelect, SegmentedControl } from '../components/ui';
import { hasCustomGeminiKey } from '../integrations/gemini';
import { recordWrongAnswerFeedback } from '../lib/aiQuota';
import { normalizeAppLanguage } from '../lib/grading';
import { courseColors } from '../lib/colors';
import { TUTOR_SUBJECTS, subjectLabel } from '../lib/geminiConversations';
import { commitScheduleSyncToStore } from '../lib/scheduleSync';
import { cx, showToast } from '../lib/uiHelpers';
import { getLocalizedPersonas, resolveUniAccessory } from '../lib/uniAccessories';
import { saveUniAgent, useUniAgent } from '../lib/uniAgents';
import { getStageInfo } from '../lib/uniMastery';
import { openUniCheckIn } from '../lib/uniCheckInBus';
import { looksSyncableReply } from '../lib/visionParsers';
import { googleService } from '../services/googleService';
import { useStore } from '../store/useStore';

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
  const [authorizingDrive, setAuthorizingDrive] = useState(false);
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

  const {
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
    pendingToolsByMsgId,
    busyToolId,
    confirmToolProposal,
    cancelToolProposal,
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
  } = useAssistantChat({
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
    if (messages.length === 0 && !loading && !error && !streamingText) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, loading, error, streamingText]);

  const uniWelcomeMood = loading
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
      return c
        ? t('page.sugExamCourse', { course: c.shortName })
        : t('page.sugExam');
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

  const handleClearAttachedMaterials = () => {
    clearAttachedMaterials();
  };

  const firstName = userName?.trim().split(/\s+/)[0] || '';

  return (
    <div
      className="flex h-[calc(100dvh-5.25rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)-var(--keyboard-height,0px))] min-h-0 flex-col md:h-[calc(100dvh-3.5rem)]"
    >
      {/* Cabeçalho minimalista estilo app Gemini no telemóvel (< md) */}
      <div className="shrink-0 space-y-2 pb-1 md:hidden">
        <h1 className="sr-only">{t('srHeading')}</h1>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setConvsModalMode('list')}
              aria-label={t('page.conversations', { count: conversations.length })}
              className="relative grid size-11 shrink-0 place-items-center rounded-full text-fg transition hover:bg-surface-2"
            >
              <Menu size={20} />
              {conversations.length > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute right-2 top-2 size-2 rounded-full bg-accent"
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileFiltersOpen((v) => !v)}
              aria-expanded={mobileFiltersOpen}
              aria-label={
                currentConv && messages.length > 0
                  ? currentConv.title
                  : t('page.styleOptions', { persona: personas.find((p) => p.id === uniPersona)?.label ?? personas[0]?.label ?? '' })
              }
              className="flex min-h-[44px] min-w-0 items-center gap-1.5 rounded-full px-2 text-left transition hover:bg-surface-2"
            >
              <span className="truncate font-display text-lg font-bold tracking-tight text-fg">
                {currentConv && messages.length > 0 ? (
                  currentConv.title
                ) : (
                  <>
                    {courseUniAgent ? courseUniAgent.name : 'Uni'}{' '}
                    <span className="font-normal text-muted">
                      {personas.find((p) => p.id === effectivePersona)?.label ?? personas[0]?.label ?? ''}
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
              disabled={loading}
              onClick={() => void handleCreateConversation()}
              aria-label={t('page.newConv')}
              title={t('page.newConv')}
              className="grid size-11 place-items-center rounded-full text-fg transition hover:bg-surface-2 disabled:opacity-45"
            >
              <SquarePen size={18} />
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t('page.moreOptions')}
              title={t('page.options')}
              className="grid size-11 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg"
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
                items={personas.map((p) => ({ id: p.id, label: p.label }))}
              />
              <button
                type="button"
                onClick={() => setKeyGuideOpen(true)}
                className="min-h-11 rounded-full border border-line bg-surface-2 px-3 text-xs font-medium tabular text-muted"
              >
                {quota.bypassed ? t('page.unlimited') : `${quota.chatRemaining}/${quota.chatLimit} msgs`}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setMobileFiltersOpen(false);
                  setNotebookOpen(true);
                }}
                className="flex min-h-11 items-center gap-1.5 rounded-full bg-pastel-butter/80 px-3 text-xs font-semibold text-[#141312] dark:bg-[#352D14] dark:text-[#FAF6EC]"
              >
                <Sparkles size={13} /> {t('notebook.title')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileFiltersOpen(false);
                  openUniCheckIn({ kind: 'day', courseId: activeCourse?.id });
                }}
                className="flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-fg"
              >
                <BookOpenCheck size={13} /> {t('page.journal')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileFiltersOpen(false);
                  setLiveVoiceOpen(true);
                }}
                className="flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-fg"
              >
                <Mic size={13} /> {t('liveVoice.openBtn')}
              </button>
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
              {t('page.companion')}
            </p>
            <h1 className="truncate font-display text-2xl font-bold leading-tight tracking-tight text-fg">
              {t('page.talkWith')}{' '}
              <span className="font-serif font-medium italic text-accent-ink">Uni</span>
            </h1>
            <p className="truncate text-xs font-medium text-muted">
              {user ? t('page.synced') : t('page.thisDevice')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <TabGuideHelpButton tabKey="assistente" />
            <Button
              size="sm"
              variant="primary"
              disabled={loading}
              onClick={() => void handleCreateConversation()}
              aria-label={t('page.newConv')}
              title={t('page.newConv')}
              className="min-h-[44px] px-3.5"
            >
              <Plus size={16} />
              <span>{t('page.newConv')}</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setConvsModalMode('list')}
              aria-label={t('page.conversations', { count: conversations.length })}
              className="min-h-[44px] px-3.5 text-xs"
            >
              <FolderOpen size={15} />
              <span>{t('page.conversations', { count: conversations.length })}</span>
            </Button>
            <Button
              variant="secondary"
              iconOnly
              onClick={() => setMenuOpen(true)}
              aria-label={t('page.moreOptions')}
              title={t('page.options')}
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
                <span>{t('page.notebook')}</span>
              </button>

              <button
                type="button"
                onClick={() => openUniCheckIn({ kind: 'day', courseId: activeCourse?.id })}
                className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-fg transition hover:bg-surface-2"
              >
                <BookOpenCheck size={13} className="text-accent-ink dark:text-accent" />
                <span>{t('page.journal')}</span>
              </button>

              <button
                type="button"
                onClick={() => setLiveVoiceOpen(true)}
                className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-fg transition hover:bg-surface-2"
              >
                <Mic size={13} className="text-accent-ink dark:text-accent" />
                <span>{t('liveVoice.openBtn')}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                layoutId="tutor-persona-pill"
                value={uniPersona}
                onChange={(v) => updateSettings({ uniPersona: v as typeof uniPersona })}
                items={personas.map((p) => ({ id: p.id, label: p.label }))}
              />
              <button
                type="button"
                onClick={() => setKeyGuideOpen(true)}
                title={t('page.unlockTitle')}
                className="min-h-11 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium tabular text-muted transition hover:border-accent hover:text-fg"
              >
                {quota.bypassed
                  ? t('page.ownKey')
                  : t('page.msgsUnlock', { remaining: quota.chatRemaining, limit: quota.chatLimit })}
              </button>
            </div>
          </div>

          {messages.length === 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
              {[{ id: 'all', label: t('page.allSubjects') }, ...TUTOR_SUBJECTS].map((subj) => {
                const active = activeSubject === subj.id;
                return (
                  <button
                    key={subj.id}
                    type="button"
                    onClick={() => setActiveSubject(subj.id)}
                    className={cx(
                      'min-h-11 shrink-0 rounded-full border px-3.5 text-xs font-medium transition',
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
                      className="flex min-h-11 max-w-[210px] items-center gap-1.5 px-3 text-xs font-medium"
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
                        aria-label={t('page.deleteConv', { title: c.title })}
                        title={t('page.deleteThis')}
                        className="grid size-11 place-items-center rounded-full text-ink-cta-fg/80 transition hover:bg-white/15 hover:text-ink-cta-fg"
                      >
                        <Trash2 size={14} />
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
                {t('page.keyHowTo')}
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
              <div className="relative flex size-16 shrink-0 items-center justify-center rounded-full bg-pastel-butter/75 shadow-card dark:bg-surface-2 sm:size-20">
                <UniBuddy
                  mood={uniWelcomeMood}
                  form={courseUniAgent?.formId}
                  stage={courseUniAgent?.stage}
                  skin={courseUniAgent?.skinId ?? globalUniSkin}
                  accessory={uniAccessory}
                  size={44}
                  onClick={() =>
                    courseUniAgent ? setCourseUniMemoryOpen(true) : setCollectiblesOpen(true)
                  }
                  ariaLabel={
                    courseUniAgent
                      ? t('page.agentAria', { name: courseUniAgent.name })
                      : t('page.uniAria')
                  }
                />
                {(courseUniAgent?.petId ?? globalUniPet) !== 'none' && (
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-surface p-0.5 shadow-xs">
                    <UniPetBuddy
                      pet={(courseUniAgent?.petId ?? globalUniPet) as Exclude<typeof globalUniPet, 'none'>}
                      size={22}
                    />
                  </span>
                )}
              </div>
            ) : (
              <div className="grid size-12 shrink-0 place-items-center rounded-full border border-line bg-surface text-accent">
                <Sparkles size={20} />
              </div>
            )}

            <h2 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight text-fg sm:mt-5 sm:text-3xl">
              {t('page.hello', { name: firstName ? `, ${firstName}` : '' })}{' '}
              <span className="block sm:inline">
                {courseUniAgent ? (
                  activeCourse?.shortName &&
                  courseUniAgent.name.trim().toLowerCase() === activeCourse.shortName.trim().toLowerCase() ? (
                    <>
                      {t('page.hereIs', { name: '' }).trim()}{' '}
                      <span className={cx(!isMinimal && 'font-serif font-medium italic text-accent-ink dark:text-accent')}>
                        {courseUniAgent.name}
                      </span>
                      .
                    </>
                  ) : (
                    <>
                      {t('page.hereIs', { name: courseUniAgent.name })}{' '}
                      {activeCourse?.shortName && (
                        <span className={cx(!isMinimal && 'font-serif font-medium italic text-accent-ink dark:text-accent')}>
                          ({activeCourse.shortName})
                        </span>
                      )}
                      .
                    </>
                  )
                ) : (
                  <>
                    {t('page.whatOn')}{' '}
                    <span className={cx(!isMinimal && 'font-serif font-medium italic text-accent-ink dark:text-accent')}>
                      {t('page.thinking')}
                    </span>
                    ?
                  </>
                )}
              </span>
            </h2>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted sm:text-sm">
              {courseUniAgent
                ? t('specialistIntro', {
                    stage: getStageInfo(courseUniAgent.stage, appLang).localizedLabel,
                    mastery: courseUniAgent.mastery,
                  })
                : t('page.introGeneric')}
            </p>
            {courseUniAgent && (
              <button
                type="button"
                onClick={() => setCourseUniMemoryOpen(true)}
                className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-xs font-semibold text-fg transition hover:border-accent"
              >
                <Brain size={14} className="text-accent" />
                {t('whatKnowsBtn', { name: courseUniAgent.name })}
              </button>
            )}

            {/* Seletor discreto de assunto inline no mobile sem roubar espaço ao chat */}
            <div className="mt-4 flex max-w-full items-center gap-1.5 overflow-x-auto pb-0.5 md:hidden">
              {[{ id: 'all', label: t('page.all') }, ...TUTOR_SUBJECTS].map((subj) => {
                const active = activeSubject === subj.id;
                return (
                  <button
                    key={subj.id}
                    type="button"
                    onClick={() => setActiveSubject(subj.id)}
                    className={cx(
                      'min-h-11 shrink-0 rounded-full px-3.5 text-xs font-medium transition',
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
                {t('page.activeDocsChat', { count: attachedMaterials.length })}
              </p>
            )}

            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:mt-5">
              {[
                ...(recentLogSuggestion ? [recentLogSuggestion] : []),
                t('page.starter1'),
                t('page.starter2'),
                t('page.starter3'),
              ].map((starter) => (
                <button
                  key={starter}
                  type="button"
                  disabled={loading}
                  onClick={() => void send(starter)}
                  className="min-h-11 rounded-full border border-line/80 bg-surface/90 px-3.5 py-1.5 text-xs font-medium text-fg shadow-sm transition hover:border-accent hover:bg-accent-soft/45 disabled:opacity-50"
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
              className="rise ml-auto max-w-[85%] space-y-1.5 whitespace-pre-wrap break-words rounded-3xl rounded-br-md bg-ink-cta px-4 py-3 text-sm text-ink-cta-fg shadow-card"
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
              className="rise max-w-[95%] rounded-3xl rounded-bl-md bg-surface px-4 py-3.5 shadow-card"
            >
              <Markdown text={m.text} />
              {pendingToolsByMsgId[m.id]?.map((proposal) => (
                <UniToolProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  busy={busyToolId === proposal.id}
                  onConfirm={() => void confirmToolProposal(m.id, proposal.id)}
                  onCancel={() => cancelToolProposal(m.id, proposal.id)}
                />
              ))}
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
                      parts.push(t('page.syncAssessments', { count: res.assessmentsCount }));
                    }
                    if (res.classesCount > 0) {
                      parts.push(t('page.syncClasses', { count: res.classesCount }));
                    }
                    if (res.createdCoursesCount > 0) {
                      parts.push(t('page.syncCourses', { count: res.createdCoursesCount }));
                    }
                    const summary =
                      parts.length > 0
                        ? t('page.syncUpdated', { parts: parts.join(', ') })
                        : t('page.syncNothing');
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
                      {t('page.syncAsk')}
                    </span>
                    <Button
                      size="sm"
                      variant="primary"
                      loading={syncingMsgId === m.id}
                      onClick={() => void extractSyncFromExistingMessage(m)}
                      className="gap-1.5"
                    >
                      <CalendarDays size={13} />
                      {t('page.syncBtn')}
                    </Button>
                  </div>
                )
              )}
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-2 text-xs text-muted">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{t('page.suggestion')}</span>
                  {m.sourceDocTitles && m.sourceDocTitles.length > 0 && (
                    <AnswerSources text={m.text} titles={m.sourceDocTitles} />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <ListenButton sourceId={`tutor:${m.id}`} text={m.text} />
                  {flaggedWrongIds[m.id] ? (
                    <span className="inline-flex min-h-11 items-center gap-1 px-2 text-xs font-medium text-coral">
                      <Flag size={12} /> {t('page.flagged')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setFlaggedWrongIds((prev) => ({ ...prev, [m.id]: true }));
                        recordWrongAnswerFeedback();
                        showToast(t('page.thanksFlag'));
                      }}
                      className="inline-flex min-h-11 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-muted transition hover:bg-coral-soft hover:text-coral"
                    >
                      <Flag size={12} /> {t('page.wrong')}
                    </button>
                  )}
                  {flaggedWrongIds[m.id] && courseUniAgent && (
                    <button
                      type="button"
                      onClick={() => setCourseUniMemoryOpen(true)}
                      className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-fg hover:border-accent"
                    >
                      {t('page.fixNotebook')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ),
        )}

        {loading && streamingText && (
          <div className="rise max-w-[95%] rounded-3xl rounded-bl-md bg-surface px-4 py-3.5 shadow-card">
            <Markdown text={streamingText} />
            <div className="mt-2 flex items-center gap-1.5 text-xs text-accent-ink">
              <Sparkles size={12} className="animate-pulse" />
              <span>{t('page.writing')}</span>
            </div>
          </div>
        )}

        {loading && !streamingText && (
          <div
            role="status"
            className="rise flex w-fit items-center gap-2.5 rounded-3xl rounded-bl-md bg-surface px-4 py-2.5 text-sm text-muted shadow-card"
          >
            <UniBuddy mood="thinking" accessory={uniAccessory} size={30} interactive={false} />
            <span>{t('page.thinkingNow')}</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rise flex max-w-[95%] flex-col items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            <span className="break-words">{error}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {!quota.bypassed && quota.chatRemaining <= 0 && (
                <Button size="sm" variant="primary" onClick={() => setKeyGuideOpen(true)}>
                  {t('page.useFreeKey')}
                </Button>
              )}
              {hasCustomKey && (
                <>
                  <Button size="sm" variant="primary" onClick={() => setKeyGuideOpen(true)}>
                    {t('page.manageKey')}
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
                    {t('page.backNative')}
                  </Button>
                </>
              )}
              <Button size="sm" variant="secondary" onClick={retry} disabled={loading}>
                <RotateCcw size={14} />
                {t('page.retry')}
              </Button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Aviso amigável de 1 toque para ativar o Uni nativo (zero chave obrigatória; 1 linha no mobile) */}
      {!aiConsent && (
        <div className="mt-2.5 flex shrink-0 items-center justify-between gap-2.5 rounded-2xl bg-pastel-butter/75 px-3.5 py-2.5 text-xs text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC] sm:px-4 sm:py-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-1.5 font-semibold">
              <Sparkles size={14} className="shrink-0 text-accent" />
              <span className="truncate">{t('page.enableUni')}</span>
              <Badge tone="accent" className="hidden sm:inline-flex">{t('page.included')}</Badge>
            </div>
            <p className="hidden opacity-80 sm:block">
              {t('page.consentLong', { limit: quota.chatLimit })}
            </p>
            <p className="truncate text-xs opacity-80 sm:hidden">
              {t('page.consentShort', { limit: quota.chatLimit })}
            </p>
          </div>
          <Button size="sm" variant="primary" onClick={() => requestAiConsent()}>
            {t('page.enableBtn')}
          </Button>
        </div>
      )}

      {/* Aviso de reautorização silenciosa do Google Drive para leitura real de PDFs */}
      {driveAuthNeeded && (
        <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-line bg-surface-2/90 px-3.5 py-2.5 text-xs text-fg">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="font-semibold">{t('page.driveTitle')}</div>
            <p className="text-xs text-muted">
              {t('page.driveBody')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant="primary"
              disabled={authorizingDrive}
              onClick={async () => {
                setAuthorizingDrive(true);
                try {
                  await googleService.connectPersonalAccount(false);
                  setDriveAuthNeeded(false);
                  showToast(t('page.driveOk'));
                } catch (e) {
                  showToast((e as Error)?.message || t('page.driveFail'));
                } finally {
                  setAuthorizingDrive(false);
                }
              }}
            >
              {authorizingDrive ? t('page.connecting') : t('page.authorizeDrive')}
            </Button>
            <button
              type="button"
              onClick={() => setDriveAuthNeeded(false)}
              aria-label={t('page.dismissDrive')}
              className="-mr-1.5 grid size-11 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
            >
              <X size={15} />
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
              ariaLabel={t('page.courseContext')}
              className="min-w-0 [&>button]:max-w-[210px] [&>button]:px-3"
              options={[
                { value: 'all', label: t('page.allCoursesOpt'), shortLabel: t('page.allShort'), hint: t('page.semesterOverview') },
                ...courses.map((c) => ({
                  value: c.id,
                  label: c.shortName || c.name,
                  hint: c.name !== c.shortName ? c.name : undefined,
                  dotClass: courseColors[c.color]?.dot,
                })),
              ]}
            />
            <SourcesPill count={attachedMaterials.length} onClick={() => setSourcesOpen(true)} />
          </div>
          <button
            type="button"
            onClick={() => setShowActions((v) => !v)}
            aria-expanded={showActions}
            className="min-h-[44px] shrink-0 whitespace-nowrap px-2 text-xs font-medium text-muted hover:text-fg"
          >
            {showActions ? t('page.hideSug') : t('page.showSug')}
          </button>
        </div>

        <div className="flex min-w-0 items-center justify-between gap-1.5 md:hidden">
          <div className="flex min-w-0 items-center gap-1.5">
            <PillSelect
              value={activeCourseId}
              onChange={setActiveCourseId}
              placement="up"
              icon={<BookOpen size={13} />}
              ariaLabel={t('page.courseContext')}
              className="min-w-0 [&>button]:min-h-11 [&>button]:max-w-[140px] [&>button]:px-2.5"
              options={[
                { value: 'all', label: t('page.allCoursesOpt'), shortLabel: t('page.allShort'), hint: t('page.semesterOverview') },
                ...courses.map((c) => ({
                  value: c.id,
                  label: c.shortName || c.name,
                  hint: c.name !== c.shortName ? c.name : undefined,
                  dotClass: courseColors[c.color]?.dot,
                })),
              ]}
            />
            <SourcesPill count={attachedMaterials.length} onClick={() => setSourcesOpen(true)} />
          </div>
          <button
            type="button"
            onClick={() => setMobileSuggestionsOpen(true)}
            aria-expanded={mobileSuggestionsOpen}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-fg transition hover:border-accent/50"
          >
            <Sparkles size={13} className="text-accent" aria-hidden="true" />
            <span>{t('page.suggestions')}</span>
          </button>
        </div>

        {pendingSeedPrompt && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl border border-accent/40 bg-accent-soft/65 px-3.5 py-2.5 text-xs">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-accent-ink dark:text-accent">{t('page.seedReady')}</p>
              <p className="line-clamp-2 text-fg">{pendingSeedPrompt}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                size="sm"
                variant="primary"
                disabled={loading}
                onClick={() => {
                  const text = pendingSeedPrompt;
                  if (routeState?.courseId) setActiveCourseId(routeState.courseId);
                  dismissPendingSeedPrompt();
                  void send(text);
                }}
              >
                {t('page.send')}
              </Button>
              <button
                type="button"
                aria-label={t('page.dismissSeed')}
                onClick={dismissPendingSeedPrompt}
                className="-mr-1.5 grid size-11 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        {showActions && (
          <div className="hidden md:block">
            <QuickActions disabled={loading || !aiConsent} activeCourseId={activeCourseId} onSend={send} />
          </div>
        )}
        <Composer
          disabled={loading || !aiConsent}
          loading={loading}
          onSend={send}
          onStop={stop}
          hidePaperclipOnMobile
          placeholder={aiConsent ? t('page.askUni') : t('page.enableAbove')}
          leadingSlot={
            <button
              type="button"
              onClick={() => setMobileComposerToolsOpen((v) => !v)}
              aria-expanded={mobileComposerToolsOpen}
              aria-label={t('page.composerTools')}
              className={cx(
                'grid size-11 shrink-0 place-items-center rounded-full transition md:hidden',
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
                  aria-label={t('page.attachPhotoPdf')}
                  className="flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-fg"
                >
                  <Paperclip size={13} />
                  <span>{t('page.photoPdf')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileComposerToolsOpen(false);
                    setNotebookOpen(true);
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-full bg-pastel-butter/80 px-3 text-xs font-semibold text-[#141312] dark:bg-[#352D14] dark:text-[#FAF6EC]"
                >
                  <Sparkles size={13} />
                  <span>{t('page.notebook')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileComposerToolsOpen(false);
                    openUniCheckIn({ kind: 'day', courseId: activeCourse?.id });
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-fg"
                >
                  <BookOpenCheck size={13} />
                  <span>{t('page.journal')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileComposerToolsOpen(false);
                    setLiveVoiceOpen(true);
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-fg"
                >
                  <Mic size={13} />
                  <span>{t('liveVoice.openBtn')}</span>
                </button>
              </div>
            ) : null
          }
        />
      </div>

      <SourcesSheet
        open={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
        materials={availableMaterials}
        selectedIds={selectedMaterialIds}
        onToggle={toggleMaterial}
        onSelectMany={selectAllMaterials}
        onOpenAttach={() => setShowDocPicker(true)}
      />

      <Modal
        open={mobileSuggestionsOpen}
        onClose={() => setMobileSuggestionsOpen(false)}
        title={t('quick.sheetTitle')}
      >
        <QuickActions
          variant="mobile-sheet"
          disabled={loading || !aiConsent}
          activeCourseId={activeCourseId}
          onSend={send}
          onAfterSend={() => setMobileSuggestionsOpen(false)}
        />
      </Modal>

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
        maxAiFiles={maxAiFiles}
        availableMaterials={availableMaterials}
        selectedMaterialIds={selectedMaterialIds}
        onToggleMaterial={toggleMaterial}
        onSelectAllMaterials={selectAllMaterials}
        onClearAttachedMaterials={handleClearAttachedMaterials}
        confirmDeleteConv={confirmDeleteConv}
        onCloseDeleteConv={() => setConfirmDeleteConv(false)}
        onConfirmDeleteConv={() => {
          setConfirmDeleteConv(false);
          if (activeConvId) void handleDeleteConversationById(activeConvId);
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
        conversations={conversations}
        activeConvId={activeConvId}
        courses={courses}
        activeCourse={activeCourse}
        activeCourseId={activeCourseId}
        activeSubject={activeSubject}
        onSelectConversation={(conv) => {
          setActiveConvId(conv.id);
          if (conv.courseId) setActiveCourseId(conv.courseId);
        }}
        onCreateConversation={handleCreateConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversationById}
        notebookOpen={notebookOpen}
        onCloseNotebook={() => setNotebookOpen(false)}
        attachedMaterials={attachedMaterials}
        uniAccessory={uniAccessory}
        uniPersona={effectivePersona}
      />
      {courseUniAgent && activeCourse && courseUniMemoryOpen && (
        <UniNotebookMemoryModal
          open={courseUniMemoryOpen}
          onClose={() => setCourseUniMemoryOpen(false)}
          agent={courseUniAgent}
          courseName={activeCourse.shortName || activeCourse.name}
          onUpdateAgent={async (next) => {
            await saveUniAgent(next);
          }}
        />
      )}
      {liveVoiceOpen && (
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
      )}
    </div>
  );
}
