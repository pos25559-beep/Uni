import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import { useStore } from '../../store/useStore';
import { fmtMinutes } from '../../lib/selectors';
import {
  getLocalizedScaleLabel,
  normalizeAppLanguage,
  resolveIntlLocale,
} from '../../lib/grading';
import { getLocalizedAccessories, getLocalizedPersonas } from '../../lib/uniAccessories';
import {
  getUniCollectibleStates,
  getUniPetStates,
  readCollectibleTelemetry,
} from '../../lib/uniCollectibles';
import type { AppLanguage, GradingScale } from '../../types';
import { UniBuddy, UniPetBuddy } from '../brand/UnipediaMarks';
import { Button, Card, DateField, Field, Input } from '../ui';
import { cx } from '../../lib/uiHelpers';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Segunda primeiro; o valor é o índice de Date.getDay().
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function ProfileCard() {
  const { t, i18n } = useTranslation(['settings', 'common', 'uni']);
  const appLang: AppLanguage = normalizeAppLanguage(i18n.language);
  const settings = useStore((s) => s.settings);
  const sessions = useStore((s) => s.sessions);
  const courses = useStore((s) => s.courses);
  const weeklyCheckIns = useStore((s) => s.weeklyCheckIns);
  const updateSettings = useStore((s) => s.updateSettings);
  const personas = getLocalizedPersonas(appLang);
  const accessories = getLocalizedAccessories(appLang);
  const telemetry = readCollectibleTelemetry(sessions, courses, weeklyCheckIns);
  const skinStates = getUniCollectibleStates(telemetry);
  const petStates = getUniPetStates(telemetry);
  const currentLang: AppLanguage = normalizeAppLanguage(settings.language ?? appLang);
  const currentScale: GradingScale = settings.gradingScale ?? 'pt20';
  const weekdayFmt = new Intl.DateTimeFormat(resolveIntlLocale(appLang), { weekday: 'short' });
  const dayLabel = (dayIndex: number) =>
    weekdayFmt
      .format(new Date(Date.UTC(2024, 0, 7 + dayIndex)))
      .replace(/\.$/, '');
  const [minutesDraftState, setMinutesDraftState] = useState<{ base: number; text: string }>({
    base: settings.dailyStudyMinutes,
    text: String(settings.dailyStudyMinutes),
  });
  const [editingMinutes, setEditingMinutes] = useState(false);
  const minutesText =
    editingMinutes || minutesDraftState.base === settings.dailyStudyMinutes
      ? minutesDraftState.text
      : String(settings.dailyStudyMinutes);
  const setMinutesText = (text: string) =>
    setMinutesDraftState({ base: settings.dailyStudyMinutes, text });
  const [userNameDraft, setUserNameDraft] = useState(settings.userName);
  const [semesterDraft, setSemesterDraft] = useState(settings.semesterName);
  const [editingField, setEditingField] = useState<'userName' | 'semesterName' | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches,
  );
  const supportsWebInstall =
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & { install?: () => Promise<void> }).install === 'function';

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    const navInstall = (navigator as Navigator & { install?: () => Promise<void> }).install;
    if (typeof navInstall === 'function') {
      try {
        await navInstall.call(navigator);
        return;
      } catch {
        // Utilizador cancelou ou plataforma recusou instalação direta
      }
    }
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setInstallPrompt(null);
    }
  };

  const endBeforeStart = settings.semesterEnd < settings.semesterStart;

  const onMinutes = (text: string) => {
    setMinutesText(text);
    const v = Number(text);
    if (text.trim() !== '' && Number.isFinite(v) && v >= 0 && v <= 1440) {
      updateSettings({ dailyStudyMinutes: Math.round(v) });
    }
  };

  const toggleDay = (day: number) => {
    const on = settings.studyDays.includes(day);
    const next = on ? settings.studyDays.filter((d) => d !== day) : [...settings.studyDays, day];
    updateSettings({ studyDays: [...next].sort((a, b) => a - b) });
  };

  return (
    <Card title={t('settings:profileTitle')}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('settings:nameLabel')}>
          <Input
            value={editingField === 'userName' ? userNameDraft : settings.userName}
            placeholder={t('settings:profileCard.namePlaceholder')}
            onFocus={() => {
              setUserNameDraft(settings.userName);
              setEditingField('userName');
            }}
            onChange={(e) => {
              const v = e.target.value;
              setUserNameDraft(v);
              updateSettings({ userName: v });
            }}
            onBlur={() => setEditingField(null)}
          />
        </Field>
        <Field label={t('settings:profileCard.semesterNameLabel')}>
          <Input
            value={editingField === 'semesterName' ? semesterDraft : settings.semesterName}
            placeholder={t('settings:profileCard.semesterPlaceholder')}
            onFocus={() => {
              setSemesterDraft(settings.semesterName);
              setEditingField('semesterName');
            }}
            onChange={(e) => {
              const v = e.target.value;
              setSemesterDraft(v);
              updateSettings({ semesterName: v });
            }}
            onBlur={() => setEditingField(null)}
          />
        </Field>
        <Field label={t('settings:profileCard.semesterStart')}>
          <DateField
            aria-label={t('settings:profileCard.semesterStart')}
            value={settings.semesterStart}
            onChange={(val) => val && updateSettings({ semesterStart: val })}
          />
        </Field>
        <Field
          label={t('settings:profileCard.semesterEnd')}
          hint={endBeforeStart ? <span className="text-warn">{t('settings:profileCard.endBeforeStart')}</span> : undefined}
        >
          <DateField
            aria-label={t('settings:profileCard.semesterEnd')}
            value={settings.semesterEnd}
            onChange={(val) => val && updateSettings({ semesterEnd: val })}
          />
        </Field>
        <Field
          label={t('settings:dailyMinutesLabel')}
          hint={t('settings:profileCard.dailyMinutesHint', { time: fmtMinutes(settings.dailyStudyMinutes) })}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={1440}
            step={15}
            value={minutesText}
            onFocus={() => setEditingMinutes(true)}
            onChange={(e) => onMinutes(e.target.value)}
            onBlur={() => {
              setEditingMinutes(false);
              setMinutesText(String(useStore.getState().settings.dailyStudyMinutes));
            }}
          />
        </Field>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted">{t('settings:studyDaysLabel')}</span>
          <div className="flex flex-wrap gap-1.5">
            {DAY_ORDER.map((day) => {
              const on = settings.studyDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(day)}
                  className={cx(
                    'min-h-[44px] min-w-11 flex-1 rounded-xl border text-xs font-medium transition sm:flex-none sm:px-3',
                    on
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line bg-surface-2 text-muted hover:text-fg',
                  )}
                >
                  {dayLabel(day)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Visual & Personalidade do Uni */}
      <div className="mt-5 space-y-3 border-t border-line pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-medium text-muted">{t('settings:profileCard.uniStyle')}</span>
            <p className="text-xs text-muted">
              {t('settings:profileCard.uniStyleHint')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => updateSettings({ uniAccessory: 'auto' })}
            className={cx(
              'min-h-[44px] rounded-full border px-3.5 text-xs font-semibold transition',
              (settings.uniAccessory ?? 'auto') === 'auto'
                ? 'border-accent bg-accent-soft text-accent-ink'
                : 'border-line bg-surface-2 text-muted hover:text-fg',
            )}
          >
            {t('settings:profileCard.autoPerCourse')}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {accessories.map((acc) => {
            const active = settings.uniAccessory === acc.id;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => updateSettings({ uniAccessory: acc.id })}
                className={cx(
                  'flex min-h-[44px] items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-medium transition',
                  active
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-2/60 text-fg hover:bg-surface-2',
                )}
              >
                <UniBuddy mood="happy" accessory={acc.id} size={28} interactive={false} />
                <span>{acc.shortLabel}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-xs font-medium text-muted">{t('settings:uniPersonaLabel')}</span>
          <div className="inline-flex flex-wrap gap-1 rounded-full bg-surface-2 p-1">
            {personas.map((p) => {
              const active = (settings.uniPersona ?? 'amigo') === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => updateSettings({ uniPersona: p.id })}
                  className={cx(
                    'min-h-11 rounded-full px-3 text-xs font-semibold transition',
                    active ? 'bg-ink-cta text-ink-cta-fg' : 'text-muted hover:text-fg',
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 12 Cores do Uni & 5 Micropets companheiros */}
        <div className="space-y-3 border-t border-line pt-4">
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted">
              {t('uni:shelf.tabLooks', { count: skinStates.filter((s) => s.unlocked).length })}
            </span>
            <div className="flex flex-wrap gap-2">
              {skinStates.map((item) => {
                const active = (settings.uniSkin ?? 'classic') === item.skin.id;
                return (
                  <button
                    key={item.skin.id}
                    type="button"
                    disabled={!item.unlocked}
                    onClick={() => {
                      if (item.unlocked) updateSettings({ uniSkin: item.skin.id });
                    }}
                    title={item.unlocked ? item.skin.name : item.skin.unlockHint}
                    className={cx(
                      'flex min-h-[44px] items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-medium transition',
                      active
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : item.unlocked
                          ? 'border-line bg-surface-2/60 text-fg hover:bg-surface-2'
                          : 'cursor-not-allowed border-line/50 bg-surface-2/30 opacity-55',
                    )}
                  >
                    <UniBuddy mood="happy" skin={item.skin.id} size={26} interactive={false} />
                    <span>{item.skin.name.replace(/^Uni\s+/i, '')}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <span className="text-xs font-medium text-muted">
              {t('uni:shelf.petsTitle', { defaultValue: 'Micropets Companheiros' })}
            </span>
            <div className="flex flex-wrap gap-2">
              {petStates.map((pState) => {
                const active = (settings.uniPet ?? 'cat') === pState.pet.id;
                return (
                  <button
                    key={pState.pet.id}
                    type="button"
                    disabled={!pState.unlocked}
                    onClick={() => {
                      if (pState.unlocked) updateSettings({ uniPet: pState.pet.id });
                    }}
                    title={pState.unlocked ? pState.pet.tagline : pState.pet.unlockHint}
                    className={cx(
                      'flex min-h-[44px] items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-medium transition',
                      active
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : pState.unlocked
                          ? 'border-line bg-surface-2/60 text-fg hover:bg-surface-2'
                          : 'cursor-not-allowed border-line/50 bg-surface-2/30 opacity-55',
                    )}
                  >
                    <UniPetBuddy pet={pState.pet.id} size={26} />
                    <span>{pState.pet.name}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => updateSettings({ uniPet: 'none' })}
                className={cx(
                  'flex min-h-[44px] items-center rounded-2xl border px-3 py-1.5 text-xs font-medium transition',
                  (settings.uniPet ?? 'cat') === 'none'
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-2/60 text-muted hover:text-fg',
                )}
              >
                {t('uni:shelf.noPetBtn', { defaultValue: 'Sem micropet' })}
              </button>
            </div>
          </div>
        </div>

        {/* Idioma da interface e escala de notas */}
        <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted">{t('settings:languageLabel')}</span>
            <p className="text-xs text-muted">{t('settings:languageHint')}</p>
            <div className="inline-flex flex-wrap gap-1 rounded-2xl bg-surface-2 p-1">
              {SUPPORTED_LANGUAGES.map((langOpt) => {
                const active = currentLang === langOpt;
                return (
                  <button
                    key={langOpt}
                    type="button"
                    onClick={() => updateSettings({ language: langOpt })}
                    className={cx(
                      'min-h-11 rounded-full px-3 text-xs font-semibold transition',
                      active ? 'bg-ink-cta text-ink-cta-fg' : 'text-muted hover:text-fg',
                    )}
                  >
                    {t(`common:languages.${langOpt}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted">{t('settings:gradingScaleLabel')}</span>
            <p className="text-xs text-muted">{t('settings:gradingScaleHint')}</p>
            <div className="inline-flex flex-wrap gap-1 rounded-2xl bg-surface-2 p-1">
              {(['pt20', 'scale10', 'pct100'] as GradingScale[]).map((scaleId) => {
                const active = currentScale === scaleId;
                return (
                  <button
                    key={scaleId}
                    type="button"
                    onClick={() => updateSettings({ gradingScale: scaleId })}
                    className={cx(
                      'min-h-11 rounded-full px-3 text-xs font-semibold transition',
                      active ? 'bg-ink-cta text-ink-cta-fg' : 'text-muted hover:text-fg',
                    )}
                  >
                    {getLocalizedScaleLabel(scaleId, appLang)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Companheiros discretos no ecrã */}
        <div className="space-y-3 border-t border-line pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div>
              <span className="text-xs font-medium text-muted">{t('settings:profileCard.companionsLabel')}</span>
              <p className="text-xs text-muted">
                {(settings.appTone ?? 'vibrante') === 'serio'
                  ? t('settings:profileCard.companionsPaused')
                  : t('settings:profileCard.companionsHint')}
              </p>
            </div>
            <div className="inline-flex rounded-full bg-surface-2 p-1">
              {(
                [
                  ['all', t('settings:profileCard.companionsAll')],
                  ['solo', t('settings:profileCard.companionsSolo')],
                  ['off', t('settings:profileCard.companionsOff')],
                ] as const
              ).map(([modeId, label]) => {
                const active = (settings.uniLiveCompanions ?? 'all') === modeId;
                return (
                  <button
                    key={modeId}
                    type="button"
                    onClick={() => updateSettings({ uniLiveCompanions: modeId })}
                    className={cx(
                      'min-h-11 rounded-full px-3 text-xs font-semibold transition',
                      active ? 'bg-ink-cta text-ink-cta-fg' : 'text-muted hover:text-fg',
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {!isInstalled && (supportsWebInstall || installPrompt) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-fg">{t('settings:profileCard.installTitle')}</span>
            <p className="text-xs text-muted">{t('settings:profileCard.installHint')}</p>
          </div>
          <Button size="sm" variant="primary" onClick={() => void handleInstallApp()}>
            <Download size={14} /> {t('settings:profileCard.installBtn')}
          </Button>
        </div>
      )}

    </Card>
  );
}
