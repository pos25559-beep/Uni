import { format, parseISO, startOfWeek } from 'date-fns';
import {
  ArrowUp,
  BookOpenCheck,
  Check,
  Flame,
  Moon,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { converseCheckInWithGemini } from '../../integrations/gemini';
import { daysUntil, fmtMinutes, sessionMinutes, todayStr, upcomingAssessments } from '../../lib/selectors';
import { cx, showToast } from '../../lib/uiHelpers';
import { resolveUniAccessory } from '../../lib/uniAccessories';
import {
  buildLocalUniCheckInReply,
  parseConversationalCheckIn,
  studyLogEntryToHumanPrompt,
  type ParsedCheckInUnderstanding,
} from '../../lib/uniCheckInNlu';
import { useSheetSwipeDismiss } from '../../lib/useSheetSwipeDismiss';
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
import { Badge, Button } from '../ui';

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

const CHECKIN_TABS: ReadonlyArray<{
  id: StudyLogKind;
  label: string;
  shortLabel: string;
  icon: typeof BookOpenCheck;
}> = [
  { id: 'class', label: 'Pós-Aula', shortLabel: 'Aula', icon: BookOpenCheck },
  { id: 'day', label: 'Fim do Dia', shortLabel: 'Dia', icon: Moon },
  { id: 'week', label: 'Domingo', shortLabel: 'Semana', icon: Sun },
  { id: 'exam_prep', label: 'Modo Teste', shortLabel: 'Teste', icon: Flame },
];

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
    return `Como correu a aula de **${cname}**${slotText}? Podes escrever naturalmente — ex.: *"Entendi tudo sobre Laminagem"* ou *"Foi difícil, demos Critério de Von Mises e travei nos sinais"*.`;
  }
  if (kind === 'day') {
    const summary =
      minutesToday > 0
        ? `Hoje já somaste **${fmtMinutes(minutesToday)}** de estudo`
        : classesCountToday > 0
          ? `Tiveste ${classesCountToday} aula(s) hoje`
          : 'Dia tranquilo no horário';
    return `${summary}. Como sentiste o dia e o teu estudo hoje? Conta-me por palavras tuas para eu calibrar o plano de amanhã.`;
  }
  if (kind === 'week') {
    return `Hora do balanço da semana! O que ficou bem consolidado, onde travaste ou que cadeiras pedem mais foco nos próximos dias?`;
  }
  const testName = assessment ? `**${assessment.title}** de **${cname}**` : `o próximo teste de **${cname}**`;
  const days = assessment ? Math.max(0, daysUntil(assessment.date)) : null;
  const when = days !== null ? (days === 0 ? ' (é hoje!)' : ` (faltam ${days} dia${days === 1 ? '' : 's'})`) : '';
  return `Vamos alinhar ${testName}${when}! Diz-me **até que slide, aula ou matéria sai**, o que já estudaste e como te sentes.\n*(Ex.: "Cai até ao slide 8, já revi até T03 e estou ansioso")*`;
}

function getQuickChips(kind: StudyLogKind, course?: Course): QuickChip[] {
  const firstTopic = course?.topics[0]?.title;
  if (kind === 'class') {
    return [
      { label: 'Entendi bem', sendText: 'Entendi bem a aula de hoje, deu para acompanhar tudo.' },
      { label: 'Dúvidas em…', prefillText: 'Fiquei com dúvidas em ' },
      { label: 'Difícil / demos…', prefillText: 'A aula foi difícil, demos ' },
      ...(firstTopic
        ? [{ label: `Demos ${firstTopic.slice(0, 18)}`, prefillText: `Hoje demos ${firstTopic} e ` }]
        : []),
      { label: 'Faltei / rever', sendText: 'Faltei à aula hoje, preciso de rever a matéria.' },
    ];
  }
  if (kind === 'day') {
    return [
      { label: 'Dia produtivo', sendText: 'Hoje foi um dia produtivo, rendeu bem o estudo (4/5).' },
      { label: 'Ritmo normal', sendText: 'Dia normal de estudo, avancei ao meu ritmo (3/5).' },
      { label: 'Estou cansado', sendText: 'Estou muito cansado hoje, quase não deu para estudar (2/5).' },
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
    { label: 'Já estudei metade', sendText: 'Já estudei cerca de metade da matéria, mas sinto-me um pouco ansioso.' },
    { label: 'Ainda não comecei', prefillText: 'Ainda não comecei a estudar e sai até ao slide ' },
    { label: 'Sinto-me confiante', sendText: 'Já revi bem os tópicos principais e sinto-me confiante.' },
  ];
}

function renderInlineMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((seg, idx) => {
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
  });
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
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOutsideRef = useRef(false);

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

  useSheetSwipeDismiss({
    ref: dialogRef,
    open,
    onClose,
    maxViewportWidth: 640,
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [inputText]);

  const uniAccessory = resolveUniAccessory(
    settings.uniAccessory,
    academicProfile?.degreeName,
    effectiveCourse?.name ?? courses[0]?.name,
  );

  const scrollChatBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 35);
  };

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
    scrollChatBottom();

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
        scrollChatBottom();
      }
      return;
    }

    const reply = buildLocalUniCheckInReply({
      parsed: localParsed,
      course: effectiveCourse,
      assessment: selectedAssessment,
    });
    setTurns((prev) => [...prev, { id: `m-${Date.now()}`, role: 'model', text: reply }]);
    scrollChatBottom();
  };

  const handleConfirm = (openTutorAfter = false) => {
    const nowIso = new Date().toISOString();
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

  const onComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      void handleSendMessage();
    }
  };

  const isOutsideDialog = (clientX: number, clientY: number) => {
    const dialog = dialogRef.current;
    if (!dialog) return false;
    const rect = dialog.getBoundingClientRect();
    return (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    );
  };

  const quickChips = getQuickChips(kind, effectiveCourse);
  const perceivedCount =
    (understanding?.matchedTopicIds.length ?? 0) + (understanding?.newTopicsToAdd.length ?? 0);
  const hasDraftOrResult = Boolean(understanding || inputText.trim());

  if (typeof document === 'undefined') return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => {
        if (!('closedBy' in HTMLDialogElement.prototype)) {
          pressedOutsideRef.current = isOutsideDialog(e.clientX, e.clientY);
        }
      }}
      onPointerUp={(e) => {
        if (
          !('closedBy' in HTMLDialogElement.prototype) &&
          pressedOutsideRef.current &&
          isOutsideDialog(e.clientX, e.clientY)
        ) {
          onClose();
        }
        pressedOutsideRef.current = false;
      }}
      {...({ closedby: 'any' } as Record<string, unknown>)}
      className="rise m-auto mb-0 h-[92dvh] max-h-[92dvh] w-full max-w-none open:flex flex-col overscroll-contain rounded-t-[28px] border border-line bg-bg p-0 text-fg shadow-float backdrop:bg-black/45 backdrop:backdrop-blur-[2px] sm:mb-auto sm:h-[min(86dvh,740px)] sm:max-w-2xl sm:rounded-[26px]"
    >
      {/* Cabeçalho estilo Uni Tutor Gemini + Puxador swipe-down */}
      <header className="shrink-0 border-b border-line/70 bg-surface px-4 pb-2.5 pt-2">
        <div data-sheet-handle="" className="-mx-4 -mt-2 px-4 pt-2.5 pb-1 touch-none sm:touch-auto">
          <div className="mx-auto mb-2.5 h-1.5 w-11 rounded-full bg-line sm:hidden" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-pastel-butter/80 dark:bg-surface-2">
                <UniBuddy
                  size={24}
                  accessory={uniAccessory}
                  skin={settings.uniSkin ?? 'classic'}
                  mood={sending ? 'thinking' : 'happy'}
                  interactive={false}
                />
              </div>
              <div className="min-w-0">
                <h2 id={titleId} className="truncate font-display text-base font-bold leading-tight text-fg">
                  Diário do{' '}
                  <span className="font-serif font-medium italic text-accent-ink dark:text-accent">Uni</span>
                </h2>
              </div>
              <Badge tone="accent" className="shrink-0 text-xs">
                +4 ⚡
              </Badge>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="hidden size-11 -mr-1.5 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg sm:flex"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Faixa compacta de modos em 1 linha (estilo chips do Tutor) */}
        <div
          role="tablist"
          aria-label="Tipo de conversa do Uni"
          className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar"
        >
          {CHECKIN_TABS.map((item) => {
            const Icon = item.icon;
            const active = kind === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleKindChange(item.id)}
                className={cx(
                  'inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition',
                  active
                    ? 'border-[#141312] bg-ink-cta text-ink-cta-fg dark:border-white/20'
                    : 'border-line bg-bg text-muted hover:text-fg',
                )}
              >
                <Icon size={13} />
                <span className="sm:hidden">{item.shortLabel}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Faixa contextual (Cadeira em Pós-Aula / Teste em Modo Teste) */}
        {kind === 'class' && courses.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {courses.map((c) => {
              const selected = (effectiveCourse?.id ?? '') === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleCourseSelect(c.id)}
                  className={cx(
                    'min-h-[34px] shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition',
                    selected
                      ? 'border-accent bg-accent-soft font-semibold text-accent-ink'
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
          <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
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
                    'min-h-[34px] shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition',
                    selected
                      ? 'border-accent bg-accent-soft font-semibold text-accent-ink'
                      : 'border-line bg-surface-2/60 text-muted hover:text-fg',
                  )}
                >
                  {c?.shortName ?? 'Cadeira'} · {a.title} ({days}d)
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Feed de conversa aberto e respirável estilo Uni Tutor */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {turns.map((turn) =>
          turn.role === 'user' ? (
            <div
              key={turn.id}
              className="rise ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-[22px] rounded-br-md bg-ink-cta px-4 py-3 text-sm leading-relaxed text-ink-cta-fg shadow-card"
            >
              {turn.text}
            </div>
          ) : (
            <div
              key={turn.id}
              className="rise max-w-[94%] rounded-[22px] rounded-bl-md bg-surface px-4 py-3.5 text-sm leading-relaxed text-fg shadow-card"
            >
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-accent-ink dark:text-accent">
                <UniBuddy
                  size={18}
                  accessory={uniAccessory}
                  skin={settings.uniSkin ?? 'classic'}
                  mood="happy"
                  interactive={false}
                />
                <span>Uni</span>
                {settings.uniPet && settings.uniPet !== 'none' && (
                  <UniPetBuddy pet={settings.uniPet} size={13} />
                )}
              </div>
              <div className="whitespace-pre-wrap">{renderInlineMarkdown(turn.text)}</div>
            </div>
          ),
        )}

        {sending && (
          <div
            role="status"
            className="rise flex w-fit items-center gap-2.5 rounded-[22px] rounded-bl-md bg-surface px-4 py-2.5 text-sm text-muted shadow-card"
          >
            <UniBuddy
              mood="thinking"
              accessory={uniAccessory}
              skin={settings.uniSkin ?? 'classic'}
              size={26}
              interactive={false}
            />
            <span>O Uni está a alinhar o plano…</span>
          </div>
        )}
      </div>

      {/* Rodapé fixo estilo Gemini: Cartão de Alinhamento (quando pronto) + Sugestões + Cápsula Compositor */}
      <footer className="shrink-0 space-y-2 border-t border-line/70 bg-surface px-3.5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {understanding && (
          <div className="rounded-2xl border border-accent/35 bg-accent-soft/55 px-3 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-accent-ink dark:text-accent">Alinhamento pronto:</span>
              <Badge tone="accent">{understanding.feelingLabel}</Badge>
              {understanding.scopeLabel && <Badge tone="neutral">{understanding.scopeLabel}</Badge>}
              {understanding.topicTitle && <Badge tone="neutral">{understanding.topicTitle}</Badge>}
              {perceivedCount > 0 && <Badge tone="neutral">{perceivedCount} tópico(s)</Badge>}
            </div>
            {(understanding.newTopicsToAdd.length > 0 || understanding.matchedTopicIds.length > 0) &&
              effectiveCourse && (
                <p className="mt-1 line-clamp-1 text-muted">
                  Tópicos:{' '}
                  {[
                    ...effectiveCourse.topics
                      .filter((t) => understanding.matchedTopicIds.includes(t.id))
                      .map((t) => t.title),
                    ...understanding.newTopicsToAdd,
                  ].join(', ')}
                </p>
              )}
            <div className="mt-2 flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={!hasDraftOrResult}
                onClick={() => handleConfirm(true)}
                className="flex-1 whitespace-nowrap px-3 text-xs"
              >
                <Sparkles size={14} className="shrink-0" /> Falar no Tutor
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={!hasDraftOrResult}
                onClick={() => handleConfirm(false)}
                className="flex-1 whitespace-nowrap px-3 text-xs"
              >
                <Check size={14} className="shrink-0" /> Guardar &amp; alinhar
              </Button>
            </div>
          </div>
        )}

        {/* Sugestões rápidas antes da primeira resposta (sem cortes horizontais) */}
        {!understanding && (
          <div className="flex flex-wrap items-center gap-1.5">
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
                className="min-h-[34px] rounded-full border border-line/85 bg-bg px-3 py-1 text-xs font-medium text-fg transition hover:border-accent hover:bg-accent-soft/45"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Cápsula compositor estilo Gemini (igual ao Uni Tutor) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSendMessage();
          }}
          className="flex items-end gap-1.5 rounded-[28px] border border-line/80 bg-bg/75 px-3 py-1.5 shadow-card transition focus-within:border-accent focus-within:bg-surface"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={onComposerKeyDown}
            aria-label="Mensagem para o Diário do Uni"
            placeholder={
              kind === 'exam_prep'
                ? 'Ex.: Cai até ao slide 8 e já revi T01–T03…'
                : kind === 'class'
                  ? 'Ex.: Demos Critério de Von Mises, fiquei com dúvidas…'
                  : 'Responde ao Uni com as tuas palavras…'
            }
            style={{ minHeight: 40 }}
            className="max-h-28 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-fg placeholder:text-muted/75 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            aria-label="Enviar resposta ao Uni"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-cta text-ink-cta-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ArrowUp size={18} strokeWidth={2.2} />
          </button>
        </form>
      </footer>
    </dialog>,
    document.body,
  );
}
