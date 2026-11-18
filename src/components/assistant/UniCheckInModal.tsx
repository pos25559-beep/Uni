import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n/tr';
import { format, parseISO, startOfWeek } from 'date-fns';
import {
  ArrowUp,
  BookOpenCheck,
  Check,
  Flame,
  Moon,
  RotateCcw,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { converseCheckInWithGemini } from '../../integrations/gemini';
import { daysUntil, fmtMinutes, sessionMinutes, todayStr, upcomingAssessments } from '../../lib/selectors';
import { cx, showToast } from '../../lib/uiHelpers';
import { resolveUniAccessory } from '../../lib/uniAccessories';
import {
  buildCheckInContextKey,
  buildTurnsFromSavedEntry,
  buildUnderstandingFromSavedEntry,
  clearCheckInDraft,
  findSavedCheckInEntry,
  loadCheckInDraft,
  saveCheckInDraft,
} from '../../lib/uniCheckInDrafts';
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
import { UniBuddy } from '../brand/UnipediaMarks';
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
  { id: 'class', label: 'tabs.class', shortLabel: 'tabs.classShort', icon: BookOpenCheck },
  { id: 'day', label: 'tabs.day', shortLabel: 'tabs.dayShort', icon: Moon },
  { id: 'week', label: 'tabs.week', shortLabel: 'tabs.weekShort', icon: Sun },
  { id: 'exam_prep', label: 'tabs.exam', shortLabel: 'tabs.examShort', icon: Flame },
];

/** Atalho de tradução para o check-in (namespace `assistant`, grupo `checkin`). */
const ck = (key: string, vars: Record<string, string | number> = {}) => tr(`assistant:checkin.${key}`, vars);

function buildOpeningGreeting(args: {
  kind: StudyLogKind;
  course?: Course;
  assessment?: Assessment;
  minutesToday: number;
  classesCountToday: number;
  classSlotLabel?: string;
}): string {
  const { kind, course, assessment, minutesToday, classesCountToday, classSlotLabel } = args;
  const cname = course?.shortName || course?.name || ck('yourCourse');

  if (kind === 'class') {
    const slot = classSlotLabel ? ` (${classSlotLabel})` : '';
    return ck('greet.class', { course: cname, slot });
  }
  if (kind === 'day') {
    const summary =
      minutesToday > 0
        ? ck('greet.daySummaryMinutes', { minutes: fmtMinutes(minutesToday) })
        : classesCountToday > 0
          ? ck('greet.daySummaryClasses', { count: classesCountToday })
          : ck('greet.daySummaryCalm');
    return ck('greet.day', { summary });
  }
  if (kind === 'week') {
    return ck('greet.week');
  }
  const testName = assessment
    ? ck('greet.testNamed', { test: assessment.title, course: cname })
    : ck('greet.testNext', { course: cname });
  const days = assessment ? Math.max(0, daysUntil(assessment.date)) : null;
  const when = days !== null ? (days === 0 ? ck('greet.whenToday') : ck('greet.whenDays', { count: days })) : '';
  return ck('greet.exam', { test: testName, when });
}

function getQuickChips(kind: StudyLogKind, course?: Course): QuickChip[] {
  const firstTopic = course?.topics[0]?.title;
  if (kind === 'class') {
    return [
      { label: ck('chips.classGood'), sendText: ck('chips.classGoodText') },
      { label: ck('chips.classDoubts'), prefillText: ck('chips.classDoubtsText') },
      { label: ck('chips.classHard'), prefillText: ck('chips.classHardText') },
      ...(firstTopic
        ? [
            {
              label: ck('chips.classTopic', { topic: firstTopic.slice(0, 18) }),
              prefillText: ck('chips.classTopicText', { topic: firstTopic }),
            },
          ]
        : []),
      { label: ck('chips.classMissed'), sendText: ck('chips.classMissedText') },
    ];
  }
  if (kind === 'day') {
    return [
      { label: ck('chips.dayGood'), sendText: ck('chips.dayGoodText') },
      { label: ck('chips.dayNormal'), sendText: ck('chips.dayNormalText') },
      { label: ck('chips.dayTired'), sendText: ck('chips.dayTiredText') },
    ];
  }
  if (kind === 'week') {
    return [
      { label: ck('chips.weekStable'), sendText: ck('chips.weekStableText') },
      { label: ck('chips.weekPressure'), sendText: ck('chips.weekPressureText') },
      { label: ck('chips.weekConfident'), sendText: ck('chips.weekConfidentText') },
    ];
  }
  return [
    { label: ck('chips.examSlide'), prefillText: ck('chips.examSlideText') },
    { label: ck('chips.examHalf'), sendText: ck('chips.examHalfText') },
    { label: ck('chips.examNotStarted'), prefillText: ck('chips.examNotStartedText') },
    { label: ck('chips.examConfident'), sendText: ck('chips.examConfidentText') },
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
  const { t } = useTranslation('assistant');
  const navigate = useNavigate();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOutsideRef = useRef(false);

  const courses = useStore((s) => s.courses);
  const assessments = useStore((s) => s.assessments);
  const classes = useStore((s) => s.classes);
  const materials = useStore((s) => s.materials);
  const sessions = useStore((s) => s.sessions);
  const studyLogs = useStore((s) => s.studyLogs);
  const settings = useStore((s) => s.settings);
  const academicProfile = useStore((s) => s.academicProfile);

  const addStudyLog = useStore((s) => s.addStudyLog);
  const addWeeklyCheckIn = useStore((s) => s.addWeeklyCheckIn);
  const ensureCourseTopic = useStore((s) => s.ensureCourseTopic);
  const patchAssessment = useStore((s) => s.patch);
  const replan = useStore((s) => s.replan);

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

  const resolveSnapshot = useCallback(
    (nextKind: StudyLogKind, nextCourseId: string, nextAssessmentId: string) => {
      const nextAssess = assessments.find((a) => a.id === nextAssessmentId) ?? futureAssessments[0];
      const nextCourse =
        nextKind === 'exam_prep' && nextAssess
          ? courses.find((c) => c.id === nextAssess.courseId) ?? courses[0]
          : courses.find((c) => c.id === nextCourseId) ?? courses[0];
      const slot =
        classes.find((c) => c.courseId === nextCourse?.id && c.weekday === todayWeekday) ??
        classes.find((c) => c.courseId === nextCourse?.id);
      const greeting = buildOpeningGreeting({
        kind: nextKind,
        course: nextCourse,
        assessment: nextAssess,
        minutesToday: dayStats.minutes,
        classesCountToday: dayStats.todayClasses,
        classSlotLabel: slot ? `${slot.type} ${slot.start}` : undefined,
      });
      const contextKey = buildCheckInContextKey({
        kind: nextKind,
        today,
        weekKey: currentWeekKey,
        courseId: nextCourse?.id,
        classSlotId: slot?.id,
        assessmentId: nextAssess?.id,
      });
      const draft = loadCheckInDraft(contextKey);
      if (draft && (draft.turns.some((t) => t.role === 'user') || draft.inputText.trim())) {
        return {
          contextKey,
          source: 'draft' as const,
          savedEntry: undefined,
          turns: draft.turns.length > 0 ? draft.turns : [{ id: `greet-${Date.now()}`, role: 'model' as const, text: greeting }],
          inputText: draft.inputText,
          understanding: draft.understanding,
        };
      }
      const saved = findSavedCheckInEntry({
        studyLogs,
        kind: nextKind,
        today,
        weekKey: currentWeekKey,
        courseId: nextCourse?.id,
        assessmentId: nextAssess?.id,
      });
      if (saved) {
        return {
          contextKey,
          source: 'saved' as const,
          savedEntry: saved,
          turns: buildTurnsFromSavedEntry(saved, greeting, nextCourse),
          inputText: '',
          understanding: buildUnderstandingFromSavedEntry(saved),
        };
      }
      return {
        contextKey,
        source: 'fresh' as const,
        savedEntry: undefined,
        turns: [{ id: `greet-${Date.now()}`, role: 'model' as const, text: greeting }],
        inputText: '',
        understanding: null,
      };
    },
    [assessments, futureAssessments, courses, classes, todayWeekday, dayStats.minutes, dayStats.todayClasses, today, currentWeekKey, studyLogs],
  );

  const initialCourseResolved = initialCourseId ?? initialMatchedSlot?.courseId ?? courses[0]?.id ?? '';
  const initialAssessResolved = initialTargetAssessment?.id ?? '';
  const initialSnapshot = useMemo(
    () => resolveSnapshot(initialKind, initialCourseResolved, initialAssessResolved),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inicialização única por abertura/chave
    [],
  );

  const [kind, setKind] = useState<StudyLogKind>(initialKind);
  const [courseId, setCourseId] = useState<string>(initialCourseResolved);
  const [assessmentId, setAssessmentId] = useState<string>(initialAssessResolved);
  const [inputText, setInputText] = useState<string>(initialSnapshot.inputText);
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
  const activeSlot = useMemo(
    () =>
      classes.find((c) => c.courseId === effectiveCourse?.id && c.weekday === todayWeekday) ??
      classes.find((c) => c.courseId === effectiveCourse?.id),
    [classes, effectiveCourse?.id, todayWeekday],
  );
  const activeContextKey = useMemo(
    () =>
      buildCheckInContextKey({
        kind,
        today,
        weekKey: currentWeekKey,
        courseId: effectiveCourse?.id,
        classSlotId: activeSlot?.id,
        assessmentId: selectedAssessment?.id,
      }),
    [kind, today, currentWeekKey, effectiveCourse?.id, activeSlot?.id, selectedAssessment?.id],
  );
  const savedEntryForContext = useMemo(
    () =>
      findSavedCheckInEntry({
        studyLogs,
        kind,
        today,
        weekKey: currentWeekKey,
        courseId: effectiveCourse?.id,
        assessmentId: selectedAssessment?.id,
      }),
    [studyLogs, kind, today, currentWeekKey, effectiveCourse?.id, selectedAssessment?.id],
  );

  const [turns, setTurns] = useState<MiniChatTurn[]>(() => initialSnapshot.turns);
  const [understanding, setUnderstanding] = useState<ParsedCheckInUnderstanding | null>(
    () => initialSnapshot.understanding,
  );
  const [conversationSource, setConversationSource] = useState<'fresh' | 'draft' | 'saved'>(
    () => initialSnapshot.source,
  );
  const manuallyClearedRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationSource === 'fresh' && !manuallyClearedRef.current && savedEntryForContext) {
      const greeting = buildOpeningGreeting({
        kind,
        course: effectiveCourse,
        assessment: selectedAssessment,
        minutesToday: dayStats.minutes,
        classesCountToday: dayStats.todayClasses,
        classSlotLabel: activeSlot ? `${activeSlot.type} ${activeSlot.start}` : undefined,
      });
      setTurns(buildTurnsFromSavedEntry(savedEntryForContext, greeting, effectiveCourse));
      setUnderstanding(buildUnderstandingFromSavedEntry(savedEntryForContext));
      setConversationSource('saved');
    }
  }, [
    conversationSource,
    savedEntryForContext,
    kind,
    effectiveCourse,
    selectedAssessment,
    dayStats.minutes,
    dayStats.todayClasses,
    activeSlot,
  ]);

  useEffect(() => {
    if (conversationSource === 'saved') return;
    saveCheckInDraft(activeContextKey, { turns, inputText, understanding });
  }, [activeContextKey, conversationSource, turns, inputText, understanding]);

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

  const applyContextSnapshot = (nextKind: StudyLogKind, nextCourseId: string, nextAssessmentId: string) => {
    manuallyClearedRef.current = false;
    const snap = resolveSnapshot(nextKind, nextCourseId, nextAssessmentId);
    setTurns(snap.turns);
    setUnderstanding(snap.understanding);
    setInputText(snap.inputText);
    setConversationSource(snap.source);
  };

  const handleStartFresh = () => {
    manuallyClearedRef.current = true;
    clearCheckInDraft(activeContextKey);
    const greeting = buildOpeningGreeting({
      kind,
      course: effectiveCourse,
      assessment: selectedAssessment,
      minutesToday: dayStats.minutes,
      classesCountToday: dayStats.todayClasses,
      classSlotLabel: activeSlot ? `${activeSlot.type} ${activeSlot.start}` : undefined,
    });
    setTurns([{ id: `greet-${Date.now()}`, role: 'model', text: greeting }]);
    setUnderstanding(null);
    setInputText('');
    setConversationSource('fresh');
    inputRef.current?.focus();
  };

  const handleKindChange = (nextKind: StudyLogKind) => {
    setKind(nextKind);
    applyContextSnapshot(nextKind, courseId, assessmentId);
  };

  const handleCourseSelect = (nextCid: string) => {
    setCourseId(nextCid);
    applyContextSnapshot(kind, nextCid, assessmentId);
  };

  const handleAssessmentSelect = (nextAid: string) => {
    setAssessmentId(nextAid);
    applyContextSnapshot(kind, courseId, nextAid);
  };

  const handleSendMessage = async (rawOverride?: string) => {
    const text = (rawOverride ?? inputText).trim();
    if (!text || sending) return;

    manuallyClearedRef.current = false;
    setConversationSource('draft');
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
      showToast(t('checkin.needText'), 'neutral');
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
      patchAssessment(
        'assessments',
        selectedAssessment.id,
        { topicIds: finalTopicIds },
        { skipReconcile: true },
      );
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

    const cleanedMessages = turns
      .filter((t) => t.text.trim().length > 0)
      .slice(-30)
      .map((t) => ({ id: t.id, role: t.role, text: t.text.trim().slice(0, 2000) }));

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
      ...(finalUnderstanding.studyFocus ? { studyFocus: finalUnderstanding.studyFocus } : {}),
      ...(finalUnderstanding.topicTitle ? { topicTitle: finalUnderstanding.topicTitle } : {}),
      ...(finalTopicIds.length > 0 ? { topicIds: finalTopicIds } : {}),
      ...(finalUnderstanding.studiedSummary ? { studiedSummary: finalUnderstanding.studiedSummary } : {}),
      ...(finalUnderstanding.difficulties ? { difficulties: finalUnderstanding.difficulties } : {}),
      notes: finalUnderstanding.scopeLabel
        ? `${finalUnderstanding.scopeLabel} — ${finalUnderstanding.notes}`
        : finalUnderstanding.notes,
      ...(cleanedMessages.length > 0 ? { messages: cleanedMessages } : {}),
    };

    const wasAlreadySaved = Boolean(savedEntryForContext);
    addStudyLog(entry);
    clearCheckInDraft(activeContextKey);
    replan('checkin', { force: true });

    showToast(
      wasAlreadySaved
        ? t('checkin.updated')
        : t('checkin.saved'),
      'ok',
    );
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
      {/* Cabeçalho estilo Uni Tutor + Puxador swipe-down */}
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
                  {t('checkin.journalOf')}{' '}
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
              aria-label={t('checkin.close')}
              className="hidden size-11 -mr-1.5 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg sm:flex"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Faixa compacta de modos em 1 linha (estilo chips do Tutor) */}
        <div
          role="tablist"
          aria-label={t('checkin.kindAria')}
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
                  'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition',
                  active
                    ? 'border-[#141312] bg-ink-cta text-ink-cta-fg dark:border-white/20'
                    : 'border-line bg-bg text-muted hover:text-fg',
                )}
              >
                <Icon size={13} />
                <span className="sm:hidden">{t(`checkin.${item.shortLabel}`)}</span>
                <span className="hidden sm:inline">{t(`checkin.${item.label}`)}</span>
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
                    'min-h-11 shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition',
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
                    'min-h-11 shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition',
                    selected
                      ? 'border-accent bg-accent-soft font-semibold text-accent-ink'
                      : 'border-line bg-surface-2/60 text-muted hover:text-fg',
                  )}
                >
                  {c?.shortName ?? t('checkin.course')} · {a.title} ({days}d)
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
        {(conversationSource === 'saved' ||
          (conversationSource === 'draft' &&
            (turns.some((t) => t.role === 'user') || inputText.trim().length > 0))) && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-line/75 bg-surface px-3 py-2 text-xs">
            <span className="min-w-0 truncate text-muted">
              {conversationSource === 'saved'
                ? t('checkin.savedConv', { date: savedEntryForContext?.date ? ` · ${savedEntryForContext.date}` : '' })
                : t('checkin.draftSaved')}
            </span>
            <button
              type="button"
              onClick={handleStartFresh}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-line bg-bg px-3 py-1 text-xs font-semibold text-fg transition hover:border-accent"
            >
              <RotateCcw size={12} /> {conversationSource === 'saved' ? t('checkin.newConv') : t('checkin.clear')}
            </button>
          </div>
        )}

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
            <span>{t('checkin.aligning')}</span>
          </div>
        )}
      </div>

      {/* Rodapé fixo estilo Gemini: Cartão de Alinhamento (quando pronto) + Sugestões + Cápsula Compositor */}
      <footer className="shrink-0 space-y-2 border-t border-line/70 bg-surface px-3.5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {understanding && (
          <div className="rounded-2xl border border-accent/35 bg-accent-soft/55 px-3 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-accent-ink dark:text-accent">{t('checkin.ready')}</span>
              <Badge tone="accent">{understanding.feelingLabel}</Badge>
              {understanding.studyFocus && <Badge tone="ok">{understanding.studyFocus}</Badge>}
              {understanding.scopeLabel && <Badge tone="neutral">{understanding.scopeLabel}</Badge>}
              {understanding.topicTitle && <Badge tone="neutral">{understanding.topicTitle}</Badge>}
              {perceivedCount > 0 && <Badge tone="neutral">{t('checkin.topicsN', { count: perceivedCount })}</Badge>}
            </div>
            {(understanding.newTopicsToAdd.length > 0 || understanding.matchedTopicIds.length > 0) &&
              effectiveCourse && (
                <p className="mt-1 line-clamp-1 text-muted">
                  {t('checkin.topicsPrefix')}{' '}
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
                <Sparkles size={14} className="shrink-0" /> {t('checkin.toTutor')}
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={!hasDraftOrResult}
                onClick={() => handleConfirm(false)}
                className="flex-1 whitespace-nowrap px-3 text-xs"
              >
                <Check size={14} className="shrink-0" />{' '}
                {savedEntryForContext ? t('checkin.update') : t('checkin.save')}
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
                    if (conversationSource === 'saved') setConversationSource('draft');
                    setInputText(chip.prefillText);
                    inputRef.current?.focus();
                  }
                }}
                className="min-h-11 rounded-full border border-line/85 bg-bg px-3 py-1 text-xs font-medium text-fg transition hover:border-accent hover:bg-accent-soft/45"
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
            onChange={(e) => {
              if (conversationSource === 'saved') setConversationSource('draft');
              setInputText(e.target.value);
            }}
            onKeyDown={onComposerKeyDown}
            aria-label={t('checkin.msgAria')}
            placeholder={
              kind === 'exam_prep'
                ? t('checkin.phExam')
                : kind === 'class'
                  ? t('checkin.phClass')
                  : t('checkin.phDefault')
            }
            style={{ minHeight: 40 }}
            className="max-h-28 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-fg placeholder:text-muted/75 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            aria-label={t('checkin.sendAria')}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-ink-cta text-ink-cta-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ArrowUp size={18} strokeWidth={2.2} />
          </button>
        </form>
      </footer>
    </dialog>,
    document.body,
  );
}
