import { Bell, BellOff, BookOpenCheck, CalendarHeart, Flame, GraduationCap, Clock, Moon, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Select, Switch } from '../ui';
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
      showToast('Lembretes inteligentes desativados.', 'neutral');
      return;
    }

    const perm = await requestUniNotificationPermission();
    setPermState(perm);
    if (perm === 'denied') {
      patchPrefs({ enabled: false });
      showToast(
        'Permissão bloqueada no dispositivo. Podes ativar nas definições do browser ou Android.',
        'danger',
      );
      return;
    }

    patchPrefs({ enabled: true });
    showToast(
      perm === 'granted'
        ? 'Lembretes inteligentes do Uni ativados!'
        : 'Preferências guardadas! Vais receber avisos discretos dentro da app.',
    );
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await sendTestUniNotification(plannerInput);
      const nextPerm = await getUniNotificationPermission();
      setPermState(nextPerm);
      if (res.delivered === 'native' || res.delivered === 'web') {
        showToast(`Notificação enviada: "${res.notification.title}"`);
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
      title={hideHeader ? undefined : 'Lembretes inteligentes do Uni'}
      className={isMinimal ? undefined : 'rounded-[26px] border-line/70'}
    >
      <div className="space-y-4">
        <p className="text-xs text-muted">
          Protege a tua sequência, revisões SRS, provas e aulas — sem spam.
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
              <p className="text-sm font-semibold text-fg">Ativar notificações adaptativas</p>
              <p className="text-xs text-muted">
                {permState === 'denied'
                  ? 'Bloqueadas no navegador/Android — usa apenas avisos discretos na app.'
                  : prefs.enabled
                    ? `Ativo · máximo ${prefs.maxDailyNudges}/dia · silêncio ${prefs.quietStart}–${prefs.quietEnd}`
                    : 'Opt-in: só agenda lembretes quando ligas este interruptor.'}
              </p>
            </div>
          </div>
          <Switch
            checked={prefs.enabled}
            onCheckedChange={(v) => void handleMasterToggle(v)}
            label="Ativar notificações adaptativas do Uni"
          />
        </div>

        {/* Categorias granulares */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
              <Flame size={16} className="text-coral" />
              <span>Sequência diária</span>
            </span>
            <Switch
              checked={prefs.streakSaver}
              onCheckedChange={(v) => patchPrefs({ streakSaver: v })}
              label="Proteção de sequência diária"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
              <Sparkles size={16} className="text-forest" />
              <span>Revisões SRS do dia</span>
            </span>
            <Switch
              checked={prefs.srsDue}
              onCheckedChange={(v) => patchPrefs({ srsDue: v })}
              label="Resumo de revisões espaçadas"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
              <GraduationCap size={16} className="text-cobalt" />
              <span>Testes e exames</span>
            </span>
            <Switch
              checked={prefs.assessments}
              onCheckedChange={(v) => patchPrefs({ assessments: v })}
              label="Contagem decrescente de provas"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
              <Clock size={16} className="text-honey-ink" />
              <span>Aulas com sala</span>
            </span>
            <Switch
              checked={prefs.classReminders}
              onCheckedChange={(v) => patchPrefs({ classReminders: v })}
              label="Avisos antes das aulas"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
              <BookOpenCheck size={16} className="text-forest" />
              <span>Pergunta pós-aula</span>
            </span>
            <Switch
              checked={prefs.postClassCheckIn ?? true}
              onCheckedChange={(v) => patchPrefs({ postClassCheckIn: v })}
              label="Pergunta pós-aula sobre a matéria dada"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
              <Moon size={16} className="text-coral" />
              <span>Fim do dia (diário)</span>
            </span>
            <Switch
              checked={prefs.eveningCheckIn ?? true}
              onCheckedChange={(v) => patchPrefs({ eveningCheckIn: v })}
              label="Balanço do final do dia"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
              <CalendarHeart size={16} className="text-cobalt" />
              <span>Balanço de domingo</span>
            </span>
            <Switch
              checked={prefs.sundayReview ?? true}
              onCheckedChange={(v) => patchPrefs({ sundayReview: v })}
              label="Balanço semanal ao domingo"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
              <GraduationCap size={16} className="text-coral" />
              <span>Alinhamento Modo Teste</span>
            </span>
            <Switch
              checked={prefs.examPrepCheckIn ?? true}
              onCheckedChange={(v) => patchPrefs({ examPrepCheckIn: v })}
              label="Perguntar até que matéria sai em Modo Teste"
            />
          </label>
        </div>

        {/* Cadência e silêncio */}
        <div className="grid gap-3 rounded-2xl border border-line/75 bg-surface-2/40 p-3.5 sm:grid-cols-3">
          <div className="space-y-1 text-xs">
            <span className="block font-semibold text-muted">Hora do empurrão diário</span>
            <Select
              aria-label="Hora do empurrão diário"
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
            <span className="block font-semibold text-muted">Antes da aula</span>
            <Select
              aria-label="Antes da aula"
              value={prefs.classBeforeMinutes}
              onChange={(e) =>
                patchPrefs({ classBeforeMinutes: Number(e.target.value) === 30 ? 30 : 15 })
              }
            >
              <option value={15}>15 minutos antes</option>
              <option value={30}>30 minutos antes</option>
            </Select>
          </div>

          <div className="space-y-1 text-xs">
            <span className="block font-semibold text-muted">Máximo por dia</span>
            <Select
              aria-label="Máximo por dia"
              value={prefs.maxDailyNudges}
              onChange={(e) => {
                const v = Number(e.target.value);
                patchPrefs({
                  maxDailyNudges:
                    v === 1 || v === 2 || v === 3 || v === 4 || v === 6 ? v : 4,
                });
              }}
            >
              <option value={1}>1 aviso/dia</option>
              <option value={2}>2 avisos/dia</option>
              <option value={3}>3 avisos/dia</option>
              <option value={4}>4 avisos/dia</option>
              <option value={6}>6 avisos/dia</option>
            </Select>
          </div>

          <div className="space-y-1 text-xs">
            <span className="block font-semibold text-muted">Após a aula</span>
            <Select
              aria-label="Após a aula"
              value={prefs.postClassDelayMinutes ?? 10}
              onChange={(e) => {
                const v = Number(e.target.value);
                patchPrefs({ postClassDelayMinutes: v === 5 ? 5 : v === 15 ? 15 : 10 });
              }}
            >
              <option value={5}>5 min depois</option>
              <option value={10}>10 min depois</option>
              <option value={15}>15 min depois</option>
            </Select>
          </div>

          <div className="space-y-1 text-xs">
            <span className="block font-semibold text-muted">Hora fim do dia</span>
            <Select
              aria-label="Hora fim do dia"
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

          <label className="space-y-1 text-xs">
            <span className="block font-semibold text-muted">Silêncio desde</span>
            <input
              type="time"
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-fg"
              value={prefs.quietStart}
              onChange={(e) => patchPrefs({ quietStart: e.target.value })}
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="font-semibold text-muted">Silêncio até</span>
            <input
              type="time"
              className="w-full rounded-xl border border-line bg-surface px-2.5 py-1.5 text-sm text-fg"
              value={prefs.quietEnd}
              onChange={(e) => patchPrefs({ quietEnd: e.target.value })}
            />
          </label>

          <div className="flex items-end">
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              onClick={() => void handleTest()}
              disabled={testing}
            >
              <Bell size={15} />
              Testar notificação agora
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
            <span>Pré-visualização ao vivo</span>
            <span>
              {prefs.enabled
                ? `${scheduledPreview.length} agendada(s) nas próximas 72h`
                : 'Exemplo imediato'}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-fg">{samplePreview.title}</p>
          <p className="text-xs text-muted">{samplePreview.body}</p>
        </div>
      </div>
    </Card>
  );
}
