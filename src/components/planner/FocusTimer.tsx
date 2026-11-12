// Temporizador de foco para uma sessão. Baseado em timestamps (Date.now()), por isso
// continua certo mesmo com o separador em segundo plano (os timers do browser abrandam).
import { Check, Pause, Play, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { courseColors } from '../../lib/colors';
import { todayStr } from '../../lib/selectors';
import { useStore } from '../../store/useStore';
import type { Course, StudySession, Topic } from '../../types';
import { Button, Ring, cx } from '../ui';

type Phase = 'idle' | 'running' | 'paused' | 'finished';
const levels: Topic['confidence'][] = [1, 2, 3, 4, 5];
const levelText = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Dominada'];
const EXTRA_MS = 5 * 60_000;

const formatClock = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

interface FocusTimerProps {
  session: StudySession;
  course?: Course;
  topic?: Topic;
  onClose: () => void;
}

export default function FocusTimer({ session, course, topic, onClose }: FocusTimerProps) {
  const patch = useStore((s) => s.patch);
  const updateTopic = useStore((s) => s.updateTopic);

  const [budgetMs, setBudgetMs] = useState(session.minutes * 60_000);
  const [phase, setPhase] = useState<Phase>('idle');
  /** Tempo acumulado antes do último arranque (ms). */
  const [accumulated, setAccumulated] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [confidenceSet, setConfidenceSet] = useState<Topic['confidence'] | null>(null);
  const originalTitle = useRef(document.title);

  const elapsedMs = Math.min(
    budgetMs,
    accumulated + (phase === 'running' && startedAt !== null ? now - startedAt : 0),
  );
  const remainingMs = Math.max(0, budgetMs - elapsedMs);
  const running = phase === 'running';
  const color = course ? courseColors[course.color].hex : '#8b5cf6';

  // Atualiza o relógio enquanto corre.
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  // Título do separador com o tempo restante, restaurado ao sair.
  useEffect(() => {
    const original = originalTitle.current;
    if (running) document.title = `${formatClock(remainingMs)} · Foco`;
    else document.title = original;
  }, [running, remainingMs]);

  useEffect(() => {
    const original = originalTitle.current;
    return () => { document.title = original; };
  }, []);

  // Tecla Escape fecha o overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const start = () => {
    setStartedAt(Date.now());
    setNow(Date.now());
    setPhase('running');
  };

  const pause = () => {
    const t = Date.now();
    if (startedAt !== null) setAccumulated((a) => a + (t - startedAt));
    setStartedAt(null);
    setPhase('paused');
  };

  const finish = () => {
    if (phase === 'finished') return;
    const t = Date.now();
    const total = Math.min(
      budgetMs,
      accumulated + (phase === 'running' && startedAt !== null ? t - startedAt : 0),
    );
    setAccumulated(total);
    setStartedAt(null);
    setPhase('finished');
    const minutes = Math.max(1, Math.round(total / 60_000));
    patch('sessions', session.id, { done: true, actualMinutes: minutes });
    if (session.topicId) {
      updateTopic(session.courseId, session.topicId, {
        lastStudied: todayStr(),
        ...(topic?.status === 'todo' ? { status: 'learning' as const } : {}),
      });
    }
  };

  // Ao chegar a zero, conclui sozinho.
  useEffect(() => {
    if (phase === 'running' && remainingMs === 0) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remainingMs]);

  const setConfidence = (level: Topic['confidence']) => {
    if (!session.topicId) return;
    updateTopic(session.courseId, session.topicId, { confidence: level });
    setConfidenceSet(level);
  };

  const progress = budgetMs > 0 ? elapsedMs / budgetMs : 0;
  const finished = phase === 'finished';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/95 p-6 backdrop-blur-md">
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar temporizador"
        className="absolute right-4 top-4 rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-fg"
      >
        <X size={20} />
      </button>

      <div className="rise flex w-full max-w-sm flex-col items-center text-center">
        <div className="flex items-center gap-2 text-xs font-medium text-muted">
          {course && (
            <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5', courseColors[course.color].soft)}>
              <span className={cx('size-1.5 rounded-full', courseColors[course.color].dot)} />
              {course.shortName}
            </span>
          )}
          <span className="tabular">{session.minutes} min planeados</span>
        </div>
        <h2 className="mt-3 text-lg font-semibold tracking-tight">
          {topic?.title ?? session.notes ?? 'Estudo'}
        </h2>

        <div className="my-8">
          <Ring value={progress} size={248} stroke={10} color={color}>
            <span className="text-5xl font-semibold tracking-tight tabular">{formatClock(remainingMs)}</span>
          </Ring>
        </div>

        {!finished ? (
          <>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {phase === 'running' ? (
                <Button onClick={pause} className="h-12 px-6">
                  <Pause size={18} /> Pausar
                </Button>
              ) : (
                <Button variant="primary" onClick={start} className="h-12 px-6">
                  <Play size={18} /> {phase === 'paused' ? 'Retomar' : 'Iniciar'}
                </Button>
              )}
              <Button onClick={() => setBudgetMs((b) => b + EXTRA_MS)} className="h-12 px-4">
                <Plus size={16} /> 5 min
              </Button>
              <Button variant="ghost" onClick={finish} className="h-12 px-4">
                <Check size={16} /> Concluir
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted tabular">
              {Math.round(elapsedMs / 60_000)} de {Math.round(budgetMs / 60_000)} min
            </p>
          </>
        ) : (
          <div className="w-full">
            <p className="text-sm font-semibold text-ok">Sessão concluída</p>
            {session.topicId && topic ? (
              <div className="mt-5">
                <p className="text-sm font-medium">Como correu?</p>
                <p className="mt-1 text-xs text-muted">Indica o quão confiante estás nesta matéria.</p>
                <div className="mt-4 flex justify-center gap-2" role="radiogroup" aria-label="Confiança">
                  {levels.map((level) => {
                    const active = (confidenceSet ?? topic.confidence) >= level;
                    return (
                      <button
                        key={level}
                        type="button"
                        role="radio"
                        aria-checked={confidenceSet === level}
                        aria-label={`${level} — ${levelText[level - 1]}`}
                        title={levelText[level - 1]}
                        onClick={() => setConfidence(level)}
                        className={cx(
                          'size-10 rounded-full border transition',
                          active ? 'border-accent bg-accent' : 'border-line bg-surface-2 hover:border-muted/60',
                          confidenceSet === level && 'ring-2 ring-accent ring-offset-2 ring-offset-bg',
                        )}
                      />
                    );
                  })}
                </div>
                <p className="mt-3 h-4 text-xs text-muted">
                  {confidenceSet ? levelText[confidenceSet - 1] : ''}
                </p>
              </div>
            ) : null}
            <Button variant="primary" onClick={onClose} className="mt-6 w-full">
              Fechar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
