// Calendário unificado: aulas, avaliações, sessões de estudo, eventos e tarefas num só sítio.
import {
  addDays, addMonths, addWeeks, format, startOfDay, startOfMonth, startOfWeek,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarPlus, ChevronLeft, ChevronRight, Download, MoreHorizontal, Share2, Upload, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import AgendaView from '../components/calendar/AgendaView';
import DayPanel from '../components/calendar/DayPanel';
import MonthView from '../components/calendar/MonthView';
import NewEventModal from '../components/calendar/NewEventModal';
import ClassFormModal from '../components/courses/ClassFormModal';
import { ConfirmModal } from '../components/courses/ConfirmModal';
import SmartScheduleImportModal from '../components/courses/SmartScheduleImportModal';
import { buildCalendarItems } from '../components/calendar/items';
import type { CalItem, CalKind, CalState } from '../components/calendar/items';
import { KIND_META, KIND_ORDER } from '../components/calendar/shared';
import { AnimatedPage } from '../components/motion/Primitives';
import { TabGuideBanner, TabGuideHelpButton } from '../components/onboarding/TabGuideBanner';
import WeekView from '../components/calendar/WeekView';
import { ActionSheet, Button, Modal, PageHeader, SegmentedControl } from '../components/ui';
import { cx, showToast } from '../lib/uiHelpers';
import { buildIcsCalendar, downloadIcsCalendar } from '../integrations/ics';
import { capitalizeFirst, toDateStr } from '../lib/selectors';
import {
  buildSemesterSharePayload,
  buildSemesterShareUrl,
  decodeSemesterSharePayload,
  planSharedSemesterImport,
} from '../lib/semesterShare';
import { newId, useStore } from '../store/useStore';
import type { ClassSlot, Course } from '../types';

type View = 'mes' | 'semana' | 'agenda';

const VIEWS: { key: View; label: string }[] = [
  { key: 'mes', label: 'Mês' },
  { key: 'semana', label: 'Semana' },
  { key: 'agenda', label: 'Agenda' },
];

const ALL_ON: Record<CalKind, boolean> = { aula: true, avaliacao: true, estudo: true, evento: true, tarefa: true };

export default function Calendar() {
  const { t } = useTranslation('plan');
  const courses = useStore((s) => s.courses);
  const classes = useStore((s) => s.classes);
  const assessments = useStore((s) => s.assessments);
  const sessions = useStore((s) => s.sessions);
  const events = useStore((s) => s.events);
  const tasks = useStore((s) => s.tasks);
  const settings = useStore((s) => s.settings);
  const academicProfile = useStore((s) => s.academicProfile);
  const upsertMany = useStore((s) => s.upsertMany);
  const remove = useStore((s) => s.remove);
  const [searchParams, setSearchParams] = useSearchParams();

  const [view, setView] = useState<View>('mes');
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState(() => toDateStr(new Date()));
  const [kinds, setKinds] = useState<Record<CalKind, boolean>>(ALL_ON);
  const [newOpen, setNewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [calMenuOpen, setCalMenuOpen] = useState(false);
  const [shareModalUrl, setShareModalUrl] = useState<string | null>(null);
  const [sharedDismissedToken, setSharedDismissedToken] = useState<string | null>(null);
  const [satNoticeDismissed, setSatNoticeDismissed] = useState(false);
  const [editingClass, setEditingClass] = useState<{ slot: ClassSlot; course: Course } | null>(null);
  const [deletingClass, setDeletingClass] = useState<{ id: string; title: string } | null>(null);

  const [today] = useState(() => toDateStr(new Date()));

  const range = useMemo(() => {
    if (view === 'mes') {
      const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
      return { start, end: addDays(start, 41), days: Array.from({ length: 42 }, (_, i) => addDays(start, i)) };
    }
    if (view === 'semana') {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      return { start, end: addDays(start, 6), days: Array.from({ length: 7 }, (_, i) => addDays(start, i)) };
    }
    return { start: cursor, end: addDays(cursor, 29), days: [] as Date[] };
  }, [view, cursor]);

  const calState: CalState = useMemo(
    () => ({ courses, classes, assessments, sessions, events, tasks, settings }),
    [courses, classes, assessments, sessions, events, tasks, settings],
  );

  const allItems = useMemo(
    () => buildCalendarItems(calState, range.start, range.end),
    [calState, range],
  );

  const visible = useMemo(() => allItems.filter((it) => kinds[it.kind]), [allItems, kinds]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    for (const it of visible) {
      const list = map.get(it.date);
      if (list) list.push(it);
      else map.set(it.date, [it]);
    }
    return map;
  }, [visible]);

  const courseById = useMemo(
    () => new Map<string, Course>(courses.map((c) => [c.id, c])),
    [courses],
  );
  const classById = useMemo(
    () => new Map<string, ClassSlot>(classes.map((cl) => [cl.id, cl])),
    [classes],
  );
  const saturdayClasses = useMemo(
    () => classes.filter((cl) => cl.weekday === 6),
    [classes],
  );

  const openEditClassItem = (item: CalItem) => {
    if (item.kind !== 'aula') return;
    const slot = classById.get(item.refId);
    const course = item.courseId ? courseById.get(item.courseId) : undefined;
    if (slot && course) setEditingClass({ slot, course });
  };

  const moveSaturdayToFriday = () => {
    if (saturdayClasses.length === 0) return;
    upsertMany(
      'classes',
      saturdayClasses.map((cl) => ({ ...cl, weekday: 5 })),
    );
    showToast(
      saturdayClasses.length === 1
        ? t('cal.movedOne')
        : t('cal.movedMany', { count: saturdayClasses.length }),
    );
  };

  const label = (() => {
    if (view === 'mes') return format(cursor, 'MMMM yyyy', { locale: pt });
    if (view === 'semana') {
      return `${format(range.start, 'd MMM', { locale: pt })} – ${format(range.end, 'd MMM yyyy', { locale: pt })}`;
    }
    return `${format(cursor, 'd MMM', { locale: pt })} – ${format(addDays(cursor, 29), 'd MMM yyyy', { locale: pt })}`;
  })();

  const step = (dir: 1 | -1) =>
    setCursor((c) => (view === 'mes' ? addMonths(c, dir) : view === 'semana' ? addWeeks(c, dir) : addDays(c, 30 * dir)));

  const goToday = () => {
    const t = startOfDay(new Date());
    setCursor(t);
    setSelected(toDateStr(t));
  };

  const toggleKind = (k: CalKind) => setKinds((prev) => ({ ...prev, [k]: !prev[k] }));

  const turmaToken = searchParams.get('turma');
  const incomingShare = useMemo(
    () => (turmaToken && turmaToken !== sharedDismissedToken ? decodeSemesterSharePayload(turmaToken) : null),
    [turmaToken, sharedDismissedToken],
  );

  const handleExportIcs = () => {
    const ics = buildIcsCalendar({ courses, classes, assessments, events, settings });
    downloadIcsCalendar(`unipedia-${toDateStr(new Date())}.ics`, ics);
    showToast(t('cal.exported'));
  };

  const handleShareTurma = async () => {
    const payload = buildSemesterSharePayload({
      settings,
      academicProfile,
      courses,
      classes,
      assessments,
    });
    const url = buildSemesterShareUrl(payload);
    setShareModalUrl(url);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Horário ${payload.semesterName} · Unipedia`,
          text: t('cal.shareText'),
          url,
        });
        return;
      }
    } catch {
      // fallback para copiar link abaixo
    }
    try {
      await navigator.clipboard?.writeText(url);
      showToast(t('cal.linkCopiedClass'));
    } catch {
      // modal já mostra o link para copiar manualmente
    }
  };

  const dismissIncomingShare = () => {
    if (turmaToken) setSharedDismissedToken(turmaToken);
    if (searchParams.has('turma')) {
      const next = new URLSearchParams(searchParams);
      next.delete('turma');
      setSearchParams(next, { replace: true });
    }
  };

  const confirmIncomingShare = () => {
    if (!incomingShare) return;
    const plan = planSharedSemesterImport(
      incomingShare,
      { courses, classes, assessments },
      () => newId(),
    );
    if (plan.newCourses.length > 0) upsertMany('courses', plan.newCourses);
    if (plan.newClasses.length > 0) upsertMany('classes', plan.newClasses);
    if (plan.newAssessments.length > 0) upsertMany('assessments', plan.newAssessments);
    dismissIncomingShare();
    showToast(
      t('cal.importedSummary', { c: plan.newCourses.length, k: plan.newClasses.length, a: plan.newAssessments.length }),
    );
  };

  return (
    <AnimatedPage className="min-w-0 space-y-4 overflow-x-hidden">
      <PageHeader
        eyebrow={t('calendar.eyebrow')}
        title={t('calendar.title')}
        accentTitle={t('calendar.accentTitle')}
        subtitle={t('cal.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <TabGuideHelpButton tabKey="calendario" />
            <Button variant="primary" size="sm" onClick={() => setNewOpen(true)}>
              <CalendarPlus size={15} aria-hidden="true" /> + {t('calendar.newEvent')}
            </Button>
            <Button
              variant="secondary"
              iconOnly
              onClick={() => setCalMenuOpen(true)}
              aria-label={t('calendar.moreActions')}
              title={t('calendar.moreActions')}
            >
              <MoreHorizontal size={17} aria-hidden="true" />
            </Button>
          </div>
        }
      />

      <TabGuideBanner tabKey="calendario" />

      {saturdayClasses.length > 0 && !satNoticeDismissed && (
        <div
          data-testid="saturday-classes-banner"
          className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-warn/35 bg-warn/10 px-4 py-3 text-xs text-fg"
        >
          <span>
            {t('cal.satFound')}{' '}
            <strong>
              {saturdayClasses.length}{' '}
              {saturdayClasses.length === 1 ? t('cal.satOne') : t('cal.satMany')}
            </strong>{' '}
            {t('cal.satHint')}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={moveSaturdayToFriday}>
              {t('cal.moveFri')}
            </Button>
            <button
              type="button"
              onClick={() => setSatNoticeDismissed(true)}
              aria-label={t('cal.keepSat')}
              title={t('cal.closeNotice')}
              className="-mr-1.5 grid size-11 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Navegação e vista */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button size="sm" iconOnly variant="secondary" aria-label={t('cal.prev')} onClick={() => step(-1)}>
            <ChevronLeft size={16} />
          </Button>
          <Button size="sm" variant="secondary" onClick={goToday}>{t('calendar.today')}</Button>
          <Button size="sm" iconOnly variant="secondary" aria-label={t('cal.next')} onClick={() => step(1)}>
            <ChevronRight size={16} />
          </Button>
          <span className="ml-1 min-w-0 truncate font-display text-sm font-bold tabular">{capitalizeFirst(label)}</span>
        </div>

        <SegmentedControl
          layoutId="calendar-view-tabs"
          value={view}
          onChange={(v) => setView(v as View)}
          items={VIEWS.map((v) => ({ id: v.key, label: t(`cal.view.${v.key}`) }))}
        />
      </div>

      {/* Filtros */}
      <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1 sm:mb-5 sm:flex-wrap sm:overflow-visible sm:pb-0">
        {KIND_ORDER.map((k) => {
          const on = kinds[k];
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => toggleKind(k)}
              className={cx(
                'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-medium transition',
                on ? 'border-line bg-surface text-fg' : 'border-transparent bg-surface-2 text-muted',
              )}
            >
              <span className={cx('size-2 rounded-full', KIND_META[k].dot, !on && 'opacity-30')} />
              {KIND_META[k].plural}
            </button>
          );
        })}
        <p className="ml-auto hidden text-xs text-muted lg:block">
          Cor = cadeira · borda forte = avaliação · tracejado = tarefa
        </p>
      </div>

      {view === 'mes' && (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-5">
          <div className="rise min-w-0 rounded-2xl border border-line bg-surface p-2 sm:p-3">
            <MonthView
              days={range.days}
              anchor={cursor}
              byDay={byDay}
              courseById={courseById}
              selected={selected}
              today={today}
              onSelect={setSelected}
            />
          </div>
          <div className="mt-4 lg:mt-0">
            <DayPanel
              date={selected}
              items={byDay.get(selected) ?? []}
              courseById={courseById}
              onNewEvent={() => setNewOpen(true)}
            />
          </div>
        </div>
      )}

      {view === 'semana' && (
        <div className="rise rounded-2xl border border-line bg-surface p-2 sm:p-3">
          <WeekView
            days={range.days}
            byDay={byDay}
            courseById={courseById}
            today={today}
            selected={selected}
            onSelect={setSelected}
            onEditClass={openEditClassItem}
          />
        </div>
      )}

      {view === 'agenda' && (
        <AgendaView
          items={visible}
          courseById={courseById}
          today={today}
          onEditClass={openEditClassItem}
          onDeleteClass={(it) => setDeletingClass({ id: it.refId, title: it.title })}
        />
      )}

      {newOpen && (
        <NewEventModal
          defaultDate={selected}
          onClose={() => setNewOpen(false)}
        />
      )}

      {editingClass && (
        <ClassFormModal
          course={editingClass.course}
          initialSlot={editingClass.slot}
          onClose={() => setEditingClass(null)}
        />
      )}

      {deletingClass && (
        <ConfirmModal
          title={t('cal.deleteClass')}
          message={t('cal.deleteClassMsg', { title: deletingClass.title })}
          confirmLabel="Apagar"
          onConfirm={() => remove('classes', deletingClass.id)}
          onClose={() => setDeletingClass(null)}
        />
      )}

      {importOpen && <SmartScheduleImportModal onClose={() => setImportOpen(false)} />}

      <ActionSheet
        open={calMenuOpen}
        onClose={() => setCalMenuOpen(false)}
        title={t('cal.actions')}
        actions={[
          {
            id: 'import-schedule',
            label: t('cal.importSchedule'),
            hint: t('cal.importHint'),
            icon: <Upload size={16} />,
            onSelect: () => setImportOpen(true),
          },
          {
            id: 'export-ics',
            label: t('cal.exportIcs'),
            hint: t('cal.exportHint'),
            icon: <Download size={16} />,
            onSelect: handleExportIcs,
          },
          {
            id: 'share-turma',
            label: t('cal.share'),
            hint: t('cal.shareHint'),
            icon: <Share2 size={16} />,
            onSelect: () => void handleShareTurma(),
          },
        ]}
      />

      <Modal
        open={Boolean(shareModalUrl)}
        onClose={() => setShareModalUrl(null)}
        title={t('cal.share')}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (shareModalUrl) {
                  void navigator.clipboard?.writeText(shareModalUrl);
                  showToast(t('cal.linkCopied'));
                }
              }}
            >
              {t('cal.copyLink')}
            </Button>
            <Button onClick={() => setShareModalUrl(null)}>{t('cal.close')}</Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-muted">
            {t('cal.shareBody', { c: courses.length, k: classes.length })}
          </p>
          <input
            type="text"
            readOnly
            value={shareModalUrl ?? ''}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-fg"
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(incomingShare)}
        onClose={dismissIncomingShare}
        title={incomingShare ? t('cal.importTitle', { name: incomingShare.semesterName }) : t('cal.importTitleBare')}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={dismissIncomingShare}>
              {t('cal.cancel')}
            </Button>
            <Button variant="primary" onClick={confirmIncomingShare}>
              {t('cal.importConfirm')}
            </Button>
          </div>
        }
      >
        {incomingShare && (
          <div className="space-y-3 text-sm">
            <p className="text-muted">
              {t('cal.willAdd')}
            </p>
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-line bg-surface-2/60 p-3 text-center">
              <div>
                <p className="font-display text-lg font-bold text-fg">{incomingShare.courses.length}</p>
                <p className="text-xs text-muted">{t('cal.courses')}</p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-fg">{incomingShare.classes.length}</p>
                <p className="text-xs text-muted">{t('cal.classes')}</p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-fg">{incomingShare.assessments.length}</p>
                <p className="text-xs text-muted">{t('cal.exams')}</p>
              </div>
            </div>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted">
              {incomingShare.courses.map((c) => (
                <li key={c.code} className="flex items-center justify-between rounded-lg bg-surface px-2.5 py-1.5">
                  <span className="font-medium text-fg">{c.name}</span>
                  <span className="font-mono">{c.code}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </AnimatedPage>
  );
}
