import { AlertCircle, Clock, Cloud, Loader2, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LEGAL_INFO } from '../../../lib/legal';
import { hapticTap } from '../../../lib/nativeBridge';
import { useStore } from '../../../store/useStore';
import { StickerBadge } from '../../motion/Primitives';
import { Button, Field, Input, Textarea } from '../../ui';
import { cx } from '../../../lib/uiHelpers';

const STUDY_DAY_NUMS = [1, 2, 3, 4, 5, 6, 0] as const;

const DAILY_PRESETS = [
  { minutes: 90, label: '1h30' },
  { minutes: 120, label: '2h' },
  { minutes: 180, label: '3h' },
  { minutes: 240, label: '4h' },
];

interface Step4RhythmPrivacyProps {
  dailyMinutes: number;
  setDailyMinutes: (min: number) => void;
  studyDays: number[];
  onToggleStudyDay: (day: number) => void;
  activeCandidates: Array<{ key: string; label: string }>;
  difficultKeys: string[];
  onToggleDifficult: (key: string) => void;
  difficultNotes: string;
  setDifficultNotes: (val: string) => void;
  academicMailConnected: boolean;
  academicEmail?: string;
  academicHint: string;
  setAcademicHint: (val: string) => void;
  academicBusy: boolean;
  onConnectAcademic: () => void;
  ageConfirmed: boolean;
  setAgeConfirmed: (val: boolean) => void;
  aiConsent: boolean;
  setAiConsent: (val: boolean) => void;
  cloudSyncConsent: boolean;
  setCloudSyncConsent: (val: boolean) => void;
  isSignedIn: boolean;
  personalEmail?: string;
  submitAttempted: boolean;
  onOpenLegal: (kind: 'privacy' | 'terms') => void;
}

export default function Step4RhythmPrivacy({
  dailyMinutes,
  setDailyMinutes,
  studyDays,
  onToggleStudyDay,
  activeCandidates,
  difficultKeys,
  onToggleDifficult,
  difficultNotes,
  setDifficultNotes,
  academicMailConnected,
  academicEmail,
  academicHint,
  setAcademicHint,
  academicBusy,
  onConnectAcademic,
  ageConfirmed,
  setAgeConfirmed,
  aiConsent,
  setAiConsent,
  cloudSyncConsent,
  setCloudSyncConsent,
  isSignedIn,
  personalEmail,
  submitAttempted,
  onOpenLegal,
}: Step4RhythmPrivacyProps) {
  const { t } = useTranslation('onboarding');
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');

  return (
    <div className="space-y-5">
      {/* Ritmo diário e dias livres */}
      <div
        className={cx(
          'space-y-4 overflow-hidden p-4 shadow-card sm:p-5',
          isMinimal
            ? 'rounded-[22px] border border-line bg-surface'
            : 'rounded-[26px] border border-line/70 bg-surface',
        )}
      >
        <div
          className={cx(
            !isMinimal &&
              '-mx-4 -mt-4 border-b border-black/5 bg-pastel-mint/70 px-4 py-4 text-[#141312] dark:border-white/10 dark:bg-surface-2 dark:text-[#FAF6EC] sm:-mx-5 sm:-mt-5 sm:px-5',
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-accent-ink dark:text-accent" />
              <h2 className="font-display text-xl font-bold">{t('s4.title')}</h2>
            </div>
            {!isMinimal && (
              <StickerBadge tone="butter" tilt={-2}>
                {t('s4.badge')}
              </StickerBadge>
            )}
          </div>
          <p className="mt-1 text-xs opacity-80">
            {t('s4.intro')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {DAILY_PRESETS.map((preset) => {
            const selected = dailyMinutes === preset.minutes;
            return (
              <button
                key={preset.minutes}
                type="button"
                onClick={() => {
                  void hapticTap();
                  setDailyMinutes(preset.minutes);
                }}
                className={cx(
                  'min-h-[60px] rounded-2xl border p-3 text-left transition',
                  selected
                    ? 'border-accent bg-accent-soft text-accent-ink ring-1 ring-accent'
                    : 'border-line bg-surface-2/60 text-fg hover:border-muted/50',
                )}
              >
                <span className="block font-display text-lg font-extrabold tabular">
                  {preset.label}
                </span>
                <span className="block text-xs text-muted">{t(`s4.preset.${preset.minutes}`)}</span>
              </button>
            );
          })}
        </div>

        <div>
          <span className="block text-xs font-medium text-muted">{t('s4.days')}</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STUDY_DAY_NUMS.map((day) => {
              const active = studyDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => onToggleStudyDay(day)}
                  className={cx(
                    'min-h-11 min-w-11 rounded-xl border px-3 text-xs font-bold transition',
                    active
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line bg-surface-2 text-muted hover:text-fg',
                  )}
                >
                  {t(`s4.day.${day}`)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cadeiras mais exigentes */}
      {activeCandidates.length > 0 && (
        <div className="space-y-3 rounded-[24px] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
          <h3 className="font-display text-base font-bold text-fg">
            {t('s4.hard')}
          </h3>
          <p className="text-xs text-muted">
            {t('s4.hardHint')}
          </p>
          <div className="flex flex-wrap gap-2">
            {activeCandidates.map((c) => {
              const selected = difficultKeys.includes(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => onToggleDifficult(c.key)}
                  className={cx(
                    'min-h-11 rounded-full border px-3.5 text-xs font-semibold transition',
                    selected
                      ? 'border-coral bg-coral-soft text-coral-ink'
                      : 'border-line bg-surface-2 text-muted hover:text-fg',
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          <Field label={t('s4.notes')}>
            <Textarea
              rows={2}
              value={difficultNotes}
              onChange={(e) => setDifficultNotes(e.target.value)}
              placeholder={t('s4.notesPh')}
            />
          </Field>
        </div>
      )}

      {/* Email institucional opcional */}
      <div className="space-y-3 rounded-[24px] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className="flex items-center gap-2">
          <Mail size={17} className="text-accent-ink" />
          <h3 className="font-display text-base font-bold text-fg">{t('s4.mailTitle')}</h3>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          {t('s4.mailBody')}
        </p>
        {academicMailConnected && academicEmail ? (
          <div className="rounded-xl bg-ok/10 px-3 py-2 text-xs font-semibold text-ok">
            {t('s4.connected', { email: academicEmail })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Input
              type="email"
              value={academicHint}
              onChange={(e) => setAcademicHint(e.target.value)}
              placeholder={t('s4.mailPh')}
              className="min-w-[200px] flex-1"
            />
            <Button size="sm" variant="secondary" onClick={onConnectAcademic} disabled={academicBusy}>
              {academicBusy && <Loader2 size={14} className="animate-spin" />}
              {t('s4.connect')}
            </Button>
          </div>
        )}
      </div>

      {/* Privacidade e RGPD (com opt-in explícito e linguagem acessível) */}
      <div
        className={cx(
          'space-y-3 p-4 shadow-card sm:p-5',
          isMinimal
            ? 'rounded-[22px] border border-line bg-surface'
            : 'rounded-[26px] bg-pastel-butter/45 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]',
        )}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-accent-ink dark:text-accent" />
          <h3 className="font-display text-base font-bold">{t('s4.privacyTitle')}</h3>
        </div>

        {/* Idade mínima obrigatória (aviso apenas se tentar avançar sem confirmar) */}
        <label
          className={cx(
            'flex min-h-[52px] cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition',
            submitAttempted && !ageConfirmed
              ? 'border-coral bg-coral-soft/60'
              : 'border-line bg-surface-2/60 hover:border-muted/50',
          )}
        >
          <input
            id="onboarding-age-confirm"
            type="checkbox"
            checked={ageConfirmed}
            aria-invalid={submitAttempted && !ageConfirmed}
            aria-describedby={submitAttempted && !ageConfirmed ? 'onboarding-age-error' : undefined}
            onChange={(e) => setAgeConfirmed(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-accent"
          />
          <span className="text-xs leading-relaxed text-fg">
            <strong>{t('s4.ageTitle', { age: LEGAL_INFO.minimumAgePT })}</strong>{' '}
            {t('s4.ageBody', { age: LEGAL_INFO.minimumAgePT })}
          </span>
        </label>

        {submitAttempted && !ageConfirmed && (
          <p id="onboarding-age-error" role="alert" className="flex items-center gap-1.5 px-1 text-xs font-semibold text-coral-ink">
            <AlertCircle size={14} aria-hidden="true" /> {t('s4.ageError')}
          </p>
        )}

        {/* IA opt-in explícito (desligado por predefinição) */}
        <label className="flex min-h-[52px] cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface-2/60 p-3.5 transition hover:border-muted/50">
          <input
            type="checkbox"
            checked={aiConsent}
            onChange={(e) => setAiConsent(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-accent"
          />
          <span className="text-xs leading-relaxed text-fg">
            <strong className="inline-flex items-center gap-1">
              <Sparkles size={13} className="text-accent-ink" /> {t('s4.aiTitle')}
            </strong>{' '}
            {t('s4.aiBody')}
          </span>
        </label>

        {/* Sincronização na nuvem opt-in */}
        <label className="flex min-h-[52px] cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface-2/60 p-3.5 transition hover:border-muted/50">
          <input
            type="checkbox"
            checked={cloudSyncConsent}
            onChange={(e) => setCloudSyncConsent(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-accent"
          />
          <span className="text-xs leading-relaxed text-fg">
            <strong className="inline-flex items-center gap-1">
              <Cloud size={13} className="text-accent-ink" /> {t('s4.cloudTitle')}
            </strong>{' '}
            {isSignedIn && personalEmail
              ? t('s4.cloudSigned', { email: personalEmail })
              : t('s4.cloudLater')}
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <button
            type="button"
            onClick={() => onOpenLegal('privacy')}
            className="min-h-11 rounded-xl px-2 font-semibold text-accent-ink hover:underline"
          >
            {t('s4.readPrivacy')}
          </button>
          <span aria-hidden="true" className="text-muted">·</span>
          <button
            type="button"
            onClick={() => onOpenLegal('terms')}
            className="min-h-11 rounded-xl px-2 font-semibold text-accent-ink hover:underline"
          >
            {t('s4.terms')}
          </button>
        </div>
      </div>
    </div>
  );
}
