import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardPaste,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { formatAcademicYearShort } from '../../../lib/portugalCurriculum';
import type { CompletedCourseRecord } from '../../../types';
import type { SmartImportInitialMode } from '../../courses/SmartScheduleImportModal';
import { Button, Field, Input, Select, cx } from '../../ui';

interface Step3CoursesProps {
  records: CompletedCourseRecord[];
  mainFilteredRecords: CompletedCourseRecord[];
  optionalAvailableRecords: CompletedCourseRecord[];
  availableRecordYears: number[];
  effectiveYearFilter: number | 'all';
  setYearFilter: (yr: number | 'all') => void;
  showOtherTermsHistory: boolean;
  setShowOtherTermsHistory: (val: boolean) => void;
  showOptionalCourses: boolean;
  setShowOptionalCourses: (val: boolean) => void;
  optionalSearch: string;
  setOptionalSearch: (val: string) => void;
  isSecondarySchool: boolean;
  doingCount: number;
  approvedCount: number;
  weightedAvg: number | null;
  approvedEctsFromList: number;
  activeEctsFromList: number;
  onUpdateStatus: (id: string, status: CompletedCourseRecord['status']) => void;
  onUpdateGrade: (id: string, raw: string) => void;
  onRemoveRecord: (rec: CompletedCourseRecord) => void;
  onResetDefaults: () => void;
  replaceCoursesWithCurriculum: boolean;
  setReplaceCoursesWithCurriculum: (val: boolean) => void;
  hasExistingCourses: boolean;
  newCourseCode: string;
  setNewCourseCode: (val: string) => void;
  newCourseName: string;
  setNewCourseName: (val: string) => void;
  newCourseYear: number;
  setNewCourseYear: (val: number) => void;
  newCourseEcts: number;
  setNewCourseEcts: (val: number) => void;
  onAddCustomRecord: () => void;
  yearChoices: number[];
  onOpenScheduleImport: (mode: SmartImportInitialMode) => void;
  onUploadScreenshot: (files: FileList | null) => void;
  ocrBusy: boolean;
  ocrFeedback: string | null;
  ocrError: string | null;
  scheduleDoneInfo: { classesCount: number; source: 'photo' | 'gcal' | 'print' } | null;
  showPastePlan: boolean;
  setShowPastePlan: (val: boolean) => void;
  pastedPlanText: string;
  setPastedPlanText: (val: string) => void;
  onApplyPasted: (mode: 'replace' | 'merge') => void;
}

const STATUS_OPTIONS: Array<{ id: CompletedCourseRecord['status']; label: string }> = [
  { id: 'a_fazer', label: 'A fazer' },
  { id: 'aprovada', label: 'Feita' },
  { id: 'por_fazer', label: 'Depois' },
];

export default function Step3Courses({
  records,
  mainFilteredRecords,
  optionalAvailableRecords,
  availableRecordYears,
  effectiveYearFilter,
  setYearFilter,
  showOtherTermsHistory,
  setShowOtherTermsHistory,
  showOptionalCourses,
  setShowOptionalCourses,
  optionalSearch,
  setOptionalSearch,
  isSecondarySchool,
  doingCount,
  approvedCount,
  weightedAvg,
  approvedEctsFromList,
  activeEctsFromList,
  onUpdateStatus,
  onUpdateGrade,
  onRemoveRecord,
  onResetDefaults,
  replaceCoursesWithCurriculum,
  setReplaceCoursesWithCurriculum,
  hasExistingCourses,
  newCourseCode,
  setNewCourseCode,
  newCourseName,
  setNewCourseName,
  newCourseYear,
  setNewCourseYear,
  newCourseEcts,
  setNewCourseEcts,
  onAddCustomRecord,
  yearChoices,
  onOpenScheduleImport,
  onUploadScreenshot,
  ocrBusy,
  ocrFeedback,
  ocrError,
  scheduleDoneInfo,
  showPastePlan,
  setShowPastePlan,
  pastedPlanText,
  setPastedPlanText,
  onApplyPasted,
}: Step3CoursesProps) {
  const [showManualAdd, setShowManualAdd] = useState(records.length === 0);

  return (
    <div className="space-y-5">
      {/* Resumo + ações de importação */}
      <div className="rounded-[24px] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen size={18} className="text-accent-ink" />
              <h2 className="font-display text-xl font-bold text-fg">As tuas cadeiras</h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">
              Marca o que estás a fazer agora, já concluíste ou fica para depois. Podes também importar o teu horário.
            </p>
          </div>
          {records.length > 0 && (
            <Button size="sm" variant="ghost" onClick={onResetDefaults}>
              <RotateCcw size={14} /> Repor plano base
            </Button>
          )}
        </div>

        {/* Métricas rápidas */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-accent-soft px-3 py-1 font-semibold text-accent-ink tabular">
            {doingCount} ativas{isSecondarySchool ? '' : ` · ${activeEctsFromList} ECTS`}
          </span>
          <span className="rounded-full bg-surface-2 px-3 py-1 font-semibold text-fg tabular">
            {approvedCount} concluídas{isSecondarySchool ? '' : ` · ${approvedEctsFromList} ECTS`}
          </span>
          {weightedAvg !== null && (
            <span className="rounded-full bg-pastel-butter px-3 py-1 font-semibold text-[#141312] tabular">
              Média {weightedAvg.toFixed(1)}
            </span>
          )}
        </div>

        {/* Atalhos de importação */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => onOpenScheduleImport('photo')}>
            <CalendarDays size={14} /> Importar horário
          </Button>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3.5 text-xs font-semibold text-fg transition hover:bg-surface">
            {ocrBusy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            <span>Ler print do horário</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                onUploadScreenshot(e.target.files);
                e.currentTarget.value = '';
              }}
            />
          </label>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowPastePlan(!showPastePlan)}
          >
            <ClipboardPaste size={14} /> Colar texto do portal
          </Button>
        </div>

        {scheduleDoneInfo && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-ok">
            <CheckCircle2 size={14} /> {scheduleDoneInfo.classesCount} aula(s) importadas com sucesso.
          </p>
        )}
        {ocrFeedback && (
          <p className="mt-2 rounded-xl bg-ok/10 px-3 py-2 text-xs text-ok">{ocrFeedback}</p>
        )}
        {ocrError && (
          <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-coral-soft px-3 py-2 text-xs text-coral-ink">
            <AlertCircle size={14} /> {ocrError}
          </p>
        )}

        {showPastePlan && (
          <div className="mt-4 space-y-2.5 rounded-2xl border border-line bg-surface-2/60 p-3.5">
            <p className="text-xs text-muted">
              Cola a lista de cadeiras do portal académico ou escreve uma cadeira por linha:
            </p>
            <textarea
              rows={4}
              value={pastedPlanText}
              onChange={(e) => setPastedPlanText(e.target.value)}
              placeholder="Ex.: Álgebra Linear (6 ECTS)&#10;Cálculo I (6 ECTS)"
              className="w-full rounded-xl border border-line bg-surface p-3 text-xs text-fg focus:border-accent focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={() => onApplyPasted('merge')}>
                Juntar à lista
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onApplyPasted('replace')}>
                Substituir lista
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowPastePlan(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Filtros + Lista principal (scroll natural da página, sem scroll interno preso) */}
      <div className="space-y-3 rounded-[24px] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setYearFilter('all')}
              className={cx(
                'min-h-11 rounded-full border px-3 text-xs font-semibold transition',
                effectiveYearFilter === 'all'
                  ? 'border-accent bg-accent-soft text-accent-ink'
                  : 'border-line bg-surface-2 text-muted hover:text-fg',
              )}
            >
              Todos os anos
            </button>
            {availableRecordYears.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setYearFilter(yr)}
                className={cx(
                  'min-h-11 rounded-full border px-3 text-xs font-semibold transition',
                  effectiveYearFilter === yr
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-2 text-muted hover:text-fg',
                )}
              >
                {formatAcademicYearShort(yr, isSecondarySchool)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowOtherTermsHistory(!showOtherTermsHistory)}
            className="min-h-11 px-2 text-xs font-semibold text-accent-ink hover:underline"
          >
            {showOtherTermsHistory ? 'Mostrar só semestre atual' : 'Ver outros semestres'}
          </button>
        </div>

        {mainFilteredRecords.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface-2/40 px-4 py-6 text-center text-xs text-muted">
            Ainda não tens cadeiras na lista. Adiciona abaixo ou importa pelo horário.
          </div>
        ) : (
          <ul className="space-y-2.5">
            {mainFilteredRecords.map((rec) => (
              <li
                key={rec.id}
                className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface-2/50 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-surface px-2 py-0.5 font-mono text-xs font-bold text-fg">
                      {rec.code}
                    </span>
                    <span className="text-xs font-semibold text-fg">{rec.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {formatAcademicYearShort(rec.year, isSecondarySchool)} · {rec.semester}.º sem
                    {isSecondarySchool ? '' : ` · ${rec.ects || 6} ECTS`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {STATUS_OPTIONS.map((opt) => {
                    const active = rec.status === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onUpdateStatus(rec.id, opt.id)}
                        className={cx(
                          'min-h-11 rounded-xl border px-3 text-xs font-semibold transition',
                          active
                            ? opt.id === 'a_fazer'
                              ? 'border-accent bg-accent-soft text-accent-ink'
                              : opt.id === 'aprovada'
                                ? 'border-ok bg-ok/15 text-ok'
                                : 'border-fg/40 bg-surface text-fg'
                            : 'border-line bg-surface text-muted hover:text-fg',
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}

                  {rec.status === 'aprovada' && (
                    <Input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Nota de ${rec.name}`}
                      placeholder="Nota"
                      value={rec.grade ?? ''}
                      onChange={(e) => onUpdateGrade(rec.id, e.target.value)}
                      className="w-20 text-center tabular"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => onRemoveRecord(rec)}
                    aria-label={`Remover ${rec.name}`}
                    className="inline-flex size-11 items-center justify-center rounded-xl text-muted transition hover:bg-coral-soft hover:text-coral-ink"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Opcionais colapsáveis */}
        {optionalAvailableRecords.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowOptionalCourses(!showOptionalCourses)}
              className="min-h-11 text-xs font-semibold text-accent-ink hover:underline"
            >
              {showOptionalCourses
                ? 'Esconder cadeiras opcionais'
                : `+ Ver ${optionalAvailableRecords.length} cadeiras opcionais`}
            </button>
            {showOptionalCourses && (
              <div className="mt-2 space-y-2 rounded-2xl border border-line bg-surface-2/40 p-3">
                <Input
                  value={optionalSearch}
                  onChange={(e) => setOptionalSearch(e.target.value)}
                  placeholder="Procurar cadeira opcional…"
                />
                <div className="flex flex-wrap gap-2">
                  {optionalAvailableRecords.slice(0, 18).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateStatus(opt.id, 'a_fazer')}
                      className="min-h-11 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-fg hover:border-accent"
                    >
                      + {opt.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* "+ Outra cadeira" colapsável por defeito */}
        <div className="border-t border-line pt-3">
          {!showManualAdd ? (
            <Button size="sm" variant="secondary" onClick={() => setShowManualAdd(true)}>
              <Plus size={15} /> Outra cadeira manualmente
            </Button>
          ) : (
            <div className="space-y-3 rounded-2xl border border-line bg-surface-2/60 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-fg">Adicionar cadeira manualmente</span>
                <button
                  type="button"
                  onClick={() => setShowManualAdd(false)}
                  className="min-h-9 px-2 text-xs text-muted hover:text-fg"
                >
                  Fechar
                </button>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-[110px_1fr_90px_90px]">
                <Field label="Sigla">
                  <Input
                    value={newCourseCode}
                    onChange={(e) => setNewCourseCode(e.target.value)}
                    placeholder="CALC1"
                  />
                </Field>
                <Field label="Nome da cadeira">
                  <Input
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                    placeholder="Ex.: Análise Matemática I"
                  />
                </Field>
                <Field label="Ano">
                  <Select
                    value={newCourseYear}
                    onChange={(e) => setNewCourseYear(Number(e.target.value))}
                  >
                    {yearChoices.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}.º
                      </option>
                    ))}
                  </Select>
                </Field>
                {!isSecondarySchool && (
                  <Field label="ECTS">
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={newCourseEcts}
                      onChange={(e) => setNewCourseEcts(Number(e.target.value) || 6)}
                    />
                  </Field>
                )}
              </div>
              <Button size="sm" variant="primary" onClick={onAddCustomRecord}>
                <Plus size={14} /> Adicionar à lista
              </Button>
            </div>
          )}
        </div>

        {hasExistingCourses && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface-2/50 px-3.5 py-2.5 text-xs">
            <input
              type="checkbox"
              checked={replaceCoursesWithCurriculum}
              onChange={(e) => setReplaceCoursesWithCurriculum(e.target.checked)}
              className="size-5 shrink-0 accent-accent"
            />
            <span className="text-fg">
              Atualizar as cadeiras ativas do meu espaço de estudo com esta lista ({doingCount})
            </span>
          </label>
        )}
      </div>
    </div>
  );
}
