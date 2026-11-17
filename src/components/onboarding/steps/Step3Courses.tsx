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
import { useTranslation } from 'react-i18next';
import { formatAcademicYearShort } from '../../../lib/portugalCurriculum';
import type { CompletedCourseRecord } from '../../../types';
import type { SmartImportInitialMode } from '../../courses/SmartScheduleImportModal';
import { useStore } from '../../../store/useStore';
import { StickerBadge } from '../../motion/Primitives';
import { Button, Field, Input, Select } from '../../ui';
import { cx } from '../../../lib/uiHelpers';

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
  scheduleDoneInfo: {
    classesCount: number;
    assessmentsCount?: number;
    source: 'photo' | 'gcal' | 'print';
    courseLabels?: string[];
    slotSummaries?: string[];
  } | null;
  showPastePlan: boolean;
  setShowPastePlan: (val: boolean) => void;
  pastedPlanText: string;
  setPastedPlanText: (val: string) => void;
  onApplyPasted: (mode: 'replace' | 'merge') => void;
  pendingAiConsentCount?: number;
  onConfirmAiAndReadPrint?: () => void;
  onCancelAiPrintConsent?: () => void;
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
  pendingAiConsentCount = 0,
  onConfirmAiAndReadPrint,
  onCancelAiPrintConsent,
}: Step3CoursesProps) {
  const { t } = useTranslation('onboarding');
  const [showManualAdd, setShowManualAdd] = useState(records.length === 0);
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');

  return (
    <div className="space-y-5">
      {/* Resumo + ações de importação */}
      <div
        className={cx(
          'overflow-hidden p-4 shadow-card sm:p-5',
          isMinimal
            ? 'rounded-[22px] border border-line bg-surface'
            : 'rounded-[26px] border border-line/70 bg-surface',
        )}
      >
        <div
          className={cx(
            !isMinimal &&
              '-mx-4 -mt-4 mb-4 border-b border-black/5 bg-pastel-sage/65 px-4 py-4 text-[#141312] dark:border-white/10 dark:bg-surface-2 dark:text-[#FAF6EC] sm:-mx-5 sm:-mt-5 sm:px-5',
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-accent-ink dark:text-accent" />
                <h2 className="font-display text-xl font-bold">{t('s3.title')}</h2>
              </div>
              <p className="mt-1 text-xs leading-relaxed opacity-80 sm:text-sm">
                {t('s3.intro')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isMinimal && (
                <StickerBadge tone="butter" tilt={2}>
                  {t('s3.badge')}
                </StickerBadge>
              )}
              {records.length > 0 && (
                <Button size="sm" variant="secondary" onClick={onResetDefaults}>
                  <RotateCcw size={14} /> {t('s3.reset')}
                </Button>
              )}
            </div>
          </div>

          {/* Métricas rápidas */}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-white/80 px-3 py-1 font-semibold text-[#141312] tabular dark:bg-black/25 dark:text-[#FAF6EC]">
              {t('s3.activeCount', { count: doingCount })}{isSecondarySchool ? '' : ` · ${activeEctsFromList} ECTS`}
            </span>
            <span className="rounded-full bg-white/65 px-3 py-1 font-semibold text-[#141312] tabular dark:bg-black/20 dark:text-[#FAF6EC]">
              {t('s3.doneCount', { count: approvedCount })}{isSecondarySchool ? '' : ` · ${approvedEctsFromList} ECTS`}
            </span>
            {weightedAvg !== null && (
              <span className="rounded-full bg-pastel-butter px-3 py-1 font-semibold text-[#141312] tabular">
                {t('s3.avgLabel', { avg: weightedAvg.toFixed(1) })}
              </span>
            )}
          </div>
        </div>

        {/* Atalhos de importação */}
        <div className={cx('flex flex-wrap gap-2', isMinimal && 'mt-4')}>
          <Button size="sm" variant="secondary" onClick={() => onOpenScheduleImport('photo')}>
            <CalendarDays size={14} /> {t('s3.importSchedule')}
          </Button>
          <label
            className={cx(
              'inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3.5 text-xs font-semibold text-fg transition',
              ocrBusy ? 'pointer-events-none opacity-75' : 'cursor-pointer hover:bg-surface',
            )}
          >
            {ocrBusy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            <span>{ocrBusy ? t('s3.readingPrint') : t('s3.readPrint')}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={ocrBusy}
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
            <ClipboardPaste size={14} /> {t('s3.pastePortal')}
          </Button>
        </div>

        {scheduleDoneInfo && (
          <div className="mt-3 space-y-2 rounded-2xl border border-ok/25 bg-ok/10 px-3.5 py-2.5 text-xs">
            <p className="flex items-center gap-1.5 font-semibold text-ok">
              <CheckCircle2 size={14} /> {t('s3.classesImported', { count: scheduleDoneInfo.classesCount })}
              {scheduleDoneInfo.assessmentsCount
                ? t('s3.andAssessments', { count: scheduleDoneInfo.assessmentsCount })
                : ''}{' '}
              {t('s3.importedOk')}
            </p>
            {scheduleDoneInfo.courseLabels && scheduleDoneInfo.courseLabels.length > 0 && (
              <p className="text-xs leading-relaxed text-fg/85">
                <span className="font-semibold text-fg">{t('s3.recognised')}</span>{' '}
                {scheduleDoneInfo.courseLabels.join(' · ')}
              </p>
            )}
            {scheduleDoneInfo.slotSummaries && scheduleDoneInfo.slotSummaries.length > 0 && (
              <ul className="space-y-0.5 text-xs text-muted">
                {scheduleDoneInfo.slotSummaries.slice(0, 6).map((line, i) => (
                  <li key={`${i}-${line}`}>• {line}</li>
                ))}
                {scheduleDoneInfo.slotSummaries.length > 6 && (
                  <li className="text-xs font-medium text-fg/75">
                    {t('s3.moreSlots', { count: scheduleDoneInfo.slotSummaries.length - 6 })}
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
        {ocrFeedback && (
          <p className="mt-2 rounded-xl bg-ok/10 px-3 py-2 text-xs text-ok">{ocrFeedback}</p>
        )}
        {ocrError && (
          <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-coral-soft px-3 py-2 text-xs text-coral-ink">
            <AlertCircle size={14} /> {ocrError}
          </p>
        )}
        {pendingAiConsentCount > 0 && onConfirmAiAndReadPrint && (
          <div className="mt-3 space-y-2 rounded-2xl border border-accent/35 bg-accent-soft/60 p-3.5 text-xs">
            <p className="font-semibold text-fg">
              {pendingAiConsentCount === 1 ? t('s3.aiAskOne') : t('s3.aiAskMany', { count: pendingAiConsentCount })}
            </p>
            <p className="leading-relaxed text-muted">
              {t('s3.aiBody')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={onConfirmAiAndReadPrint}>
                {t('s3.aiConfirm')}
              </Button>
              {onCancelAiPrintConsent && (
                <Button size="sm" variant="ghost" onClick={onCancelAiPrintConsent}>
                  {t('s3.cancel')}
                </Button>
              )}
            </div>
          </div>
        )}

        {showPastePlan && (
          <div className="mt-4 space-y-2.5 rounded-2xl border border-line bg-surface-2/60 p-3.5">
            <p className="text-xs text-muted">
              {t('s3.pasteHint')}
            </p>
            <textarea
              rows={4}
              value={pastedPlanText}
              onChange={(e) => setPastedPlanText(e.target.value)}
              placeholder={t('s3.pastePh')}
              className="w-full rounded-xl border border-line bg-surface p-3 text-xs text-fg focus:border-accent focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={() => onApplyPasted('merge')}>
                {t('s3.merge')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onApplyPasted('replace')}>
                {t('s3.replace')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowPastePlan(false)}>
                {t('s3.close')}
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
              {t('s3.allYears')}
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
            {showOtherTermsHistory ? t('s3.onlyCurrent') : t('s3.otherTerms')}
          </button>
        </div>

        {mainFilteredRecords.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface-2/40 px-4 py-6 text-center text-xs text-muted">
            {t('s3.empty')}
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
                    {formatAcademicYearShort(rec.year, isSecondarySchool)} · {t('common:fmt.semShort', { n: rec.semester })}
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
                        {t(`s3.status.${opt.id}`)}
                      </button>
                    );
                  })}

                  {rec.status === 'aprovada' && (
                    <Input
                      type="text"
                      inputMode="decimal"
                      aria-label={t('s3.gradeOf', { name: rec.name })}
                      placeholder={t('s3.grade')}
                      value={rec.grade ?? ''}
                      onChange={(e) => onUpdateGrade(rec.id, e.target.value)}
                      className="w-20 text-center tabular"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => onRemoveRecord(rec)}
                    aria-label={t('s3.removeAria', { name: rec.name })}
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
                ? t('s3.hideOptional')
                : t('s3.showOptional', { count: optionalAvailableRecords.length })}
            </button>
            {showOptionalCourses && (
              <div className="mt-2 space-y-2 rounded-2xl border border-line bg-surface-2/40 p-3">
                <Input
                  value={optionalSearch}
                  onChange={(e) => setOptionalSearch(e.target.value)}
                  placeholder={t('s3.searchOptional')}
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
              <Plus size={15} /> {t('s3.otherManual')}
            </Button>
          ) : (
            <div className="space-y-3 rounded-2xl border border-line bg-surface-2/60 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-fg">{t('s3.manualTitle')}</span>
                <button
                  type="button"
                  onClick={() => setShowManualAdd(false)}
                  className="min-h-11 px-2 text-xs text-muted hover:text-fg"
                >
                  {t('s3.close')}
                </button>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-[110px_1fr_90px_90px]">
                <Field label={t('s3.code')}>
                  <Input
                    value={newCourseCode}
                    onChange={(e) => setNewCourseCode(e.target.value)}
                    placeholder="CALC1"
                  />
                </Field>
                <Field label={t('s3.courseName')}>
                  <Input
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                    placeholder={t('s3.courseNamePh')}
                  />
                </Field>
                <Field label={t('s3.year')}>
                  <Select
                    value={newCourseYear}
                    onChange={(e) => setNewCourseYear(Number(e.target.value))}
                  >
                    {yearChoices.map((yr) => (
                      <option key={yr} value={yr}>
                        {t('s3.yearOption', { n: yr })}
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
                <Plus size={14} /> {t('s3.addToList')}
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
              {t('s3.updateActive', { count: doingCount })}
            </span>
          </label>
        )}
      </div>
    </div>
  );
}
