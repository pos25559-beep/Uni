import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { APP_PALETTES } from '../../lib/academicCredits';
import { fmtMinutes } from '../../lib/selectors';
import { weekdayShort } from '../../lib/colors';
import { UNI_ACCESSORIES, UNI_PERSONAS } from '../../lib/uniAccessories';
import { UniBuddy } from '../brand/UnipediaMarks';
import { Button, Card, Field, Input, cx } from '../ui';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Segunda primeiro; o valor é o índice de Date.getDay().
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function ProfileCard() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const [minutesText, setMinutesText] = useState(String(settings.dailyStudyMinutes));
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
            value={settings.userName}
            placeholder="Como te devemos chamar?"
            onChange={(e) => updateSettings({ userName: e.target.value })}
          />
        </Field>
        <Field label="Nome do semestre">
          <Input
            value={settings.semesterName}
            onChange={(e) => updateSettings({ semesterName: e.target.value })}
          />
        </Field>
        <Field label="Início do semestre">
          <Input
            type="date"
            value={settings.semesterStart}
            onChange={(e) => e.target.value && updateSettings({ semesterStart: e.target.value })}
          />
        </Field>
        <Field
          label="Fim do semestre"
          hint={endBeforeStart ? <span className="text-warn">O fim é anterior ao início.</span> : undefined}
        >
          <Input
            type="date"
            value={settings.semesterEnd}
            onChange={(e) => e.target.value && updateSettings({ semesterEnd: e.target.value })}
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
          <span className="text-xs font-medium text-muted">Personalidade no Tutor</span>
          <div className="inline-flex flex-wrap gap-1 rounded-full bg-surface-2 p-1">
            {UNI_PERSONAS.map((p) => {
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

        {/* Paleta de cores & Companheiros discretos */}
        <div className="space-y-3 border-t border-line pt-4">
          <div>
            <span className="text-xs font-medium text-muted">Paleta de cores</span>
            <p className="text-xs text-muted">
              Escolhe entre o caderno quente ou paletas mais minimalistas e sóbrias.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {APP_PALETTES.map((pal) => {
                const active = (settings.themePalette ?? 'caderno') === pal.id;
                return (
                  <button
                    key={pal.id}
                    type="button"
                    onClick={() => updateSettings({ themePalette: pal.id })}
                    className={cx(
                      'flex min-h-[44px] items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition',
                      active
                        ? 'border-accent bg-accent-soft/60 text-fg'
                        : 'border-line bg-surface-2/60 text-fg hover:bg-surface-2',
                    )}
                  >
                    <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
                      <span
                        className="size-4 rounded-full border border-black/15"
                        style={{ backgroundColor: pal.bgHex }}
                      />
                      <span
                        className="size-4 rounded-full border border-black/15"
                        style={{ backgroundColor: pal.accentHex }}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">{pal.name}</span>
                      <span className="block truncate text-xs text-muted">{pal.tagline}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

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
