import { format, startOfWeek } from 'date-fns';
import {
  Check,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { askGemini, buildStudyContext, SYSTEM_PROMPT, type ChatMessage } from '../../integrations/gemini';
import { generatePlan } from '../../lib/planner';
import { todayStr } from '../../lib/selectors';
import { resolveUniAccessory } from '../../lib/uniAccessories';
import { newId, useStore } from '../../store/useStore';
import type { WeeklyCheckIn } from '../../types';
import { Badge, Button, Field, Input, Modal, Textarea, cx } from '../ui';
import { Markdown } from './Markdown';

interface WeeklyTutorModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: 'checkin' | 'chat';
}

const MOODS: Array<{ value: WeeklyCheckIn['mood']; label: string }> = [
  { value: 'confiante', label: 'Confiante' },
  { value: 'estavel', label: 'Estável' },
  { value: 'pressionado', label: 'Pressionado' },
  { value: 'atrasado', label: 'Com atraso' },
];

const parseList = (text: string): string[] =>
  text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

const getCurrentWeekKey = () => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

const nowIso = () => new Date().toISOString();

export default function WeeklyTutorModal({
  open,
  onClose,
  initialTab = 'checkin',
}: WeeklyTutorModalProps) {
  const courses = useStore((s) => s.courses);
  const assessments = useStore((s) => s.assessments);
  const classes = useStore((s) => s.classes);
  const events = useStore((s) => s.events);
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);
  const academicProfile = useStore((s) => s.academicProfile);
  const weeklyCheckIns = useStore((s) => s.weeklyCheckIns);

  const addWeeklyCheckIn = useStore((s) => s.addWeeklyCheckIn);
  const replaceGeneratedSessions = useStore((s) => s.replaceGeneratedSessions);

  const [currentWeekKey] = useState(getCurrentWeekKey);
  const latest = weeklyCheckIns[0];

  const [tab, setTab] = useState<'checkin' | 'chat'>(initialTab);
  const [mood, setMood] = useState<WeeklyCheckIn['mood']>(latest?.mood ?? 'estavel');
  const [understoodText, setUnderstoodText] = useState(
    latest?.weekOf === currentWeekKey ? latest.understoodTopics.join(', ') : '',
  );
  const [difficultiesText, setDifficultiesText] = useState(
    latest?.weekOf === currentWeekKey ? latest.classDifficulties.join(', ') : '',
  );
  const [pendingText, setPendingText] = useState(
    latest?.weekOf === currentWeekKey ? latest.pendingNextWeek.join(', ') : '',
  );
  const [hardCourseIds, setHardCourseIds] = useState<string[]>(
    latest?.hardCourseIds.length ? latest.hardCourseIds : academicProfile.difficultCourseIds,
  );
  const [notes, setNotes] = useState(latest?.weekOf === currentWeekKey ? latest.notes : '');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Estado do chat direto com o Tutor
  const [chatMsgs, setChatMsgs] = useState<ChatMessage[]>([]);
  const [promptInput, setPromptInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const toggleCourse = (id: string) => {
    setHardCourseIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const handleSaveAndRecalculate = (openChatAfter = false) => {
    const checkIn: WeeklyCheckIn = {
      id: `checkin-${currentWeekKey}`,
      weekOf: currentWeekKey,
      createdAt: nowIso(),
      mood,
      understoodTopics: parseList(understoodText),
      classDifficulties: parseList(difficultiesText),
      pendingNextWeek: parseList(pendingText),
      hardCourseIds,
      notes: notes.trim(),
    };

    addWeeklyCheckIn(checkIn);

    const today = todayStr();
    const updatedCheckIns = [checkIn, ...weeklyCheckIns.filter((w) => w.weekOf !== currentWeekKey)];
    const plan = generatePlan({
      courses,
      assessments,
      classes,
      events,
      settings,
      from: today,
      days: 14,
      existing: sessions.filter((s) => !s.generated || s.done || s.date < today),
      difficultCourseIds: hardCourseIds,
      weeklyCheckIns: updatedCheckIns,
      extraActivities: academicProfile.extraActivities,
    });
    replaceGeneratedSessions(today, plan);
    setSavedMsg(`Check-in guardado e ${plan.length} sessões adaptadas ao teu ritmo.`);

    if (openChatAfter) {
      setTab('chat');
      void sendToTutor(
        `Acabei de fazer o meu check-in semanal (estado: ${mood}). ` +
          (checkIn.classDifficulties.length > 0
            ? `Não entendi bem na aula: ${checkIn.classDifficulties.join(', ')}. `
            : '') +
          (checkIn.pendingNextWeek.length > 0
            ? `Ficou pendente para a próxima semana: ${checkIn.pendingNextWeek.join(', ')}. `
            : '') +
          'Qual é o melhor plano de ataque para esta semana?',
      );
    }
  };

  const sendToTutor = async (textOverride?: string) => {
    const content = (textOverride ?? promptInput).trim();
    if (!content || chatBusy) return;

    const userMsg: ChatMessage = {
      id: newId(),
      role: 'user',
      text: content,
      at: new Date().toISOString(),
    };
    const nextHistory = [...chatMsgs, userMsg];
    setChatMsgs(nextHistory);
    if (!textOverride) setPromptInput('');
    setChatBusy(true);
    setChatError(null);

    try {
      const state = useStore.getState();
      const context = buildStudyContext(state);
      const reply = await askGemini({
        messages: nextHistory.slice(-12),
        system: SYSTEM_PROMPT(context, undefined, {
          persona: state.settings.uniPersona,
          accessory: resolveUniAccessory(
            state.settings.uniAccessory,
            state.academicProfile.degreeName,
            state.courses[0]?.name,
          ),
          studentName: state.settings.userName,
          appTone: state.settings.appTone,
        }),
      });
      setChatMsgs((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'model',
          text: reply,
          at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Erro ao contactar o tutor Gemini.');
    } finally {
      setChatBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Tutor Semanal Unipedia · Semana de ${currentWeekKey}`}
      maxWidthClass="sm:max-w-2xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          {tab === 'checkin' && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleSaveAndRecalculate(false)}>
                Guardar & recalcular plano
              </Button>
              <Button variant="primary" onClick={() => handleSaveAndRecalculate(true)}>
                <Sparkles size={15} /> Guardar & falar com Tutor
              </Button>
            </div>
          )}
        </div>
      }
    >
      {/* Separadores */}
      <div className="flex gap-2 rounded-xl bg-surface-2 p-1.5">
        <button
          type="button"
          onClick={() => setTab('checkin')}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition',
            tab === 'checkin' ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg',
          )}
        >
          <RefreshCw size={14} /> Check-in da semana
        </button>
        <button
          type="button"
          onClick={() => setTab('chat')}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition',
            tab === 'chat' ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg',
          )}
        >
          <MessageSquare size={14} /> Conversar com o Tutor
        </button>
      </div>

      <div>
        {tab === 'checkin' ? (
            <div className="space-y-4">
              <div>
                <span className="mb-1.5 block text-xs font-medium text-muted">Como correu esta semana?</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {MOODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMood(m.value)}
                      className={cx(
                        'rounded-xl border px-3 py-2 text-xs font-medium transition',
                        mood === m.value
                          ? 'border-accent bg-accent-soft text-accent'
                          : 'border-line bg-surface-2 text-muted hover:text-fg',
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <Field
                label="O que percebeste bem esta semana?"
                hint="Separa por vírgulas (ex.: Equação de Bernoulli, Integrais de linha)"
              >
                <Input
                  value={understoodText}
                  onChange={(e) => setUnderstoodText(e.target.value)}
                  placeholder="Tópicos que já dominas..."
                />
              </Field>

              <Field
                label="O que NÃO entendeste bem na aula?"
                hint="Estes tópicos vão receber mais tempo no teu plano de estudo."
              >
                <Input
                  value={difficultiesText}
                  onChange={(e) => setDifficultiesText(e.target.value)}
                  placeholder="Ex.: Teorema de Stokes, Encurvadura de colunas..."
                />
              </Field>

              <Field label="O que ficou em atraso para a próxima semana?">
                <Input
                  value={pendingText}
                  onChange={(e) => setPendingText(e.target.value)}
                  placeholder="Ex.: Ficha 4 de MdF, Série de exercícios 3..."
                />
              </Field>

              <div>
                <span className="mb-1.5 block text-xs font-medium text-muted">
                  Cadeiras com maior dificuldade esta semana
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {courses.map((c) => {
                    const active = hardCourseIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCourse(c.id)}
                        className={cx(
                          'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition',
                          active
                            ? 'border-warn bg-warn/15 text-warn'
                            : 'border-line bg-surface-2 text-muted hover:text-fg',
                        )}
                      >
                        {active && <Check size={12} />}
                        {c.shortName}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Field label="Notas livres para o Tutor">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex.: Esta semana tive pouco tempo por causa do laboratório, preciso de focar no teste de sexta..."
                  className="min-h-20"
                />
              </Field>

              {savedMsg && <Badge tone="ok">{savedMsg}</Badge>}
            </div>
          ) : (
            <div className="flex h-96 flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Analisa o meu check-in semanal e define as 3 prioridades de amanhã',
                  'Explica-me de forma simples o que não percebi na aula',
                  'Faz-me 1 pergunta de treino sobre a matéria mais urgente',
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void sendToTutor(q)}
                    className="rounded-xl border border-line bg-surface-2 px-2.5 py-1.5 text-left text-xs text-muted hover:border-accent/50 hover:text-fg"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-line bg-surface-2 p-3">
                {chatMsgs.length === 0 ? (
                  <p className="text-xs text-muted">
                    O teu tutor conhece o teu curso, histórico de notas, dificuldades declaradas,
                    Modo Teste e check-ins semanais. Escreve uma pergunta ou escolhe uma sugestão acima.
                  </p>
                ) : (
                  chatMsgs.map((m) => (
                    <div
                      key={m.id}
                      className={cx(
                        'rounded-xl px-3.5 py-2.5 text-sm',
                        m.role === 'user'
                          ? 'ml-8 bg-accent text-accent-fg'
                          : 'mr-4 border border-line bg-surface text-fg',
                      )}
                    >
                      {m.role === 'user' ? m.text : <Markdown text={m.text} />}
                    </div>
                  ))
                )}
                {chatBusy && (
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <Loader2 size={14} className="animate-spin" /> O tutor está a pensar...
                  </div>
                )}
                {chatError && <p className="text-xs text-danger">{chatError}</p>}
              </div>

              <div className="flex gap-2">
                <Input
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendToTutor();
                    }
                  }}
                  placeholder="Pergunta ao teu tutor semanal..."
                />
                <Button variant="primary" onClick={() => void sendToTutor()} disabled={chatBusy || !promptInput.trim()}>
                  <Send size={15} />
                </Button>
              </div>
            </div>
          )}
      </div>
    </Modal>
  );
}
