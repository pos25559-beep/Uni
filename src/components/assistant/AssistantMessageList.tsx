import { CalendarDays, FileText, Flag, RotateCcw, Sparkles } from 'lucide-react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '../../integrations/gemini';
import { recordWrongAnswerFeedback } from '../../lib/aiQuota';
import type { UniAgentRecord } from '../../lib/localDb';
import { commitScheduleSyncToStore, type ResolvedScheduleSyncBundle } from '../../lib/scheduleSync';
import { showToast } from '../../lib/uiHelpers';
import type { UniToolProposal } from '../../lib/uniTools';
import { looksSyncableReply } from '../../lib/visionParsers';
import { ListenButton } from '../audio/ListenButton';
import UniDuoStage from '../brand/UniDuoStage';
import { Button } from '../ui';
import { Markdown } from './Markdown';
import { AnswerSources } from './SourcesSheet';
import UniSyncCard from './UniSyncCard';
import UniToolProposalCard from './UniToolProposalCard';

export interface AssistantMessageListProps {
  messages: ChatMessage[];
  pendingToolsByMsgId: Record<string, UniToolProposal[]>;
  pendingSyncByMsgId: Record<string, ResolvedScheduleSyncBundle>;
  busyToolId: string | null;
  syncingMsgId: string | null;
  onConfirmToolProposal: (msgId: string, proposalId: string) => void;
  onCancelToolProposal: (msgId: string, proposalId: string) => void;
  onUpdatePendingSync: (msgId: string, next: ResolvedScheduleSyncBundle) => void;
  onExtractSync: (msg: ChatMessage) => void;
  onOpenCalendar: () => void;
  flaggedWrongIds: Record<string, boolean>;
  onFlagWrong: (msgId: string) => void;
  courseUniAgent?: UniAgentRecord | null;
  onOpenCourseUniMemory: () => void;
  loading: boolean;
  streamingText: string | null;
  error: string | null;
  quota: { bypassed: boolean; chatRemaining: number };
  hasCustomKey: boolean;
  onOpenKeyGuide: () => void;
  onClearCustomKeyAndRetry: () => void;
  onRetry: () => void;
  bottomRef: RefObject<HTMLDivElement | null>;
}

export function AssistantMessageList(props: AssistantMessageListProps) {
  const {
    messages,
    pendingToolsByMsgId,
    pendingSyncByMsgId,
    busyToolId,
    syncingMsgId,
    onConfirmToolProposal,
    onCancelToolProposal,
    onUpdatePendingSync,
    onExtractSync,
    onOpenCalendar,
    flaggedWrongIds,
    onFlagWrong,
    courseUniAgent,
    onOpenCourseUniMemory,
    loading,
    streamingText,
    error,
    quota,
    hasCustomKey,
    onOpenKeyGuide,
    onClearCustomKeyAndRetry,
    onRetry,
    bottomRef,
  } = props;
  const { t } = useTranslation('assistant');

  return (
    <>
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
                onConfirm={() => onConfirmToolProposal(m.id, proposal.id)}
                onCancel={() => onCancelToolProposal(m.id, proposal.id)}
              />
            ))}
            {pendingSyncByMsgId[m.id] ? (
              <UniSyncCard
                bundle={pendingSyncByMsgId[m.id]}
                onChange={(next) => onUpdatePendingSync(m.id, next)}
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
                  onUpdatePendingSync(m.id, {
                    ...current,
                    applied: true,
                    appliedSummary: summary,
                  });
                  showToast(summary);
                }}
                onOpenCalendar={onOpenCalendar}
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
                    onClick={() => onExtractSync(m)}
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
                      onFlagWrong(m.id);
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
                    onClick={onOpenCourseUniMemory}
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
        <div className="rise w-fit rounded-3xl rounded-bl-md bg-surface px-4 py-2 shadow-card">
          <UniDuoStage context="thinking" compact label={t('page.thinkingNow')} />
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
              <Button size="sm" variant="primary" onClick={onOpenKeyGuide}>
                {t('page.useFreeKey')}
              </Button>
            )}
            {hasCustomKey && (
              <>
                <Button size="sm" variant="primary" onClick={onOpenKeyGuide}>
                  {t('page.manageKey')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onClearCustomKeyAndRetry}
                  disabled={loading}
                >
                  {t('page.backNative')}
                </Button>
              </>
            )}
            <Button size="sm" variant="secondary" onClick={onRetry} disabled={loading}>
              <RotateCcw size={14} />
              {t('page.retry')}
            </Button>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </>
  );
}
