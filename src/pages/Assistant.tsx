import {
  Award,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  FileText,
  FolderOpen,
  Menu,
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
import { useLocation, useNavigate } from 'react-router-dom';
import AssistantModals from '../components/assistant/AssistantModals';
import { Composer } from '../components/assistant/Composer';
import { Markdown } from '../components/assistant/Markdown';
import { QuickActions } from '../components/assistant/QuickActions';
import UniSyncCard from '../components/assistant/UniSyncCard';
import { useAssistantChat } from '../components/assistant/useAssistantChat';
import { UniBuddy } from '../components/brand/UnipediaMarks';
import { TabGuideBanner, TabGuideHelpButton } from '../components/onboarding/TabGuideBanner';
import { Badge, Button, PillSelect, SegmentedControl } from '../components/ui';
import { hasCustomGeminiKey } from '../integrations/gemini';
import { courseColors } from '../lib/colors';
import { TUTOR_SUBJECTS, subjectLabel } from '../lib/geminiConversations';
import { commitScheduleSyncToStore } from '../lib/scheduleSync';
import { cx, showToast } from '../lib/uiHelpers';
import { resolveUniAccessory, UNI_PERSONAS } from '../lib/uniAccessories';
import { openUniCheckIn } from '../lib/uniCheckInBus';
import { looksSyncableReply } from '../lib/visionParsers';
import { googleService } from '../services/googleService';
import { useStore } from '../store/useStore';

export default function Assistant() {
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
  const uniPersona = useStore((s) => s.settings.uniPersona ?? 'amigo');
  const appTone = useStore((s) => s.settings.appTone ?? 'vibrante');
  const isMinimal = appTone === 'serio';
  const aiConsent = useStore((s) => Boolean(s.settings.aiConsent));
  const hasCustomKey = useStore((s) => Boolean(s.settings.geminiApiKey?.trim()) || hasCustomGeminiKey());
  const updateSettings = useStore((s) => s.updateSettings);
  const userName = useStore((s) => s.settings.userName);
  const setIntegration = useStore((s) => s.setIntegration);

  const [activeCourseId, setActiveCourseId] = useState<string>(() => routeState?.courseId || 'all');
  const [activeSubject, setActiveSubject] = useState<string>('all');
  const [authorizingDrive, setAuthorizingDrive] = useState(false);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [convsModalMode, setConvsModalMode] = useState<'list' | 'new' | null>(null);
  const [confirmDeleteConv, setConfirmDeleteConv] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [materialsStripMode, setMaterialsStripMode] = useState<'compact' | 'collapsed' | 'expanded'>('compact');
  const [tutorOpen, setTutorOpen] = useState(false);
  const [keyGuideOpen, setKeyGuideOpen] = useState(false);
  const [collectiblesOpen, setCollectiblesOpen] = useState(false);
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [dismissedPrompt, setDismissedPrompt] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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
    uniPersona,
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
    const latestExam = studyLogs.find((l) => l.kind === 'exam_prep');
    if (latestExam) {
      const c = courses.find((x) => x.id === latestExam.courseId);
      return c
        ? `Revê comigo a matéria alinhada de ${c.shortName} para o teste`
        : 'Revê comigo a matéria do meu próximo teste';
    }
    const hardClass = studyLogs.find(
      (l) => l.kind === 'class' && (l.feeling === 'dificil' || l.feeling === 'mais_ou_menos'),
    );
    if (hardClass) {
      const c = courses.find((x) => x.id === hardClass.courseId);
      return hardClass.topicTitle
        ? `Explica passo a passo «${hardClass.topicTitle}»${c ? ` (${c.shortName})` : ''}`
        : `Ajuda-me a rever a última aula${c ? ` de ${c.shortName}` : ''}`;
    }
    return null;
  }, [studyLogs, courses]);

  const handleClearAttachedMaterials = () => {
    clearAttachedMaterials();
    setMaterialsStripMode('compact');
  };

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
              <button
                type="button"
                onClick={() => {
                  setMobileFiltersOpen(false);
                  openUniCheckIn({ kind: 'day', courseId: activeCourse?.id });
                }}
                className="flex min-h-[38px] items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-fg"
              >
                <BookOpenCheck size={13} /> Diário
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

              <button
                type="button"
                onClick={() => openUniCheckIn({ kind: 'day', courseId: activeCourse?.id })}
                className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-fg transition hover:bg-surface-2"
              >
                <BookOpenCheck size={13} className="text-accent-ink dark:text-accent" />
                <span>Diário</span>
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
                ...(recentLogSuggestion ? [recentLogSuggestion] : []),
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

      {/* Aviso amigável de 1 toque para ativar o Uni nativo (zero chave obrigatória; 1 linha no mobile) */}
      {!aiConsent && (
        <div className="mt-2.5 flex shrink-0 items-center justify-between gap-2.5 rounded-[20px] bg-pastel-butter/75 px-3.5 py-2.5 text-xs text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC] sm:rounded-[22px] sm:px-4 sm:py-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-1.5 font-semibold">
              <Sparkles size={14} className="shrink-0 text-accent" />
              <span className="truncate">Ativar o Uni</span>
              <Badge tone="accent" className="hidden sm:inline-flex">Incluído</Badge>
            </div>
            <p className="hidden opacity-80 sm:block">
              Pronto a usar com 1 toque (até {quota.chatLimit} mensagens/dia). Aceita apenas o envio das tuas perguntas para o Tutor responder.
            </p>
            <p className="truncate text-xs opacity-80 sm:hidden">
              Até {quota.chatLimit} msgs/dia incluídas
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
            <p className="text-xs text-muted">
              A sessão do Google Drive expirou neste dispositivo — liga em 1 toque para extrair texto e fórmulas reais dos teus apontamentos.
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
          <div className="space-y-1.5">
            {materialsStripMode === 'collapsed' && attachedMaterials.length > 0 ? (
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-line/80 bg-surface-2/60 px-2.5 py-1.5 text-xs">
                <div className="flex min-w-0 items-center gap-1.5">
                  {activeCourse && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent-ink md:hidden">
                      <span className="max-w-[90px] truncate">{activeCourse.shortName || activeCourse.name}</span>
                      <button
                        type="button"
                        onClick={() => setActiveCourseId('all')}
                        aria-label="Limpar filtro de cadeira"
                        className="hover:text-danger"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setMaterialsStripMode('compact')}
                    aria-label="Expandir apontamentos anexados"
                    className="inline-flex min-h-[30px] items-center gap-1.5 truncate font-semibold text-fg hover:text-accent-ink"
                  >
                    <Paperclip size={12} className="shrink-0 text-accent" />
                    <span className="truncate">{attachedMaterials.length} apontamento(s) anexado(s)</span>
                    <ChevronDown size={13} className="shrink-0 text-muted" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleClearAttachedMaterials}
                  aria-label="Limpar todos os apontamentos anexados"
                  className="min-h-[30px] shrink-0 rounded-full px-2 text-xs font-medium text-muted hover:bg-surface hover:text-danger"
                >
                  Limpar
                </button>
              </div>
            ) : (
              <>
                {attachedMaterials.length > 1 && (
                  <div className="flex items-center justify-between gap-2 px-0.5 text-xs">
                    <span className="font-medium text-muted">
                      {attachedMaterials.length} apontamentos ativos
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setMaterialsStripMode((m) => (m === 'expanded' ? 'compact' : 'expanded'))
                        }
                        className="inline-flex min-h-[28px] items-center gap-1 rounded-full px-2 font-medium text-muted hover:bg-surface-2 hover:text-fg"
                      >
                        {materialsStripMode === 'expanded' ? (
                          <>
                            <ChevronUp size={12} /> 1 linha
                          </>
                        ) : (
                          <>
                            <ChevronDown size={12} /> Ver lista
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMaterialsStripMode('collapsed')}
                        aria-label="Diminuir barra de apontamentos"
                        className="inline-flex min-h-[28px] items-center gap-1 rounded-full bg-surface-2 px-2.5 font-semibold text-fg hover:bg-surface-2/80"
                      >
                        Diminuir
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAttachedMaterials}
                        aria-label="Limpar todos os apontamentos"
                        className="min-h-[28px] rounded-full px-2 text-muted hover:text-danger"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                )}

                <div
                  className={cx(
                    'flex gap-1.5',
                    materialsStripMode === 'expanded'
                      ? 'max-h-28 flex-wrap overflow-y-auto pr-1'
                      : 'flex-nowrap items-center overflow-x-auto pb-0.5 no-scrollbar',
                  )}
                >
                  {activeCourse && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-ink md:hidden">
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
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs text-muted"
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
              </>
            )}
          </div>
        )}

        {pendingSeedPrompt && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl border border-accent/40 bg-accent-soft/65 px-3.5 py-2.5 text-xs">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-accent-ink dark:text-accent">Resumo do Diário do Uni pronto</p>
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
                Enviar
              </Button>
              <button
                type="button"
                aria-label="Dispensar sugestão do diário"
                onClick={dismissPendingSeedPrompt}
                className="-mr-1.5 grid size-11 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
              >
                <X size={15} />
              </button>
            </div>
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
                  aria-label="Anexar foto ou PDF de apontamentos"
                  className="flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-fg"
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
                  className="min-w-0 [&>button]:min-h-11 [&>button]:max-w-[140px] [&>button]:px-2.5"
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
                  className="flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-fg"
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
                  className="flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-fg"
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
                  className="flex min-h-11 items-center gap-1 rounded-full bg-pastel-butter/80 px-3 text-xs font-semibold text-[#141312] dark:bg-[#352D14] dark:text-[#FAF6EC]"
                >
                  <span>Caderno</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileComposerToolsOpen(false);
                    openUniCheckIn({ kind: 'day', courseId: activeCourse?.id });
                  }}
                  className="flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-fg"
                >
                  <BookOpenCheck size={13} />
                  <span>Diário</span>
                </button>
              </div>
            ) : null
          }
        />
      </div>

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
        uniPersona={uniPersona}
      />
    </div>
  );
}
