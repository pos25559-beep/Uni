import { ChevronDown, GraduationCap, Plus, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CHALLENGE_OPTIONS,
  ECTS_TARGETS,
  EXTRA_ACTIVITY_PRESETS,
} from '../../../lib/academicCredits';
import { hapticTap } from '../../../lib/nativeBridge';
import {
  formatAcademicYearShort,
  type UniversityCatalogEntry,
} from '../../../lib/portugalCurriculum';
import type { ExtraActivity } from '../../../types';
import { useStore } from '../../../store/useStore';
import { StickerBadge } from '../../motion/Primitives';
import { Button, Field, Input, Select } from '../../ui';
import { cx } from '../../../lib/uiHelpers';

export type AcademicCycleMode = 'licenciatura' | 'mestrado' | 'misto';

interface Step2AcademicProps {
  catalog: UniversityCatalogEntry[];
  universityId: string;
  onUniversityChange: (id: string) => void;
  customUniversity: string;
  setCustomUniversity: (val: string) => void;
  degreeId: string;
  onDegreeChange: (id: string) => void;
  customDegree: string;
  setCustomDegree: (val: string) => void;
  availableDegrees: UniversityCatalogEntry['degrees'];
  isSecondarySchool: boolean;
  academicCycle: AcademicCycleMode;
  onCycleChange: (cycle: AcademicCycleMode) => void;
  yearChoices: number[];
  activeYears: number[];
  onToggleYear: (year: number) => void;
  currentSemester: 1 | 2;
  onSemesterChange: (sem: 1 | 2) => void;
  entryYear: number;
  setEntryYear: (yr: number) => void;
  targetTotalEcts: number;
  onSelectEctsTarget: (total: number) => void;
  completedEcts: number;
  setCompletedEcts: (ects: number) => void;
  ectsStage: { stageSummary: string; progressPct: number; estimatedYear: number };
  onApplyEctsStage: () => void;
  learningChallenges: string[];
  onToggleChallenge: (id: string) => void;
  extraActivities: ExtraActivity[];
  onToggleExtraPreset: (preset: (typeof EXTRA_ACTIVITY_PRESETS)[number]) => void;
  onRemoveExtra: (id: string) => void;
  customExtraLabel: string;
  setCustomExtraLabel: (val: string) => void;
  customExtraHours: number;
  setCustomExtraHours: (val: number) => void;
  onAddCustomExtra: () => void;
}

export default function Step2Academic({
  catalog,
  universityId,
  onUniversityChange,
  customUniversity,
  setCustomUniversity,
  degreeId,
  onDegreeChange,
  customDegree,
  setCustomDegree,
  availableDegrees,
  isSecondarySchool,
  academicCycle,
  onCycleChange,
  yearChoices,
  activeYears,
  onToggleYear,
  currentSemester,
  onSemesterChange,
  entryYear,
  setEntryYear,
  targetTotalEcts,
  onSelectEctsTarget,
  completedEcts,
  setCompletedEcts,
  ectsStage,
  onApplyEctsStage,
  learningChallenges,
  onToggleChallenge,
  extraActivities,
  onToggleExtraPreset,
  onRemoveExtra,
  customExtraLabel,
  setCustomExtraLabel,
  customExtraHours,
  setCustomExtraHours,
  onAddCustomExtra,
}: Step2AcademicProps) {
  const { t } = useTranslation('onboarding');
  const [showEctsAndExtras, setShowEctsAndExtras] = useState(false);
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');

  return (
    <div className="space-y-5">
      <div
        className={cx(
          'overflow-hidden p-5 shadow-card',
          isMinimal
            ? 'rounded-2xl border border-line bg-surface'
            : 'rounded-3xl border border-line/70 bg-surface',
        )}
      >
        <div
          className={cx(
            !isMinimal &&
              '-mx-5 -mt-5 mb-5 border-b border-black/5 bg-pastel-sky/70 px-5 py-4 text-[#141312] dark:border-white/10 dark:bg-surface-2 dark:text-[#FAF6EC]',
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <GraduationCap size={18} className="text-accent-ink dark:text-accent" />
              <h2 className="font-display text-xl font-bold">{t('s2.title')}</h2>
            </div>
            {!isMinimal && (
              <StickerBadge tone="butter" tilt={-2}>
                {t('s2.badge')}
              </StickerBadge>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed opacity-80 sm:text-sm">
            {t('s2.intro')}
          </p>
        </div>

        <div className={cx('space-y-4', isMinimal && 'mt-4')}>
          <Field label={t('s2.institution')}>
            <Select
              value={universityId}
              onChange={(e) => onUniversityChange(e.target.value)}
            >
              <option value="outra">{t('s2.otherInstitution')}</option>
              {catalog.map((u) => {
                const regionTag = u.country === 'ES' ? 'ES · ' : u.country === 'BR' ? 'BR · ' : '';
                const label = u.name.startsWith(u.shortName) ? u.name : `${u.shortName} · ${u.name}`;
                return (
                  <option key={u.id} value={u.id}>
                    {regionTag}
                    {label}
                  </option>
                );
              })}
            </Select>
          </Field>

          {universityId === 'outra' && (
            <Field label={t('s2.schoolName')}>
              <Input
                value={customUniversity}
                onChange={(e) => setCustomUniversity(e.target.value)}
                placeholder={t('s2.schoolPh')}
              />
            </Field>
          )}

          {availableDegrees.length > 0 ? (
            <Field label={isSecondarySchool ? t('s2.areaDegree') : t('s2.degree')}>
              <Select
                value={degreeId}
                onChange={(e) => onDegreeChange(e.target.value)}
              >
                {availableDegrees.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
                <option value="outro">{t('s2.otherDegree')}</option>
              </Select>
            </Field>
          ) : null}

          {(availableDegrees.length === 0 || degreeId === 'outro') && (
            <Field label={t('s2.degreeName')}>
              <Input
                value={customDegree}
                onChange={(e) => setCustomDegree(e.target.value)}
                placeholder={t('s2.degreePh')}
              />
            </Field>
          )}

          {!isSecondarySchool && (
            <div className="space-y-2">
              <span className="block text-xs font-medium text-muted">{t('s2.cycle')}</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'licenciatura' as const, label: t('s2.bachelor') },
                  { id: 'mestrado' as const, label: t('s2.master') },
                  { id: 'misto' as const, label: t('s2.mixed') },
                ].map((c) => {
                  const active = academicCycle === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onCycleChange(c.id)}
                      className={cx(
                        'min-h-11 rounded-xl border px-3 text-xs font-semibold transition',
                        active
                          ? 'border-accent bg-accent-soft text-accent-ink'
                          : 'border-line bg-surface-2 text-muted hover:text-fg',
                      )}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ano(s) e Semestre */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="block text-xs font-medium text-muted">
                {academicCycle === 'misto' ? t('s2.activeYears') : t('s2.currentYear')}
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {yearChoices.map((yr) => {
                  const active = activeYears.includes(yr);
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => onToggleYear(yr)}
                      className={cx(
                        'min-h-11 min-w-11 rounded-xl border px-3 text-xs font-bold transition',
                        active
                          ? 'border-accent bg-accent-soft text-accent-ink'
                          : 'border-line bg-surface-2 text-muted hover:text-fg',
                      )}
                    >
                      {formatAcademicYearShort(yr, isSecondarySchool)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-muted">
                {isSecondarySchool ? t('s2.periodSemester') : t('s2.currentSemester')}
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([1, 2] as const).map((sem) => {
                  const active = currentSemester === sem;
                  return (
                    <button
                      key={sem}
                      type="button"
                      onClick={() => onSemesterChange(sem)}
                      className={cx(
                        'min-h-11 rounded-xl border px-3 text-xs font-bold transition',
                        active
                          ? 'border-accent bg-accent-soft text-accent-ink'
                          : 'border-line bg-surface-2 text-muted hover:text-fg',
                      )}
                    >
                      {sem}.º {isSecondarySchool ? 'Período' : 'Semestre'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('s2.entryYear')}>
              <Input
                type="number"
                min={2010}
                max={2035}
                value={entryYear}
                onChange={(e) => setEntryYear(Number(e.target.value) || new Date().getFullYear())}
              />
            </Field>
            {!isSecondarySchool && (
              <div
                className={cx(
                  'flex flex-col justify-end rounded-2xl px-4 py-3',
                  isMinimal
                    ? 'border border-line bg-surface-2/60'
                    : 'bg-pastel-butter/60 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]',
                )}
              >
                <span className="text-xs opacity-75">{t('s2.ectsAuto')}</span>
                <span className="font-mono text-sm font-bold tabular">
                  {completedEcts} / {targetTotalEcts} ECTS · {ectsStage.stageSummary}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Créditos & Contexto pessoal (opcional, colapsável para não encher o ecrã) */}
      <details
        open={showEctsAndExtras}
        onToggle={(e) => setShowEctsAndExtras(e.currentTarget.open)}
        className={cx(
          'p-4 shadow-card sm:p-5',
          isMinimal
            ? 'rounded-2xl border border-line bg-surface'
            : 'rounded-3xl border border-line/70 bg-pastel-peach/35 dark:bg-surface-2',
        )}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-bold text-fg">
          <span className="flex items-center gap-2">
            <Sparkles size={15} className="text-accent-ink" />
            {t('s2.customise')}
          </span>
          <ChevronDown
            size={16}
            className={cx('shrink-0 text-muted transition-transform', showEctsAndExtras && 'rotate-180')}
          />
        </summary>

        <div className="mt-4 space-y-5 border-t border-line pt-4">
          {!isSecondarySchool && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-fg">{t('s2.totalCredits')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {ECTS_TARGETS.map((preset) => (
                    <button
                      key={preset.total}
                      type="button"
                      onClick={() => onSelectEctsTarget(preset.total)}
                      className={cx(
                        'min-h-11 rounded-full border px-3 text-xs font-semibold transition',
                        targetTotalEcts === preset.total
                          ? 'border-accent bg-accent-soft text-accent-ink'
                          : 'border-line bg-surface-2 text-muted hover:text-fg',
                      )}
                    >
                      {preset.total} ECTS
                    </button>
                  ))}
                </div>
              </div>

              <Field label={t('s2.ectsDone', { done: completedEcts, total: targetTotalEcts })}>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={targetTotalEcts}
                    step={3}
                    value={Math.min(targetTotalEcts, completedEcts)}
                    onChange={(e) => setCompletedEcts(Number(e.target.value))}
                    className="h-2 min-w-[160px] flex-1 cursor-pointer accent-accent"
                  />
                  <Button size="sm" variant="secondary" onClick={onApplyEctsStage}>
                    {t('s2.suggestYear', { year: ectsStage.estimatedYear })}
                  </Button>
                </div>
              </Field>
            </div>
          )}

          <div className="space-y-2">
            <span className="block text-xs font-semibold text-fg">{t('s2.supportAreas')}</span>
            <div className="flex flex-wrap gap-2">
              {CHALLENGE_OPTIONS.map((ch) => {
                const active = learningChallenges.includes(ch.id);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => onToggleChallenge(ch.id)}
                    className={cx(
                      'min-h-11 rounded-full border px-3.5 text-xs font-semibold transition',
                      active
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-surface-2 text-muted hover:text-fg',
                    )}
                  >
                    {ch.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-semibold text-fg">{t('s2.extras')}</span>
            <div className="flex flex-wrap gap-2">
              {EXTRA_ACTIVITY_PRESETS.map((preset) => {
                const active = extraActivities.some((a) => a.label === preset.label);
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onToggleExtraPreset(preset)}
                    className={cx(
                      'min-h-11 rounded-full border px-3 text-xs font-semibold transition',
                      active
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-surface-2 text-muted hover:text-fg',
                    )}
                  >
                    {preset.label} · {preset.hoursPerWeek}h/sem
                  </button>
                );
              })}
            </div>

            {extraActivities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {extraActivities.map((act) => (
                  <span
                    key={act.id}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-xs font-medium text-fg"
                  >
                    {act.label} ({act.hoursPerWeek}h)
                    <button
                      type="button"
                      onClick={() => {
                        void hapticTap();
                        onRemoveExtra(act.id);
                      }}
                      aria-label={t('s2.remove', { label: act.label })}
                      className="inline-flex size-6 items-center justify-center rounded-full text-muted hover:text-fg"
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <Input
                value={customExtraLabel}
                onChange={(e) => setCustomExtraLabel(e.target.value)}
                placeholder={t('s2.otherActivity')}
                className="min-w-[160px] flex-1"
              />
              <Input
                type="number"
                min={1}
                max={40}
                value={customExtraHours}
                onChange={(e) => setCustomExtraHours(Number(e.target.value) || 2)}
                className="w-20"
                aria-label={t('s2.hoursWeek')}
              />
              <Button size="sm" variant="secondary" onClick={onAddCustomExtra}>
                <Plus size={14} /> {t('s2.add')}
              </Button>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
