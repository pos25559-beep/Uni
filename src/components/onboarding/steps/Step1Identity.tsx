import { Palette, Sparkles, Sun, Moon, Monitor } from 'lucide-react';
import { APP_PALETTES } from '../../../lib/academicCredits';
import { hapticTap } from '../../../lib/nativeBridge';
import {
  UNI_ACCESSORIES,
  UNI_PERSONAS,
  type UniAccessoryId,
  type UniPersonaMode,
} from '../../../lib/uniAccessories';
import type { AppTone, Settings, ThemePalette, UniLiveCompanionsMode } from '../../../types';
import { UniBuddy } from '../../brand/UnipediaMarks';
import { StickerBadge } from '../../motion/Primitives';
import { Field, Input, cx } from '../../ui';

interface Step1IdentityProps {
  userName: string;
  setUserName: (name: string) => void;
  themePref: Settings['theme'];
  setThemePref: (theme: Settings['theme']) => void;
  themePalette: ThemePalette;
  setThemePalette: (palette: ThemePalette) => void;
  appTone: AppTone;
  setAppTone: (tone: AppTone) => void;
  uniAccessory: 'auto' | UniAccessoryId;
  setUniAccessory: (acc: 'auto' | UniAccessoryId) => void;
  uniPersona: UniPersonaMode;
  setUniPersona: (persona: UniPersonaMode) => void;
  uniLiveCompanions: UniLiveCompanionsMode;
  setUniLiveCompanions: (mode: UniLiveCompanionsMode) => void;
}

const THEME_OPTIONS: Array<{ id: Settings['theme']; label: string; icon: typeof Monitor }> = [
  { id: 'system', label: 'Sistema', icon: Monitor },
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'dark', label: 'Escuro', icon: Moon },
];

const TONE_OPTIONS: Array<{ id: AppTone; label: string; hint: string }> = [
  { id: 'vibrante', label: 'Expressivo', hint: 'Pastéis vivos, movimento tátil e Uni ativo' },
  { id: 'serio', label: 'Sério & Minimal', hint: 'Superfícies neutras, foco calmo e sem distrações' },
];

export default function Step1Identity({
  userName,
  setUserName,
  themePref,
  setThemePref,
  themePalette,
  setThemePalette,
  appTone,
  setAppTone,
  uniAccessory,
  setUniAccessory,
  uniPersona,
  setUniPersona,
  uniLiveCompanions,
  setUniLiveCompanions,
}: Step1IdentityProps) {
  const previewAcc = uniAccessory === 'auto' ? 'default' : uniAccessory;
  const isMinimal = appTone === 'serio';

  return (
    <div className="space-y-5">
      {/* Cartão de apresentação com o Uni ao vivo */}
      <div
        className={cx(
          'flex flex-col items-center gap-4 p-5 text-center shadow-card sm:flex-row sm:text-left',
          isMinimal
            ? 'rounded-[22px] border border-line bg-surface text-fg'
            : 'rounded-[26px] bg-pastel-butter/75 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]',
        )}
      >
        <div
          className={cx(
            'flex size-24 shrink-0 items-center justify-center rounded-full',
            isMinimal ? 'border border-line bg-surface-2' : 'bg-white/80 shadow-card dark:bg-black/25',
          )}
        >
          <UniBuddy mood="happy" accessory={previewAcc} size={76} interactive={false} />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          {isMinimal ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">
              <Sparkles size={13} /> Passo 1 · Em 2 minutos
            </span>
          ) : (
            <StickerBadge tone="sage" tilt={-2}>
              <Sparkles size={12} /> Passo 1 · Em 2 minutos
            </StickerBadge>
          )}
          <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
            Olá! Como queres que o teu{' '}
            <span className={cx(!isMinimal && 'font-serif font-medium italic')}>caderno</span> te trate?
          </h2>
          <p className="text-xs leading-relaxed opacity-80 sm:text-sm">
            Escolhe o teu nome, as cores do caderno e o estilo do Uni. Podes mudar tudo mais tarde.
          </p>
        </div>
      </div>

      {/* Nome */}
      <div className="rounded-[24px] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
        <Field label="O teu primeiro nome (ou alcunha)">
          <Input
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Ex.: Clara ou Duarte"
            autoComplete="given-name"
          />
        </Field>
      </div>

      {/* Tema e Paleta ao vivo */}
      <div className="space-y-4 rounded-[24px] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className="flex items-center gap-2">
          <Palette size={16} className="text-accent-ink" />
          <h3 className="font-display text-base font-bold text-fg">Ambiente e paleta</h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((t) => {
            const Icon = t.icon;
            const active = themePref === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  void hapticTap();
                  setThemePref(t.id);
                }}
                className={cx(
                  'flex min-h-11 items-center justify-center gap-1 whitespace-nowrap rounded-xl border px-2 text-xs font-semibold transition sm:gap-1.5 sm:px-3',
                  active
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-2 text-muted hover:text-fg',
                )}
              >
                <Icon size={15} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {APP_PALETTES.map((pal) => {
            const active = themePalette === pal.id;
            return (
              <button
                key={pal.id}
                type="button"
                onClick={() => {
                  void hapticTap();
                  setThemePalette(pal.id);
                }}
                className={cx(
                  'flex min-h-[54px] items-center gap-2.5 rounded-2xl border p-3 text-left transition',
                  active
                    ? 'border-accent bg-accent-soft/60 ring-1 ring-accent'
                    : 'border-line bg-surface-2/60 hover:border-muted/50',
                )}
              >
                <div className="flex shrink-0 -space-x-1.5">
                  <span
                    className="size-4 rounded-full border border-black/15"
                    style={{ backgroundColor: pal.bgHex }}
                  />
                  <span
                    className="size-4 rounded-full border border-black/15"
                    style={{ backgroundColor: pal.accentHex }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-fg">{pal.name}</span>
                  <span className="block truncate text-xs text-muted">{pal.tagline}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {TONE_OPTIONS.map((t) => {
            const active = appTone === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  void hapticTap();
                  setAppTone(t.id);
                  if (t.id === 'serio') setUniLiveCompanions('off');
                  else if (uniLiveCompanions === 'off') setUniLiveCompanions('all');
                }}
                className={cx(
                  'min-h-[52px] rounded-2xl border px-3 py-2 text-left transition',
                  active
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-2/60 text-fg hover:border-muted/50',
                )}
              >
                <span className="block text-xs font-bold">{t.label}</span>
                <span className="block text-xs text-muted">{t.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Personalidade do Uni */}
      <div className="space-y-3 rounded-[24px] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
        <h3 className="font-display text-base font-bold text-fg">Estilo e voz do Uni</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {UNI_PERSONAS.map((p) => {
            const active = uniPersona === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  void hapticTap();
                  setUniPersona(p.id);
                }}
                className={cx(
                  'min-h-[54px] rounded-2xl border px-3 py-2.5 text-left transition',
                  active
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-2/60 text-fg hover:border-muted/50',
                )}
              >
                <span className="block text-xs font-bold">{p.label}</span>
                <span className="block text-xs text-muted">{p.hint}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => {
              void hapticTap();
              setUniAccessory('auto');
            }}
            className={cx(
              'min-h-11 rounded-full border px-3.5 text-xs font-semibold transition',
              uniAccessory === 'auto'
                ? 'border-accent bg-accent-soft text-accent-ink'
                : 'border-line bg-surface-2 text-muted hover:text-fg',
            )}
          >
            Automático pela área
          </button>
          {UNI_ACCESSORIES.filter((a) => a.id !== 'default').map((acc) => {
            const active = uniAccessory === acc.id;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => {
                  void hapticTap();
                  setUniAccessory(acc.id);
                }}
                className={cx(
                  'min-h-11 rounded-full border px-3.5 text-xs font-semibold transition',
                  active
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-2 text-muted hover:text-fg',
                )}
              >
                {acc.shortLabel}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
