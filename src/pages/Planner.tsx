import { addDays, addWeeks, format, parseISO, startOfWeek } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WeeklyTutorModal from '../components/assistant/WeeklyTutorModal';
import {
  AnimatedPage,
  BentoMetricTile,
  WeekDayPills,
  celebrateStationery,
} from '../components/motion/Primitives';
import CourseDistribution from '../components/planner/CourseDistribution';
import DayColumn from '../components/planner/DayColumn';
import FocusTimer from '../components/planner/FocusTimer';
import SessionModal from '../components/planner/SessionModal';
import { TabGuideBanner, TabGuideHelpButton } from '../components/onboarding/TabGuideBanner';
import {
  ActionSheet,
  Badge,
  Button,
  Card,
  CourseChip,
  EmptyState,
  Modal,
  PageHeader,
  SegmentedControl,
  showToast,
} from '../components/ui';
import { weekdayShort } from '../lib/colors';
import { hapticTap } from '../lib/nativeBridge';
import { analyzeTestMode, generatePlan, planSummary } from '../lib/planner';
import { fmtMinutes, sessionMinutes, todayStr } from '../lib/selectors';
import { useStore } from '../store/useStore';
import type { StudySession } from '../types';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function studyDaysLabel(days: number[]): string {
  const ordered = DAY_ORDER.filter((d) => days.includes(d));
  if (ordered.length === 0) return 'sem dias de estudo';
  const pos = ordered.map((d) => DAY_ORDER.indexOf(d));
  const contiguous = pos.every((p, i) => i === 0 || p === pos[i - 1] + 1);
  if (ordered.length > 2 && contiguous) {
    return `${weekdayShort[ordered[0]]}–${weekdayShort[ordered[ordered.length - 1]]}`;
  }
  return ordered.map((d) => weekdayShort[d]).join(', ');
}

export default function Planner() {
  const courses = useStore((s) => s.courses);
  const assessments = useStore((s) => s.assessments);
  const classes = useStore((s) => s.classes);
  const events = useStore((s) => s.events);
  const sessions = useStore((s) => s.sessions);
  const settings = useStore((s) => s.settings);
  const academicProfile = useStore((s) => s.academicProfile);
  const weeklyCheckIns = useStore((s) => s.weeklyCheckIns);
  const replaceGeneratedSessions = useStore((s) => s.replaceGeneratedSessions);
  const upsertMany = useStore((s) => s.upsertMany);
  const patch = useStore((s) => s.patch);
  const remove = useStore((s) => s.remove);
  const navigate = useNavigate();

  const today = useMemo(() => todayStr(), []);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayKey, setSelectedDayKey] = useState(today);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [modal, setModal] = useState<{ session?: StudySession; date: string } | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const testMode = useMemo(
    () => analyzeTestMode(courses, assessments, today),
    [courses, assessments, today],
  );

  const weekDays = useMemo(() => {
    const start = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekOffset]);

  const weekKeys = useMemo(() => weekDays.map((d) => format(d, 'yyyy-MM-dd')), [weekDays]);
  const weekFrom = weekKeys[0];
  const weekTo = weekKeys[6];
  const activeDayKey = weekKeys.includes(selectedDayKey)
    ? selectedDayKey
    : weekKeys.includes(today)
      ? today
      : weekKeys[0];

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const topicById = useMemo(
    () => new Map(courses.flatMap((c) => c.topics.map((t) => [t.id, t] as const))),
    [courses],
  );
  const assessmentById = useMemo(() => new Map(assessments.map((a) => [a.id, a])), [assessments]);

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? '')),
    [sessions],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, StudySession[]>();
    for (const s of sorted) {
      const list = map.get(s.date);
      if (list) list.push(s);
      else map.set(s.date, [s]);
    }
    return map;
  }, [sorted]);

  const weekSessions = useMemo(
    () => sorted.filter((s) => s.date >= weekFrom && s.date <= weekTo),
    [sorted, weekFrom, weekTo],
  );

  const overdue = useMemo(() => sorted.filter((s) => !s.done && s.date < today), [sorted, today]);

  const stats = useMemo(() => {
    const planned = weekSessions.reduce((sum, s) => sum + s.minutes, 0);
    const done = weekSessions.reduce((sum, s) => sum + sessionMinutes(s), 0);
    const doneCount = weekSessions.filter((s) => s.done).length;
    const pct = weekSessions.length > 0 ? Math.round((doneCount / weekSessions.length) * 100) : 0;
    return { planned, done, pct };
  }, [weekSessions]);

  const distribution = useMemo(
    () => planSummary(weekSessions, courses).filter((r) => r.planned > 0),
    [weekSessions, courses],
  );

  const hasPendingGenerated = useMemo(
    () => sessions.some((s) => s.generated && !s.done && s.date >= today),
    [sessions, today],
  );

  const noPlanInputs = courses.length === 0;
  const starterOnlyMode = courses.length > 0 && !assessments.some((a) => a.grade === undefined);
  const focusSession = focusId ? sessions.find((s) => s.id === focusId) : undefined;

  const generate = () => {
    void hapticTap();
    const plan = generatePlan({
      courses,
      assessments,
      classes,
      events,
      settings,
      from: today,
      days: 14,
      existing: sessions.filter((s) => !s.generated || s.done || s.date < today),
      difficultCourseIds: academicProfile.difficultCourseIds,
      weeklyCheckIns,
      extraActivities: academicProfile.extraActivities,
    });
    replaceGeneratedSessions(today, plan);
    setConfirmOpen(false);
    celebrateStationery();
    showToast(`Plano gerado com ${plan.length} sessões`, 'ok');
  };

  const onGenerate = () => (hasPendingGenerated ? setConfirmOpen(true) : generate());

  const moveAllToToday = () => {
    void hapticTap();
    upsertMany('sessions', overdue.map((s) => ({ ...s, date: today })));
    showToast('Sessões movidas para hoje', 'ok');
  };

  const weekLabel = `${format(weekDays[0], 'd MMM', { locale: pt })} – ${format(weekDays[6], 'd MMM yyyy', { locale: pt })}`;

  const pillDays = useMemo(
    () =>
      weekDays.map((d, i) => {
        const key = weekKeys[i];
        const daySessions = byDay.get(key) ?? [];
        const hasPending = daySessions.some((s) => !s.done);
        const allDone = daySessions.length > 0 && !hasPending;
        return {
          key,
          shortLabel: weekdayShort[d.getDay()],
          dayNumber: format(d, 'd'),
          isToday: key === today,
          dotTone: hasPending ? ('coral' as const) : allDone ? ('accent' as const) : ('none' as const),
          count: daySessions.length,
        };
      }),
    [weekDays, weekKeys, byDay, today],
  );

  const selectedIndex = Math.max(0, weekKeys.indexOf(activeDayKey));
  const selectedDate = weekDays[selectedIndex];

  return (
    <AnimatedPage className="space-y-5">
      <PageHeader
        eyebrow="Planeador"
        title="Plano de"
        accentTitle="estudo"
        subtitle={`${fmtMinutes(settings.dailyStudyMinutes)} por dia · ${studyDaysLabel(settings.studyDays)}`}
        actions={
          <div className="flex items-center gap-2">
            <TabGuideHelpButton tabKey="plano" />
            <Button variant="primary" onClick={onGenerate} disabled={noPlanInputs}>
              <Sparkles size={16} /> Gerar plano
            </Button>
            <Button
              variant="secondary"
              iconOnly
              onClick={() => setActionsOpen(true)}
              aria-label="Mais ações do plano"
              title="Mais ações"
            >
              <MoreHorizontal size={18} />
            </Button>
          </div>
        }
      />

      <TabGuideBanner tabKey="plano" />

      {testMode.mode !== 'normal' && (
        <div
          className={
            testMode.mode === 'single_test'
              ? 'flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-pastel-butter/85 px-4 py-3.5 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]'
              : 'flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-pastel-blush/85 px-4 py-3.5 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]'
          }
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-surface/80 p-2 text-coral dark:bg-black/25">
              <Flame size={18} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">
                  {testMode.mode === 'single_test'
                    ? 'Modo Teste ativo (< 10 dias)'
                    : `Modo Teste Múltiplo (${testMode.urgentCourseIds.length} cadeiras)`}
                </span>
                <Badge tone={testMode.mode === 'single_test' ? 'warn' : 'danger'}>
                  {testMode.mode === 'single_test' ? 'Foco intensivo' : 'Equilíbrio'}
                </Badge>
              </div>
              <p className="mt-1 text-xs opacity-75">
                {testMode.mode === 'single_test'
                  ? `Foco total em ${testMode.urgentAssessments[0].course.shortName} (${testMode.urgentAssessments[0].assessment.title} em ${testMode.urgentAssessments[0].daysLeft}d).`
                  : `Equilíbrio entre ${testMode.urgentAssessments.map((u) => `${u.course.shortName} (${u.daysLeft}d)`).join(' · ')}.`}
              </p>
            </div>
          </div>
          <Button size="sm" variant="primary" onClick={generate}>
            <Sparkles size={14} /> Recalcular
          </Button>
        </div>
      )}

      {starterOnlyMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-pastel-sage/75 px-4 py-3 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]">
          <div className="min-w-0 flex-1 text-xs leading-relaxed">
            <span className="font-bold">Modo Arranque de Semestre:</span> ainda sem datas de provas marcadas — o plano distribui estudo contínuo equilibrado pelas tuas cadeiras ativas e recalcula mal inserires avaliações.
          </div>
          <Button size="sm" variant="secondary" onClick={() => navigate('/cadeiras')}>
            Adicionar provas
          </Button>
        </div>
      )}

      {sessions.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={28} />}
          title={noPlanInputs ? 'Ainda não tens cadeiras ativas' : 'Ainda não há plano de estudo'}
          hint={
            noPlanInputs
              ? 'Adiciona as tuas cadeiras (mesmo sem datas de provas ainda) para gerar o plano inicial.'
              : 'Gera já um plano automático para os próximos 14 dias ou cria sessões manuais.'
          }
          action={
            noPlanInputs ? (
              <Button variant="primary" onClick={() => navigate('/cadeiras')}>
                Ir para as cadeiras
              </Button>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="secondary" onClick={() => setModal({ date: today })} disabled={courses.length === 0}>
                  <Plus size={16} /> Nova sessão
                </Button>
                <Button variant="primary" onClick={onGenerate}>
                  <Sparkles size={16} /> Gerar plano
                </Button>
              </div>
            )
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <BentoMetricTile
              tone="sage"
              label="Planeado"
              value={fmtMinutes(stats.planned)}
              hint={`${weekSessions.length} sessões na semana`}
              icon={<Clock size={15} />}
            />
            <BentoMetricTile
              tone="mint"
              label="Concluído"
              value={fmtMinutes(stats.done)}
              hint={`${stats.pct}% da semana`}
            />
            <BentoMetricTile
              tone="butter"
              label="Meta diária"
              value={fmtMinutes(settings.dailyStudyMinutes)}
              hint={studyDaysLabel(settings.studyDays)}
            />
            <BentoMetricTile
              tone={overdue.length > 0 ? 'peach' : 'sky'}
              label="Em atraso"
              value={overdue.length}
              hint={overdue.length > 0 ? 'por reagendar' : 'tudo em dia'}
              icon={<AlertTriangle size={15} className={overdue.length > 0 ? 'text-coral' : undefined} />}
            />
          </div>

          {overdue.length > 0 && (
            <Card
              className="border-warn/40"
              title={`Em atraso (${overdue.length})`}
              action={
                <Button size="sm" variant="secondary" onClick={moveAllToToday}>
                  Mover todas para hoje
                </Button>
              }
            >
              <ul className="divide-y divide-line">
                {overdue.map((s) => {
                  const topic = s.topicId ? topicById.get(s.topicId) : undefined;
                  return (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CourseChip course={courseById.get(s.courseId)} />
                          <span className="text-xs tabular text-muted">
                            {format(parseISO(s.date), 'EEE d MMM', { locale: pt })}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm font-medium">{topic?.title ?? s.notes ?? 'Estudo'}</p>
                        <p className="text-xs tabular text-muted">{s.minutes} min</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => patch('sessions', s.id, { date: today })}>
                          Mover para hoje
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove('sessions', s.id)}>
                          Descartar
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  iconOnly
                  variant="ghost"
                  aria-label="Semana anterior"
                  onClick={() => setWeekOffset((w) => w - 1)}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span className="font-display text-sm font-bold capitalize">{weekLabel}</span>
                <Button
                  size="sm"
                  iconOnly
                  variant="ghost"
                  aria-label="Semana seguinte"
                  onClick={() => setWeekOffset((w) => w + 1)}
                >
                  <ChevronRight size={16} />
                </Button>
                {weekOffset !== 0 && (
                  <Button size="sm" variant="secondary" onClick={() => { setWeekOffset(0); setSelectedDayKey(today); }}>
                    Hoje
                  </Button>
                )}
              </div>

              <div className="lg:hidden">
                <SegmentedControl
                  layoutId="planner-view-mode"
                  value={viewMode}
                  onChange={(v) => setViewMode(v as 'day' | 'week')}
                  items={[
                    { id: 'day', label: 'Dia' },
                    { id: 'week', label: 'Semana' },
                  ]}
                />
              </div>
            </div>

            <WeekDayPills
              days={pillDays}
              selectedKey={activeDayKey}
              onSelect={(key) => setSelectedDayKey(key)}
            />

            {/* Mobile: por defeito apenas o dia selecionado; opcionalmente semana completa */}
            <div className={viewMode === 'day' ? 'lg:hidden' : 'hidden'}>
              <DayColumn
                date={selectedDate}
                sessions={byDay.get(activeDayKey) ?? []}
                budget={settings.dailyStudyMinutes}
                isToday={activeDayKey === today}
                isStudyDay={settings.studyDays.includes(selectedDate.getDay())}
                courseById={courseById}
                topicById={topicById}
                assessmentById={assessmentById}
                onFocus={(s) => setFocusId(s.id)}
                onEdit={(s) => setModal({ session: s, date: s.date })}
                onAdd={(date) => setModal({ date })}
              />
            </div>

            <div className={viewMode === 'week' ? 'grid gap-3 lg:grid-cols-7' : 'hidden lg:grid lg:grid-cols-7 lg:gap-3'}>
              {weekDays.map((d, i) => {
                const key = weekKeys[i];
                return (
                  <DayColumn
                    key={key}
                    date={d}
                    sessions={byDay.get(key) ?? []}
                    budget={settings.dailyStudyMinutes}
                    isToday={key === today}
                    isStudyDay={settings.studyDays.includes(d.getDay())}
                    courseById={courseById}
                    topicById={topicById}
                    assessmentById={assessmentById}
                    onFocus={(s) => setFocusId(s.id)}
                    onEdit={(s) => setModal({ session: s, date: s.date })}
                    onAdd={(date) => setModal({ date })}
                  />
                );
              })}
            </div>
          </section>

          <Card title="Distribuição por cadeira">
            {distribution.length > 0 ? (
              <CourseDistribution rows={distribution} courseById={courseById} />
            ) : (
              <EmptyState
                icon={<CalendarDays size={24} />}
                title="Sem sessões nesta semana"
                hint="Gera um plano ou adiciona uma sessão para ver a distribuição por cadeira."
              />
            )}
          </Card>
        </>
      )}

      <ActionSheet
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title="Ações do plano"
        actions={[
          {
            id: 'new',
            label: 'Nova sessão manual',
            hint: `Adicionar bloco em ${format(selectedDate, 'd MMM', { locale: pt })}`,
            icon: <Plus size={16} />,
            onSelect: () => {
              if (courses.length === 0) {
                showToast('Adiciona primeiro uma cadeira', 'neutral');
                return;
              }
              setModal({ date: activeDayKey });
            },
          },
          {
            id: 'checkin',
            label: 'Check-in semanal com Tutor',
            hint: 'Ajusta o plano ao teu ritmo desta semana',
            icon: <MessageSquare size={16} />,
            onSelect: () => setTutorOpen(true),
          },
        ]}
      />

      {modal && (
        <SessionModal
          courses={courses}
          session={modal.session}
          defaultDate={modal.date}
          onClose={() => setModal(null)}
        />
      )}

      {focusSession && (
        <FocusTimer
          session={focusSession}
          course={courseById.get(focusSession.courseId)}
          topic={focusSession.topicId ? topicById.get(focusSession.topicId) : undefined}
          onClose={() => setFocusId(null)}
        />
      )}

      <WeeklyTutorModal open={tutorOpen} onClose={() => setTutorOpen(false)} />

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Substituir o plano?"
        footer={
          <>
            <Button onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={generate}>
              Gerar plano
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          As sessões geradas que ainda não fizeste, a partir de hoje, são substituídas por um plano novo.
        </p>
        <p className="text-sm text-muted">
          Mantêm-se as sessões concluídas, as que criaste manualmente e as que estão em atraso.
        </p>
      </Modal>
    </AnimatedPage>
  );
}
