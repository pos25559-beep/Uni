import { format, parseISO, startOfWeek } from 'date-fns';
import {
  BookOpenCheck,
  Check,
  Flame,
  Moon,
  Send,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { converseCheckInWithGemini } from '../../integrations/gemini';
import { daysUntil, fmtMinutes, sessionMinutes, todayStr, upcomingAssessments } from '../../lib/selectors';
import { resolveUniAccessory } from '../../lib/uniAccessories';
import {
  buildLocalUniCheckInReply,
  parseConversationalCheckIn,
  studyLogEntryToHumanPrompt,
  type ParsedCheckInUnderstanding,
} from '../../lib/uniCheckInNlu';
import { newId, useStore } from '../../store/useStore';
import type {
  Assessment,
  Course,
  StudyLogEntry,
  StudyLogKind,
  Topic,
  WeeklyCheckIn,
} from '../../types';
import { UniBuddy, UniPetBuddy } from '../brand/UnipediaMarks';
import { Badge, Button, Modal } from '../ui';
import { cx, showToast } from '../../lib/uiHelpers';

export interface UniCheckInModalProps {
  open: boolean;
  onClose: () => void;
  initialKind?: StudyLogKind;
  initialCourseId?: string;
  initialClassSlotId?: string;
  initialAssessmentId?: string;
}

interface MiniChatTurn {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface QuickChip {
  label: string;
  sendText?: string;
  prefillText?: string;
}

function buildOpeningGreeting(args: {
  kind: StudyLogKind;
  course?: Course;
  assessment?: Assessment;
  minutesToday: number;
  classesCountToday: number;
  classSlotLabel?: string;
}): string {
  const { kind, course, assessment, minutesToday, classesCountToday, classSlotLabel } = args;
  const cname = course?.shortName || course?.name || 'a tua cadeira';

  if (kind === 'class') {
    const slotText = classSlotLabel ? ` (${classSlotLabel})` : '';
    return `Olá! Como correu a aula de **${cname}**${slotText}? Podes responder naturalmente — ex.: *"Entendi tudo sobre Laminagem"* ou *"Foi difícil, demos Critério de Von Mises e travei nos sinais"*.`;
  }
  if (kind === 'day') {
    const summary =
      minutesToday > 0
        ? `Hoje já somaste **${fmtMinutes(minutesToday)}** de estudo`
        : classesCountToday > 0
          ? `Tiveste ${classesCountToday} aula(s) hoje`
          : 'Dia tranquilo no horário';
    return `Boa noite! ${summary}. Como sentiste o dia e o teu estudo hoje? Conta-me por palavras tuas para eu calibrar o plano de amanhã.`;
  }
  if (kind === 'week') {
    return `Hora do nosso balanço de domingo! Como sentiste esta semana no geral — o que ficou bem consolidado, onde travaste ou que cadeiras pedem mais foco?`;
  }
  const testName = assessment ? `**${assessment.title}** de **${cname}**` : `o próximo teste de **${cname}**`;
  const days = assessment ? Math.max(0, daysUntil(assessment.date)) : null;
  const when = days !== null ? (days === 0 ? ' (é hoje!)' : ` (faltam ${days} dia${days === 1 ? '' : 's'})`) : '';
  return `Vamos alinhar ${testName}${when}! Diz-me naturalmente: **até que slide, aula ou matéria sai**, o que já estudaste e como te sentes. (Ex.: *"Cai até ao slide 8, já revi até T03 e estou ansioso"*)`;
}

function getQuickChips(kind: StudyLogKind, course?: Course): QuickChip[] {
  const firstTopic = course?.topics[0]?.title;
  if (kind === 'class') {
    return [
      { label: 'Entendi bem', sendText: 'Entendi bem a aula de hoje, deu para acompanhar tudo.' },
      { label: 'Algumas dúvidas em…', prefillText: 'Fiquei com dúvidas em ' },
      { label: 'Difícil / demos…', prefillText: 'A aula foi difícil, demos ' },
      ...(firstTopic
        ? [{ label: `Demos ${firstTopic.slice(0, 22)}`, prefillText: `Hoje demos ${firstTopic} e ` }]
        : []),
      { label: 'Faltei / rever', sendText: 'Faltei à aula hoje, preciso de rever a matéria.' },
    ];
  }
  if (kind === 'day') {
    return [
      { label: 'Dia produtivo!', sendText: 'Hoje foi um dia produtivo, rendeu bem o estudo (4/5).' },
      { label: 'Estudo normal', sendText: 'Dia normal de estudo, avancei ao meu ritmo (3/5).' },
      { label: 'Estou cansado hoje', sendText: 'Estou muito cansado hoje, quase não deu para estudar (2/5).' },
    ];
  }
  if (kind === 'week') {
    return [
      { label: 'Semana estável', sendText: 'Semana estável, cumpri o essencial e sinto-me acompanhado.' },
      { label: 'Pressionado c/ testes', sendText: 'Semana pressionada, acumulei dúvidas antes dos testes.' },
      { label: 'Semana confiante', sendText: 'Semana excelente e confiante, consolidei bem a matéria!' },
    ];
  }
  return [
    { label: 'Cai até ao slide…', prefillText: 'A matéria do teste cai até ao slide ' },
    { label: 'Já estudei metade, ansioso', sendText: 'Já estudei cerca de metade da matéria, mas sinto-me um pouco ansioso.' },
    { label: 'Ainda não comecei', prefillText: 'Ainda não comecei a estudar e sai até ao slide ' },
    { label: 'Sinto-me confiante', sendText: 'Já revi bem os tópicos principais e sinto-me confiante.' },
  ];
}

export default function UniCheckInModal(props: UniCheckInModalProps) {
  if (!props.open) return null;
  const resetKey = `${props.initialKind ?? 'day'}-${props.initialCourseId ?? ''}-${props.initialClassSlotId ?? ''}-${props.initialAssessmentId ?? ''}`;
  return <UniCheckInModalInner key={resetKey} {...props} />;
}

function UniCheckInModalInner({
  open,
  onClose,
  initialKind = 'day',
  initialCourseId,
  initialClassSlotId,
  initialAssessmentId,
}: UniCheckInModalProps) {
  const navigate = useNavigate();
  const courses = useStore((s) => s.courses);
  const assessments = useStore((s) => s.assessments);
  const classes = useStore((s) => s.classes);
  const materials = useStore((s) => s.materials);
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);
  const academicProfile = useStore((s) => s.academicProfile);

  const addStudyLog = useStore((s) => s.addStudyLog);
  const addWeeklyCheckIn = useStore((s) => s.addWeeklyCheckIn);
  const ensureCourseTopic = useStore((s) => s.ensureCourseTopic);
  const patchAssessment = useStore((s) => s.patch);
  const reconcileFuturePlan = useStore((s) => s.reconcileFuturePlan);

  const today = todayStr();
  const todayDate = useMemo(() => parseISO(`${today}T12:00:00`), [today]);
  const todayWeekday = todayDate.getDay();
  const currentWeekKey = useMemo(
    () => format(startOfWeek(todayDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    [todayDate],
  );
  const futureAssessments = useMemo(() => upcomingAssessments(assessments), [assessments]);

  const initialMatchedSlot = useMemo(
    () =>
      classes.find((c) => c.id === initialClassSlotId) ??
      classes.find((c) => initialCourseId && c.courseId === initialCourseId && c.weekday === todayWeekday) ??
      classes.find((c) => c.weekday === todayWeekday) ??
      classes[0],
    [classes, initialClassSlotId, initialCourseId, todayWeekday],
  );
  const initialTargetAssessment = useMemo(
    () =>
      assessments.find((a) => a.id === initialAssessmentId) ??
      futureAssessments.find((a) => !initialCourseId || a.courseId === initialCourseId) ??
      futureAssessments[0],
    [assessments, initialAssessmentId, futureAssessments, initialCourseId],
  );

  const dayStats = useMemo(() => {
    const doneToday = sessions.filter((s) => s.done && s.date === today);
    const minutes = doneToday.reduce((sum, s) => sum + sessionMinutes(s), 0);
    const todayClasses = classes.filter((c) => c.weekday === todayWeekday).length;
    return { doneCount: doneToday.length, minutes, todayClasses };
  }, [sessions, classes, today, todayWeekday]);

  const [kind, setKind] = useState<StudyLogKind>(initialKind);
  const [courseId, setCourseId] = useState<string>(
    () => initialCourseId ?? initialMatchedSlot?.courseId ?? courses[0]?.id ?? '',
  );
  const [assessmentId, setAssessmentId] = useState<string>(() => initialTargetAssessment?.id ?? '');
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  const activeCourse = useMemo(
    () => courses.find((c) => c.id === courseId) ?? courses[0],
    [courses, courseId],
  );
  const selectedAssessment = useMemo(
    () => assessments.find((a) => a.id === assessmentId) ?? futureAssessments[0],
    [assessments, assessmentId, futureAssessments],
  );
  const effectiveCourse = useMemo(
    () =>
      kind === 'exam_prep' && selectedAssessment
        ? courses.find((c) => c.id === selectedAssessment.courseId) ?? activeCourse
        : activeCourse,
    [kind, selectedAssessment, courses, activeCourse],
  );

  const [turns, setTurns] = useState<MiniChatTurn[]>(() => [
    {
      id: 'greet-0',
      role: 'model',
      text: buildOpeningGreeting({
        kind: initialKind,
        course:
          initialKind === 'exam_prep' && initialTargetAssessment
            ? courses.find((c) => c.id === initialTargetAssessment.courseId) ?? courses[0]
            : courses.find((c) => c.id === (initialCourseId ?? initialMatchedSlot?.courseId)) ?? courses[0],
        assessment: initialTargetAssessment,
        minutesToday: dayStats.minutes,
        classesCountToday: dayStats.todayClasses,
        classSlotLabel: initialMatchedSlot
          ? `${initialMatchedSlot.type} ${initialMatchedSlot.start}`
          : undefined,
      }),
    },
  ]);

  const [understanding, setUnderstanding] = useState<ParsedCheckInUnderstanding | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const uniAccessory = resolveUniAccessory(
    settings.uniAccessory,
    academicProfile?.degreeName,
    effectiveCourse?.name ?? courses[0]?.name,
  );

  const resetChatForContext = (nextKind: StudyLogKind, nextCourseId: string, nextAssessmentId: string) => {
    const nextAssess = assessments.find((a) => a.id === nextAssessmentId) ?? futureAssessments[0];
    const nextCourse =
      nextKind === 'exam_prep' && nextAssess
        ? courses.find((c) => c.id === nextAssess.courseId) ?? courses[0]
        : courses.find((c) => c.id === nextCourseId) ?? courses[0];
    const slot = classes.find((c) => c.courseId === nextCourse?.id && c.weekday === todayWeekday) ??
      classes.find((c) => c.courseId === nextCourse?.id);

    setTurns([
      {
        id: `greet-${Date.now()}`,
        role: 'model',
        text: buildOpeningGreeting({
          kind: nextKind,
          course: nextCourse,
          assessment: nextAssess,
          minutesToday: dayStats.minutes,
          classesCountToday: dayStats.todayClasses,
          classSlotLabel: slot ? `${slot.type} ${slot.start}` : undefined,
        }),
      },
    ]);
    setUnderstanding(null);
    setInputText('');
  };

  const handleKindChange = (nextKind: StudyLogKind) => {
    setKind(nextKind);
    resetChatForContext(nextKind, courseId, assessmentId);
  };

  const handleCourseSelect = (nextCid: string) => {
    setCourseId(nextCid);
    resetChatForContext(kind, nextCid, assessmentId);
  };

  const handleAssessmentSelect = (nextAid: string) => {
    setAssessmentId(nextAid);
    resetChatForContext(kind, courseId, nextAid);
  };

  const handleSendMessage = async (rawOverride?: string) => {
    const text = (rawOverride ?? inputText).trim();
    if (!text || sending) return;

    const userTurn: MiniChatTurn = { id: `u-${Date.now()}`, role: 'user', text };
    const nextTurns = [...turns, userTurn];
    setTurns(nextTurns);
    if (!rawOverride) setInputText('');

    const combinedUserText = nextTurns
      .filter((t) => t.role === 'user')
      .map((t) => t.text)
      .join('. ');

    const localParsed = parseConversationalCheckIn({
      kind,
      userText: combinedUserText,
      course: effectiveCourse,
      courses,
      materials,
      assessment: selectedAssessment,
      previousTopicIds: understanding?.matchedTopicIds ?? selectedAssessment?.topicIds,
    });

    setUnderstanding(localParsed);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 30);

    // Se IA estiver autorizada, obtém resposta conversacional humana do Uni + refinamento semântico; caso contrário responde logo offline com 0 ms.
    if (settings.aiConsent && effectiveCourse) {
      setSending(true);
      try {
        const courseMatTitles = materials
          .filter((m) => m.courseId === effectiveCourse.id)
          .map((m) => m.title);
        const aiRes = await converseCheckInWithGemini({
          messages: nextTurns.map((t) => ({ role: t.role, text: t.text })),
          baseUnderstanding: localParsed,
          courseName: effectiveCourse.shortName || effectiveCourse.name,
          courseTopics: effectiveCourse.topics.map((t) => ({ id: t.id, title: t.title })),
          courseMaterials: courseMatTitles,
          assessmentTitle: selectedAssessment?.title,
          persona: settings.uniPersona ?? 'amigo',
        });
        setUnderstanding(aiRes.understanding);
        setTurns((prev) => [
          ...prev,
          { id: `m-${Date.now()}`, role: 'model', text: aiRes.reply },
        ]);
      } catch {
        const fallback = buildLocalUniCheckInReply({
          parsed: localParsed,
          course: effectiveCourse,
          assessment: selectedAssessment,
        });
        setTurns((prev) => [
          ...prev,
          { id: `m-${Date.now()}`, role: 'model', text: fallback },
        ]);
      } finally {
        setSending(false);
        setTimeout(() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }, 40);
      }
      return;
    }

    const reply = buildLocalUniCheckInReply({
      parsed: localParsed,
      course: effectiveCourse,
      assessment: selectedAssessment,
    });
    setTurns((prev) => [...prev, { id: `m-${Date.now()}`, role: 'model', text: reply }]);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 40);
  };

  const handleConfirm = (openTutorAfter = false) => {
    const nowIso = new Date().toISOString();
    // Se o estudante escreveu no input mas carregou logo em Confirmar sem enviar no chat, interpreta na hora!
    let finalUnderstanding = understanding;
    if (!finalUnderstanding && inputText.trim()) {
      finalUnderstanding = parseConversationalCheckIn({
        kind,
        userText: inputText.trim(),
        course: effectiveCourse,
        courses,
        materials,
        assessment: selectedAssessment,
      });
    }
    if (!finalUnderstanding) {
      showToast('Escreve ou escolhe uma resposta rápida para o Uni antes de guardar.', 'neutral');
      return;
    }

    const syncedTopicIds = new Set<string>(finalUnderstanding.matchedTopicIds);

    // Cria/atualiza tópicos identificados na cadeira ativa
    if (effectiveCourse) {
      const status: Topic['status'] =
        finalUnderstanding.feeling === 'clara' || finalUnderstanding.feeling === 'confiante'
          ? 'review'
          : 'learning';
      const confidence: Topic['confidence'] =
        finalUnderstanding.feeling === 'dificil' || finalUnderstanding.feeling === 'ansioso'
          ? 2
          : finalUnderstanding.feeling === 'clara' || finalUnderstanding.feeling === 'confiante'
            ? 4
            : 3;

      if (finalUnderstanding.topicTitle) {
        const created = ensureCourseTopic(effectiveCourse.id, finalUnderstanding.topicTitle, {
          status,
          confidence,
        });
        if (created) syncedTopicIds.add(created.id);
      }
      for (const title of finalUnderstanding.newTopicsToAdd) {
        const created = ensureCourseTopic(effectiveCourse.id, title, {
          status,
          confidence: finalUnderstanding.feeling === 'ansioso' ? 2 : 3,
        });
        if (created) syncedTopicIds.add(created.id);
      }
    }

    const finalTopicIds = [...syncedTopicIds];

    if (kind === 'exam_prep' && selectedAssessment) {
      patchAssessment('assessments', selectedAssessment.id, { topicIds: finalTopicIds });
    }

    if (kind === 'week') {
      const checkIn: WeeklyCheckIn = {
        id: newId(),
        weekOf: currentWeekKey,
        createdAt: nowIso,
        mood: finalUnderstanding.weekMood ?? 'estavel',
        understoodTopics: finalUnderstanding.understoodTopics,
        classDifficulties: finalUnderstanding.classDifficulties,
        pendingNextWeek: finalUnderstanding.pendingNextWeek,
        hardCourseIds: finalUnderstanding.hardCourseIds,
        notes: finalUnderstanding.notes,
      };
      addWeeklyCheckIn(checkIn);
    }

    const entry: StudyLogEntry = {
      id: newId(),
      kind,
      date: today,
      createdAt: nowIso,
      ...(effectiveCourse ? { courseId: effectiveCourse.id } : {}),
      ...(kind === 'class' && initialMatchedSlot ? { classSlotId: initialMatchedSlot.id } : {}),
      ...(kind === 'exam_prep' && selectedAssessment ? { assessmentId: selectedAssessment.id } : {}),
      feeling: finalUnderstanding.feeling,
      ...(finalUnderstanding.rating ? { rating: finalUnderstanding.rating } : {}),
      ...(finalUnderstanding.topicTitle ? { topicTitle: finalUnderstanding.topicTitle } : {}),
      ...(finalTopicIds.length > 0 ? { topicIds: finalTopicIds } : {}),
      ...(finalUnderstanding.studiedSummary ? { studiedSummary: finalUnderstanding.studiedSummary } : {}),
      ...(finalUnderstanding.difficulties ? { difficulties: finalUnderstanding.difficulties } : {}),
      notes: finalUnderstanding.scopeLabel
        ? `${finalUnderstanding.scopeLabel} — ${finalUnderstanding.notes}`
        : finalUnderstanding.notes,
    };

    addStudyLog(entry);
    reconcileFuturePlan(true);

    showToast('Conversa registada no Diário do Uni (+4 ⚡) e plano alinhado!', 'ok');
    onClose();

    if (openTutorAfter) {
      navigate('/assistente', {
        state: {
          prefillPrompt: studyLogEntryToHumanPrompt(entry, effectiveCourse),
          courseId: effectiveCourse?.id,
        },
      });
    }
  };

  const quickChips = getQuickChips(kind, effectiveCourse);
  const perceivedCount =
    (understanding?.matchedTopicIds.length ?? 0) + (understanding?.newTopicsToAdd.length ?? 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Conversa com o Uni · Diário"
      maxWidthClass="sm:max-w-2xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={onClose}>
            Agora não
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              disabled={!understanding && !inputText.trim()}
              onClick={() => handleConfirm(true)}
            >
              <Sparkles size={15} /> Abrir no Tutor
            </Button>
            <Button
              variant="primary"
              disabled={!understanding && !inputText.trim()}
              onClick={() => handleConfirm(false)}
            >
              <Check size={15} /> Confirmar & alinhar plano
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Abas 2x2 mobile / 4-col desktop para trocar rapidamente o contexto do check-in */}
        <div
          role="tablist"
          aria-label="Tipo de conversa do Uni"
          className="grid grid-cols-2 gap-1.5 rounded-2xl bg-surface-2 p-1.5 sm:grid-cols-4"
        >
          {(
            [
              { id: 'class', label: 'Pós-Aula', icon: <BookOpenCheck size={14} /> },
              { id: 'day', label: 'Fim do Dia', icon: <Moon size={14} /> },
              { id: 'week', label: 'Domingo', icon: <Sun size={14} /> },
              { id: 'exam_prep', label: 'Modo Teste', icon: <Flame size={14} /> },
            ] as const
          ).map((item) => {
            const active = kind === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleKindChange(item.id)}
                className={cx(
                  'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition',
                  active
                    ? 'bg-surface text-fg shadow-card'
                    : 'text-muted hover:text-fg',
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Cápsulas horizontais limpas (sem abrir seletor nativo gigante no telemóvel) */}
        {kind === 'class' && courses.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {courses.map((c) => {
              const selected = (effectiveCourse?.id ?? '') === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleCourseSelect(c.id)}
                  className={cx(
                    'min-h-[36px] shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition',
                    selected
                      ? 'border-accent bg-accent text-accent-fg'
                      : 'border-line bg-surface-2/60 text-muted hover:text-fg',
                  )}
                >
                  {c.shortName || c.name}
                </button>
              );
            })}
          </div>
        )}

        {kind === 'exam_prep' && futureAssessments.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {futureAssessments.map((a) => {
              const c = courses.find((x) => x.id === a.courseId);
              const selected = (selectedAssessment?.id ?? '') === a.id;
              const days = Math.max(0, daysUntil(a.date));
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleAssessmentSelect(a.id)}
                  className={cx(
                    'min-h-[36px] shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition',
                    selected
                      ? 'border-accent bg-accent text-accent-fg'
                      : 'border-line bg-surface-2/60 text-muted hover:text-fg',
                  )}
                >
                  {c?.shortName ?? 'Cadeira'} · {a.title} ({days}d)
                </button>
              );
            })}
          </div>
        )}

        {/* Área conversacional humana */}
        <div
          ref={scrollRef}
          className="max-h-44 space-y-2.5 overflow-y-auto rounded-2xl border border-line/70 bg-surface-2/40 p-3 sm:max-h-60"
        >
          {turns.map((turn) => (
            <div
              key={turn.id}
              className={cx(
                'flex items-end gap-2',
                turn.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              {turn.role === 'model' && (
                <div className="flex shrink-0 items-end gap-0.5 rounded-xl bg-pastel-butter/70 p-1.5 dark:bg-surface">
                  <UniBuddy
                    size={28}
                    accessory={uniAccessory}
                    skin={settings.uniSkin ?? 'classic'}
                    mood="happy"
                  />
                  {settings.uniPet && settings.uniPet !== 'none' && (
                    <UniPetBuddy pet={settings.uniPet} size={14} />
                  )}
                </div>
              )}
              <div
                className={cx(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                  turn.role === 'user'
                    ? 'rounded-br-sm bg-ink-cta text-ink-cta-fg'
                    : 'rounded-bl-sm border border-line/70 bg-surface text-fg',
                )}
              >
                {turn.text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((seg, idx) => {
                  if (seg.startsWith('**') && seg.endsWith('**')) {
                    return <strong key={idx}>{seg.slice(2, -2)}</strong>;
                  }
                  if (seg.startsWith('*') && seg.endsWith('*')) {
                    return (
                      <em key={idx} className="text-muted">
                        {seg.slice(1, -1)}
                      </em>
                    );
                  }
                  return <span key={idx}>{seg}</span>;
                })}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <Sparkles size={13} className="animate-pulse text-accent" />
              <span>Uni está a alinhar a matéria e o plano…</span>
            </div>
          )}
        </div>

        {/* Cartão compacto do que o Uni percebeu e vai sincronizar */}
        {understanding && (
          <div className="rounded-2xl border border-accent/35 bg-accent-soft/55 px-3.5 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-accent-ink dark:text-accent">
                Alinhamento pronto:
              </span>
              <Badge tone="accent">{understanding.feelingLabel}</Badge>
              {understanding.scopeLabel && <Badge tone="neutral">{understanding.scopeLabel}</Badge>}
              {understanding.topicTitle && <Badge tone="neutral">{understanding.topicTitle}</Badge>}
              {perceivedCount > 0 && (
                <Badge tone="neutral">{perceivedCount} tópico(s)</Badge>
              )}
              <Badge tone="accent">+4 ⚡ Ninho</Badge>
            </div>
            {(understanding.newTopicsToAdd.length > 0 || understanding.matchedTopicIds.length > 0) &&
              effectiveCourse && (
                <p className="mt-1.5 line-clamp-2 text-muted">
                  Tópicos:{' '}
                  {[
                    ...effectiveCourse.topics
                      .filter((t) => understanding.matchedTopicIds.includes(t.id))
                      .map((t) => t.title),
                    ...understanding.newTopicsToAdd,
                  ].join(', ')}
                </p>
              )}
          </div>
        )}

        {/* Sugestões táteis opcionais de resposta rápida */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {quickChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => {
                if (chip.sendText) {
                  void handleSendMessage(chip.sendText);
                } else if (chip.prefillText) {
                  setInputText(chip.prefillText);
                  inputRef.current?.focus();
                }
              }}
              className="min-h-[36px] shrink-0 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-fg transition hover:border-accent hover:bg-accent-soft/40"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Input conversacional natural */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              kind === 'exam_prep'
                ? 'Ex.: A matéria cai até ao slide 8 e já revi T01–T03…'
                : kind === 'class'
                  ? 'Ex.: Hoje demos Critério de Von Mises, fiquei com dúvidas…'
                  : 'Responde ao Uni com as tuas palavras…'
            }
            className="min-h-[44px] min-w-0 flex-1 rounded-2xl border border-line bg-surface px-3.5 py-2 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            aria-label="Enviar resposta ao Uni"
            className={cx(
              'grid size-11 shrink-0 place-items-center rounded-2xl transition',
              inputText.trim() && !sending
                ? 'bg-accent text-accent-fg shadow-sm hover:opacity-95'
                : 'bg-surface-2 text-muted opacity-60',
            )}
          >
            <Send size={17} />
          </button>
        </form>
      </div>
    </Modal>
  );
}
