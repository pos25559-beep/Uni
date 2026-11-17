import { Play } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  clearActiveFocusSnapshot,
  loadActiveFocusSnapshot,
  resolveRecoveredFocusState,
} from '../../lib/focusShield';
import { formatSessionDisplay } from '../../lib/selectors';
import { useHubUiStore } from '../../store/useHubUiStore';
import { useStore } from '../../store/useStore';
import { Button } from '../ui';

/**
 * «Bloco de foco em curso · Retomar foco»: aparece no Hoje e no Plano quando há um bloco
 * guardado a meio (página recarregada ou foco fechado) e nenhum foco aberto.
 */
export default function FocusResumeCard() {
  const { t, i18n } = useTranslation('plan');
  const sessions = useStore((s) => s.sessions);
  const courses = useStore((s) => s.courses);
  const focusSessionId = useHubUiStore((s) => s.focusSessionId);
  const nonce = useHubUiStore((s) => s.focusSnapshotNonce);
  const openFocus = useHubUiStore((s) => s.openFocus);
  const bump = useHubUiStore((s) => s.bumpFocusSnapshot);

  const recoverable = useMemo(() => {
    void nonce;
    if (focusSessionId) return null;
    const snap = loadActiveFocusSnapshot();
    if (!snap) return null;
    const session = sessions.find((s) => s.id === snap.sessionId && !s.done);
    if (!session) return null;
    const course = courses.find((c) => c.id === session.courseId);
    const topic = session.topicId ? course?.topics.find((tp) => tp.id === session.topicId) : undefined;
    const state = resolveRecoveredFocusState(snap);
    return {
      session,
      course,
      topic,
      elapsedMinutes: Math.max(0, Math.round(state.accumulatedMs / 60_000)),
      plannedMinutes: Math.round(state.budgetMs / 60_000),
    };
  }, [courses, focusSessionId, nonce, sessions]);

  if (!recoverable) return null;

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-accent/35 bg-accent-soft px-4 py-3 text-fg shadow-[var(--shadow-card)]">
      <div className="min-w-0 text-xs leading-relaxed">
        <p className="font-bold text-accent-ink">{t('ui.focusInProgress')}</p>
        <p className="mt-0.5 truncate text-fg">
          {recoverable.course ? `${recoverable.course.shortName} · ` : ''}
          {formatSessionDisplay(recoverable.session, recoverable.topic, i18n.language).title} (
          {t('focus.ui.nOf', { a: recoverable.elapsedMinutes, b: recoverable.plannedMinutes })})
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="primary" onClick={() => openFocus(recoverable.session.id)}>
          <Play size={14} /> {t('ui.resumeFocus')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            clearActiveFocusSnapshot(recoverable.session.id);
            bump();
          }}
        >
          {t('ui.discard')}
        </Button>
      </div>
    </div>
  );
}
