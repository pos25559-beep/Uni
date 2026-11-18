import {
  BookOpenCheck,
  ChevronDown,
  FolderOpen,
  Menu,
  Mic,
  MoreHorizontal,
  Plus,
  Sparkles,
  SquarePen,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TUTOR_SUBJECTS, subjectLabel, type Conversation } from '../../lib/geminiConversations';
import type { UniAgentRecord } from '../../lib/localDb';
import type { UniPersonaMode } from '../../lib/uniAccessories';
import { openUniCheckIn } from '../../lib/uniCheckInBus';
import { cx } from '../../lib/uiHelpers';
import type { Course } from '../../types';
import { TabGuideHelpButton } from '../onboarding/TabGuideBanner';
import { Button, SegmentedControl } from '../ui';

export interface AssistantHeaderProps {
  personas: Array<{ id: UniPersonaMode; label: string }>;
  uniPersona: UniPersonaMode;
  effectivePersona: UniPersonaMode;
  onChangePersona: (next: UniPersonaMode) => void;
  courseUniAgent?: UniAgentRecord | null;
  activeCourse?: Course;
  currentConv?: Conversation | null;
  messagesCount: number;
  conversationsCount: number;
  filteredConversations: Conversation[];
  activeConvId?: string | null;
  onSelectConv: (id: string) => void;
  onRequestDeleteConv: () => void;
  activeSubject: string;
  onChangeSubject: (subject: string) => void;
  loading: boolean;
  isMinimal: boolean;
  isSignedIn: boolean;
  quota: { bypassed: boolean; chatRemaining: number; chatLimit: number };
  mobileFiltersOpen: boolean;
  setMobileFiltersOpen: (fn: (prev: boolean) => boolean) => void;
  onCreateConversation: () => void;
  onOpenConvsModal: () => void;
  onOpenMenu: () => void;
  onOpenKeyGuide: () => void;
  onOpenNotebook: () => void;
  onOpenLiveVoice: () => void;
}

export function AssistantHeader(props: AssistantHeaderProps) {
  const {
    personas,
    uniPersona,
    effectivePersona,
    onChangePersona,
    courseUniAgent,
    activeCourse,
    currentConv,
    messagesCount,
    conversationsCount,
    filteredConversations,
    activeConvId,
    onSelectConv,
    onRequestDeleteConv,
    activeSubject,
    onChangeSubject,
    loading,
    isMinimal,
    isSignedIn,
    quota,
    mobileFiltersOpen,
    setMobileFiltersOpen,
    onCreateConversation,
    onOpenConvsModal,
    onOpenMenu,
    onOpenKeyGuide,
    onOpenNotebook,
    onOpenLiveVoice,
  } = props;
  const { t } = useTranslation('assistant');

  return (
    <>
      {/* Cabeçalho minimalista estilo app Gemini no telemóvel (< md) */}
      <div className="shrink-0 space-y-2 pb-1 md:hidden">
        <h1 className="sr-only">{t('srHeading')}</h1>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={onOpenConvsModal}
              aria-label={t('page.conversations', { count: conversationsCount })}
              className="relative grid size-11 shrink-0 place-items-center rounded-full text-fg transition hover:bg-surface-2"
            >
              <Menu size={20} />
              {conversationsCount > 0 && (
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
                currentConv && messagesCount > 0
                  ? currentConv.title
                  : t('page.styleOptions', {
                      persona:
                        personas.find((p) => p.id === uniPersona)?.label ?? personas[0]?.label ?? '',
                    })
              }
              className="flex min-h-[44px] min-w-0 items-center gap-1.5 rounded-full px-2 text-left transition hover:bg-surface-2"
            >
              <span className="truncate font-display text-lg font-bold tracking-tight text-fg">
                {currentConv && messagesCount > 0 ? (
                  currentConv.title
                ) : (
                  <>
                    {courseUniAgent ? courseUniAgent.name : 'Uni'}{' '}
                    <span className="font-normal text-muted">
                      {personas.find((p) => p.id === effectivePersona)?.label ??
                        personas[0]?.label ??
                        ''}
                    </span>
                  </>
                )}
              </span>
              <ChevronDown
                size={15}
                className={cx(
                  'shrink-0 text-muted transition-transform',
                  mobileFiltersOpen && 'rotate-180',
                )}
              />
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              disabled={loading}
              onClick={onCreateConversation}
              aria-label={t('page.newConv')}
              title={t('page.newConv')}
              className="grid size-11 place-items-center rounded-full text-fg transition hover:bg-surface-2 disabled:opacity-45"
            >
              <SquarePen size={18} />
            </button>
            <button
              type="button"
              onClick={onOpenMenu}
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
                onChange={(v) => onChangePersona(v as UniPersonaMode)}
                items={personas.map((p) => ({ id: p.id, label: p.label }))}
              />
              <button
                type="button"
                onClick={onOpenKeyGuide}
                className="min-h-11 rounded-full border border-line bg-surface-2 px-3 text-xs font-medium tabular text-muted"
              >
                {quota.bypassed
                  ? t('page.unlimited')
                  : `${quota.chatRemaining}/${quota.chatLimit} msgs`}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setMobileFiltersOpen(() => false);
                  onOpenNotebook();
                }}
                className="flex min-h-11 items-center gap-1.5 rounded-full bg-pastel-butter/80 px-3 text-xs font-semibold text-[#141312] dark:bg-[#352D14] dark:text-[#FAF6EC]"
              >
                <Sparkles size={13} /> {t('notebook.title')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileFiltersOpen(() => false);
                  openUniCheckIn({ kind: 'day', courseId: activeCourse?.id });
                }}
                className="flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-fg"
              >
                <BookOpenCheck size={13} /> {t('page.journal')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileFiltersOpen(() => false);
                  onOpenLiveVoice();
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
            <p className="text-xs font-medium tracking-wide text-muted">{t('page.companion')}</p>
            <h1 className="truncate font-display text-2xl font-bold leading-tight tracking-tight text-fg">
              {t('page.talkWith')}{' '}
              <span className="font-serif font-medium italic text-accent-ink">Uni</span>
            </h1>
            <p className="truncate text-xs font-medium text-muted">
              {isSignedIn ? t('page.synced') : t('page.thisDevice')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <TabGuideHelpButton tabKey="assistente" />
            <Button
              size="sm"
              variant="primary"
              disabled={loading}
              onClick={onCreateConversation}
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
              onClick={onOpenConvsModal}
              aria-label={t('page.conversations', { count: conversationsCount })}
              className="min-h-[44px] px-3.5 text-xs"
            >
              <FolderOpen size={15} />
              <span>{t('page.conversations', { count: conversationsCount })}</span>
            </Button>
            <Button
              variant="secondary"
              iconOnly
              onClick={onOpenMenu}
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
                onClick={onOpenNotebook}
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
                onClick={onOpenLiveVoice}
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
                onChange={(v) => onChangePersona(v as UniPersonaMode)}
                items={personas.map((p) => ({ id: p.id, label: p.label }))}
              />
              <button
                type="button"
                onClick={onOpenKeyGuide}
                title={t('page.unlockTitle')}
                className="min-h-11 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium tabular text-muted transition hover:border-accent hover:text-fg"
              >
                {quota.bypassed
                  ? t('page.ownKey')
                  : t('page.msgsUnlock', {
                      remaining: quota.chatRemaining,
                      limit: quota.chatLimit,
                    })}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
            {[{ id: 'all', label: t('page.allSubjects') }, ...TUTOR_SUBJECTS].map((subj) => {
              const active = activeSubject === subj.id;
              return (
                <button
                  key={subj.id}
                  type="button"
                  onClick={() => onChangeSubject(subj.id)}
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
                      onClick={() => onSelectConv(c.id)}
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
                        onClick={onRequestDeleteConv}
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
    </>
  );
}
