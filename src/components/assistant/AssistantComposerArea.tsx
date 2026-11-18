import { BookOpen, BookOpenCheck, Mic, Paperclip, Plus, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatAttachment } from '../../integrations/gemini';
import { courseColors } from '../../lib/colors';
import { toFriendlyError } from '../../lib/errorMessages';
import { openUniCheckIn } from '../../lib/uniCheckInBus';
import { cx, showToast } from '../../lib/uiHelpers';
import { googleService } from '../../services/googleService';
import { requestAiConsent } from '../../store/useAiConsentStore';
import type { Course } from '../../types';
import { Badge, Button, PillSelect } from '../ui';
import { Composer } from './Composer';
import { QuickActions } from './QuickActions';
import { SourcesPill } from './SourcesSheet';

export interface AssistantComposerAreaProps {
  aiConsent: boolean;
  chatLimit: number;
  driveAuthNeeded: boolean;
  onDismissDriveAuth: () => void;
  courses: Course[];
  activeCourse?: Course;
  activeCourseId: string;
  onChangeCourseId: (id: string) => void;
  attachedCount: number;
  onOpenSources: () => void;
  showActions: boolean;
  onToggleActions: () => void;
  onOpenMobileSuggestions: () => void;
  pendingSeedPrompt: string | null;
  onSendSeedPrompt: () => void;
  onDismissSeedPrompt: () => void;
  loading: boolean;
  onSend: (text: string, attachments?: ChatAttachment[]) => Promise<void> | void;
  onStop: () => void;
  mobileComposerToolsOpen: boolean;
  setMobileComposerToolsOpen: (fn: (prev: boolean) => boolean) => void;
  onOpenNotebook: () => void;
  onOpenLiveVoice: () => void;
}

export function AssistantComposerArea(props: AssistantComposerAreaProps) {
  const {
    aiConsent,
    chatLimit,
    driveAuthNeeded,
    onDismissDriveAuth,
    courses,
    activeCourse,
    activeCourseId,
    onChangeCourseId,
    attachedCount,
    onOpenSources,
    showActions,
    onToggleActions,
    onOpenMobileSuggestions,
    pendingSeedPrompt,
    onSendSeedPrompt,
    onDismissSeedPrompt,
    loading,
    onSend,
    onStop,
    mobileComposerToolsOpen,
    setMobileComposerToolsOpen,
    onOpenNotebook,
    onOpenLiveVoice,
  } = props;
  const { t } = useTranslation('assistant');
  const [authorizingDrive, setAuthorizingDrive] = useState(false);

  const courseOptions = [
    {
      value: 'all',
      label: t('page.allCoursesOpt'),
      shortLabel: t('page.allShort'),
      hint: t('page.semesterOverview'),
    },
    ...courses.map((c) => ({
      value: c.id,
      label: c.shortName || c.name,
      hint: c.name !== c.shortName ? c.name : undefined,
      dotClass: courseColors[c.color]?.dot,
    })),
  ];

  return (
    <>
      {!aiConsent && (
        <div className="mt-2.5 flex shrink-0 items-center justify-between gap-2.5 rounded-2xl bg-pastel-butter/75 px-3.5 py-2.5 text-xs text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC] sm:px-4 sm:py-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-1.5 font-semibold">
              <Sparkles size={14} className="shrink-0 text-accent" />
              <span className="truncate">{t('page.enableUni')}</span>
              <Badge tone="accent" className="hidden sm:inline-flex">
                {t('page.included')}
              </Badge>
            </div>
            <p className="hidden opacity-80 sm:block">
              {t('page.consentLong', { limit: chatLimit })}
            </p>
            <p className="truncate text-xs opacity-80 sm:hidden">
              {t('page.consentShort', { limit: chatLimit })}
            </p>
          </div>
          <Button size="sm" variant="primary" onClick={() => requestAiConsent()}>
            {t('page.enableBtn')}
          </Button>
        </div>
      )}

      {driveAuthNeeded && (
        <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-line bg-surface-2/90 px-3.5 py-2.5 text-xs text-fg">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="font-semibold">{t('page.driveTitle')}</div>
            <p className="text-xs text-muted">{t('page.driveBody')}</p>
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
                  onDismissDriveAuth();
                  showToast(t('page.driveOk'));
                } catch (e) {
                  showToast(toFriendlyError(e, t('page.driveFail')), 'danger');
                } finally {
                  setAuthorizingDrive(false);
                }
              }}
            >
              {authorizingDrive ? t('page.connecting') : t('page.authorizeDrive')}
            </Button>
            <button
              type="button"
              onClick={onDismissDriveAuth}
              aria-label={t('page.dismissDrive')}
              className="-mr-1.5 grid size-11 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Contexto do compositor + sugestões + entrada de mensagem */}
      <div className="shrink-0 space-y-2 pt-1.5 md:space-y-2.5 md:pt-3">
        <div className="hidden items-center justify-between gap-2 md:flex">
          <div className="flex min-w-0 items-center gap-1.5">
            <PillSelect
              value={activeCourseId}
              onChange={onChangeCourseId}
              placement="up"
              icon={<BookOpen size={14} />}
              ariaLabel={t('page.courseContext')}
              className="min-w-0 [&>button]:max-w-[210px] [&>button]:px-3"
              options={courseOptions}
            />
            <SourcesPill count={attachedCount} onClick={onOpenSources} />
          </div>
          <button
            type="button"
            onClick={onToggleActions}
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
              onChange={onChangeCourseId}
              placement="up"
              icon={<BookOpen size={13} />}
              ariaLabel={t('page.courseContext')}
              className="min-w-0 [&>button]:min-h-11 [&>button]:max-w-[140px] [&>button]:px-2.5"
              options={courseOptions}
            />
            <SourcesPill count={attachedCount} onClick={onOpenSources} />
          </div>
          <button
            type="button"
            onClick={onOpenMobileSuggestions}
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
              <Button size="sm" variant="primary" disabled={loading} onClick={onSendSeedPrompt}>
                {t('page.send')}
              </Button>
              <button
                type="button"
                aria-label={t('page.dismissSeed')}
                onClick={onDismissSeedPrompt}
                className="-mr-1.5 grid size-11 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        {showActions && (
          <div className="hidden md:block">
            <QuickActions disabled={loading || !aiConsent} activeCourseId={activeCourseId} onSend={onSend} />
          </div>
        )}
        <Composer
          disabled={loading || !aiConsent}
          loading={loading}
          onSend={onSend}
          onStop={onStop}
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
                    setMobileComposerToolsOpen(() => false);
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
                    setMobileComposerToolsOpen(() => false);
                    onOpenNotebook();
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-full bg-pastel-butter/80 px-3 text-xs font-semibold text-[#141312] dark:bg-[#352D14] dark:text-[#FAF6EC]"
                >
                  <Sparkles size={13} />
                  <span>{t('page.notebook')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileComposerToolsOpen(() => false);
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
                    setMobileComposerToolsOpen(() => false);
                    onOpenLiveVoice();
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
    </>
  );
}
