import { OnboardingProvider, useOnboarding } from '@onboardjs/react';
import type { OnboardingStep } from '@onboardjs/core';
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { colorNames } from '../../lib/colors';
import { parseCurriculumFromText } from '../../lib/curriculumParser';
import { auth } from '../../lib/firebase';
import {
  fetchSharedCurriculaFromCloud,
  publishSharedCurriculum,
} from '../../lib/firestoreSync';
import { readNormalizedScreenshot } from '../../lib/imageUpload';
import { LEGAL_INFO } from '../../lib/legal';
import { hapticSuccess, hapticTap, syncNativeTheme } from '../../lib/nativeBridge';
import {
  applyImportedScheduleRecords,
  buildInitialCompletedRecords,
  computeWeightedAverage,
  deriveCourseAcronym,
  getUniversityById,
  mergeCurriculumCatalog,
  PORTUGAL_CURRICULA,
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
import { UnipediaLogoMark } from '../brand/UnipediaMarks';
import SmartScheduleImportModal, {
  type SmartImportInitialMode,
  type SmartScheduleImportSummary,
} from '../courses/SmartScheduleImportModal';
import { celebrateStationery, UNIPEDIA_SPRING } from '../motion/Primitives';
import { Button, cx } from '../ui';
import Step1Identity from './steps/Step1Identity';
import Step2Academic, { type AcademicCycleMode } from './steps/Step2Academic';
import Step3Courses from './steps/Step3Courses';
import Step4RhythmPrivacy from './steps/Step4RhythmPrivacy';

export type OnboardingStepId = 'identidade' | 'curso' | 'cadeiras' | 'ritmo';

type OnboardingContextData = {
  flowData: Record<string, unknown>;
  flowVersion: string;
};

const ONBOARDING_STEPS: OnboardingStep<OnboardingContextData>[] = [
  { id: 'identidade', type: 'INFORMATION', nextStep: 'curso' },
  { id: 'curso', type: 'INFORMATION', previousStep: 'identidade', nextStep: 'cadeiras' },
  { id: 'cadeiras', type: 'INFORMATION', previousStep: 'curso', nextStep: 'ritmo' },
  { id: 'ritmo', type: 'CONFIRMATION', previousStep: 'cadeiras', nextStep: null },
];

const STEP_META: Array<{ id: OnboardingStepId; label: string }> = [
  { id: 'identidade', label: 'Tu & Estilo' },
  { id: 'curso', label: 'Curso & Semestre' },
  { id: 'cadeiras', label: 'Cadeiras' },
  { id: 'ritmo', label: 'Ritmo & Privacidade' },
];

export interface OnboardingExperienceProps {
  onClose: () => void;
  fullScreen?: boolean;
  initialStepId?: OnboardingStepId;
}

function OnboardingFlowBody({ onClose, fullScreen = true }: OnboardingExperienceProps) {
  const settings = useStore((s) => s.settings);
  const existingCourses = useStore((s) => s.courses);
  const storedProfile = useStore((s) => s.academicProfile);
  const updateSettings = useStore((s) => s.updateSettings);
  const saveAcademicProfile = useStore((s) => s.saveAcademicProfile);
  const applyCurriculumCourses = useStore((s) => s.applyCurriculumCourses);

  const {
    connected: academicMailConnected,
    academicEmail,
    connect: connectAcademicMail,
  } = useAcademicEmails('onboarding');

  const { currentStep, next, previous } = useOnboarding<OnboardingContextData>();
  const activeStepId = (currentStep?.id as OnboardingStepId) ?? 'identidade';
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
  const [scheduleDoneInfo, setScheduleDoneInfo] = useState<{
    classesCount: number;
    source: 'photo' | 'gcal' | 'print';
  } | null>(null);
  const [scheduleImportMode, setScheduleImportMode] = useState<SmartImportInitialMode | null>(null);
  const [scheduleImportBaseline, setScheduleImportBaseline] = useState<{
    courses: number;
    classes: number;
    assessments: number;
  } | null>(null);
  const [showPastePlan, setShowPastePlan] = useState(false);
  const [pastedPlanText, setPastedPlanText] = useState('');

  // Passo 4: Ritmo, Email Académico & Privacidade (aiConsent opt-in explícito: false por defeito!)
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
      // Deduz ECTS aprovados automaticamente a partir dos anos anteriores selecionados
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
    meta: { classesCount: number; assessmentsCount: number; source: 'photo' | 'gcal' | 'print' },
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

    if (hasActiveItems) {
      setYearFilter('all');
      setScheduleDoneInfo({ classesCount: meta.classesCount, source: meta.source });
    }

    const parts: string[] = [];
    if (importedCourses.length > 0) parts.push(`${importedCourses.length} registo(s)`);
    if (meta.classesCount > 0) parts.push(`${meta.classesCount} aula(s) no horário`);
    if (meta.assessmentsCount > 0) parts.push(`${meta.assessmentsCount} avaliação(ões)`);
    setOcrError(null);
    setOcrFeedback(
      hasActiveItems
        ? `Etapa pronta pelo teu horário: ${parts.join(', ')}. As restantes ficaram arrumadas em «Depois».`
        : `Importado com sucesso: ${parts.join(', ')}.`,
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
    const exists = extraActivities.find((a) => a.label === preset.label);
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
      setOcrError(
        'Não detetei cadeiras nesse texto. Cola a tabela do portal académico ou escreve uma cadeira por linha.',
      );
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
    setOcrFeedback(
      `${parsed.length} ${parsed.length === 1 ? 'cadeira importada' : 'cadeiras importadas'} diretamente do texto colado!`,
    );
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

  const handleScreenshotUpload = async (files: FileList | null) => {
    const pickedFiles = files ? Array.from(files) : [];
    if (pickedFiles.length === 0) return;
    const imageFiles = pickedFiles.filter((f) => {
      if (f.type.startsWith('image/')) return true;
      return /\.(png|jpe?g|webp|gif|heic|heif|bmp)$/i.test(f.name);
    });
    if (imageFiles.length === 0) {
      setOcrError('Seleciona uma imagem válida (PNG, JPG, WebP ou print do horário).');
      return;
    }

    if (!aiConsent) {
      setOcrError('Ativa a opção do Tutor Uni no passo seguinte (ou nas Definições) para ler prints com IA, ou usa «Colar texto do portal».');
      return;
    }

    setOcrBusy(true);
    setOcrError(null);
    setOcrFeedback(null);

    try {
      const historyItems: ExtractedHistoryItem[] = [];
      const scheduleSlots: ExtractedScheduleSlot[] = [];
      const scheduleAssessments: ExtractedScheduleAssessment[] = [];
      let firstError: Error | null = null;
      let anySucceeded = false;

      for (const file of imageFiles) {
        const { base64, mimeType } = await readNormalizedScreenshot(file);

        try {
          const scheduleRes = await parseTimetableFromScreenshot(base64, mimeType);
          anySucceeded = true;
          scheduleSlots.push(...scheduleRes.slots);
          scheduleAssessments.push(...scheduleRes.assessments);
        } catch (err) {
          if (!firstError) firstError = err instanceof Error ? err : new Error(String(err));
        }

        try {
          const historyRes = await parseAcademicHistoryFromScreenshot(base64, mimeType, {
            currentSemester,
          });
          anySucceeded = true;
          historyItems.push(...historyRes);
        } catch (err) {
          if (!firstError) firstError = err instanceof Error ? err : new Error(String(err));
        }
      }

      if (!anySucceeded && firstError) throw firstError;

      if (historyItems.length === 0 && scheduleSlots.length === 0 && scheduleAssessments.length === 0) {
        setOcrError(
          'Não consegui reconhecer cadeiras nem aulas nessas imagens. Tenta um print mais nítido da pauta ou do horário semanal.',
        );
        return;
      }

      const importedCourses: ImportedRecordCourseInput[] = [
        ...historyItems.map((item) => ({
          code: item.code,
          name: item.name,
          ects: item.ects,
          semester: item.semester,
          status: item.status,
          grade: item.grade,
        })),
        ...scheduleSlots.map((slot) => ({
          code: slot.courseCode,
          name: slot.courseName,
          ects: isSecondarySchool ? 4 : 6,
          semester: currentSemester,
          status: 'a_fazer' as const,
        })),
        ...scheduleAssessments.map((a) => ({
          name: a.courseName,
          ects: isSecondarySchool ? 4 : 6,
          semester: currentSemester,
          status: 'a_fazer' as const,
        })),
      ];

      if (scheduleSlots.length > 0 || scheduleAssessments.length > 0) {
        const state = useStore.getState();
        const currentCourses = [...state.courses];
        const createdCourses: Course[] = [];
        let colorIdx = currentCourses.length;
        const palette =
          colorNames.length > 0 ? colorNames : (['emerald', 'sky', 'amber'] as CourseColor[]);

        const ensureCourseId = (courseName: string, courseCode?: string): string => {
          const matched =
            matchCourse(courseName, [...currentCourses, ...createdCourses]) ||
            (courseCode ? matchCourse(courseCode, [...currentCourses, ...createdCourses]) : undefined);
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

        const importedClasses: ClassSlot[] = scheduleSlots.map((s) => ({
          id: newId(),
          courseId: ensureCourseId(s.courseName, s.courseCode),
          type: s.type,
          weekday: s.weekday,
          start: s.start,
          end: s.end,
          room: s.room,
          source: 'local',
        }));

        const importedAssessments: Assessment[] = scheduleAssessments.map((a) => ({
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
        classesCount: scheduleSlots.length,
        assessmentsCount: scheduleAssessments.length,
        source: 'print',
      });
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : 'Erro ao analisar o print agora.');
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
    if (!ageConfirmed) return;

    const uniName =
      universityId === 'outra'
        ? customUniversity.trim() || 'Outra Instituição'
        : selectedUniversity?.name ?? 'Instituição Portuguesa';
    const degName =
      degreeId === 'outro'
        ? customDegree.trim() || 'Plano Personalizado'
        : availableDegrees.find((d) => d.id === degreeId)?.name ?? 'Percurso Académico';

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
      userName: userName.trim() || 'Estudante',
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
      // Sem auto-arranque intrusivo de Driver.js; o estudante pode sempre abrir o tour em Definições.
      tourCompleted: true,
      hasSeenWelcome: true,
      ...(!auth.currentUser ? { guestMode: true } : {}),
    });

    if (replaceCoursesWithCurriculum && doingCount > 0) {
      applyCurriculumCourses(profile);
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

  const canSkipDirectly = storedProfile.onboardingCompleted && ageConfirmed;
  const activePersonalEmail = settings.personalEmail || auth.currentUser?.email || '';

  return (
    <div
      className={cx(
        'relative flex flex-col overflow-hidden bg-bg text-fg',
        fullScreen ? 'h-[100dvh] w-full overflow-hidden' : 'w-full rounded-[22px]',
      )}
    >
      <AnimatePresence>
        {finishingWipe && (
          <motion.div
            aria-hidden="true"
            initial={{ clipPath: 'circle(0% at 86% 92%)' }}
            animate={{ clipPath: 'circle(155% at 86% 92%)' }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none fixed inset-0 z-[80] bg-accent"
          />
        )}
      </AnimatePresence>

      {/* Cabeçalho Estúdio Caderno Vivo */}
      <header className="sticky top-0 z-10 border-b border-line/70 bg-bg/92 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <UnipediaLogoMark size={34} />
            <div>
              <p className="font-display text-sm font-extrabold leading-tight text-fg">
                Unipedia
              </p>
              <p className="font-mono text-xs text-muted tabular">
                Passo {stepIndex + 1}/{STEP_META.length} · {STEP_META[stepIndex]?.label}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {STEP_META.map((item, idx) => {
                const isActive = idx === stepIndex;
                return (
                  <motion.span
                    key={item.id}
                    layout
                    transition={UNIPEDIA_SPRING}
                    className={cx(
                      'h-2 rounded-full transition-colors',
                      isActive
                        ? 'w-7 bg-accent'
                        : idx < stepIndex
                          ? 'w-2.5 bg-accent/45'
                          : 'w-2 bg-line',
                    )}
                  />
                );
              })}
            </div>

            {canSkipDirectly && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                Fechar
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Corpo em 4 passos curtos */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        <motion.div
          key={activeStepId}
          initial={{ opacity: 0, x: direction * 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5"
        >
          {activeStepId === 'identidade' && (
            <Step1Identity
              userName={userName}
              setUserName={setUserName}
              themePref={themePref}
              setThemePref={setThemePref}
              themePalette={themePalette}
              setThemePalette={setThemePalette}
              appTone={appTone}
              setAppTone={setAppTone}
              uniAccessory={uniAccessory}
              setUniAccessory={setUniAccessory}
              uniPersona={uniPersona}
              setUniPersona={setUniPersona}
              uniLiveCompanions={uniLiveCompanions}
              setUniLiveCompanions={setUniLiveCompanions}
            />
          )}

          {activeStepId === 'curso' && (
            <Step2Academic
              catalog={catalog}
              universityId={universityId}
              onUniversityChange={handleUniversityChange}
              customUniversity={customUniversity}
              setCustomUniversity={setCustomUniversity}
              degreeId={degreeId}
              onDegreeChange={handleDegreeChange}
              customDegree={customDegree}
              setCustomDegree={setCustomDegree}
              availableDegrees={availableDegrees}
              isSecondarySchool={isSecondarySchool}
              academicCycle={academicCycle}
              onCycleChange={handleCycleChange}
              yearChoices={yearChoices}
              activeYears={activeYears}
              onToggleYear={toggleYearPill}
              currentSemester={currentSemester}
              onSemesterChange={handleSemesterChange}
              entryYear={entryYear}
              setEntryYear={setEntryYear}
              targetTotalEcts={targetTotalEcts}
              onSelectEctsTarget={handleSelectEctsTarget}
              completedEcts={completedEcts}
              setCompletedEcts={setCompletedEcts}
              ectsStage={ectsStage}
              onApplyEctsStage={handleApplyEctsStage}
              learningChallenges={learningChallenges}
              onToggleChallenge={toggleLearningChallenge}
              extraActivities={extraActivities}
              onToggleExtraPreset={toggleExtraPreset}
              onRemoveExtra={(id) => setExtraActivities((prev) => prev.filter((a) => a.id !== id))}
              customExtraLabel={customExtraLabel}
              setCustomExtraLabel={setCustomExtraLabel}
              customExtraHours={customExtraHours}
              setCustomExtraHours={setCustomExtraHours}
              onAddCustomExtra={handleAddCustomExtra}
            />
          )}

          {activeStepId === 'cadeiras' && (
            <Step3Courses
              records={records}
              mainFilteredRecords={mainFilteredRecords}
              optionalAvailableRecords={optionalAvailableRecords}
              availableRecordYears={availableRecordYears}
              effectiveYearFilter={effectiveYearFilter}
              setYearFilter={setYearFilter}
              showOtherTermsHistory={showOtherTermsHistory}
              setShowOtherTermsHistory={setShowOtherTermsHistory}
              showOptionalCourses={showOptionalCourses}
              setShowOptionalCourses={setShowOptionalCourses}
              optionalSearch={optionalSearch}
              setOptionalSearch={setOptionalSearch}
              isSecondarySchool={isSecondarySchool}
              doingCount={doingCount}
              approvedCount={approvedCount}
              weightedAvg={weightedAvg}
              approvedEctsFromList={approvedEctsFromList}
              activeEctsFromList={activeEctsFromList}
              onUpdateStatus={updateRecordStatus}
              onUpdateGrade={updateRecordGrade}
              onRemoveRecord={removeRecord}
              onResetDefaults={resetRecordsToDegreeDefaults}
              replaceCoursesWithCurriculum={replaceCoursesWithCurriculum}
              setReplaceCoursesWithCurriculum={setReplaceCoursesWithCurriculum}
              hasExistingCourses={existingCourses.length > 0}
              newCourseCode={newCourseCode}
              setNewCourseCode={setNewCourseCode}
              newCourseName={newCourseName}
              setNewCourseName={setNewCourseName}
              newCourseYear={newCourseYear}
              setNewCourseYear={setNewCourseYear}
              newCourseEcts={newCourseEcts}
              setNewCourseEcts={setNewCourseEcts}
              onAddCustomRecord={addCustomRecord}
              yearChoices={yearChoices}
              onOpenScheduleImport={(mode) => {
                const st = useStore.getState();
                setScheduleImportBaseline({
                  courses: st.courses.length,
                  classes: st.classes.length,
                  assessments: st.assessments.length,
                });
                setScheduleImportMode(mode);
              }}
              onUploadScreenshot={(files) => void handleScreenshotUpload(files)}
              ocrBusy={ocrBusy}
              ocrFeedback={ocrFeedback}
              ocrError={ocrError}
              scheduleDoneInfo={scheduleDoneInfo}
              showPastePlan={showPastePlan}
              setShowPastePlan={setShowPastePlan}
              pastedPlanText={pastedPlanText}
              setPastedPlanText={setPastedPlanText}
              onApplyPasted={handleApplyPastedCurriculum}
            />
          )}

          {activeStepId === 'ritmo' && (
            <Step4RhythmPrivacy
              dailyMinutes={dailyMinutes}
              setDailyMinutes={setDailyMinutes}
              studyDays={studyDays}
              onToggleStudyDay={toggleStudyDay}
              activeCandidates={activeCandidates}
              difficultKeys={difficultKeys}
              onToggleDifficult={toggleDifficult}
              difficultNotes={difficultNotes}
              setDifficultNotes={setDifficultNotes}
              academicMailConnected={academicMailConnected}
              academicEmail={academicEmail ?? undefined}
              academicHint={academicHint}
              setAcademicHint={setAcademicHint}
              academicBusy={academicBusy}
              onConnectAcademic={() => void handleConnectAcademic()}
              ageConfirmed={ageConfirmed}
              setAgeConfirmed={setAgeConfirmed}
              aiConsent={aiConsent}
              setAiConsent={(next) => {
                setAiConsent(next);
                updateSettings({ aiConsent: next });
              }}
              cloudSyncConsent={cloudSyncConsent}
              setCloudSyncConsent={setCloudSyncConsent}
              isSignedIn={Boolean(auth.currentUser)}
              personalEmail={activePersonalEmail}
              submitAttempted={submitAttempted}
              onOpenLegal={setLegalPreview}
            />
          )}
        </motion.div>
      </main>

      {/* Rodapé de navegação */}
      <footer className="sticky bottom-0 z-10 border-t border-line/70 bg-bg/92 px-4 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          {stepIndex > 0 ? (
            <Button variant="ghost" onClick={() => void handleGoPrev()}>
              <ChevronLeft size={16} /> Anterior
            </Button>
          ) : (
            <span className="text-xs font-medium text-muted">
              Podes ajustar tudo mais tarde
            </span>
          )}

          {activeStepId !== 'ritmo' ? (
            <motion.button
              type="button"
              layoutId="onboarding-cta"
              transition={UNIPEDIA_SPRING}
              onClick={() => void handleGoNext()}
              whileTap={{ scale: 0.94 }}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-ink-cta px-5 text-sm font-bold text-ink-cta-fg shadow-card transition-opacity hover:opacity-90"
            >
              <span>Continuar</span>
              <ChevronRight size={18} aria-hidden="true" />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              layoutId="onboarding-cta"
              transition={UNIPEDIA_SPRING}
              onClick={handleFinish}
              whileTap={{ scale: 0.96 }}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-ink-cta px-6 text-sm font-bold text-ink-cta-fg shadow-card transition-opacity hover:opacity-90"
            >
              <span>Começar com o Uni</span>
              <ArrowRight size={17} aria-hidden="true" />
            </motion.button>
          )}
        </div>
      </footer>

      {legalPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={legalPreview === 'privacy' ? 'Política de Privacidade' : 'Termos de Utilização'}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 shadow-float sm:rounded-3xl sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
              <h3 className="font-display text-lg font-bold text-fg">
                {legalPreview === 'privacy' ? 'Política de Privacidade' : 'Termos de Utilização'}
              </h3>
              <button
                type="button"
                aria-label="Fechar pré-visualização legal"
                onClick={() => setLegalPreview(null)}
                className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs leading-relaxed text-muted sm:text-sm">
              {legalPreview === 'privacy' ? (
                <>
                  <p>
                    <strong className="text-fg">Responsável:</strong> {LEGAL_INFO.controllerName} ({LEGAL_INFO.country}) ·{' '}
                    <span className="font-mono">{LEGAL_INFO.contactEmail}</span>
                  </p>
                  <p>
                    Os teus apontamentos, disciplinas, avaliações e sessões são guardados por predefinição no armazenamento local do teu dispositivo. Só há sincronização Firebase se iniciares sessão voluntariamente.
                  </p>
                  <p>
                    O teu email institucional é ligado apenas se quiseres, de forma independente do Gmail pessoal.
                  </p>
                </>
              ) : (
                <p>
                  A {LEGAL_INFO.appName} é uma ferramenta gratuita de apoio ao estudo para estudantes do Ensino Secundário e Superior (idade mínima {LEGAL_INFO.minimumAgePT} anos em Portugal).
                </p>
              )}
              <div className="pt-2">
                <a
                  href={legalPreview === 'privacy' ? '/privacidade' : '/termos'}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent-ink hover:underline"
                >
                  Abrir página completa <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {scheduleImportMode && (
        <SmartScheduleImportModal
          initialMode={scheduleImportMode}
          currentSemester={currentSemester}
          onImported={(summary: SmartScheduleImportSummary) => {
            applyScheduleScopeToRecords(
              [
                ...summary.activeCourses.map((c) => ({
                  code: c.code,
                  name: c.name,
                  ects: c.ects ?? (isSecondarySchool ? 4 : 6),
                  semester: currentSemester,
                  status: 'a_fazer' as const,
                })),
                ...(summary.otherSemesterCourses ?? []).map((c) => ({
                  code: c.code,
                  name: c.name,
                  ects: c.ects ?? (isSecondarySchool ? 4 : 6),
                  semester: c.semester,
                  status: 'por_fazer' as const,
                })),
              ],
              {
                classesCount: summary.classesCount,
                assessmentsCount: summary.assessmentsCount,
                source: summary.source,
              },
            );
            setScheduleImportMode(null);
            setScheduleImportBaseline(null);
          }}
          onClose={() => {
            setScheduleImportMode(null);
            const state = useStore.getState();
            const storeCourses = state.courses;
            const addedClasses = Math.max(
              0,
              state.classes.length - (scheduleImportBaseline?.classes ?? 0),
            );
            const addedAssessments = Math.max(
              0,
              state.assessments.length - (scheduleImportBaseline?.assessments ?? 0),
            );
            const addedCourses = Math.max(
              0,
              storeCourses.length - (scheduleImportBaseline?.courses ?? 0),
            );
            setScheduleImportBaseline(null);

            if (addedClasses > 0 || addedAssessments > 0 || addedCourses > 0) {
              applyScheduleScopeToRecords(
                storeCourses.map((c) => ({
                  code: c.code,
                  name: c.name,
                  ects: c.ects,
                  status: 'a_fazer' as const,
                })),
                {
                  classesCount: addedClasses,
                  assessmentsCount: addedAssessments,
                  source: scheduleImportMode === 'gcal' ? 'gcal' : 'photo',
                },
              );
            }
          }}
        />
      )}
    </div>
  );
}

export default function OnboardingExperience({
  onClose,
  fullScreen = true,
  initialStepId = 'identidade',
}: OnboardingExperienceProps) {
  return (
    <OnboardingProvider<OnboardingContextData>
      steps={ONBOARDING_STEPS}
      initialStepId={initialStepId}
      initialContext={{ flowData: {}, flowVersion: LEGAL_INFO.policyVersion }}
    >
      <OnboardingFlowBody onClose={onClose} fullScreen={fullScreen} />
    </OnboardingProvider>
  );
}
