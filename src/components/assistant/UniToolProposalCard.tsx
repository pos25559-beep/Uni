import { CalendarPlus, Check, HelpCircle, Layers, Target, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { UniToolProposal } from '../../lib/uniTools';
import { cx } from '../../lib/uiHelpers';
import { Badge, Button } from '../ui';

interface UniToolProposalCardProps {
  proposal: UniToolProposal;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function UniToolProposalCard({
  proposal,
  busy = false,
  onConfirm,
  onCancel,
}: UniToolProposalCardProps) {
  const { t } = useTranslation('assistant');

  const meta =
    proposal.toolName === 'criar_sessao'
      ? {
          icon: CalendarPlus,
          title: t('tools.createSession'),
          detail: proposal.session
            ? `${proposal.topicTitle} · ${t('tools.minutesLabel', {
                minutes: proposal.session.minutes,
                date: proposal.session.date,
              })}`
            : proposal.topicTitle,
        }
      : proposal.toolName === 'criar_flashcards'
        ? {
            icon: Layers,
            title: t('tools.createFlashcards'),
            detail: `${proposal.topicTitle} · ${t('tools.cardsCount', {
              count: proposal.flashcards?.length ?? 0,
            })}`,
          }
        : proposal.toolName === 'focar_plano'
          ? {
              icon: Target,
              title: t('tools.focusPlan'),
              detail: proposal.planFocus?.exclusive
                ? t('tools.focusExclusiveDetail', {
                    course: proposal.courseLabel,
                    reason: proposal.planFocus.reason,
                  })
                : t('tools.focusBoostDetail', {
                    course: proposal.courseLabel,
                    reason: proposal.planFocus?.reason ?? '',
                  }),
            }
          : {
              icon: HelpCircle,
              title: t('tools.markDoubt'),
              detail: `${t('tools.doubtLabel', { topic: proposal.topicTitle })} — ${proposal.doubt?.note ?? ''}`,
            };

  const Icon = meta.icon;

  return (
    <div
      className={cx(
        'mt-2.5 rounded-2xl border p-3.5 text-left transition',
        proposal.status === 'confirmed'
          ? 'border-ok/35 bg-ok/10'
          : proposal.status === 'cancelled'
            ? 'border-line bg-surface-2/45 opacity-75'
            : 'border-accent/35 bg-surface shadow-card',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                {t('tools.proposalTitle')}
              </p>
              <Badge tone="neutral">{proposal.courseLabel}</Badge>
            </div>
            <p className="mt-0.5 text-sm font-semibold text-fg">{meta.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">{meta.detail}</p>
          </div>
        </div>
      </div>

      {proposal.toolName === 'criar_flashcards' && proposal.flashcards && proposal.flashcards.length > 0 && (
        <ul className="mt-2.5 space-y-1.5 rounded-xl bg-surface-2/65 p-2.5 text-xs">
          {proposal.flashcards.slice(0, 3).map((fc, idx) => (
            <li key={`${proposal.id}-fc-${idx}`} className="truncate text-fg">
              <strong className="font-semibold">Q{idx + 1}:</strong> {fc.front}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {proposal.status === 'pending' ? (
          <>
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
              <X size={14} /> {t('tools.cancel')}
            </Button>
            <Button size="sm" variant="primary" onClick={onConfirm} loading={busy}>
              <Check size={14} /> {t('tools.confirm')}
            </Button>
          </>
        ) : proposal.status === 'confirmed' ? (
          <Badge tone="ok">{t('tools.confirmed')}</Badge>
        ) : (
          <Badge tone="neutral">{t('tools.cancelled')}</Badge>
        )}
      </div>
    </div>
  );
}
