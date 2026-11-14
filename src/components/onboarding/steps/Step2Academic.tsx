import { ChevronDown, GraduationCap, Plus, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
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
import { Button, Field, Input, Select, cx } from '../../ui';

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
  const [showEctsAndExtras, setShowEctsAndExtras] = useState(false);

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2">
          <GraduationCap size={18} className="text-accent-ink" />
          <h2 className="font-display text-xl font-bold text-fg">O teu curso e semestre</h2>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">
          Escolhe a tua escola ou faculdade, curso, ano e semestre atual. Calculamos automaticamente o ponto de partida.
        </p>

        <div className="mt-4 space-y-4">
          <Field label="Instituição / Nível de ensino">
            <Select
              value={universityId}
              onChange={(e) => onUniversityChange(e.target.value)}
            >
              <option value="outra">Outra instituição (escrever manualmente)</option>
              {catalog.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.shortName} — {u.name}
                </option>
              ))}
            </Select>
          </Field>

          {universityId === 'outra' && (
            <Field label="Nome da escola ou faculdade">
              <Input
                value={customUniversity}
                onChange={(e) => setCustomUniversity(e.target.value)}
                placeholder="Ex.: Universidade do Porto, Escola Secundária…"
              />
            </Field>
          )}

          {availableDegrees.length > 0 ? (
            <Field label={isSecondarySchool ? 'Área / Curso' : 'Curso'}>
              <Select
                value={degreeId}
                onChange={(e) => onDegreeChange(e.target.value)}
              >
                {availableDegrees.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
                <option value="outro">Outro curso (personalizado)</option>
              </Select>
            </Field>
          ) : null}

          {(availableDegrees.length === 0 || degreeId === 'outro') && (
            <Field label="Nome do teu curso">
              <Input
                value={customDegree}
                onChange={(e) => setCustomDegree(e.target.value)}
                placeholder="Ex.: Engenharia Informática, Economia, Medicina…"
              />
            </Field>
          )}

          {!isSecondarySchool && (
            <div className="space-y-2">
              <span className="block text-xs font-medium text-muted">Ciclo de estudos</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'licenciatura' as const, label: 'Licenciatura' },
                  { id: 'mestrado' as const, label: 'Mestrado' },
                  { id: 'misto' as const, label: 'Misto' },
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
                {academicCycle === 'misto' ? 'Anos com cadeiras ativas' : 'Ano atual'}
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
                {isSecondarySchool ? 'Período / Semestre' : 'Semestre atual'}
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
            <Field label="Ano letivo de ingresso">
              <Input
                type="number"
                min={2010}
                max={2035}
                value={entryYear}
                onChange={(e) => setEntryYear(Number(e.target.value) || new Date().getFullYear())}
              />
            </Field>
            {!isSecondarySchool && (
              <div className="flex flex-col justify-end rounded-2xl border border-line bg-surface-2/60 px-3.5 py-2.5">
                <span className="text-xs text-muted">ECTS deduzidos automaticamente</span>
                <span className="font-mono text-sm font-bold text-fg tabular">
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
        className="rounded-[24px] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5"
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-bold text-fg">
          <span className="flex items-center gap-2">
            <Sparkles size={15} className="text-accent-ink" />
            Personalizar créditos ECTS, dificuldades e extras (opcional)
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
                <span className="text-xs font-semibold text-fg">Total de créditos do ciclo</span>
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

              <Field label={`ECTS já concluídos (${completedEcts} / ${targetTotalEcts})`}>
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
                    Sugerir ano ({ectsStage.estimatedYear}.º)
                  </Button>
                </div>
              </Field>
            </div>
          )}

          <div className="space-y-2">
            <span className="block text-xs font-semibold text-fg">Em que áreas queres mais apoio do Uni?</span>
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
            <span className="block text-xs font-semibold text-fg">Atividades fora das aulas (part-time, desporto…)</span>
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
                      aria-label={`Remover ${act.label}`}
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
                placeholder="Outra atividade (ex.: Música)"
                className="min-w-[160px] flex-1"
              />
              <Input
                type="number"
                min={1}
                max={40}
                value={customExtraHours}
                onChange={(e) => setCustomExtraHours(Number(e.target.value) || 2)}
                className="w-20"
                aria-label="Horas por semana"
              />
              <Button size="sm" variant="secondary" onClick={onAddCustomExtra}>
                <Plus size={14} /> Adicionar
              </Button>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
