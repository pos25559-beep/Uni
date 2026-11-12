import { addDays, addWeeks, format, parseISO, startOfWeek } from 'date-fns';
import { pt } from 'date-fns/locale';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Clock, Plus, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CourseDistribution from '../components/planner/CourseDistribution';
import DayColumn from '../components/planner/DayColumn';
import FocusTimer from '../components/planner/FocusTimer';
import SessionModal from '../components/planner/SessionModal';
import { Button, Card, CourseChip, EmptyState, Modal, PageHeader, Stat } from '../components/ui';
import { weekdayShort } from '../lib/colors';
import { generatePlan, planSummary } from '../lib/planner';
import { fmtMinutes, sessionMinutes, todayStr } from '../lib/selectors';
import { useStore } from '../store/useStore';
import type { StudySession } from '../types';

/** Ordem de apresentação: segunda a domingo (valores de Date.getDay()). */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "Seg–Sáb" quando os dias são contíguos; caso contrário lista-os. */
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
  const replaceGeneratedSessions = useStore((s) => s.replaceGeneratedSessions);
  const upsertMany = useStore((s) => s.upsertMany);
  const patch = useStore((s) => s.patch);
  const remove = useStore((s) => s.remove);
  const navigate = useNavigate();

  const today = useMemo(() => todayStr(), []);
  const [weekOffset, setWeekOffset] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [modal, setModal] = useState<{ session?: StudySession; date: string } | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  // Semana visível (segunda a domingo).
  const weekDays = useMemo(
    () => {
      const start = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    },
    [weekOffset],
  );
  const weekKeys = useMemo(() => weekDays.map((d) => format(d, 'yyyy-MM-dd')), [weekDays]);
  const weekFrom = weekKeys[0];
  const weekTo = weekKeys[6];

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
  const noPlanInputs = courses.length === 0 || !assessments.some((a) => a.grade === undefined);
  const focusSession = focusId ? sessions.find((s) => s.id === focusId) : undefined;

  const generate = () => {
    const plan = generatePlan({
      courses,
      assessments,
      classes,
      events,
      settings,
      from: today,
      days: 14,
      // Mantém concluídas, manuais e as sessões de dias anteriores (atrasadas).
      existing: sessions.filter((s) => !s.generated || s.done || s.date < today),
    });
    replaceGeneratedSessions(today, plan);
    setConfirmOpen(false);
  };

  const onGenerate = () => (hasPendingGenerated ? setConfirmOpen(true) : generate());

  const moveAllToToday = () => {
    upsertMany('sessions', overdue.map((s) => ({ ...s, date: today })));
  };

  const weekLabel = `${format(weekDays[0], 'd MMM', { locale: pt })} – ${format(weekDays[6], 'd MMM yyyy', { locale: pt })}`;

  return (
    <>
      <PageHeader
        title="Plano de estudo"
        subtitle={`${fmtMinutes(settings.dailyStudyMinutes)} por dia · ${studyDaysLabel(settings.studyDays)}`}
        actions={
          <>
            <Button onClick={() => setModal({ date: today })} disabled={courses.length === 0}>
              <Plus size={16} /> Nova sessão
            </Button>
            <Button variant="primary" onClick={onGenerate} disabled={noPlanInputs}>
              <Sparkles size={16} /> Gerar plano
            </Button>
          </>
        }
      />

      {sessions.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={28} />}
          title={noPlanInputs ? 'Ainda não há avaliações para planear' : 'Ainda não há plano de estudo'}
          hint={
            noPlanInputs
              ? 'Adiciona as cadeiras e as datas dos testes e exames. Com isso, o plano distribui o tempo de estudo por dia.'
              : 'O plano distribui as horas de estudo pelos tópicos das próximas avaliações, dia a dia.'
          }
          action={
            noPlanInputs ? (
              <Button variant="primary" onClick={() => navigate('/cadeiras')}>Ir para as cadeiras</Button>
            ) : (
              <Button variant="primary" onClick={onGenerate}>
                <Sparkles size={16} /> Gerar plano
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Planeado esta semana"
              value={fmtMinutes(stats.planned)}
              hint={`${weekSessions.length} sessões`}
              icon={<Clock size={16} className="text-muted" />}
            />
            <Stat
              label="Estudado esta semana"
              value={fmtMinutes(stats.done)}
              hint="sessões concluídas"
            />
            <Stat label="Conclusão" value={`${stats.pct}%`} hint="das sessões da semana" />
            <Stat
              label="Em atraso"
              value={overdue.length}
              hint={overdue.length > 0 ? 'por reagendar' : 'tudo em dia'}
              icon={<AlertTriangle size={16} className={overdue.length > 0 ? 'text-warn' : 'text-muted'} />}
            />
          </div>

          {overdue.length > 0 && (
            <Card
              className="mt-6 border-warn/40"
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
                          <span className="text-xs text-muted tabular">
                            {format(parseISO(s.date), 'EEE d MMM', { locale: pt })}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm font-medium">{topic?.title ?? s.notes ?? 'Estudo'}</p>
                        <p className="text-xs text-muted tabular">{s.minutes} min</p>
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

          <section className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold capitalize">{weekLabel}</h2>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" aria-label="Semana anterior" onClick={() => setWeekOffset((w) => w - 1)}>
                  <ChevronLeft size={16} />
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>
                  Esta semana
                </Button>
                <Button size="sm" variant="ghost" aria-label="Semana seguinte" onClick={() => setWeekOffset((w) => w + 1)}>
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-7">
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

          <Card className="mt-6" title="Distribuição por cadeira">
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

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Substituir o plano?"
        footer={
          <>
            <Button onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={generate}>Gerar plano</Button>
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
    </>
  );
}
