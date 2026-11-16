import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { fmtMinutes } from '../../lib/selectors';
import { GRADE_SCALES } from '../../lib/grading';
import { weekdayShort } from '../../lib/colors';
import { getLocalizedPersonas, UNI_ACCESSORIES } from '../../lib/uniAccessories';
import type { AppLanguage, GradingScale } from '../../types';
import { UniBuddy } from '../brand/UnipediaMarks';
import { Button, Card, DateField, Field, Input } from '../ui';
import { cx } from '../../lib/uiHelpers';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Segunda primeiro; o valor é o índice de Date.getDay().
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function ProfileCard() {
  const { t, i18n } = useTranslation(['settings', 'common']);
  const appLang: AppLanguage = i18n.language?.startsWith('en') ? 'en' : 'pt-PT';
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const personas = getLocalizedPersonas(appLang);
  const currentLang: AppLanguage = settings.language ?? 'pt-PT';
  const currentScale: GradingScale = settings.gradingScale ?? 'pt20';
  const [minutesText, setMinutesText] = useState(String(settings.dailyStudyMinutes));
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
    <Card title="Perfil e semestre">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome">
          <Input
            value={editingField === 'userName' ? userNameDraft : settings.userName}
            placeholder="Como te devemos chamar?"
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
        <Field label="Nome do semestre">
          <Input
            value={editingField === 'semesterName' ? semesterDraft : settings.semesterName}
            placeholder="Ex.: 2026/27 · 1.º Semestre"
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
        <Field label="Início do semestre">
          <DateField
            aria-label="Início do semestre"
            value={settings.semesterStart}
            onChange={(val) => val && updateSettings({ semesterStart: val })}
          />
        </Field>
        <Field
          label="Fim do semestre"
          hint={endBeforeStart ? <span className="text-warn">O fim é anterior ao início.</span> : undefined}
        >
          <DateField
            aria-label="Fim do semestre"
            value={settings.semesterEnd}
            onChange={(val) => val && updateSettings({ semesterEnd: val })}
          />
        </Field>
        <Field
          label="Tempo de estudo por dia (minutos)"
          hint={`Equivale a ${fmtMinutes(settings.dailyStudyMinutes)} por dia.`}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={1440}
            step={15}
            value={minutesText}
            onChange={(e) => onMinutes(e.target.value)}
          />
        </Field>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted">Dias de estudo</span>
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
                  {weekdayShort[day]}
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
            <span className="text-xs font-medium text-muted">Estilo do Uni</span>
            <p className="text-xs text-muted">
              Muda o chapéu ou adereço automaticamente pela cadeira ou fixa o teu preferido.
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
            Automático por cadeira
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {UNI_ACCESSORIES.map((acc) => {
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
                    'min-h-[40px] rounded-full px-3 text-xs font-semibold transition',
                    active ? 'bg-ink-cta text-ink-cta-fg' : 'text-muted hover:text-fg',
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Idioma da interface e escala de notas */}
        <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted">{t('settings:languageLabel')}</span>
            <p className="text-xs text-muted">{t('settings:languageHint')}</p>
            <div className="inline-flex rounded-full bg-surface-2 p-1">
              {(['pt-PT', 'en'] as AppLanguage[]).map((langOpt) => {
                const active = currentLang === langOpt;
                return (
                  <button
                    key={langOpt}
                    type="button"
                    onClick={() => updateSettings({ language: langOpt })}
                    className={cx(
                      'min-h-11 rounded-full px-3.5 text-xs font-semibold transition',
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
            <div className="inline-flex flex-wrap gap-1 rounded-full bg-surface-2 p-1">
              {(['pt20', 'scale10', 'pct100'] as GradingScale[]).map((scaleId) => {
                const active = currentScale === scaleId;
                const meta = GRADE_SCALES[scaleId];
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
                    {appLang === 'en' ? meta.labelEn : meta.label}
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
              <span className="text-xs font-medium text-muted">Unis discretos no ecrã</span>
              <p className="text-xs text-muted">
                {(settings.appTone ?? 'vibrante') === 'serio'
                  ? 'Em pausa porque o estilo Sério & Minimal está ativo.'
                  : 'Companheiros tímidos nos cantos que se escondem quando escreves ou fazes scroll.'}
              </p>
            </div>
            <div className="inline-flex rounded-full bg-surface-2 p-1">
              {(
                [
                  ['all', 'Até 2'],
                  ['solo', 'Só 1'],
                  ['off', 'Desligado'],
                ] as const
              ).map(([modeId, label]) => {
                const active = (settings.uniLiveCompanions ?? 'all') === modeId;
                return (
                  <button
                    key={modeId}
                    type="button"
                    onClick={() => updateSettings({ uniLiveCompanions: modeId })}
                    className={cx(
                      'min-h-[40px] rounded-full px-3 text-xs font-semibold transition',
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
            <span className="text-xs font-medium text-fg">Instalar aplicação Unipedia</span>
            <p className="text-xs text-muted">Acede offline e como app dedicada no teu dispositivo.</p>
          </div>
          <Button size="sm" variant="primary" onClick={() => void handleInstallApp()}>
            <Download size={14} /> Instalar Unipedia
          </Button>
        </div>
      )}

    </Card>
  );
}
