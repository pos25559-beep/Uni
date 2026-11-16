import { Bell, BellOff, BookOpenCheck, CalendarHeart, Flame, GraduationCap, Clock, Moon, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Select, Switch, TimeField } from '../ui';
import { showToast } from '../../lib/uiHelpers';
import {
  getUniNotificationPermission,
  requestUniNotificationPermission,
  sendTestUniNotification,
  syncScheduledUniNotifications,
} from '../../lib/notificationBridge';
import {
  buildSampleUniNotification,
  planSmartNotifications,
  resolveNotificationPrefs,
} from '../../lib/uniNotifications';
import { useStore } from '../../store/useStore';
import type { NotificationPreferences } from '../../types';

const HOURS = [9, 12, 16, 18, 19, 20, 21];

export default function NotificationsCard({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const { t } = useTranslation('settings');
  const settings = useStore((s) => s.settings);
  const courses = useStore((s) => s.courses);
  const assessments = useStore((s) => s.assessments);
  const classes = useStore((s) => s.classes);
  const sessions = useStore((s) => s.sessions);
  const studyLogs = useStore((s) => s.studyLogs);
  const weeklyCheckIns = useStore((s) => s.weeklyCheckIns);
  const updateSettings = useStore((s) => s.updateSettings);

  const prefs = useMemo(
    () => resolveNotificationPrefs(settings.notifications),
    [settings.notifications],
  );
  const [permState, setPermState] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>('prompt');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getUniNotificationPermission().then((status) => {
      if (mounted) setPermState(status);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const plannerInput = useMemo(
    () => ({ courses, assessments, classes, sessions, studyLogs, weeklyCheckIns, settings }),
    [courses, assessments, classes, sessions, studyLogs, weeklyCheckIns, settings],
  );

  const scheduledPreview = useMemo(() => planSmartNotifications(plannerInput), [plannerInput]);
  const samplePreview = useMemo(() => buildSampleUniNotification(plannerInput), [plannerInput]);

  const patchPrefs = (partial: Partial<NotificationPreferences>) => {
    const nextPrefs = { ...prefs, ...partial };
    updateSettings({ notifications: nextPrefs });
    void syncScheduledUniNotifications({
      ...plannerInput,
      settings: { ...settings, notifications: nextPrefs },
    });
  };

  const handleMasterToggle = async (enabled: boolean) => {
    if (!enabled) {
      patchPrefs({ enabled: false });
      showToast(t('notif.off'), 'neutral');
      return;
    }

    const perm = await requestUniNotificationPermission();
    setPermState(perm);
    if (perm === 'denied') {
      patchPrefs({ enabled: false });
      showToast(
        t('notif.blocked'),
        'danger',
      );
      return;
    }

    patchPrefs({ enabled: true });
    showToast(
      perm === 'granted'
        ? t('notif.on')
        : t('notif.savedInApp'),
    );
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await sendTestUniNotification(plannerInput);
      const nextPerm = await getUniNotificationPermission();
      setPermState(nextPerm);
      if (res.delivered === 'native' || res.delivered === 'web') {
        showToast(t('notif.sent', { title: res.notification.title }));
      } else {
        showToast(`${res.notification.title} — ${res.notification.body}`, 'neutral');
      }
    } finally {
      setTesting(false);
    }
  };

  const isMinimal = (settings.appTone ?? 'vibrante') === 'serio';

  return (
    <Card
      title={hideHeader ? undefined : t('notif.title')}
      className={isMinimal ? undefined : 'rounded-[26px] border-line/70'}
    >
      <div className="space-y-4">
        <p className="text-xs text-muted">
          {t('notif.intro')}
        </p>
        <div
          className={
            isMinimal
              ? 'flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface-2/60 p-3.5'
              : 'flex items-center justify-between gap-4 rounded-2xl bg-pastel-sage/55 p-4 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]'
          }
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-pastel-sage text-forest-ink dark:bg-forest/20 dark:text-forest">
              {prefs.enabled ? <Bell size={18} /> : <BellOff size={18} />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg">{t('notif.master')}</p>
              <p className="text-xs text-muted">
                {permState === 'denied'
                  ? t('notif.deniedHint')
                  : prefs.enabled
                    ? t('notif.activeHint', { max: prefs.maxDailyNudges, start: prefs.quietStart, end: prefs.quietEnd })
                    : t('notif.optIn')}
              </p>
            </div>
          </div>
          <Switch
            checked={prefs.enabled}
            onCheckedChange={(v) => void handleMasterToggle(v)}
            label={t('notif.masterAria')}
          />
        </div>

        {/* Categorias granulares */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
              <Flame size={16} className="text-coral" />
              <span>{t('notif.cat.streak')}</span>
            </span>
            <Switch
              checked={prefs.streakSaver}
              onCheckedChange={(v) => patchPrefs({ streakSaver: v })}
              label={t('notif.cat.streakAria')}
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
              <Sparkles size={16} className="text-forest" />
              <span>{t('notif.cat.srs')}</span>
            </span>
            <Switch
              checked={prefs.srsDue}
              onCheckedChange={(v) => patchPrefs({ srsDue: v })}
              label={t('notif.cat.srsAria')}
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
              <GraduationCap size={16} className="text-cobalt" />
              <span>{t('notif.cat.exams')}</span>
            </span>
            <Switch
              checked={prefs.assessments}
              onCheckedChange={(v) => patchPrefs({ assessments: v })}
              label={t('notif.cat.examsAria')}
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
              <Clock size={16} className="text-honey-ink" />
              <span>{t('notif.cat.classes')}</span>
            </span>
            <Switch
              checked={prefs.classReminders}
              onCheckedChange={(v) => patchPrefs({ classReminders: v })}
              label={t('notif.cat.classesAria')}
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
              <BookOpenCheck size={16} className="text-forest" />
              <span>{t('notif.cat.postClass')}</span>
            </span>
            <Switch
              checked={prefs.postClassCheckIn ?? true}
              onCheckedChange={(v) => patchPrefs({ postClassCheckIn: v })}
              label={t('notif.cat.postClassAria')}
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
              <Moon size={16} className="text-coral" />
              <span>{t('notif.cat.evening')}</span>
            </span>
            <Switch
              checked={prefs.eveningCheckIn ?? true}
              onCheckedChange={(v) => patchPrefs({ eveningCheckIn: v })}
              label={t('notif.cat.eveningAria')}
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
              <CalendarHeart size={16} className="text-cobalt" />
              <span>{t('notif.cat.sunday')}</span>
            </span>
            <Switch
              checked={prefs.sundayReview ?? true}
              onCheckedChange={(v) => patchPrefs({ sundayReview: v })}
              label={t('notif.cat.sundayAria')}
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
              <GraduationCap size={16} className="text-coral" />
              <span>{t('notif.cat.examPrep')}</span>
            </span>
            <Switch
              checked={prefs.examPrepCheckIn ?? true}
              onCheckedChange={(v) => patchPrefs({ examPrepCheckIn: v })}
              label={t('notif.cat.examPrepAria')}
            />
          </label>
        </div>

        {/* Cadência e silêncio */}
        <div className="grid gap-3 rounded-2xl border border-line/75 bg-surface-2/40 p-3.5 sm:grid-cols-3">
          <div className="space-y-1 text-xs">
            <span className="block font-semibold text-muted">{t('notif.field.hour')}</span>
            <Select
              aria-label={t('notif.field.hour')}
              value={prefs.preferredHour}
              onChange={(e) => patchPrefs({ preferredHour: Number(e.target.value) })}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1 text-xs">
            <span className="block font-semibold text-muted">{t('notif.field.before')}</span>
            <Select
              aria-label={t('notif.field.before')}
              value={prefs.classBeforeMinutes}
              onChange={(e) =>
                patchPrefs({ classBeforeMinutes: Number(e.target.value) === 30 ? 30 : 15 })
              }
            >
              <option value={15}>{t('notif.minBefore', { count: 15 })}</option>
              <option value={30}>{t('notif.minBefore', { count: 30 })}</option>
            </Select>
          </div>

          <div className="space-y-1 text-xs">
            <span className="block font-semibold text-muted">{t('notif.field.max')}</span>
            <Select
              aria-label={t('notif.field.max')}
              value={prefs.maxDailyNudges}
              onChange={(e) => {
                const v = Number(e.target.value);
                patchPrefs({
                  maxDailyNudges:
                    v === 1 || v === 2 || v === 3 || v === 4 || v === 6 ? v : 4,
                });
              }}
            >
              <option value={1}>{t('notif.perDay', { count: 1 })}</option>
              <option value={2}>{t('notif.perDay', { count: 2 })}</option>
              <option value={3}>{t('notif.perDay', { count: 3 })}</option>
              <option value={4}>{t('notif.perDay', { count: 4 })}</option>
              <option value={6}>{t('notif.perDay', { count: 6 })}</option>
            </Select>
          </div>

          <div className="space-y-1 text-xs">
            <span className="block font-semibold text-muted">{t('notif.field.after')}</span>
            <Select
              aria-label={t('notif.field.after')}
              value={prefs.postClassDelayMinutes ?? 10}
              onChange={(e) => {
                const v = Number(e.target.value);
                patchPrefs({ postClassDelayMinutes: v === 5 ? 5 : v === 15 ? 15 : 10 });
              }}
            >
              <option value={5}>{t('notif.minAfter', { count: 5 })}</option>
              <option value={10}>{t('notif.minAfter', { count: 10 })}</option>
              <option value={15}>{t('notif.minAfter', { count: 15 })}</option>
            </Select>
          </div>

          <div className="space-y-1 text-xs">
            <span className="block font-semibold text-muted">{t('notif.field.eveningHour')}</span>
            <Select
              aria-label={t('notif.field.eveningHour')}
              value={prefs.eveningHour ?? 20}
              onChange={(e) => patchPrefs({ eveningHour: Number(e.target.value) })}
            >
              {[18, 19, 20, 21, 22].map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:30
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1 text-xs">
            <span className="block font-semibold text-muted">{t('notif.field.quietFrom')}</span>
            <TimeField
              aria-label={t('notif.field.quietFrom')}
              value={prefs.quietStart}
              onChange={(val) => patchPrefs({ quietStart: val })}
            />
          </div>

          <div className="space-y-1 text-xs">
            <span className="block font-semibold text-muted">{t('notif.field.quietTo')}</span>
            <TimeField
              aria-label={t('notif.field.quietTo')}
              value={prefs.quietEnd}
              onChange={(val) => patchPrefs({ quietEnd: val })}
            />
          </div>

          <div className="flex items-end">
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              onClick={() => void handleTest()}
              disabled={testing}
            >
              <Bell size={15} />
              {t('notif.test')}
            </Button>
          </div>
        </div>

        {/* Pré-visualização ao vivo do estilo Duolingo adaptado à personalidade */}
        <div
          className={
            isMinimal
              ? 'rounded-2xl border border-dashed border-line bg-surface px-3.5 py-3'
              : 'rounded-2xl border border-dashed border-black/15 bg-pastel-butter/45 px-4 py-3 text-[#141312] dark:border-white/15 dark:bg-surface-2 dark:text-[#FAF6EC]'
          }
        >
          <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide opacity-75">
            <span>{t('notif.preview')}</span>
            <span>
              {prefs.enabled
                ? t('notif.scheduled', { count: scheduledPreview.length })
                : t('notif.example')}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-fg">{samplePreview.title}</p>
          <p className="text-xs text-muted">{samplePreview.body}</p>
        </div>
      </div>
    </Card>
  );
}
