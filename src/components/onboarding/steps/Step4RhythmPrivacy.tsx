import { AlertCircle, Clock, Cloud, Loader2, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { LEGAL_INFO } from '../../../lib/legal';
import { hapticTap } from '../../../lib/nativeBridge';
import { Button, Field, Input, Textarea, cx } from '../../ui';

const DAY_LABELS = [
  { day: 1, label: 'Seg' },
  { day: 2, label: 'Ter' },
  { day: 3, label: 'Qua' },
  { day: 4, label: 'Qui' },
  { day: 5, label: 'Sex' },
  { day: 6, label: 'Sáb' },
  { day: 0, label: 'Dom' },
];

const DAILY_PRESETS = [
  { minutes: 90, label: '1h30', hint: 'Leve' },
  { minutes: 120, label: '2h', hint: 'Constante' },
  { minutes: 180, label: '3h', hint: 'Recomendado' },
  { minutes: 240, label: '4h', hint: 'Intensivo' },
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
  return (
    <div className="space-y-5">
      {/* Ritmo diário e dias livres */}
      <div className="space-y-4 rounded-[24px] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-accent-ink" />
          <h2 className="font-display text-xl font-bold text-fg">O teu ritmo semanal</h2>
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
                <span className="block text-xs text-muted">{preset.hint}</span>
              </button>
            );
          })}
        </div>

        <div>
          <span className="block text-xs font-medium text-muted">Dias disponíveis para estudar</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DAY_LABELS.map((d) => {
              const active = studyDays.includes(d.day);
              return (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => onToggleStudyDay(d.day)}
                  className={cx(
                    'min-h-11 min-w-11 rounded-xl border px-3 text-xs font-bold transition',
                    active
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line bg-surface-2 text-muted hover:text-fg',
                  )}
                >
                  {d.label}
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
            Alguma cadeira mais exigente? (opcional)
          </h3>
          <p className="text-xs text-muted">
            O planeador dá prioridade extra e blocos mais curtos às cadeiras que selecionares aqui.
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
          <Field label="Notas para o Uni (opcional)">
            <Textarea
              rows={2}
              value={difficultNotes}
              onChange={(e) => setDifficultNotes(e.target.value)}
              placeholder="Ex.: preciso de reforço em séries ou física antes dos testes"
            />
          </Field>
        </div>
      )}

      {/* Email institucional opcional */}
      <div className="space-y-3 rounded-[24px] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className="flex items-center gap-2">
          <Mail size={17} className="text-accent-ink" />
          <h3 className="font-display text-base font-bold text-fg">Correio da escola/faculdade (opcional)</h3>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          Podes ligar o teu email académico para ver avisos importantes no separador Hoje, ou deixar para mais tarde nas Definições.
        </p>
        {academicMailConnected && academicEmail ? (
          <div className="rounded-xl bg-ok/10 px-3 py-2 text-xs font-semibold text-ok">
            Ligado: {academicEmail}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Input
              type="email"
              value={academicHint}
              onChange={(e) => setAcademicHint(e.target.value)}
              placeholder="Ex.: a12345@escola.pt (opcional)"
              className="min-w-[200px] flex-1"
            />
            <Button size="sm" variant="secondary" onClick={onConnectAcademic} disabled={academicBusy}>
              {academicBusy && <Loader2 size={14} className="animate-spin" />}
              Ligar agora
            </Button>
          </div>
        )}
      </div>

      {/* Privacidade e RGPD (com opt-in explícito e linguagem acessível) */}
      <div className="space-y-3 rounded-[24px] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-accent-ink" />
          <h3 className="font-display text-base font-bold text-fg">Privacidade e controlo dos teus dados</h3>
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
            type="checkbox"
            checked={ageConfirmed}
            onChange={(e) => setAgeConfirmed(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-accent"
          />
          <span className="text-xs leading-relaxed text-fg">
            <strong>Confirmação de idade ({LEGAL_INFO.minimumAgePT}+ anos):</strong> confirmo que tenho pelo menos{' '}
            {LEGAL_INFO.minimumAgePT} anos ou autorização de quem me representa.
          </span>
        </label>

        {submitAttempted && !ageConfirmed && (
          <p className="flex items-center gap-1.5 px-1 text-xs font-semibold text-coral-ink">
            <AlertCircle size={14} /> Confirma a tua idade mínima acima para entrares no caderno.
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
              <Sparkles size={13} className="text-accent-ink" /> Ativar o Tutor Uni com IA (opcional):
            </strong>{' '}
            permite que o Uni responda a perguntas, gere desafios de revisão e leia prints que lhe enviares. Os teus dados ficam apenas para o teu estudo.
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
              <Cloud size={13} className="text-accent-ink" /> Cópia segura na nuvem (opcional):
            </strong>{' '}
            {isSignedIn && personalEmail
              ? `guarda o teu caderno associado à tua conta (${personalEmail}) para acederes em vários dispositivos.`
              : 'se iniciares sessão mais tarde, sincroniza o teu caderno entre telemóvel e computador.'}
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <button
            type="button"
            onClick={() => onOpenLegal('privacy')}
            className="min-h-11 rounded-xl px-2 font-semibold text-accent-ink hover:underline"
          >
            Ler Política de Privacidade
          </button>
          <span aria-hidden="true" className="text-muted">·</span>
          <button
            type="button"
            onClick={() => onOpenLegal('terms')}
            className="min-h-11 rounded-xl px-2 font-semibold text-accent-ink hover:underline"
          >
            Termos de Utilização
          </button>
        </div>
      </div>
    </div>
  );
}
