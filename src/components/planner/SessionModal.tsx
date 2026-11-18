// Criar (manual) ou editar uma sessão de estudo — com sugestão de hora livre e chips rápidos.
import { Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { matchBestMaterialForTopic } from '../../lib/planner';
import { daysUntil, todayStr } from '../../lib/selectors';
import { cx } from '../../lib/uiHelpers';
import { newId, useStore } from '../../store/useStore';
import type { Course, StudySession } from '../../types';
import { Button, DateField, Field, Input, Modal, Select, Switch, TimeField } from '../ui';

const QUICK_DURATIONS = [25, 35, 50, 75] as const;

interface SessionModalProps {
  courses: Course[];
  /** Sessão a editar; omitido = nova sessão manual. */
  session?: StudySession;
  defaultDate: string;
  /** Próxima hora livre calculada para `defaultDate`. */
  defaultStart?: string;
  onClose: () => void;
}

export default function SessionModal({
  courses,
  session,
  defaultDate,
  defaultStart,
  onClose,
}: SessionModalProps) {
  const { t } = useTranslation('plan');
  const upsert = useStore((s) => s.upsert);
  const materials = useStore((s) => s.materials);
  const assessments = useStore((s) => s.assessments);
  const contentMix = useStore((s) => s.settings.plannerPrefs?.contentMix ?? 'balanced');
  const editing = Boolean(session);

  const [courseId, setCourseId] = useState(session?.courseId ?? courses[0]?.id ?? '');
  const [topicId, setTopicId] = useState(session?.topicId ?? '');
  const [materialId, setMaterialId] = useState(session?.materialId ?? '');
  const [date, setDate] = useState(session?.date ?? defaultDate);
  const [start, setStart] = useState(session?.start ?? defaultStart ?? '17:00');
  const [minutesText, setMinutesText] = useState(String(session?.minutes ?? 50));
  const [locked, setLocked] = useState(Boolean(session?.locked));

  const course = courses.find((c) => c.id === courseId);
  const courseMaterials = materials.filter((m) => m.courseId === courseId);
  const today = useMemo(() => todayStr(), []);
  const nextExam = useMemo(
    () =>
      assessments
        .filter((a) => a.courseId === courseId && a.grade === undefined && a.date.slice(0, 10) >= today)
        .sort((a, b) => a.date.localeCompare(b.date))[0],
    [assessments, courseId, today],
  );
  const minutes = Number(minutesText);
  const minutesOk = Number.isInteger(minutes) && minutes >= 5 && minutes <= 480;
  const valid = Boolean(course) && minutesOk && date.length === 10;

  const suggestPriorityTopic = () => {
    if (!course || course.topics.length === 0) return;
    const examTopicIds = new Set(nextExam?.topicIds ?? []);
    const pool = course.topics.filter((tp) => tp.status !== 'done');
    const list = pool.length > 0 ? pool : course.topics;
    const picked = [...list].sort((a, b) => {
      const aExam = examTopicIds.has(a.id) ? 0 : 1;
      const bExam = examTopicIds.has(b.id) ? 0 : 1;
      if (aExam !== bExam) return aExam - bExam;
      return a.confidence - b.confidence;
    })[0];
    if (!picked) return;
    setTopicId(picked.id);
    const matId = matchBestMaterialForTopic({
      courseId: course.id,
      topic: picked,
      materials,
      contentMix,
      isExamUrgent: Boolean(nextExam && daysUntil(nextExam.date) <= 10),
    });
    if (matId) setMaterialId(matId);
  };

  const save = () => {
    if (!valid || !course) return;
    const base: StudySession = session ?? {
      id: newId(),
      courseId: course.id,
      date,
      minutes,
      done: false,
      generated: false,
    };
    upsert('sessions', {
      ...base,
      courseId: course.id,
      topicId: topicId || undefined,
      materialId: materialId || undefined,
      date,
      start: start || undefined,
      minutes,
      locked: locked ? true : undefined,
      // Uma sessão editada passa a ser "manual": não é substituída ao regenerar o plano.
      generated: false,
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? t('session.edit') : t('session.new')}
      footer={
        <>
          <Button onClick={onClose}>{t('session.cancel')}</Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            {t('session.save')}
          </Button>
        </>
      }
    >
      {!editing ? (
        <Field label={t('session.course')}>
          <Select
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setTopicId('');
              setMaterialId('');
            }}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        course && (
          <p className="text-sm font-medium text-fg">{course.name}</p>
        )
      )}

      <Field
        label={t('session.topic')}
        hint={
          nextExam
            ? t('session.nextExamHint', {
                title: nextExam.title,
                days: Math.max(0, daysUntil(nextExam.date)),
              })
            : t('session.topicHint')
        }
      >
        <div className="space-y-2">
          <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">{t('session.general')}</option>
            {course?.topics.map((tp) => (
              <option key={tp.id} value={tp.id}>
                {tp.title}
              </option>
            ))}
          </Select>
          {course && course.topics.length > 0 && (
            <button
              type="button"
              onClick={suggestPriorityTopic}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-surface-2/70 px-3 text-xs font-medium text-fg transition hover:border-accent"
            >
              <Sparkles size={13} className="text-accent" aria-hidden="true" />
              {t('session.suggestTopic')}
            </button>
          )}
        </div>
      </Field>

      {courseMaterials.length > 0 && (
        <Field label={t('session.material')}>
          <Select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            <option value="">{t('session.noMaterial')}</option>
            {courseMaterials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('session.date')}>
          <DateField aria-label={t('session.dateAria')} value={date} onChange={setDate} />
        </Field>
        <Field label={t('session.start')}>
          <TimeField aria-label={t('session.startAria')} value={start} onChange={setStart} />
        </Field>
      </div>

      <Field
        label={t('session.duration')}
        hint={minutesText && !minutesOk ? t('session.durationHint') : undefined}
      >
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-1.5">
            {QUICK_DURATIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutesText(String(m))}
                className={cx(
                  'min-h-11 rounded-xl border text-xs font-semibold tabular transition',
                  minutes === m
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface text-muted hover:text-fg',
                )}
              >
                {m}m
              </button>
            ))}
          </div>
          <Input
            type="number"
            inputMode="numeric"
            min={5}
            max={480}
            step={5}
            value={minutesText}
            onChange={(e) => setMinutesText(e.target.value)}
          />
        </div>
      </Field>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2/50 px-3.5 py-2.5">
        <span className="text-xs font-medium text-fg">{t('session.lockLabel')}</span>
        <Switch checked={locked} onCheckedChange={setLocked} label={t('session.lockLabel')} />
      </div>
    </Modal>
  );
}
