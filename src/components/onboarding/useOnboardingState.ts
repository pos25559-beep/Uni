import { useOnboarding } from '@onboardjs/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAcademicEmails } from '../../hooks/useGoogleData';
import { matchCourse } from '../../integrations/clip';
import {
  parseAcademicHistoryFromScreenshot,
  parseTimetableFromScreenshot,
  type ExtractedHistoryItem,
  type ExtractedScheduleAssessment,
  type ExtractedScheduleSlot,
} from '../../integrations/gemini';
import {
  defaultTargetEctsForCycle,
  EXTRA_ACTIVITY_PRESETS,
  inferAcademicStageFromEcts,
} from '../../lib/academicCredits';
import { colorNames, weekdayLong } from '../../lib/colors';
import { parseCurriculumFromText } from '../../lib/curriculumParser';
import { auth } from '../../lib/firebase';
import {
  fetchSharedCurriculaFromCloud,
  publishSharedCurriculum,
} from '../../lib/firestoreSync';
import { readNormalizedScreenshot } from '../../lib/imageUpload';
import { LEGAL_INFO } from '../../lib/legal';
import { celebrateStationery } from '../../lib/motionTokens';
import { hapticSuccess, hapticTap, syncNativeTheme } from '../../lib/nativeBridge';
import {
  applyImportedScheduleRecords,
  buildActiveCoursesFromCurriculum,
  buildInitialCompletedRecords,
  collectKnownCourseCandidates,
  computeWeightedAverage,
  defaultScaleForUniversity,
  deriveCourseAcronym,
  getUniversityById,
  mergeCurriculumCatalog,
  PORTUGAL_CURRICULA,
  resolveKnownCourseIdentity,
  type ImportedRecordCourseInput,
} from '../../lib/portugalCurriculum';
import { parsePtGrade } from '../../lib/selectors';
import type { UniAccessoryId, UniPersonaMode } from '../../lib/uniAccessories';
import { newId, useStore } from '../../store/useStore';
import type {
  AcademicProfile,
  AppTone,
  Assessment,
  ClassSlot,
  CompletedCourseRecord,
  Course,
  CourseColor,
  ExtraActivity,
  Settings,
  ThemePalette,
  UniLiveCompanionsMode,
} from '../../types';
import type { SmartImportInitialMode } from '../courses/SmartScheduleImportModal';
import {
  STEP_META,
  type OnboardingContextData,
  type OnboardingStepId,
} from './onboardingMeta';
import type { AcademicCycleMode } from './steps/Step2Academic';

export function useOnboardingState(args: {
  onClose: () => void;
  fullScreen: boolean;
}) {
  const { onClose, fullScreen } = args;
  const { t } = useTranslation('onboarding');
  const settings = useStore((s) => s.settings);
  const existingCourses = useStore((s) => s.courses);
  const storedProfile = useStore((s) => s.academicProfile);
  const updateSettings = useStore((s) => s.updateSettings);
  const saveAcademicProfile = useStore((s) => s.saveAcademicProfile);
  const applyBuiltCurriculumCourses = useStore((s) => s.applyBuiltCurriculumCourses);

  const {
    connected: academicMailConnected,
    academicEmail,
    connect: connectAcademicMail,
  } = useAcademicEmails('onboarding');

  const { currentStep, next, previous } = useOnboarding<OnboardingContextData>();
  const activeStepId = (currentStep?.id as OnboardingStepId) ?? 'curso';
  const stepIndex = Math.max(0, STEP_META.findIndex((s) => s.id === activeStepId));
  const [direction, setDirection] = useState(1);
  const [finishingWipe, setFinishingWipe] = useState(false);

  // Passo 1: Identidade, Paleta, Tom & Personalidade do Uni
  const [userName, setUserName] = useState(settings.userName);
  const [themePref, setThemePref] = useState<Settings['theme']>(settings.theme ?? 'system');
  const [themePalette, setThemePalette] = useState<ThemePalette>(settings.themePalette ?? 'caderno');
  const [appTone, setAppTone] = useState<AppTone>(settings.appTone ?? 'vibrante');
  const [uniAccessory, setUniAccessory] = useState<'auto' | UniAccessoryId>(
    settings.uniAccessory ?? 'auto',
  );
  const [uniPersona, setUniPersona] = useState<UniPersonaMode>(settings.uniPersona ?? 'amigo');
  const [uniLiveCompanions, setUniLiveCompanions] = useState<UniLiveCompanionsMode>(
    settings.uniLiveCompanions ?? 'all',
  );

  useEffect(() => {
    void syncNativeTheme(themePref, themePalette, appTone);
  }, [themePref, themePalette, appTone]);

  // Passo 2: Instituição, Curso, Ciclo, Ano/Semestre e ECTS
  const isFreshUnconfigured = !storedProfile.onboardingCompleted;
  const initialUniversityId = isFreshUnconfigured
    ? 'outra'
    : storedProfile.universityId || 'outra';
  const initialDegreeId = isFreshUnconfigured
    ? 'outro'
    : storedProfile.degreeId || 'outro';

  const [universityId, setUniversityId] = useState(initialUniversityId);
  const [customUniversity, setCustomUniversity] = useState(
    initialUniversityId === 'outra' ? storedProfile.universityName : '',
  );
  const [degreeId, setDegreeId] = useState(initialDegreeId);
  const [customDegree, setCustomDegree] = useState(
    initialDegreeId === 'outro' ? storedProfile.degreeName : '',
  );
  const [entryYear, setEntryYear] = useState<number>(
    () => storedProfile.entryYear || new Date().getFullYear(),
  );
  const [academicCycle, setAcademicCycle] = useState<AcademicCycleMode>(() => {
    if (storedProfile.academicCycle) return storedProfile.academicCycle;
    if (storedProfile.activeYears && storedProfile.activeYears.length > 1) return 'misto';
    if ((storedProfile.currentAcademicYear || 1) > 3) return 'mestrado';
    return 'licenciatura';
  });
  const [activeYears, setActiveYears] = useState<number[]>(() => {
    if (storedProfile.activeYears && storedProfile.activeYears.length > 0) {
      return storedProfile.activeYears;
    }
    return [storedProfile.currentAcademicYear || 1];
  });
  const [currentSemester, setCurrentSemester] = useState<1 | 2>(
    storedProfile.currentSemester || 1,
  );

  const primaryAcademicYear = (
    Math.min(5, Math.max(1, activeYears[activeYears.length - 1] ?? 1))
  ) as 1 | 2 | 3 | 4 | 5;

  const [catalog, setCatalog] = useState(PORTUGAL_CURRICULA);
  const [records, setRecords] = useState<CompletedCourseRecord[]>(() =>
    storedProfile.completedCourses.length > 0
      ? storedProfile.completedCourses
      : buildInitialCompletedRecords(
          initialUniversityId,
          initialDegreeId,
          (storedProfile.currentAcademicYear || 1) as 1 | 2 | 3 | 4 | 5,
          storedProfile.currentSemester || 1,
          PORTUGAL_CURRICULA,
          storedProfile.activeYears,
        ),
  );

  const [targetTotalEcts, setTargetTotalEcts] = useState<number>(() => {
    if (typeof storedProfile.targetTotalEcts === 'number' && storedProfile.targetTotalEcts > 0) {
      return storedProfile.targetTotalEcts;
    }
    return defaultTargetEctsForCycle(
      storedProfile.academicCycle ?? 'licenciatura',
      initialDegreeId,
    );
  });
  const [completedEcts, setCompletedEcts] = useState<number>(() => {
    if (typeof storedProfile.completedEcts === 'number') return storedProfile.completedEcts;
    return storedProfile.completedCourses
      .filter((c) => c.status === 'aprovada')
      .reduce((sum, c) => sum + (c.ects || 6), 0);
  });
  const [learningChallenges, setLearningChallenges] = useState<string[]>(
    storedProfile.learningChallenges ?? [],
  );
  const [extraActivities, setExtraActivities] = useState<ExtraActivity[]>(
    storedProfile.extraActivities ?? [],
  );
  const [customExtraLabel, setCustomExtraLabel] = useState('');
  const [customExtraHours, setCustomExtraHours] = useState(4);

  const ectsStage = useMemo(
    () => inferAcademicStageFromEcts(completedEcts, targetTotalEcts),
    [completedEcts, targetTotalEcts],
  );

  // Passo 3: Cadeiras
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');
  const [showOtherTermsHistory, setShowOtherTermsHistory] = useState(false);
  const [showOptionalCourses, setShowOptionalCourses] = useState(false);
  const [optionalSearch, setOptionalSearch] = useState('');
  const [replaceCoursesWithCurriculum, setReplaceCoursesWithCurriculum] = useState(true);
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseYear, setNewCourseYear] = useState<number>(primaryAcademicYear);
  const [newCourseEcts, setNewCourseEcts] = useState<number>(6);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrFeedback, setOcrFeedback] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [pendingPrintFilesForConsent, setPendingPrintFilesForConsent] = useState<File[] | null>(null);
  const [scheduleDoneInfo, setScheduleDoneInfo] = useState<{
    classesCount: number;
    assessmentsCount?: number;
    source: 'photo' | 'gcal' | 'print';
    courseLabels?: string[];
    slotSummaries?: string[];
  } | null>(null);
  const [scheduleImportMode, setScheduleImportMode] = useState<SmartImportInitialMode | null>(null);
  const [scheduleImportBaseline, setScheduleImportBaseline] = useState<{
    courses: number;
    classes: number;
    assessments: number;
  } | null>(null);
  const [showPastePlan, setShowPastePlan] = useState(false);
  const [pastedPlanText, setPastedPlanText] = useState('');

  // Passo 4: Ritmo, Email Académico & Privacidade
  const [academicHint, setAcademicHint] = useState(settings.academicEmail ?? '');
  const [academicBusy, setAcademicBusy] = useState(false);
  const [difficultKeys, setDifficultKeys] = useState<string[]>(storedProfile.difficultCourseIds);
  const [difficultNotes, setDifficultNotes] = useState(storedProfile.difficultTopicsNotes ?? '');
  const [dailyMinutes, setDailyMinutes] = useState<number>(settings.dailyStudyMinutes || 180);
  const [studyDays, setStudyDays] = useState<number[]>(settings.studyDays);
  const [ageConfirmed, setAgeConfirmed] = useState<boolean>(
    Boolean(settings.ageConfirmed13Plus || storedProfile.onboardingCompleted),
  );
  const [aiConsent, setAiConsent] = useState<boolean>(Boolean(settings.aiConsent));
  const [cloudSyncConsent, setCloudSyncConsent] = useState<boolean>(
    Boolean(settings.cloudSyncConsent),
  );
  const [legalPreview, setLegalPreview] = useState<'privacy' | 'terms' | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    let active = true;
    fetchSharedCurriculaFromCloud()
      .then((shared) => {
        if (active && shared.length > 0) {
          setCatalog(mergeCurriculumCatalog(PORTUGAL_CURRICULA, shared));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const selectedUniversity = useMemo(
    () => getUniversityById(universityId, catalog),
    [universityId, catalog],
  );
  const availableDegrees = useMemo(() => selectedUniversity?.degrees ?? [], [selectedUniversity]);
  const currentDegreeTemplates = useMemo(
    () => availableDegrees.find((d) => d.id === degreeId)?.courses ?? [],
    [availableDegrees, degreeId],
  );
  const isSecondarySchool = universityId === 'escola-secundario';

  const yearChoices = useMemo(() => {
    if (isSecondarySchool) return [1, 2, 3];
    if (academicCycle === 'licenciatura') return [1, 2, 3];
    if (academicCycle === 'mestrado') return [4, 5];
    return [1, 2, 3, 4, 5];
  }, [isSecondarySchool, academicCycle]);

  const rebuildRecords = (
    nextUniId: string,
    nextDegId: string,
    nextYears: number[],
    nextSem: 1 | 2,
  ) => {
    setScheduleDoneInfo(null);
    if (nextUniId !== 'outra' && nextDegId !== 'outro') {
      const leadYear = (nextYears[nextYears.length - 1] ?? 1) as 1 | 2 | 3 | 4 | 5;
      const built = buildInitialCompletedRecords(
        nextUniId,
        nextDegId,
        leadYear,
        nextSem,
        catalog,
        nextYears,
      );
      setRecords(built);
      const deducedEcts = built
        .filter((c) => c.status === 'aprovada')
        .reduce((sum, c) => sum + (c.ects || 6), 0);
      setCompletedEcts(deducedEcts);
    } else {
      setRecords([]);
    }
  };

  const resetRecordsToDegreeDefaults = () => {
    void hapticTap();
    rebuildRecords(universityId, degreeId, activeYears, currentSemester);
    setOcrFeedback(null);
    setOcrError(null);
  };

  const applyScheduleScopeToRecords = (
    importedCourses: ImportedRecordCourseInput[],
    meta: {
      classesCount: number;
      assessmentsCount: number;
      source: 'photo' | 'gcal' | 'print';
      slotSummaries?: string[];
    },
  ) => {
    const hasActiveItems = importedCourses.some(
      (item) =>
        item.status === 'a_fazer' &&
        (item.semester === undefined || item.semester === currentSemester),
    );
    setRecords((prev) =>
      applyImportedScheduleRecords(prev, importedCourses, {
        primaryAcademicYear,
        activeYears,
        currentSemester,
        defaultEcts: isSecondarySchool ? 4 : 6,
        templates: currentDegreeTemplates,
        replaceActiveScope: hasActiveItems,
      }),
    );

    const activeCourseLabels = Array.from(
      new Set(
        importedCourses
          .filter(
            (item) =>
              item.status === 'a_fazer' &&
              (item.semester === undefined || item.semester === currentSemester),
          )
          .map((item) => (item.code && item.code !== item.name ? `${item.code} (${item.name})` : item.name)),
      ),
    );

    if (hasActiveItems || meta.classesCount > 0 || meta.assessmentsCount > 0) {
      setYearFilter('all');
      setScheduleDoneInfo({
        classesCount: meta.classesCount,
        assessmentsCount: meta.assessmentsCount,
        source: meta.source,
        courseLabels: activeCourseLabels,
        slotSummaries: meta.slotSummaries,
      });
    }

    const parts: string[] = [];
    if (importedCourses.length > 0) parts.push(t('shell.rec', { count: importedCourses.length }));
    if (meta.classesCount > 0) parts.push(t('shell.classes', { count: meta.classesCount }));
    if (meta.assessmentsCount > 0) parts.push(t('shell.assess', { count: meta.assessmentsCount }));
    setOcrError(null);
    setOcrFeedback(
      hasActiveItems
        ? t('shell.readyBySchedule', { parts: parts.join(', ') })
        : t('shell.imported', { parts: parts.join(', ') }),
    );
    void hapticSuccess();
  };

  const handleUniversityChange = (nextUniId: string) => {
    setUniversityId(nextUniId);
    const uni = getUniversityById(nextUniId, catalog);
    const firstDegreeId = uni?.degrees[0]?.id ?? 'outro';
    setDegreeId(firstDegreeId);
    let nextCycle = academicCycle;
    let nextYears = activeYears;
    if (nextUniId === 'escola-secundario') {
      nextCycle = 'licenciatura';
      nextYears = [1];
      setAcademicCycle(nextCycle);
      setActiveYears(nextYears);
    } else if (firstDegreeId === 'memec') {
      nextCycle = 'mestrado';
      nextYears = [4];
      setAcademicCycle(nextCycle);
      setActiveYears(nextYears);
    } else if (firstDegreeId === 'lemc-memec') {
      nextCycle = 'misto';
      nextYears = [3, 4];
      setAcademicCycle(nextCycle);
      setActiveYears(nextYears);
    }
    setTargetTotalEcts(defaultTargetEctsForCycle(nextCycle, firstDegreeId));
    rebuildRecords(nextUniId, firstDegreeId, nextYears, currentSemester);
    const hasGraded = useStore.getState().assessments.some((a) => typeof a.grade === 'number');
    if (!hasGraded && nextUniId !== 'outra') {
      updateSettings({ gradingScale: defaultScaleForUniversity(nextUniId, catalog) });
    }
  };

  const handleDegreeChange = (nextDegId: string) => {
    setDegreeId(nextDegId);
    let nextCycle = academicCycle;
    let nextYears = activeYears;
    if (nextDegId === 'memec') {
      nextCycle = 'mestrado';
      setAcademicCycle(nextCycle);
      nextYears = activeYears.filter((y) => y >= 4);
      if (nextYears.length === 0) nextYears = [4];
      setActiveYears(nextYears);
    } else if (nextDegId === 'lemc-memec') {
      nextCycle = 'misto';
      setAcademicCycle(nextCycle);
    } else if (nextDegId === 'lemc' && academicCycle === 'mestrado') {
      nextCycle = 'licenciatura';
      nextYears = [1];
      setAcademicCycle(nextCycle);
      setActiveYears(nextYears);
    }
    setTargetTotalEcts(defaultTargetEctsForCycle(nextCycle, nextDegId));
    rebuildRecords(universityId, nextDegId, nextYears, currentSemester);
  };

  const handleCycleChange = (nextCycle: AcademicCycleMode) => {
    void hapticTap();
    setAcademicCycle(nextCycle);
    let nextDeg = degreeId;
    let nextYears = [...activeYears];

    if (nextCycle === 'mestrado') {
      nextYears = nextYears.filter((y) => y >= 4);
      if (nextYears.length === 0) nextYears = [4];
      if (universityId === 'nova-fct' && degreeId === 'lemc') nextDeg = 'memec';
    } else if (nextCycle === 'misto') {
      if (nextYears.length === 0) nextYears = [2, 3, 4];
      if (universityId === 'nova-fct' && (degreeId === 'lemc' || degreeId === 'memec')) nextDeg = 'lemc-memec';
    } else {
      nextYears = nextYears.filter((y) => y <= 3);
      if (nextYears.length === 0) nextYears = [1];
      if (universityId === 'nova-fct' && (degreeId === 'memec' || degreeId === 'lemc-memec')) nextDeg = 'lemc';
    }

    setDegreeId(nextDeg);
    setActiveYears(nextYears);
    setTargetTotalEcts(defaultTargetEctsForCycle(nextCycle, nextDeg));
    setNewCourseYear(nextYears[nextYears.length - 1] ?? 1);
    rebuildRecords(universityId, nextDeg, nextYears, currentSemester);
  };

  const handleSelectEctsTarget = (total: number) => {
    void hapticTap();
    setTargetTotalEcts(total);
    setCompletedEcts((prev) => Math.min(total, prev));
    if (total === 300) {
      if (academicCycle !== 'misto') handleCycleChange('misto');
    } else if (total === 120) {
      if (academicCycle !== 'mestrado') handleCycleChange('mestrado');
    } else if (academicCycle === 'mestrado') {
      handleCycleChange('licenciatura');
    }
  };

  const handleApplyEctsStage = () => {
    void hapticTap();
    const inferred = inferAcademicStageFromEcts(completedEcts, targetTotalEcts);
    const nextCycle = inferred.recommendedCycle;
    const nextYears = nextCycle === 'misto' ? [3, 4] : [inferred.estimatedYear];
    let nextDeg = degreeId;
    if (universityId === 'nova-fct') {
      if (nextCycle === 'mestrado') nextDeg = 'memec';
      else if (nextCycle === 'misto') nextDeg = 'lemc-memec';
      else nextDeg = 'lemc';
    }
    setAcademicCycle(nextCycle);
    setDegreeId(nextDeg);
    setActiveYears(nextYears);
    setNewCourseYear(inferred.estimatedYear);
    rebuildRecords(universityId, nextDeg, nextYears, currentSemester);
  };

  const toggleLearningChallenge = (id: string) => {
    void hapticTap();
    setLearningChallenges((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleExtraPreset = (preset: (typeof EXTRA_ACTIVITY_PRESETS)[number]) => {
    void hapticTap();
    const exists = extraActivities.find((a) => a.kind === preset.kind || a.label === preset.label);
    if (exists) {
      setExtraActivities((prev) => prev.filter((a) => a.id !== exists.id));
      return;
    }
    setExtraActivities((prev) => [...prev, { id: newId(), ...preset }]);
  };

  const handleAddCustomExtra = () => {
    const label = customExtraLabel.trim();
    if (!label) return;
    void hapticTap();
    setExtraActivities((prev) => [
      ...prev,
      {
        id: newId(),
        label,
        kind: 'outro',
        hoursPerWeek: Math.max(1, Math.min(40, customExtraHours || 3)),
        weekdays: [2, 4],
      },
    ]);
    setCustomExtraLabel('');
  };

  const toggleYearPill = (year: number) => {
    void hapticTap();
    let nextYears: number[];
    if (academicCycle === 'misto') {
      if (activeYears.includes(year)) {
        if (activeYears.length === 1) return;
        nextYears = activeYears.filter((y) => y !== year);
      } else {
        nextYears = [...activeYears, year].sort((a, b) => a - b);
      }
    } else {
      nextYears = [year];
    }
    setActiveYears(nextYears);
    setNewCourseYear(nextYears[nextYears.length - 1] ?? year);
    rebuildRecords(universityId, degreeId, nextYears, currentSemester);
  };

  const handleSemesterChange = (semester: 1 | 2) => {
    void hapticTap();
    setCurrentSemester(semester);
    rebuildRecords(universityId, degreeId, activeYears, semester);
  };

  const templateEligibleYearsByCode = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const tpl of currentDegreeTemplates) {
      if (tpl.eligibleYears && tpl.eligibleYears.length > 0) {
        map.set(tpl.code.toLowerCase(), tpl.eligibleYears);
      }
    }
    return map;
  }, [currentDegreeTemplates]);

  const getRecordEligibleYears = useCallback(
    (r: CompletedCourseRecord): number[] => {
      if (r.eligibleYears && r.eligibleYears.length > 0) return r.eligibleYears;
      const fromTpl = templateEligibleYearsByCode.get(r.code.toLowerCase());
      if (fromTpl && fromTpl.length > 0) return fromTpl;
      return [r.year];
    },
    [templateEligibleYearsByCode],
  );

  const updateRecordStatus = (id: string, status: CompletedCourseRecord['status']) => {
    void hapticTap();
    setRecords((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const targetYear = yearFilter !== 'all' ? yearFilter : primaryAcademicYear;
        const eligible = getRecordEligibleYears(r);
        const alignedYear =
          status === 'a_fazer' && r.isOptional && eligible.includes(targetYear)
            ? targetYear
            : r.year;
        return {
          ...r,
          year: alignedYear,
          status,
          ...(status !== 'aprovada' ? { grade: undefined } : {}),
        };
      }),
    );
  };

  const removeRecord = (record: CompletedCourseRecord) => {
    void hapticTap();
    if (record.isOptional) {
      setRecords((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, status: 'por_fazer', grade: undefined } : r)),
      );
      return;
    }
    setRecords((prev) => prev.filter((r) => r.id !== record.id));
  };

  const updateRecordGrade = (id: string, raw: string) => {
    const val = parsePtGrade(raw);
    if (val === 'invalid') return;
    setRecords((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              grade: val ?? undefined,
              status: val !== null && val >= 10 ? 'aprovada' : r.status,
            }
          : r,
      ),
    );
  };

  const handleApplyPastedCurriculum = (mode: 'replace' | 'merge') => {
    const parsed = parseCurriculumFromText(pastedPlanText, primaryAcademicYear, currentSemester);
    if (parsed.length === 0) {
      setOcrError(t('shell.noCoursesText'));
      return;
    }

    const targetYears = activeYears.length > 0 ? activeYears : [primaryAcademicYear];
    const minY = Math.min(...targetYears);
    const mapped: CompletedCourseRecord[] = parsed.map((c, idx) => {
      const isSelected = targetYears.includes(c.year);
      const isCur = isSelected && c.semester === currentSemester;
      const isPast = c.year < minY || (isSelected && c.semester < currentSemester);
      return {
        id: `hist-paste-${c.code.toLowerCase()}-${c.year}-${c.semester}-${idx}`,
        code: c.code,
        name: c.name,
        year: c.year,
        semester: c.semester,
        ects: c.ects,
        ...(c.optional ? { isOptional: true } : {}),
        status: c.optional ? 'por_fazer' : isPast ? 'aprovada' : isCur ? 'a_fazer' : 'por_fazer',
      };
    });

    if (mode === 'replace') {
      setRecords(mapped);
    } else {
      setRecords((prev) => {
        const seen = new Set(prev.map((r) => `${r.year}:${r.name.toLowerCase()}`));
        const additions = mapped.filter((m) => !seen.has(`${m.year}:${m.name.toLowerCase()}`));
        return [...prev, ...additions];
      });
    }

    setOcrError(null);
    setOcrFeedback(t('shell.pastedN', { count: parsed.length }));
    setShowPastePlan(false);
    setPastedPlanText('');
    setYearFilter('all');
    void hapticSuccess();
  };

  const addCustomRecord = () => {
    const name = newCourseName.trim();
    if (!name) return;
    const code = (newCourseCode.trim() || name.slice(0, 5)).toUpperCase();
    const chosenYear = Math.min(5, Math.max(1, Number(newCourseYear) || primaryAcademicYear));
    setRecords((prev) => [
      {
        id: `hist-custom-${Date.now().toString(36)}`,
        code,
        name,
        year: chosenYear,
        semester: currentSemester,
        ects: Math.max(1, Math.min(30, Number(newCourseEcts) || (isSecondarySchool ? 4 : 6))),
        status: 'a_fazer',
      },
      ...prev,
    ]);
    setNewCourseCode('');
    setNewCourseName('');
    void hapticSuccess();
  };

  const handleScreenshotUpload = async (
    files: FileList | File[] | null,
    bypassConsentCheck = false,
  ) => {
    const pickedFiles = files ? Array.from(files) : [];
    if (pickedFiles.length === 0) return;
    const imageFiles = pickedFiles.filter((f) => {
      if (f.type.startsWith('image/')) return true;
      return /\.(png|jpe?g|webp|gif|heic|heif|bmp)$/i.test(f.name);
    });
    if (imageFiles.length === 0) {
      setOcrError(t('shell.badImage'));
      return;
    }

    if (!aiConsent && !bypassConsentCheck) {
      setOcrError(null);
      setPendingPrintFilesForConsent(imageFiles);
      return;
    }
    setPendingPrintFilesForConsent(null);

    setOcrBusy(true);
    setOcrError(null);
    setOcrFeedback(null);

    try {
      const storeState = useStore.getState();
      const knownCourses = collectKnownCourseCandidates({
        courses: storeState.courses,
        completedCourses: records,
        degreeTemplates: currentDegreeTemplates,
      });

      const historyItems: ExtractedHistoryItem[] = [];
      const scheduleSlots: ExtractedScheduleSlot[] = [];
      const scheduleAssessments: ExtractedScheduleAssessment[] = [];
      let firstError: Error | null = null;
      let anySucceeded = false;

      for (const file of imageFiles) {
        const { base64, mimeType } = await readNormalizedScreenshot(file);

        try {
          const scheduleRes = await parseTimetableFromScreenshot(base64, mimeType, {
            focus: 'schedule',
            knownCourses,
          });
          anySucceeded = true;
          scheduleSlots.push(...scheduleRes.slots);
          scheduleAssessments.push(...scheduleRes.assessments);
        } catch (err) {
          if (!firstError) firstError = err instanceof Error ? err : new Error(String(err));
        }

        try {
          const historyRes = await parseAcademicHistoryFromScreenshot(base64, mimeType, {
            currentSemester,
            knownCourses,
          });
          anySucceeded = true;
          historyItems.push(...historyRes);
        } catch (err) {
          if (!firstError) firstError = err instanceof Error ? err : new Error(String(err));
        }
      }

      if (!anySucceeded && firstError) throw firstError;

      if (historyItems.length === 0 && scheduleSlots.length === 0 && scheduleAssessments.length === 0) {
        setOcrError(t('shell.noRecognise'));
        return;
      }

      const resolvedHistory = historyItems.map((item) => {
        const resolved = resolveKnownCourseIdentity(
          { code: item.code, name: item.name },
          knownCourses,
          currentDegreeTemplates,
        );
        return resolved
          ? {
              ...item,
              code: resolved.shortName || resolved.code || item.code,
              name: resolved.name,
              ects: item.ects ?? resolved.ects,
            }
          : item;
      });

      const resolvedSlots = scheduleSlots.map((slot) => {
        const resolved = resolveKnownCourseIdentity(
          { code: slot.courseCode, name: slot.courseName },
          knownCourses,
          currentDegreeTemplates,
        );
        return resolved
          ? {
              ...slot,
              courseCode: resolved.shortName || resolved.code || slot.courseCode,
              courseName: resolved.name,
            }
          : slot;
      });

      const resolvedAssessments = scheduleAssessments.map((a) => {
        const resolved = resolveKnownCourseIdentity(
          { name: a.courseName },
          knownCourses,
          currentDegreeTemplates,
        );
        return resolved ? { ...a, courseName: resolved.name } : a;
      });

      const importedCourses: ImportedRecordCourseInput[] = [
        ...resolvedHistory.map((item) => ({
          code: item.code,
          name: item.name,
          ects: item.ects,
          semester: item.semester,
          status: item.status,
          grade: item.grade,
        })),
        ...resolvedSlots.map((slot) => ({
          code: slot.courseCode,
          name: slot.courseName,
          ects: isSecondarySchool ? 4 : 6,
          semester: currentSemester,
          status: 'a_fazer' as const,
        })),
        ...resolvedAssessments.map((a) => ({
          name: a.courseName,
          ects: isSecondarySchool ? 4 : 6,
          semester: currentSemester,
          status: 'a_fazer' as const,
        })),
      ];

      let slotSummaries: string[] | undefined;
      if (resolvedSlots.length > 0 || resolvedAssessments.length > 0) {
        const state = useStore.getState();
        const currentCourses = [...state.courses];
        const createdCourses: Course[] = [];
        let colorIdx = currentCourses.length;
        const palette =
          colorNames.length > 0 ? colorNames : (['emerald', 'sky', 'amber'] as CourseColor[]);

        const ensureCourseId = (courseName: string, courseCode?: string): string => {
          const matched = matchCourse(courseName, [...currentCourses, ...createdCourses], courseCode);
          if (matched) return matched.id;

          const code = deriveCourseAcronym(courseName, courseCode);
          const created: Course = {
            id: newId(),
            code,
            name: courseName,
            shortName: code.slice(0, 12),
            ects: isSecondarySchool ? 4 : 6,
            color: palette[colorIdx++ % palette.length] ?? 'emerald',
            targetGrade: 14,
            topics: [],
          };
          createdCourses.push(created);
          return created.id;
        };

        const importedClasses: ClassSlot[] = resolvedSlots.map((s) => ({
          id: newId(),
          courseId: ensureCourseId(s.courseName, s.courseCode),
          type: s.type,
          weekday: s.weekday,
          start: s.start,
          end: s.end,
          room: s.room,
          source: 'local',
        }));

        const allKnown = [...currentCourses, ...createdCourses];
        slotSummaries = resolvedSlots.map((s, idx) => {
          const cls = importedClasses[idx];
          const crs = cls ? allKnown.find((c) => c.id === cls.courseId) : undefined;
          const dayLabel = weekdayLong[s.weekday]?.slice(0, 3) ?? '';
          return `${dayLabel} ${s.start}–${s.end} · ${crs?.shortName || crs?.name || s.courseName} (${s.type})`;
        });

        const importedAssessments: Assessment[] = resolvedAssessments.map((a) => ({
          id: newId(),
          courseId: ensureCourseId(a.courseName),
          kind: a.kind,
          title: a.title,
          date: a.date,
          weight: 30,
          topicIds: [],
          source: 'local',
        }));

        if (createdCourses.length > 0) state.upsertMany('courses', createdCourses);
        if (importedClasses.length > 0) state.upsertMany('classes', importedClasses);
        if (importedAssessments.length > 0) state.upsertMany('assessments', importedAssessments);
      }

      applyScheduleScopeToRecords(importedCourses, {
        classesCount: resolvedSlots.length,
        assessmentsCount: resolvedAssessments.length,
        source: 'print',
        slotSummaries,
      });
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : t('shell.ocrError'));
    } finally {
      setOcrBusy(false);
    }
  };

  const handleConnectAcademic = async () => {
    setAcademicBusy(true);
    try {
      const cleaned = academicHint.trim();
      if (cleaned) updateSettings({ academicEmail: cleaned });
      await connectAcademicMail(false, cleaned || undefined);
      void hapticSuccess();
    } finally {
      setAcademicBusy(false);
    }
  };

  const scopedRecords = useMemo(() => {
    if (showOtherTermsHistory) return records;
    return records.filter((r) => {
      if (r.status === 'a_fazer') return true;
      if (r.semester !== currentSemester) return false;
      const eligibleYears = getRecordEligibleYears(r);
      return activeYears.some((y) => eligibleYears.includes(y));
    });
  }, [records, showOtherTermsHistory, activeYears, currentSemester, getRecordEligibleYears]);

  const availableRecordYears = useMemo(() => {
    const set = new Set<number>(scopedRecords.map((r) => r.year));
    return Array.from(set).sort((a, b) => a - b);
  }, [scopedRecords]);

  const effectiveYearFilter: number | 'all' =
    yearFilter === 'all' || availableRecordYears.includes(yearFilter) ? yearFilter : 'all';

  const filteredRecords = useMemo(() => {
    if (effectiveYearFilter === 'all') return scopedRecords;
    return scopedRecords.filter((r) =>
      r.isOptional && r.status === 'por_fazer'
        ? getRecordEligibleYears(r).includes(effectiveYearFilter)
        : r.year === effectiveYearFilter,
    );
  }, [scopedRecords, effectiveYearFilter, getRecordEligibleYears]);

  const mainFilteredRecords = useMemo(
    () => filteredRecords.filter((r) => !(r.isOptional && r.status === 'por_fazer')),
    [filteredRecords],
  );

  const optionalAvailableRecords = useMemo(() => {
    const q = optionalSearch.trim().toLowerCase();
    return filteredRecords.filter((r) => {
      if (!(r.isOptional && r.status === 'por_fazer')) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
    });
  }, [filteredRecords, optionalSearch]);

  const approvedEctsFromList = useMemo(
    () => records.filter((r) => r.status === 'aprovada').reduce((sum, r) => sum + (r.ects || 6), 0),
    [records],
  );
  const activeEctsFromList = useMemo(
    () => records.filter((r) => r.status === 'a_fazer').reduce((sum, r) => sum + (r.ects || 6), 0),
    [records],
  );

  const activeCandidates = useMemo(() => {
    const activeFromRecords = records.filter((r) => r.status === 'a_fazer');
    if (replaceCoursesWithCurriculum && activeFromRecords.length > 0) {
      return activeFromRecords.map((r) => ({ key: r.code, label: `${r.code} · ${r.name}` }));
    }
    return existingCourses.map((c) => ({ key: c.id, label: `${c.shortName} · ${c.name}` }));
  }, [records, replaceCoursesWithCurriculum, existingCourses]);

  const toggleDifficult = (key: string) => {
    void hapticTap();
    setDifficultKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const toggleStudyDay = (day: number) => {
    void hapticTap();
    setStudyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  };

  const weightedAvg = useMemo(() => computeWeightedAverage(records), [records]);
  const approvedCount = records.filter((r) => r.status === 'aprovada').length;
  const doingCount = records.filter((r) => r.status === 'a_fazer').length;

  const handleGoNext = async () => {
    setDirection(1);
    void hapticTap();
    await next();
  };

  const handleGoPrev = async () => {
    setDirection(-1);
    void hapticTap();
    await previous();
  };

  const handleFinish = () => {
    setSubmitAttempted(true);
    if (!ageConfirmed) {
      requestAnimationFrame(() => {
        const el = document.getElementById('onboarding-age-confirm');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.focus({ preventScroll: true });
      });
      return;
    }

    const uniName =
      universityId === 'outra'
        ? customUniversity.trim() || t('shell.fallback.otherUni')
        : selectedUniversity?.name ?? t('shell.fallback.ptUni');
    const degName =
      degreeId === 'outro'
        ? customDegree.trim() || t('shell.fallback.customPlan')
        : availableDegrees.find((d) => d.id === degreeId)?.name ?? t('shell.fallback.academicPath');

    const profile: AcademicProfile = {
      onboardingCompleted: true,
      universityId,
      universityName: uniName,
      degreeId,
      degreeName: degName,
      entryYear,
      currentAcademicYear: primaryAcademicYear,
      academicCycle,
      activeYears,
      currentSemester,
      targetTotalEcts,
      completedEcts,
      learningChallenges,
      extraActivities,
      difficultCourseIds: difficultKeys,
      difficultTopicsNotes: difficultNotes.trim(),
      completedCourses: records,
    };

    updateSettings({
      userName: userName.trim() || t('shell.fallback.student'),
      theme: themePref,
      themePalette,
      appTone,
      uniAccessory,
      uniPersona,
      uniLiveCompanions,
      dailyStudyMinutes: Math.max(30, Math.min(900, dailyMinutes || 180)),
      studyDays: studyDays.length > 0 ? studyDays : [1, 2, 3, 4, 5, 6],
      ageConfirmed13Plus: ageConfirmed,
      gdprAcceptedAt: settings.gdprAcceptedAt || new Date().toISOString(),
      gdprPolicyVersion: LEGAL_INFO.policyVersion,
      aiConsent,
      cloudSyncConsent,
      tourCompleted: true,
      hasSeenWelcome: true,
      ...(!auth.currentUser ? { guestMode: true } : {}),
    });

    if (replaceCoursesWithCurriculum && doingCount > 0) {
      const built = buildActiveCoursesFromCurriculum(
        profile.universityId,
        profile.degreeId,
        profile.completedCourses,
        useStore.getState().courses,
      );
      applyBuiltCurriculumCourses(profile, built);
    } else {
      saveAcademicProfile(profile);
    }

    if (auth.currentUser && (universityId === 'outra' || degreeId === 'outro') && records.length > 0) {
      const customUniSlug =
        (uniName || 'outra')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
          .slice(0, 40) || 'outra';
      const customDegSlug =
        (degName || 'curso')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
          .slice(0, 40) || 'curso';
      publishSharedCurriculum({
        id: `${customUniSlug}-${customDegSlug}`,
        universityId: customUniSlug,
        universityName: uniName,
        degreeId: customDegSlug,
        degreeName: degName,
        courses: records.slice(0, 60).map((r) => ({
          code: r.code,
          name: r.name,
          shortName: r.code,
          year: ([1, 2, 3, 4, 5].includes(r.year) ? r.year : 1) as 1 | 2 | 3 | 4 | 5,
          semester: r.semester,
          ects: r.ects || 6,
          topics: [r.name],
        })),
      }).catch(() => {});
    }

    celebrateStationery();
    void hapticSuccess();

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (fullScreen && !prefersReduced) {
      setFinishingWipe(true);
      window.setTimeout(() => {
        onClose();
      }, 360);
    } else {
      onClose();
    }
  };

  return {
    activeStepId,
    stepIndex,
    direction,
    finishingWipe,
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
    catalog,
    universityId,
    handleUniversityChange,
    customUniversity,
    setCustomUniversity,
    degreeId,
    handleDegreeChange,
    customDegree,
    setCustomDegree,
    availableDegrees,
    isSecondarySchool,
    academicCycle,
    handleCycleChange,
    yearChoices,
    activeYears,
    toggleYearPill,
    currentSemester,
    handleSemesterChange,
    entryYear,
    setEntryYear,
    targetTotalEcts,
    handleSelectEctsTarget,
    completedEcts,
    setCompletedEcts,
    ectsStage,
    handleApplyEctsStage,
    learningChallenges,
    toggleLearningChallenge,
    extraActivities,
    setExtraActivities,
    toggleExtraPreset,
    customExtraLabel,
    setCustomExtraLabel,
    customExtraHours,
    setCustomExtraHours,
    handleAddCustomExtra,
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
    doingCount,
    approvedCount,
    weightedAvg,
    approvedEctsFromList,
    activeEctsFromList,
    updateRecordStatus,
    updateRecordGrade,
    removeRecord,
    resetRecordsToDegreeDefaults,
    replaceCoursesWithCurriculum,
    setReplaceCoursesWithCurriculum,
    existingCourses,
    newCourseCode,
    setNewCourseCode,
    newCourseName,
    setNewCourseName,
    newCourseYear,
    setNewCourseYear,
    newCourseEcts,
    setNewCourseEcts,
    addCustomRecord,
    scheduleImportMode,
    setScheduleImportMode,
    scheduleImportBaseline,
    setScheduleImportBaseline,
    handleScreenshotUpload,
    ocrBusy,
    ocrFeedback,
    ocrError,
    scheduleDoneInfo,
    showPastePlan,
    setShowPastePlan,
    pastedPlanText,
    setPastedPlanText,
    handleApplyPastedCurriculum,
    pendingPrintFilesForConsent,
    setPendingPrintFilesForConsent,
    setAiConsent,
    dailyMinutes,
    setDailyMinutes,
    studyDays,
    toggleStudyDay,
    activeCandidates,
    difficultKeys,
    toggleDifficult,
    difficultNotes,
    setDifficultNotes,
    academicMailConnected,
    academicEmail,
    academicHint,
    setAcademicHint,
    academicBusy,
    handleConnectAcademic,
    ageConfirmed,
    setAgeConfirmed,
    aiConsent,
    updateSettings,
    cloudSyncConsent,
    setCloudSyncConsent,
    activePersonalEmail: settings.personalEmail || auth.currentUser?.email || '',
    submitAttempted,
    legalPreview,
    setLegalPreview,
    canSkipDirectly: storedProfile.onboardingCompleted && ageConfirmed,
    applyScheduleScopeToRecords,
    handleGoNext,
    handleGoPrev,
    handleFinish,
  };
}
