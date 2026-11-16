import { KeyRound, Mic, MicOff, PhoneOff, Radio } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  startUniLiveVoiceSession,
  type LiveTranscriptEntry,
  type LiveVoiceController,
  type LiveVoiceStatus,
} from '../../integrations/geminiLiveVoice';
import { canStartLiveVoiceSession } from '../../lib/aiQuota';
import type { UniAgentRecord } from '../../lib/localDb';
import { showToast } from '../../lib/uiHelpers';
import type { UniAccessoryId, UniPersonaMode } from '../../lib/uniAccessories';
import { commitUniToolProposal, type UniToolProposal } from '../../lib/uniTools';
import { useStore } from '../../store/useStore';
import type { Course } from '../../types';
import { UniBuddy, type BuddyMood } from '../brand/UnipediaMarks';
import { Button, Modal } from '../ui';
import UniToolProposalCard from './UniToolProposalCard';

interface UniLiveVoiceModalProps {
  open: boolean;
  onClose: () => void;
  onOpenKeyGuide: () => void;
  activeCourse?: Course;
  uniAgent?: UniAgentRecord | null;
  persona: UniPersonaMode;
  accessory: UniAccessoryId;
  studentName: string;
  language: string;
}

export default function UniLiveVoiceModal({
  open,
  onClose,
  onOpenKeyGuide,
  activeCourse,
  uniAgent,
  persona,
  accessory,
  studentName,
  language,
}: UniLiveVoiceModalProps) {
  const { t } = useTranslation(['assistant', 'common']);
  const apiKey = useStore((s) => s.settings.geminiApiKey ?? '');
  const hasCustomKey = Boolean(apiKey.trim());
  const voiceGuard = canStartLiveVoiceSession(hasCustomKey);

  const [status, setStatus] = useState<LiveVoiceStatus>('idle');
  const [muted, setMuted] = useState(false);
  const [transcripts, setTranscripts] = useState<LiveTranscriptEntry[]>([]);
  const [proposals, setProposals] = useState<UniToolProposal[]>([]);
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const controllerRef = useRef<LiveVoiceController | null>(null);

  const stopSession = () => {
    controllerRef.current?.stop();
    controllerRef.current = null;
  };

  useEffect(() => {
    if (!open || !voiceGuard.allowed) return;
    let cancelled = false;
    setErrorMsg(null);
    setMuted(false);

    void startUniLiveVoiceSession({
      apiKey,
      activeCourse,
      uniAgent,
      persona,
      accessory,
      studentName,
      language,
      onStatusChange: (next) => {
        if (!cancelled) setStatus(next);
      },
      onTranscript: (entry) => {
        if (!cancelled) {
          setTranscripts((prev) => [...prev.slice(-16), entry]);
        }
      },
      onToolProposal: (proposal) => {
        if (!cancelled) {
          setProposals((prev) => [...prev, proposal]);
        }
      },
      onSilenceTimeout: () => {
        if (!cancelled) {
          showToast(t('assistant:liveVoice.silenceClosed'), 'neutral');
          onClose();
        }
      },
      onError: (msg) => {
        if (!cancelled) setErrorMsg(msg);
      },
    })
      .then((ctrl) => {
        if (cancelled) {
          ctrl.stop();
          return;
        }
        controllerRef.current = ctrl;
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(err instanceof Error ? err.message : t('assistant:liveVoice.connectionError'));
        }
      });

    return () => {
      cancelled = true;
      stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, voiceGuard.allowed]);

  const uniDisplayName = uniAgent?.name ?? 'Uni';

  const buddyMood: BuddyMood =
    status === 'listening'
      ? 'listening'
      : status === 'speaking'
        ? 'speaking'
        : status === 'thinking' || status === 'connecting'
          ? 'thinking'
          : status === 'sleeping'
            ? 'sleeping'
            : 'happy';

  const statusText =
    status === 'connecting'
      ? t('assistant:liveVoice.connecting')
      : status === 'listening'
        ? t('assistant:liveVoice.listening')
        : status === 'thinking'
          ? t('assistant:liveVoice.thinking')
          : status === 'speaking'
            ? t('assistant:liveVoice.speaking')
            : status === 'sleeping'
              ? t('assistant:liveVoice.sleeping')
              : t('assistant:liveVoice.idle');

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    controllerRef.current?.setMuted(next);
  };

  const handleConfirmProposal = async (proposal: UniToolProposal) => {
    setBusyProposalId(proposal.id);
    try {
      const res = await commitUniToolProposal(proposal);
      setProposals((prev) =>
        prev.map((p) => (p.id === proposal.id ? { ...p, status: 'confirmed' as const } : p)),
      );
      showToast(res.summary, 'ok');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao guardar ação.', 'danger');
    } finally {
      setBusyProposalId(null);
    }
  };

  const handleCancelProposal = (proposalId: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === proposalId ? { ...p, status: 'cancelled' as const } : p)),
    );
  };

  const handleClose = () => {
    stopSession();
    setStatus('idle');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('assistant:liveVoice.title', { name: uniDisplayName })}
      footer={
        !voiceGuard.allowed ? (
          <div className="flex w-full justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={handleClose}>
              {t('common:actions.close')}
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                handleClose();
                onOpenKeyGuide();
              }}
            >
              <KeyRound size={14} /> {t('assistant:liveVoice.openKeyGuide')}
            </Button>
          </div>
        ) : (
          <div className="flex w-full items-center justify-between gap-2">
            <Button size="sm" variant="secondary" onClick={toggleMute} disabled={status === 'connecting'}>
              {muted ? <MicOff size={15} /> : <Mic size={15} />}
              {muted ? t('assistant:liveVoice.unmute') : t('assistant:liveVoice.mute')}
            </Button>
            <Button size="sm" variant="danger" onClick={handleClose}>
              <PhoneOff size={15} /> {t('assistant:liveVoice.endSession')}
            </Button>
          </div>
        )
      }
    >
      {!voiceGuard.allowed ? (
        <div className="space-y-4 py-2 text-center">
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-pastel-butter/75 dark:bg-surface-2">
            <UniBuddy
              form={uniAgent?.formId ?? 'nuvem'}
              stage={uniAgent?.stage ?? 1}
              accessory={accessory}
              mood="calm"
              size={60}
              interactive={false}
            />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-display text-base font-bold text-fg">
              {t('assistant:liveVoice.needsKeyTitle')}
            </h3>
            <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted">
              {t('assistant:liveVoice.needsKeyDesc')}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center rounded-3xl bg-pastel-sage/55 px-4 py-5 text-center dark:bg-surface-2">
            <UniBuddy
              form={uniAgent?.formId ?? 'nuvem'}
              stage={uniAgent?.stage ?? 1}
              accessory={accessory}
              mood={buddyMood}
              dormant={buddyMood === 'sleeping'}
              size={84}
              interactive={false}
            />
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1 text-xs font-semibold text-fg shadow-sm">
              <Radio size={12} className="text-accent" />
              {statusText}
            </span>
          </div>

          {errorMsg && (
            <p role="alert" className="rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs text-danger">
              {errorMsg}
            </p>
          )}

          <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-line bg-surface-2/40 p-3">
            {transcripts.length === 0 ? (
              <p className="text-center text-xs text-muted">
                {t('assistant:liveVoice.transcriptEmpty', { name: uniDisplayName })}
              </p>
            ) : (
              transcripts.map((entry) => (
                <div
                  key={entry.id}
                  className={
                    entry.role === 'user'
                      ? 'ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-ink-cta px-3 py-2 text-xs text-ink-cta-fg'
                      : 'max-w-[90%] rounded-2xl rounded-bl-md bg-surface px-3 py-2 text-xs text-fg shadow-card'
                  }
                >
                  {entry.text}
                </div>
              ))
            )}
          </div>

          {proposals.length > 0 && (
            <div className="space-y-2">
              {proposals.map((p) => (
                <UniToolProposalCard
                  key={p.id}
                  proposal={p}
                  busy={busyProposalId === p.id}
                  onConfirm={() => void handleConfirmProposal(p)}
                  onCancel={() => handleCancelProposal(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
