import { lazy, Suspense, useEffect } from 'react';
import { useHubUiStore } from '../../store/useHubUiStore';
import { useStore } from '../../store/useStore';

const FocusTimer = lazy(() => import('./FocusTimer'));

/**
 * Monta o temporizador de foco uma única vez, no AppShell, para que continue a contar
 * quando o estudante muda de ecrã (por exemplo, para perguntar ao Uni especialista).
 */
export default function FocusHost() {
  const focusSessionId = useHubUiStore((s) => s.focusSessionId);
  const minimized = useHubUiStore((s) => s.focusMinimized);
  const closeFocus = useHubUiStore((s) => s.closeFocus);
  const setMinimized = useHubUiStore((s) => s.setFocusMinimized);
  const session = useStore((s) => (focusSessionId ? s.sessions.find((x) => x.id === focusSessionId) : undefined));
  const course = useStore((s) => (session ? s.courses.find((c) => c.id === session.courseId) : undefined));
  const topic = session?.topicId ? course?.topics.find((tp) => tp.id === session.topicId) : undefined;

  // Sessão apagada (ou de outro dispositivo) enquanto o foco estava aberto.
  useEffect(() => {
    if (focusSessionId && !session) closeFocus();
  }, [closeFocus, focusSessionId, session]);

  if (!session) return null;
  return (
    <Suspense fallback={null}>
      <FocusTimer
        key={session.id}
        session={session}
        course={course}
        topic={topic}
        minimized={minimized}
        onMinimize={() => setMinimized(true)}
        onExpand={() => setMinimized(false)}
        onClose={closeFocus}
      />
    </Suspense>
  );
}
