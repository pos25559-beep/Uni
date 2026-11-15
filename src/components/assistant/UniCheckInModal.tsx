import { format, parseISO, startOfWeek } from 'date-fns';
import {
  BookOpenCheck,
  Check,
  Flame,
  Moon,
  Plus,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionMinutes, todayStr, upcomingAssessments } from '../../lib/selectors';
import { resolveUniAccessory } from '../../lib/uniAccessories';
import { newId, useStore } from '../../store/useStore';
import type { StudyLogEntry, StudyLogKind, Topic, WeeklyCheckIn } from '../../types';
import { UniBuddy, UniPetBuddy } from '../brand/UnipediaMarks';
import { Badge, Button, Field, Input, Modal, Textarea, cx, showToast } from '../ui';

export interface UniCheckInModalProps {
  open: boolean;
  onClose: () => void;
  initialKind?: StudyLogKind;
  initialCourseId?: string;
  initialClassSlotId?: string;
  initialAssessmentId?: string;
}

const parseList = (text: string): string[] =>
  text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

const KIND_COPY: Record<StudyLogKind, { label: string; question: string; hint: string }> = {
  class: {
    label: 'Pós-Aula',
    question: 'Como correu a aula e que matéria foi dada?',
    hint: 'O Uni adiciona ou atualiza logo a matéria nos tópicos da cadeira e ajusta o plano se ficou alguma dúvida.',
  },
  day: {
    label: 'Fim do Dia',
    question: 'Como foi o teu dia e o estudo de hoje?',
    hint: 'Registar o dia ajuda a calibrar o ritmo de amanhã e dá +4 ⚡ no Ninho do Uni.',
  },
  week: {
    label: 'Domingo',
    question: 'Balanço de domingo: como correu a semana?',
    hint: 'Prepara a semana seguinte com o que dominaste e o que ficou pendente.',
  },
  exam_prep: {
    label: 'Modo Teste',
    question: 'Até que matéria sai, o que já estudaste e como te sentes?',
    hint: 'Marca exatamente os tópicos que saem na avaliação para o plano e o Tutor se focarem no essencial.',
  },
};

const CLASS_FEELINGS = [
  { id: 'clara', label: 'Entendi bem' },
  { id: 'mais_ou_menos', label: 'Algumas dúvidas' },
  { id: 'dificil', label: 'Difícil' },
  { id: 'faltei', label: 'Faltei / rever' },
];

const DAY_FEELINGS = [
  { id: 'produtivo', label: 'Rendeu bem' },
  { id: 'normal', label: 'Normal' },
  { id: 'cansado', label: 'Cansado' },
  { id: 'nao_estudei', label: 'Hoje não deu' },
];

const WEEK_MOODS: Array<{ id: WeeklyCheckIn['mood']; label: string }> = [
  { id: 'confiante', label: 'Confiante' },
  { id: 'estavel', label: 'Estável' },
  { id: 'pressionado', label: 'Pressionado' },
  { id: 'atrasado', label: 'Com atraso' },
];

const EXAM_FEELINGS = [
  { id: 'confiante', label: 'Confiante' },
  { id: 'estavel', label: 'Estável' },
  { id: 'ansioso', label: 'Ansioso' },
  { id: 'atrasado', label: 'Com atraso' },
];

const EXAM_PROGRESS = [
  { id: 'ainda_nao', label: 'Ainda não comecei' },
  { id: 'parcial', label: 'Estudei parte' },
  { id: 'revisto', label: 'Já revi bem' },
] as const;

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
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);
  const academicProfile = useStore((s) => s.academicProfile);
  const weeklyCheckIns = useStore((s) => s.weeklyCheckIns);

  const addStudyLog = useStore((s) => s.addStudyLog);
  const addWeeklyCheckIn = useStore((s) => s.addWeeklyCheckIn);
  const ensureCourseTopic = useStore((s) => s.ensureCourseTopic);
  const patchAssessment = useStore((s) => s.patch);
  const updateTopic = useStore((s) => s.updateTopic);
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
  const initialDoneTodayMin = useMemo(
    () =>
      sessions
        .filter((s) => s.done && s.date === today)
        .reduce((sum, s) => sum + sessionMinutes(s), 0),
    [sessions, today],
  );
  const initialTargetAssessment = useMemo(
    () =>
      assessments.find((a) => a.id === initialAssessmentId) ??
      futureAssessments.find((a) => !initialCourseId || a.courseId === initialCourseId) ??
      futureAssessments[0],
    [assessments, initialAssessmentId, futureAssessments, initialCourseId],
  );
  const latestWeekly = weeklyCheckIns[0];
  const isSameWeekCheckIn = latestWeekly?.weekOf === currentWeekKey;

  const [kind, setKind] = useState<StudyLogKind>(initialKind);

  // Pós-aula state
  const [courseId, setCourseId] = useState<string>(
    () => initialCourseId ?? initialMatchedSlot?.courseId ?? courses[0]?.id ?? '',
  );
  const [classSlotId, setClassSlotId] = useState<string>(() => initialMatchedSlot?.id ?? '');
  const [classFeeling, setClassFeeling] = useState<string>('clara');
  const [topicGiven, setTopicGiven] = useState<string>('');
  const [syncToCourseTopics, setSyncToCourseTopics] = useState(true);
  const [classDifficulties, setClassDifficulties] = useState<string>('');

  // Fim do dia state
  const [dayFeeling, setDayFeeling] = useState<string>(() =>
    initialDoneTodayMin >= 45 ? 'produtivo' : initialDoneTodayMin > 0 ? 'normal' : 'cansado',
  );
  const [dayRating, setDayRating] = useState<1 | 2 | 3 | 4 | 5>(() =>
    initialDoneTodayMin >= 45 ? 4 : 3,
  );
  const [dayNotes, setDayNotes] = useState<string>('');

  // Domingo / semana state
  const [weekMood, setWeekMood] = useState<WeeklyCheckIn['mood']>(() => latestWeekly?.mood ?? 'estavel');
  const [understoodText, setUnderstoodText] = useState(() =>
    isSameWeekCheckIn ? latestWeekly.understoodTopics.join(', ') : '',
  );
  const [weekDiffText, setWeekDiffText] = useState(() =>
    isSameWeekCheckIn ? latestWeekly.classDifficulties.join(', ') : '',
  );
  const [pendingText, setPendingText] = useState(() =>
    isSameWeekCheckIn ? latestWeekly.pendingNextWeek.join(', ') : '',
  );
  const [hardCourseIds, setHardCourseIds] = useState<string[]>(() =>
    latestWeekly?.hardCourseIds?.length
      ? latestWeekly.hardCourseIds
      : (academicProfile?.difficultCourseIds ?? []),
  );
  const [weekNotes, setWeekNotes] = useState(() =>
    isSameWeekCheckIn ? latestWeekly.notes : '',
  );

  // Modo Teste state
  const [assessmentId, setAssessmentId] = useState<string>(() => initialTargetAssessment?.id ?? '');
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>(
    () => initialTargetAssessment?.topicIds ?? [],
  );
  const [newExamTopic, setNewExamTopic] = useState<string>('');
  const [examPrepProgress, setExamPrepProgress] = useState<'ainda_nao' | 'parcial' | 'revisto'>(() =>
    initialTargetAssessment && initialTargetAssessment.topicIds.length > 0 ? 'parcial' : 'ainda_nao',
  );
  const [examStudiedNote, setExamStudiedNote] = useState<string>('');
  const [examFeeling, setExamFeeling] = useState<string>('estavel');

  const activeCourse = useMemo(
    () => courses.find((c) => c.id === courseId) ?? courses[0],
    [courses, courseId],
  );
  const selectedAssessment = useMemo(
    () => assessments.find((a) => a.id === assessmentId) ?? futureAssessments[0],
    [assessments, assessmentId, futureAssessments],
  );
  const examCourse = useMemo(
    () =>
      selectedAssessment
        ? courses.find((c) => c.id === selectedAssessment.courseId)
        : undefined,
    [courses, selectedAssessment],
  );

  const dayStats = useMemo(() => {
    const doneToday = sessions.filter((s) => s.done && s.date === today);
    const minutes = doneToday.reduce((sum, s) => sum + sessionMinutes(s), 0);
    const todayClasses = classes.filter((c) => c.weekday === todayWeekday).length;
    return { doneCount: doneToday.length, minutes, todayClasses };
  }, [sessions, classes, today, todayWeekday]);

  const uniAccessory = resolveUniAccessory(
    settings.uniAccessory,
    academicProfile?.degreeName,
    activeCourse?.name ?? examCourse?.name ?? courses[0]?.name,
  );

  const handleAssessmentSwitch = (nextId: string) => {
    setAssessmentId(nextId);
    const found = assessments.find((a) => a.id === nextId);
    setSelectedTopicIds(found?.topicIds ?? []);
  };

  const toggleExamTopicId = (tid: string) => {
    setSelectedTopicIds((prev) =>
      prev.includes(tid) ? prev.filter((id) => id !== tid) : [...prev, tid],
    );
  };

  const handleAddInlineExamTopic = () => {
    if (!examCourse || !newExamTopic.trim()) return;
    const topic = ensureCourseTopic(examCourse.id, newExamTopic.trim(), {
      status: examPrepProgress === 'revisto' ? 'review' : examPrepProgress === 'parcial' ? 'learning' : 'todo',
      confidence: examPrepProgress === 'revisto' ? 4 : examPrepProgress === 'parcial' ? 3 : 2,
    });
    if (topic && !selectedTopicIds.includes(topic.id)) {
      setSelectedTopicIds((prev) => [...prev, topic.id]);
    }
    setNewExamTopic('');
  };

  const handleSave = (openTutorAfter = false) => {
    const nowIso = new Date().toISOString();
    let tutorSeedPrompt = '';

    if (kind === 'class') {
      const targetCourseId = activeCourse?.id;
      let resolvedTopic: Topic | null = null;
      if (targetCourseId && syncToCourseTopics && topicGiven.trim()) {
        const mappedConfidence: Topic['confidence'] =
          classFeeling === 'clara' ? 4 : classFeeling === 'mais_ou_menos' ? 3 : 2;
        resolvedTopic = ensureCourseTopic(targetCourseId, topicGiven.trim(), {
          status: classFeeling === 'clara' ? 'review' : 'learning',
          confidence: mappedConfidence,
          lastStudied: today,
        });
      }
      const entry: StudyLogEntry = {
        id: newId(),
        kind: 'class',
        date: today,
        createdAt: nowIso,
        ...(targetCourseId ? { courseId: targetCourseId } : {}),
        ...(classSlotId ? { classSlotId } : {}),
        feeling: classFeeling,
        ...(topicGiven.trim() ? { topicTitle: topicGiven.trim() } : {}),
        ...(resolvedTopic ? { topicIds: [resolvedTopic.id] } : {}),
        ...(classDifficulties.trim() ? { difficulties: classDifficulties.trim() } : {}),
      };
      addStudyLog(entry);
      reconcileFuturePlan(true);
      tutorSeedPrompt =
        `Acabei de sair da aula de ${activeCourse?.shortName ?? 'uma cadeira'} (${CLASS_FEELINGS.find((f) => f.id === classFeeling)?.label ?? classFeeling}).` +
        (topicGiven.trim() ? ` Matéria dada: ${topicGiven.trim()}.` : '') +
        (classDifficulties.trim() ? ` Dúvidas: ${classDifficulties.trim()}.` : '') +
        ' Podes consolidar comigo os pontos-chave e propor 2 exercícios?';
    } else if (kind === 'day') {
      const entry: StudyLogEntry = {
        id: `log-day-${today}`,
        kind: 'day',
        date: today,
        createdAt: nowIso,
        feeling: dayFeeling,
        rating: dayRating,
        studiedSummary: `${dayStats.minutes} min estudados · ${dayStats.doneCount} sessões`,
        ...(dayNotes.trim() ? { notes: dayNotes.trim() } : {}),
      };
      addStudyLog(entry);
      reconcileFuturePlan(true);
      tutorSeedPrompt = `Fiz o balanço de hoje (${DAY_FEELINGS.find((f) => f.id === dayFeeling)?.label ?? dayFeeling}, energia ${dayRating}/5).${dayNotes.trim() ? ` Notas: ${dayNotes.trim()}.` : ''} Como ajustamos o foco para amanhã?`;
    } else if (kind === 'week') {
      const checkIn: WeeklyCheckIn = {
        id: `checkin-${currentWeekKey}`,
        weekOf: currentWeekKey,
        createdAt: nowIso,
        mood: weekMood,
        understoodTopics: parseList(understoodText),
        classDifficulties: parseList(weekDiffText),
        pendingNextWeek: parseList(pendingText),
        hardCourseIds,
        notes: weekNotes.trim(),
      };
      addWeeklyCheckIn(checkIn);
      const entry: StudyLogEntry = {
        id: `log-week-${currentWeekKey}`,
        kind: 'week',
        date: today,
        createdAt: nowIso,
        feeling: weekMood,
        ...(understoodText.trim() ? { studiedSummary: understoodText.trim() } : {}),
        ...(weekDiffText.trim() ? { difficulties: weekDiffText.trim() } : {}),
        ...(weekNotes.trim() ? { notes: weekNotes.trim() } : {}),
      };
      addStudyLog(entry);
      reconcileFuturePlan(true);
      tutorSeedPrompt = `Balanço semanal concluído (estado: ${weekMood}).${weekDiffText.trim() ? ` Dificuldades: ${weekDiffText.trim()}.` : ''}${pendingText.trim() ? ` Pendente: ${pendingText.trim()}.` : ''} Qual é a melhor estratégia para a próxima semana?`;
    } else if (kind === 'exam_prep') {
      if (selectedAssessment && examCourse) {
        patchAssessment('assessments', selectedAssessment.id, {
          topicIds: selectedTopicIds,
        });
        // Atualiza o estado dos tópicos marcados conforme o que o aluno já estudou
        for (const tid of selectedTopicIds) {
          const t = examCourse.topics.find((x) => x.id === tid);
          if (!t) continue;
          if (examPrepProgress === 'revisto' && t.status !== 'done') {
            updateTopic(examCourse.id, tid, {
              status: 'review',
              confidence: Math.max(t.confidence, 4) as Topic['confidence'],
              lastStudied: today,
            });
          } else if (examPrepProgress === 'parcial' && t.status === 'todo') {
            updateTopic(examCourse.id, tid, {
              status: 'learning',
              lastStudied: today,
            });
          }
        }
      }

      const summaryPieces = [
        EXAM_PROGRESS.find((p) => p.id === examPrepProgress)?.label,
        examStudiedNote.trim(),
      ].filter(Boolean);

      const entry: StudyLogEntry = {
        id: newId(),
        kind: 'exam_prep',
        date: today,
        createdAt: nowIso,
        ...(examCourse ? { courseId: examCourse.id } : {}),
        ...(selectedAssessment ? { assessmentId: selectedAssessment.id } : {}),
        feeling: examFeeling,
        topicIds: selectedTopicIds,
        ...(summaryPieces.length > 0 ? { studiedSummary: summaryPieces.join(' — ') } : {}),
      };
      addStudyLog(entry);
      reconcileFuturePlan(true);
      const markedNames =
        examCourse && selectedTopicIds.length > 0
          ? examCourse.topics
              .filter((t) => selectedTopicIds.includes(t.id))
              .map((t) => t.title)
              .join(', ')
          : 'matéria em aberto';
      tutorSeedPrompt = `Alinhei o Modo Teste de ${examCourse?.shortName ?? 'cadeira'} (${selectedAssessment?.title ?? 'avaliação'}). Matéria que sai: ${markedNames}. Estado: ${summaryPieces.join(' — ')}. Sinto-me ${examFeeling}. Montas-me um guião de revisão focado apenas nesta matéria?`;
    }

    showToast('Registo guardado no Diário do Uni (+4 ⚡) e plano alinhado!', 'ok');
    onClose();
    if (openTutorAfter) {
      navigate('/assistente', {
        state: {
          prefillPrompt: tutorSeedPrompt,
          courseId: kind === 'exam_prep' ? examCourse?.id : activeCourse?.id,
        },
      });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Diário & Check-in do Uni"
      maxWidthClass="sm:max-w-2xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={onClose}>
            Agora não
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => handleSave(true)}>
              <Sparkles size={15} /> Guardar e falar c/ Tutor
            </Button>
            <Button variant="primary" onClick={() => handleSave(false)}>
              <Check size={15} /> Guardar & alinhar plano
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Cabeçalho vivo do Uni */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-line/70 bg-surface-2/60 p-3.5">
          <div className="flex shrink-0 items-end gap-1 rounded-2xl bg-pastel-butter/60 px-2.5 py-2 dark:bg-surface">
            <UniBuddy
              size={44}
              accessory={uniAccessory}
              skin={settings.uniSkin ?? 'classic'}
              mood="happy"
            />
            {settings.uniPet && settings.uniPet !== 'none' && (
              <UniPetBuddy pet={settings.uniPet} size={22} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-fg">{KIND_COPY[kind].question}</p>
              <Badge tone="accent">+4 ⚡ Ninho</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted">{KIND_COPY[kind].hint}</p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Tipo de registo do Uni"
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
                onClick={() => setKind(item.id)}
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

        {kind === 'class' && (
          <div className="space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cadeira da aula">
                <select
                  className="min-h-[44px] w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-fg"
                  value={activeCourse?.id ?? ''}
                  onChange={(e) => {
                    setCourseId(e.target.value);
                    const slot = classes.find((c) => c.courseId === e.target.value);
                    setClassSlotId(slot?.id ?? '');
                  }}
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.shortName} — {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              {classes.filter((c) => c.courseId === activeCourse?.id).length > 0 && (
                <Field label="Bloco no horário (opcional)">
                  <select
                    className="min-h-[44px] w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-fg"
                    value={classSlotId}
                    onChange={(e) => setClassSlotId(e.target.value)}
                  >
                    <option value="">Aula avulso / extra</option>
                    {classes
                      .filter((c) => c.courseId === activeCourse?.id)
                      .map((cl) => (
                        <option key={cl.id} value={cl.id}>
                          {cl.type} · {cl.start}–{cl.end}
                          {cl.room ? ` (${cl.room})` : ''}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-semibold text-muted">
                Como correu a aula?
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CLASS_FEELINGS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setClassFeeling(f.id)}
                    className={cx(
                      'min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold transition',
                      classFeeling === f.id
                        ? 'border-accent bg-accent/15 text-accent-ink dark:text-accent'
                        : 'border-line bg-surface text-fg hover:bg-surface-2',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Que matéria foi dada hoje?">
              <Input
                value={topicGiven}
                onChange={(e) => setTopicGiven(e.target.value)}
                placeholder="Ex.: Critério de Von Mises, Calandragem, Integrais duplos..."
              />
            </Field>

            {activeCourse && activeCourse.topics.length > 0 && (
              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-muted">
                  Tópicos já existentes (toca para preencher):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activeCourse.topics.slice(0, 10).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTopicGiven(t.title)}
                      className={cx(
                        'min-h-[36px] rounded-full border px-3 py-1 text-xs font-medium transition',
                        topicGiven.toLowerCase() === t.title.toLowerCase()
                          ? 'border-accent bg-accent text-accent-fg'
                          : 'border-line bg-surface-2/60 text-fg hover:border-accent/60',
                      )}
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface-2/40 px-3 py-2.5 text-xs">
              <input
                type="checkbox"
                checked={syncToCourseTopics}
                onChange={(e) => setSyncToCourseTopics(e.target.checked)}
                className="size-4 accent-[var(--accent)]"
              />
              <span className="text-fg">
                Atualizar/criar automaticamente esta matéria nos tópicos da cadeira
              </span>
            </label>

            <Field label="Ficou alguma dúvida ou exercício para rever? (opcional)">
              <Input
                value={classDifficulties}
                onChange={(e) => setClassDifficulties(e.target.value)}
                placeholder="Ex.: dedução da ficha 4 ou exercício 3 da prática"
              />
            </Field>
          </div>
        )}

        {kind === 'day' && (
          <div className="space-y-3.5">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2/45 px-3.5 py-2.5 text-xs">
              <span className="font-semibold text-fg">Resumo automático de hoje:</span>
              <Badge tone="neutral">{dayStats.minutes} min estudados</Badge>
              <Badge tone="neutral">{dayStats.doneCount} sessões fechadas</Badge>
              <Badge tone="neutral">{dayStats.todayClasses} aulas no horário</Badge>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-semibold text-muted">
                Como foi o teu dia e o estudo?
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DAY_FEELINGS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setDayFeeling(f.id)}
                    className={cx(
                      'min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold transition',
                      dayFeeling === f.id
                        ? 'border-accent bg-accent/15 text-accent-ink dark:text-accent'
                        : 'border-line bg-surface text-fg hover:bg-surface-2',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-semibold text-muted">
                Energia e foco hoje (1 = esgotado · 5 = ótimo)
              </span>
              <div className="flex gap-2">
                {([1, 2, 3, 4, 5] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setDayRating(n)}
                    className={cx(
                      'min-h-[44px] flex-1 rounded-xl border text-sm font-bold transition',
                      dayRating === n
                        ? 'border-accent bg-accent text-accent-fg'
                        : 'border-line bg-surface text-fg hover:bg-surface-2',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <Field label="O que avançou bem ou ficou para amanhã? (opcional)">
              <Textarea
                rows={2}
                value={dayNotes}
                onChange={(e) => setDayNotes(e.target.value)}
                placeholder="Ex.: Fechei a folha de exercícios de MS2, falta rever critérios de cedência..."
              />
            </Field>
          </div>
        )}

        {kind === 'week' && (
          <div className="space-y-3.5">
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-muted">
                Como correu esta semana?
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {WEEK_MOODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setWeekMood(m.id)}
                    className={cx(
                      'min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold transition',
                      weekMood === m.id
                        ? 'border-accent bg-accent/15 text-accent-ink dark:text-accent'
                        : 'border-line bg-surface text-fg hover:bg-surface-2',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="O que entendeste bem esta semana?">
                <Input
                  value={understoodText}
                  onChange={(e) => setUnderstoodText(e.target.value)}
                  placeholder="Ex.: Derivadas parciais, trefilagem..."
                />
              </Field>
              <Field label="Onde tiveste mais dificuldade?">
                <Input
                  value={weekDiffText}
                  onChange={(e) => setWeekDiffText(e.target.value)}
                  placeholder="Ex.: Integrais de linha, ficha 5..."
                />
              </Field>
            </div>

            <Field label="Ficou algo pendente para segunda-feira?">
              <Input
                value={pendingText}
                onChange={(e) => setPendingText(e.target.value)}
                placeholder="Ex.: Terminar laboratório de MdF"
              />
            </Field>

            {courses.length > 0 && (
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-muted">
                  Cadeiras que precisam de mais prioridade na próxima semana:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {courses.map((c) => {
                    const active = hardCourseIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          setHardCourseIds((prev) =>
                            prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                          )
                        }
                        className={cx(
                          'min-h-[38px] rounded-full border px-3 py-1 text-xs font-semibold transition',
                          active
                            ? 'border-coral bg-coral/15 text-coral'
                            : 'border-line bg-surface text-fg hover:bg-surface-2',
                        )}
                      >
                        {c.shortName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Field label="Notas para o Uni (opcional)">
              <Textarea
                rows={2}
                value={weekNotes}
                onChange={(e) => setWeekNotes(e.target.value)}
                placeholder="Ex.: Semana de testes chegando, prefiro blocos mais curtos..."
              />
            </Field>
          </div>
        )}

        {kind === 'exam_prep' && (
          <div className="space-y-3.5">
            {futureAssessments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-4 text-center text-xs text-muted">
                Ainda não tens testes ou exames futuros registados. Adiciona uma avaliação em{' '}
                <strong>Cadeiras</strong> para o Modo Teste perguntar até que matéria sai.
              </div>
            ) : (
              <>
                <Field label="Avaliação em preparação">
                  <select
                    className="min-h-[44px] w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-fg"
                    value={selectedAssessment?.id ?? ''}
                    onChange={(e) => handleAssessmentSwitch(e.target.value)}
                  >
                    {futureAssessments.map((a) => {
                      const c = courses.find((x) => x.id === a.courseId);
                      return (
                        <option key={a.id} value={a.id}>
                          {c?.shortName ?? 'Cadeira'} · {a.title} ({a.date.slice(0, 10)})
                        </option>
                      );
                    })}
                  </select>
                </Field>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-muted">
                      Até que matéria sai neste teste? ({selectedTopicIds.length} marcado(s))
                    </span>
                    {examCourse && examCourse.topics.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedTopicIds(
                            selectedTopicIds.length === examCourse.topics.length
                              ? []
                              : examCourse.topics.map((t) => t.id),
                          )
                        }
                        className="text-xs font-semibold text-accent-ink hover:underline dark:text-accent"
                      >
                        {selectedTopicIds.length === examCourse.topics.length
                          ? 'Desmarcar tudo'
                          : 'Marcar todos os tópicos'}
                      </button>
                    )}
                  </div>

                  {examCourse && examCourse.topics.length > 0 ? (
                    <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-line bg-surface-2/40 p-2.5">
                      {examCourse.topics.map((t) => {
                        const checked = selectedTopicIds.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleExamTopicId(t.id)}
                            className={cx(
                              'inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition',
                              checked
                                ? 'border-accent bg-accent text-accent-fg'
                                : 'border-line bg-surface text-fg hover:border-accent/60',
                            )}
                          >
                            {checked && <Check size={12} />}
                            <span>{t.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted">
                      Esta cadeira ainda não tem tópicos listados — adiciona abaixo até onde vai a matéria.
                    </p>
                  )}

                  {examCourse && (
                    <div className="flex gap-2">
                      <Input
                        value={newExamTopic}
                        onChange={(e) => setNewExamTopic(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddInlineExamTopic();
                          }
                        }}
                        placeholder="+ Adicionar matéria que vai sair (ex.: Aula T07)"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleAddInlineExamTopic}
                        disabled={!newExamTopic.trim()}
                      >
                        <Plus size={14} /> Adicionar
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-muted">
                    Já estudaste alguma desta matéria?
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {EXAM_PROGRESS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setExamPrepProgress(p.id)}
                        className={cx(
                          'min-h-[44px] rounded-xl border px-2.5 py-2 text-xs font-semibold transition',
                          examPrepProgress === p.id
                            ? 'border-accent bg-accent/15 text-accent-ink dark:text-accent'
                            : 'border-line bg-surface text-fg hover:bg-surface-2',
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <Input
                    className="mt-2"
                    value={examStudiedNote}
                    onChange={(e) => setExamStudiedNote(e.target.value)}
                    placeholder="Ex.: Já li até T04, faltam exercícios de T05 e T06"
                  />
                </div>

                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-muted">
                    Como te sentes para este teste?
                  </span>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {EXAM_FEELINGS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setExamFeeling(f.id)}
                        className={cx(
                          'min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold transition',
                          examFeeling === f.id
                            ? 'border-accent bg-accent/15 text-accent-ink dark:text-accent'
                            : 'border-line bg-surface text-fg hover:bg-surface-2',
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
