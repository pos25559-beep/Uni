import { OnboardingProvider, useOnboarding } from '@onboardjs/react';
import type { OnboardingStep } from '@onboardjs/core';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Cloud,
  ExternalLink,
  HardDrive,
  KeyRound,
  Loader2,
  Mail,
  Palette,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
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
  APP_PALETTES,
  CHALLENGE_OPTIONS,
  defaultTargetEctsForCycle,
  ECTS_TARGETS,
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
import { LEGAL_INFO } from '../../lib/legal';
import { hapticSuccess, hapticTap, syncNativeTheme } from '../../lib/nativeBridge';
import {
  buildInitialCompletedRecords,
  computeWeightedAverage,
  formatAcademicYearLabel,
  formatAcademicYearShort,
  getUniversityById,
  mergeCurriculumCatalog,
  PORTUGAL_CURRICULA,
} from '../../lib/portugalCurriculum';
import {
  UNI_ACCESSORIES,
  UNI_PERSONAS,
  type UniAccessoryId,
  type UniPersonaMode,
} from '../../lib/uniAccessories';
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
import { UniBuddy, UnipediaLogoMark } from '../brand/UnipediaMarks';
import SmartScheduleImportModal, {
  type SmartImportInitialMode,
} from '../courses/SmartScheduleImportModal';
import { celebrateStationery, UNIPEDIA_SPRING } from '../motion/Primitives';
import GeminiKeyGuideModal from '../settings/GeminiKeyGuideModal';
import { Badge, Button, Field, Input, Select, Textarea, cx } from '../ui';
import { startUnipediaGuidedTour } from './TourManager';

type OnboardingStepId = 'boas-vindas' | 'estilo-uni' | 'avaliacao' | 'cadeiras' | 'ritmo';
type AcademicCycleMode = 'licenciatura' | 'mestrado' | 'misto';

type OnboardingContextData = {
  flowData: Record<string, unknown>;
  flowVersion: string;
};

const ONBOARDING_STEPS: OnboardingStep<OnboardingContextData>[] = [
  { id: 'boas-vindas', type: 'INFORMATION', nextStep: 'estilo-uni' },
  { id: 'estilo-uni', type: 'INFORMATION', previousStep: 'boas-vindas', nextStep: 'avaliacao' },
  { id: 'avaliacao', type: 'INFORMATION', previousStep: 'estilo-uni', nextStep: 'cadeiras' },
  { id: 'cadeiras', type: 'INFORMATION', previousStep: 'avaliacao', nextStep: 'ritmo' },
  { id: 'ritmo', type: 'CONFIRMATION', previousStep: 'cadeiras', nextStep: null },
];

const STEP_META: Array<{ id: OnboardingStepId; label: string }> = [
  { id: 'boas-vindas', label: 'Porquê a Unipedia' },
  { id: 'estilo-uni', label: 'O Uni & Visual' },
  { id: 'avaliacao', label: 'Créditos & Perfil' },
  { id: 'cadeiras', label: 'Cadeiras & Histórico' },
  { id: 'ritmo', label: 'Contas & Ritmo' },
];

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

export interface OnboardingExperienceProps {
  onClose: () => void;
  fullScreen?: boolean;
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
  const activeStepId = (currentStep?.id as OnboardingStepId) ?? 'boas-vindas';
  const stepIndex = Math.max(0, STEP_META.findIndex((s) => s.id === activeStepId));
  const [direction, setDirection] = useState(1);
  const [finishingWipe, setFinishingWipe] = useState(false);

  // Passo 2: Personalidade do Uni, Tom & Paleta ao vivo
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

  // Idade mínima PT + privacidade
  const [ageConfirmed, setAgeConfirmed] = useState<boolean>(
    Boolean(settings.ageConfirmed13Plus || storedProfile.onboardingCompleted),
  );
  const [legalPreview, setLegalPreview] = useState<'privacy' | 'terms' | null>(null);
  const [cloudSyncConsent, setCloudSyncConsent] = useState<boolean>(
    Boolean(settings.cloudSyncConsent),
  );
  const [aiConsent, setAiConsent] = useState<boolean>(Boolean(settings.aiConsent ?? true));

  // Passo 1: Identidade, Instituição, Ciclo e Anos simultâneos
  const isFreshUnconfigured = !storedProfile.onboardingCompleted && (!storedProfile.universityId || storedProfile.universityId === 'outra');
  const initialUniversityId = isFreshUnconfigured ? 'nova-fct' : storedProfile.universityId || 'nova-fct';
  const initialDegreeId = isFreshUnconfigured ? 'lemc' : storedProfile.degreeId || 'lemc';
  const [userName, setUserName] = useState(settings.userName);
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

  // Passo 3: Avaliação pessoal — ECTS, dificuldades & atividades extra
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
  const [customExtraDays, setCustomExtraDays] = useState<number[]>([2, 4]);

  const ectsStage = useMemo(
    () => inferAcademicStageFromEcts(completedEcts, targetTotalEcts),
    [completedEcts, targetTotalEcts],
  );

  // Passo 4: Filtros por ano, opcionais colapsáveis, adição manual e OCR
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');
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
  const [scheduleImportMode, setScheduleImportMode] = useState<SmartImportInitialMode | null>(null);
  const [showPastePlan, setShowPastePlan] = useState(false);
  const [pastedPlanText, setPastedPlanText] = useState('');

  // Passo 3: Conta institucional, Gemini Key, Ritmo e Tour
  const [academicHint, setAcademicHint] = useState(settings.academicEmail ?? '');
  const [academicBusy, setAcademicBusy] = useState(false);
  const [showGeminiModal, setShowGeminiModal] = useState(false);
  const [difficultKeys, setDifficultKeys] = useState<string[]>(storedProfile.difficultCourseIds);
  const [difficultNotes, setDifficultNotes] = useState(storedProfile.difficultTopicsNotes ?? '');
  const [dailyMinutes, setDailyMinutes] = useState<number>(settings.dailyStudyMinutes || 180);
  const [studyDays, setStudyDays] = useState<number[]>(settings.studyDays);
  const [launchTour, setLaunchTour] = useState<boolean>(!settings.tourCompleted);

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

  const selectedUniversity = useMemo(() => getUniversityById(universityId, catalog), [universityId, catalog]);
  const availableDegrees = selectedUniversity?.degrees ?? [];
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
    if (nextUniId !== 'outra' && nextDegId !== 'outro') {
      const leadYear = (nextYears[nextYears.length - 1] ?? 1) as 1 | 2 | 3 | 4 | 5;
      setRecords(
        buildInitialCompletedRecords(nextUniId, nextDegId, leadYear, nextSem, catalog, nextYears),
      );
    } else {
      setRecords([]);
    }
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
      if (universityId === 'nova-fct' && degreeId === 'lemc') {
        nextDeg = 'memec';
      }
    } else if (nextCycle === 'misto') {
      if (nextYears.length === 0) nextYears = [2, 3, 4];
      if (universityId === 'nova-fct' && (degreeId === 'lemc' || degreeId === 'memec')) {
        nextDeg = 'lemc-memec';
      }
    } else {
      nextYears = nextYears.filter((y) => y <= 3);
      if (nextYears.length === 0) nextYears = [1];
      if (universityId === 'nova-fct' && (degreeId === 'memec' || degreeId === 'lemc-memec')) {
        nextDeg = 'lemc';
      }
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
    setExtraActivities((prev) => [
      ...prev,
      { id: newId(), ...preset },
    ]);
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
        weekdays: customExtraDays.length > 0 ? customExtraDays : [2, 4],
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
      // Nos modos simples permite 1 toque para selecionar ou Shift/2º ano via Misto
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

  const updateRecordStatus = (id: string, status: CompletedCourseRecord['status']) => {
    void hapticTap();
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status, ...(status !== 'aprovada' ? { grade: undefined } : {}) } : r)),
    );
  };

  const updateRecordGrade = (id: string, raw: string) => {
    const val = raw.trim() === '' ? undefined : Math.min(20, Math.max(0, Number(raw)));
    setRecords((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              grade: typeof val === 'number' && !Number.isNaN(val) ? val : undefined,
              status: typeof val === 'number' && val >= 10 ? 'aprovada' : r.status,
            }
          : r,
      ),
    );
  };

  const handleApplyPastedCurriculum = (mode: 'replace' | 'merge') => {
    const parsed = parseCurriculumFromText(pastedPlanText, primaryAcademicYear, currentSemester);
    if (parsed.length === 0) {
      setOcrError(
        'Não detetei cadeiras nesse texto. Cola a tabela do Guia de Cursos ou portal académico, ou escreve uma cadeira por linha.',
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
    if (!files || files.length === 0) return;
    if (!aiConsent) {
      setAiConsent(true);
    }
    updateSettings({ aiConsent: true });
    setOcrBusy(true);
    setOcrError(null);
    setOcrFeedback(null);

    try {
      const fileList = Array.from(files);
      const historyItems: ExtractedHistoryItem[] = [];
      const scheduleSlots: ExtractedScheduleSlot[] = [];
      const scheduleAssessments: ExtractedScheduleAssessment[] = [];
      let firstError: Error | null = null;
      let anySucceeded = false;

      for (const file of fileList) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ''));
          reader.onerror = () => reject(new Error(`Não foi possível ler "${file.name}".`));
          reader.readAsDataURL(file);
        });
        const mimeType = file.type || 'image/png';

        const [historyRes, scheduleRes] = await Promise.allSettled([
          parseAcademicHistoryFromScreenshot(base64, mimeType),
          parseTimetableFromScreenshot(base64, mimeType),
        ]);

        if (historyRes.status === 'fulfilled') {
          anySucceeded = true;
          historyItems.push(...historyRes.value);
        } else if (!firstError) {
          firstError =
            historyRes.reason instanceof Error
              ? historyRes.reason
              : new Error(String(historyRes.reason));
        }

        if (scheduleRes.status === 'fulfilled') {
          anySucceeded = true;
          scheduleSlots.push(...scheduleRes.value.slots);
          scheduleAssessments.push(...scheduleRes.value.assessments);
        } else if (!firstError) {
          firstError =
            scheduleRes.reason instanceof Error
              ? scheduleRes.reason
              : new Error(String(scheduleRes.reason));
        }
      }

      if (!anySucceeded && firstError) {
        throw firstError;
      }

      if (
        historyItems.length === 0 &&
        scheduleSlots.length === 0 &&
        scheduleAssessments.length === 0
      ) {
        setOcrError(
          'Não consegui reconhecer cadeiras nem aulas nessas imagens. Tenta um print mais nítido da pauta ou do horário semanal.',
        );
        return;
      }

      setRecords((prev) => {
        const next = [...prev];
        const mergeCourseItem = (item: ExtractedHistoryItem) => {
          const itemNameNorm = item.name.toLowerCase();
          const itemCodeNorm = item.code?.toLowerCase();
          const idx = next.findIndex(
            (r) =>
              (itemCodeNorm && r.code.toLowerCase() === itemCodeNorm) ||
              r.name.toLowerCase().includes(itemNameNorm) ||
              itemNameNorm.includes(r.name.toLowerCase()),
          );

          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              status: item.status,
              grade: item.grade ?? next[idx].grade,
            };
          } else {
            next.unshift({
              id: `hist-ocr-${Math.random().toString(36).slice(2, 8)}`,
              code: (item.code ?? item.name.slice(0, 5)).toUpperCase(),
              name: item.name,
              year: primaryAcademicYear,
              semester: currentSemester,
              ects: item.ects ?? (isSecondarySchool ? 4 : 6),
              grade: item.grade,
              status: item.status,
            });
          }
        };

        for (const item of historyItems) {
          mergeCourseItem(item);
        }

        for (const slot of scheduleSlots) {
          mergeCourseItem({
            code: slot.courseCode,
            name: slot.courseName,
            ects: isSecondarySchool ? 4 : 6,
            status: 'a_fazer',
          });
        }

        return next;
      });

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

          const code = (courseCode || courseName.slice(0, 6)).trim();
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

      const parts: string[] = [];
      if (historyItems.length > 0) parts.push(`${historyItems.length} cadeira(s)`);
      if (scheduleSlots.length > 0) parts.push(`${scheduleSlots.length} aula(s) no horário`);
      if (scheduleAssessments.length > 0) parts.push(`${scheduleAssessments.length} avaliação(ões)`);
      setOcrFeedback(`Importado com sucesso: ${parts.join(', ')}.`);
      void hapticSuccess();
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : 'Erro ao analisar o print com Gemini Vision.');
    } finally {
      setOcrBusy(false);
    }
  };

  const handleConnectAcademic = async () => {
    setAcademicBusy(true);
    try {
      const cleaned = academicHint.trim();
      if (cleaned) {
        updateSettings({ academicEmail: cleaned });
      }
      await connectAcademicMail(false, cleaned || undefined);
      void hapticSuccess();
    } finally {
      setAcademicBusy(false);
    }
  };

  const availableRecordYears = useMemo(() => {
    const set = new Set<number>(records.map((r) => r.year));
    return Array.from(set).sort((a, b) => a - b);
  }, [records]);

  const filteredRecords = useMemo(() => {
    if (yearFilter === 'all') return records;
    return records.filter((r) => r.year === yearFilter);
  }, [records, yearFilter]);

  /** Oculta cadeiras opcionais não selecionadas para evitar listas gigantes nos Mestrados. */
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
      tourCompleted: !launchTour,
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
        if (launchTour) {
          window.setTimeout(() => startUnipediaGuidedTour(), 260);
        }
      }, 360);
    } else {
      onClose();
      if (launchTour) {
        window.setTimeout(() => startUnipediaGuidedTour(), 260);
      }
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
            className="pointer-events-none fixed inset-0 z-[80] bg-[#157F58]"
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

      {/* Corpo progressivo guiado pelo Uni */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        <motion.div
          key={activeStepId}
          initial={{ opacity: 0, x: direction * 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5"
        >
          {/* PASSO 1: RAZÃO DE SER & CONVITE PESSOAL */}
          {activeStepId === 'boas-vindas' && (
            <div className="space-y-5">
              <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[#FCE99F]/50 ring-1 ring-line">
                  <UniBuddy
                    mood="happy"
                    accessory={uniAccessory === 'auto' ? 'default' : uniAccessory}
                    size={68}
                    interactive={false}
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold text-accent">
                    <Sparkles size={11} /> Olá! Eu sou o Uni
                  </span>
                  <h2 className="font-display text-xl font-bold tracking-tight text-fg sm:text-2xl">
                    Um caderno que respeita o teu{' '}
                    <em className="font-editorial text-accent">ritmo real</em>
                  </h2>
                  <p className="text-xs leading-relaxed text-muted sm:text-sm">
                    A Unipedia nasceu para substituir folhas soltas, calendários confusos e ansiedade de última hora por sessões curtas, mensuráveis e humanas.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    badge: 'Memória duradoura',
                    title: 'Revisão 1 → 3 → 7 → 21 dias',
                    body: 'Cada bloco concluído pergunta o teu nível de confiança e agenda a próxima revisão antes que a matéria se perca.',
                  },
                  {
                    badge: 'Sem pânico de exames',
                    title: 'Modo Teste automático',
                    body: 'A 10 dias de uma prova importante, o plano muda de marcha para equilibrar revisão intensiva e exercícios.',
                  },
                  {
                    badge: 'Ao teu ritmo',
                    title: 'Planeamento realista',
                    body: 'Aulas, horas de trabalho ou ginásio e cadeiras mais exigentes entram na conta — nada de listas impossíveis.',
                  },
                ].map((reason) => (
                  <div
                    key={reason.title}
                    className="flex flex-col justify-between gap-2 rounded-3xl border border-line bg-surface p-4 shadow-sm"
                  >
                    <span className="w-fit rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] font-bold text-accent">
                      {reason.badge}
                    </span>
                    <div>
                      <h3 className="font-display text-sm font-bold text-fg">{reason.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted">{reason.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
                <Field label="Antes de começarmos, como queres que o Uni te trate?">
                  <Input
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Ex: Pedro Silva"
                  />
                </Field>
              </div>
            </div>
          )}

          {/* PASSO 2: O UNIVERSO UNI, PALETA & TOM DA APLICAÇÃO */}
          {activeStepId === 'estilo-uni' && (
            <div className="space-y-5">
              <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[#C9DC9F]/45 ring-1 ring-line">
                  <UniBuddy
                    mood="curious"
                    accessory={uniAccessory === 'auto' ? 'math' : uniAccessory}
                    size={68}
                    interactive={false}
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold text-accent">
                    <Palette size={11} /> O teu companheiro de estudo
                  </span>
                  <h2 className="font-display text-xl font-bold tracking-tight text-fg sm:text-2xl">
                    Escolhe a cara e o <em className="font-editorial text-accent">tom do teu caderno</em>
                  </h2>
                  <p className="text-xs leading-relaxed text-muted sm:text-sm">
                    Os Unis são pequenas mascotes colecionáveis que te acompanham e podem espreitar discretamente nos cantos do ecrã — ou ficar completamente silenciosos se preferires um estilo mais sério.
                  </p>
                </div>
              </div>

              {/* Tom da aplicação: Expressivo vs Sério */}
              <div className="space-y-3 rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
                <div>
                  <h3 className="font-display text-sm font-bold text-fg">
                    Qual o estilo de experiência que preferes?
                  </h3>
                  <p className="text-xs text-muted">
                    Podes mudar quando quiseres nas Definições.
                  </p>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {[
                    {
                      id: 'vibrante' as const,
                      title: 'Expressivo & Vivo',
                      desc: 'Caderno com ilustrações suaves, feedback caloroso e os Unis tímidos a espreitar nos cantos.',
                    },
                    {
                      id: 'serio' as const,
                      title: 'Sério & Minimalista',
                      desc: 'Visual sóbrio, movimento reduzido, tutor direto ao assunto e ecrã 100% livre de mascotes nos cantos.',
                    },
                  ].map((option) => {
                    const active = appTone === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          void hapticTap();
                          setAppTone(option.id);
                          if (option.id === 'serio') {
                            setUniLiveCompanions('off');
                            if (themePalette === 'caderno') setThemePalette('ardosia');
                          } else {
                            setUniLiveCompanions('all');
                          }
                        }}
                        className={cx(
                          'flex flex-col items-start gap-1 rounded-2xl border p-3.5 text-left transition',
                          active
                            ? 'border-accent bg-accent-soft/50 shadow-sm'
                            : 'border-line bg-bg hover:bg-surface-2',
                        )}
                      >
                        <span className="flex items-center gap-1.5 text-xs font-bold text-fg">
                          {active && <CheckCircle2 size={14} className="text-accent" />}
                          {option.title}
                        </span>
                        <span className="text-[11px] leading-relaxed text-muted">{option.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Paleta de cores + Tema Claro/Escuro */}
              <div className="space-y-4 rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-bold text-fg">Paleta de cores ao vivo</h3>
                    <p className="text-xs text-muted">
                      Toca para pré-visualizar imediatamente nesta janela.
                    </p>
                  </div>
                  <div className="inline-flex rounded-full bg-surface-2 p-1">
                    {(
                      [
                        ['system', 'Auto'],
                        ['light', 'Claro'],
                        ['dark', 'Escuro'],
                      ] as const
                    ).map(([pref, label]) => (
                      <button
                        key={pref}
                        type="button"
                        onClick={() => {
                          void hapticTap();
                          setThemePref(pref);
                        }}
                        className={cx(
                          'min-h-[34px] rounded-full px-3 text-xs font-semibold transition',
                          themePref === pref
                            ? 'bg-ink-cta text-ink-cta-fg'
                            : 'text-muted hover:text-fg',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {APP_PALETTES.map((pal) => {
                    const active = themePalette === pal.id;
                    return (
                      <button
                        key={pal.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          void hapticTap();
                          setThemePalette(pal.id);
                        }}
                        className={cx(
                          'flex min-h-[54px] items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition',
                          active
                            ? 'border-accent bg-accent-soft/60 shadow-sm'
                            : 'border-line bg-bg hover:bg-surface-2',
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
                          <span className="block truncate text-xs font-bold text-fg">{pal.name}</span>
                          <span className="block truncate text-[10px] text-muted">{pal.tagline}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Adereço do Uni, Personalidade do Tutor e Companheiros Discretos */}
              <div className="space-y-4 rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-bold text-fg">
                      Adereço &amp; comportamento do Uni
                    </h3>
                    <p className="text-xs text-muted">
                      Pode adaptar-se automaticamente a cada cadeira ou manter o teu estilo fixo.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void hapticTap();
                      setUniAccessory('auto');
                    }}
                    className={cx(
                      'min-h-[34px] rounded-full border px-3 text-xs font-semibold transition',
                      uniAccessory === 'auto'
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-surface-2 text-muted hover:text-fg',
                    )}
                  >
                    Automático por cadeira
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {UNI_ACCESSORIES.map((acc) => {
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
                          'flex min-h-[42px] items-center gap-1.5 rounded-2xl border px-2.5 py-1.5 text-xs font-medium transition',
                          active
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-line bg-bg text-fg hover:bg-surface-2',
                        )}
                      >
                        <UniBuddy mood="happy" accessory={acc.id} size={26} interactive={false} />
                        <span>{acc.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <span className="block text-xs font-medium text-muted">
                      Personalidade do Tutor Uni
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {UNI_PERSONAS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            void hapticTap();
                            setUniPersona(p.id);
                          }}
                          className={cx(
                            'min-h-[36px] rounded-full border px-3 text-xs font-semibold transition',
                            uniPersona === p.id
                              ? 'border-accent bg-accent text-accent-fg'
                              : 'border-line bg-bg text-muted hover:text-fg',
                          )}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-xs font-medium text-muted">
                      Unis discretos nos cantos («com vergonha»)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          ['all', 'Até 2 discretos'],
                          ['solo', 'Só 1 Uni'],
                          ['off', 'Desligado'],
                        ] as const
                      ).map(([modeId, label]) => (
                        <button
                          key={modeId}
                          type="button"
                          onClick={() => {
                            void hapticTap();
                            setUniLiveCompanions(modeId);
                          }}
                          className={cx(
                            'min-h-[36px] rounded-full border px-3 text-xs font-semibold transition',
                            uniLiveCompanions === modeId
                              ? 'border-accent bg-ink-cta text-ink-cta-fg'
                              : 'border-line bg-bg text-muted hover:text-fg',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 3: AVALIAÇÃO PESSOAL, ECTS (180 / 120 / 300), DIFICULDADES & ATIVIDADES EXTRA */}
          {activeStepId === 'avaliacao' && (
            <div className="space-y-5">
              <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#C4E0FD]/55 ring-1 ring-line">
                  <UniBuddy mood="thinking" size={56} interactive={false} />
                </div>
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold text-accent">
                    <BookOpen size={11} /> Avaliação pessoal
                  </span>
                  <h2 className="font-display text-xl font-bold tracking-tight text-fg sm:text-2xl">
                    Onde estás nos <em className="font-editorial text-accent">ECTS</em> e na tua semana?
                  </h2>
                  <p className="text-xs leading-relaxed text-muted sm:text-sm">
                    Com os teus créditos concluídos e compromissos fora das aulas, o Uni estima o teu ano letivo e evita planos irrealistas.
                  </p>
                </div>
              </div>

              {/* Meta ECTS + ECTS Concluídos */}
              {!isSecondarySchool && (
                <div className="space-y-4 rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
                  <div className="space-y-2">
                    <span className="block text-xs font-semibold text-fg">
                      Qual é a meta total do teu percurso (ECTS)?
                    </span>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {ECTS_TARGETS.map((opt) => {
                        const active = targetTotalEcts === opt.total;
                        return (
                          <button
                            key={opt.total}
                            type="button"
                            aria-pressed={active}
                            onClick={() => handleSelectEctsTarget(opt.total)}
                            className={cx(
                              'flex min-h-[52px] flex-col items-start justify-center rounded-2xl border px-3.5 py-2 text-left transition',
                              active
                                ? 'border-accent bg-accent-soft text-accent shadow-sm'
                                : 'border-line bg-bg text-fg hover:bg-surface-2',
                            )}
                          >
                            <span className="font-mono text-sm font-extrabold">{opt.shortLabel}</span>
                            <span className="text-[11px] text-muted">{opt.label.split('·')[1]?.trim()}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-line pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="onboarding-ects-slider" className="text-xs font-semibold text-fg">
                        Quantos ECTS já concluíste até agora?
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={targetTotalEcts}
                          step={3}
                          value={completedEcts}
                          onChange={(e) =>
                            setCompletedEcts(
                              Math.max(0, Math.min(targetTotalEcts, Number(e.target.value) || 0)),
                            )
                          }
                          className="w-20 text-center font-mono font-bold tabular"
                        />
                        <span className="font-mono text-xs text-muted">/ {targetTotalEcts} ECTS</span>
                      </div>
                    </div>

                    <input
                      id="onboarding-ects-slider"
                      type="range"
                      min={0}
                      max={targetTotalEcts}
                      step={3}
                      value={completedEcts}
                      onChange={(e) => setCompletedEcts(Number(e.target.value))}
                      className="w-full accent-[var(--accent)]"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-accent/25 bg-accent-soft/45 px-3.5 py-2.5 text-xs">
                      <div>
                        <p className="font-bold text-fg">
                          Leitura do Uni: {ectsStage.stageSummary}
                        </p>
                        <p className="text-[11px] text-muted">
                          {ectsStage.progressPct}% concluído · faltam {ectsStage.remainingEcts} ECTS para fechar a meta.
                        </p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={handleApplyEctsStage}>
                        Alinhar {ectsStage.estimatedYear}.º ano
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Faculdade, Curso, Ano de entrada, Ciclo & Anos simultâneos */}
              <div className="grid gap-3 rounded-3xl border border-line bg-surface p-4 shadow-sm sm:grid-cols-2 sm:p-5">
                <Field label="Instituição / Ensino">
                  <Select
                    value={universityId}
                    onChange={(e) => handleUniversityChange(e.target.value)}
                  >
                    {catalog.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.shortName})
                      </option>
                    ))}
                    <option value="outra">Outra Escola / Universidade</option>
                  </Select>
                </Field>

                <Field label={isSecondarySchool ? 'Área / Curso' : 'Curso / Plano Curricular'}>
                  {universityId === 'outra' ? (
                    <Input
                      value={customDegree}
                      onChange={(e) => setCustomDegree(e.target.value)}
                      placeholder="Ex: Engenharia Mecânica"
                    />
                  ) : (
                    <Select
                      value={degreeId}
                      onChange={(e) => handleDegreeChange(e.target.value)}
                    >
                      {availableDegrees.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                      <option value="outro">Outro curso / plano próprio</option>
                    </Select>
                  )}
                </Field>

                <Field label={isSecondarySchool ? 'Ano de matrícula' : 'Ano de entrada'}>
                  <Select
                    value={String(entryYear)}
                    onChange={(e) => setEntryYear(Number(e.target.value))}
                  >
                    {[2026, 2025, 2024, 2023, 2022, 2021, 2020].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </Select>
                </Field>

                <div className="flex items-end">
                  <p className="text-xs text-muted">
                    Estudante: <strong className="text-fg">{userName.trim() || 'Por definir'}</strong> · podes voltar ao passo 1 ou ajustar depois.
                  </p>
                </div>

                {(universityId === 'outra' || degreeId === 'outro') && (
                  <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                    {universityId === 'outra' && (
                      <Field label="Nome da Escola ou Universidade">
                        <Input
                          value={customUniversity}
                          onChange={(e) => setCustomUniversity(e.target.value)}
                          placeholder="Ex: Instituto Politécnico / Secundária"
                        />
                      </Field>
                    )}
                    {degreeId === 'outro' && universityId !== 'outra' && (
                      <Field label="Nome do curso ou mestrado">
                        <Input
                          value={customDegree}
                          onChange={(e) => setCustomDegree(e.target.value)}
                          placeholder="Ex: Mestrado em Energia"
                        />
                      </Field>
                    )}
                  </div>
                )}
              </div>

              {/* Regime / Ciclos + Anos simultâneos */}
              <div className="space-y-4 rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
                {!isSecondarySchool && (
                  <div role="group" aria-label="Tipo de percurso neste momento" className="space-y-1.5">
                    <span className="block text-xs font-medium text-muted">
                      Tipo de percurso neste momento
                    </span>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {[
                        { id: 'licenciatura' as const, title: 'Licenciatura', hint: '1.º ao 3.º ano' },
                        { id: 'mestrado' as const, title: 'Mestrado', hint: '1.º e 2.º de Mestrado' },
                        { id: 'misto' as const, title: 'Misto / Vários anos', hint: 'Cadeiras de vários anos + Mestrado' },
                      ].map((item) => {
                        const active = academicCycle === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => handleCycleChange(item.id)}
                            className={cx(
                              'flex min-h-[52px] flex-col items-start justify-center rounded-2xl border px-3.5 py-2.5 text-left transition',
                              active
                                ? 'border-accent bg-accent-soft text-accent shadow-sm'
                                : 'border-line bg-bg text-fg hover:bg-surface-2',
                            )}
                          >
                            <span className="text-xs font-bold">{item.title}</span>
                            <span className="text-[11px] text-muted">{item.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr]">
                  <div
                    role="group"
                    aria-label={
                      isSecondarySchool
                        ? 'Ano escolar'
                        : academicCycle === 'misto'
                          ? 'Seleciona TODOS os anos onde tens cadeiras agora'
                          : 'Ano curricular atual'
                    }
                    className="space-y-1.5"
                  >
                    <span className="block text-xs font-medium text-muted">
                      {isSecondarySchool
                        ? 'Ano escolar'
                        : academicCycle === 'misto'
                          ? 'Seleciona TODOS os anos onde tens cadeiras agora'
                          : 'Ano curricular atual'}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {yearChoices.map((y) => {
                        const active = activeYears.includes(y);
                        return (
                          <button
                            key={y}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggleYearPill(y)}
                            className={cx(
                              'inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold transition',
                              active
                                ? 'border-accent bg-accent text-accent-fg shadow-sm'
                                : 'border-line bg-bg text-muted hover:text-fg',
                            )}
                          >
                            {active && <Check size={13} />}
                            {formatAcademicYearShort(y, isSecondarySchool)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    role="group"
                    aria-label={isSecondarySchool ? 'Período' : 'Semestre atual'}
                    className="space-y-1.5"
                  >
                    <span className="block text-xs font-medium text-muted">
                      {isSecondarySchool ? 'Período' : 'Semestre atual'}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {([1, 2] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={currentSemester === s}
                          onClick={() => handleSemesterChange(s)}
                          className={cx(
                            'min-h-[44px] rounded-xl border text-xs font-semibold transition',
                            currentSemester === s
                              ? 'border-accent bg-accent text-accent-fg shadow-sm'
                              : 'border-line bg-bg text-muted hover:text-fg',
                          )}
                        >
                          {s}.º Semestre
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dificuldades pessoais + Atividades extracurriculares */}
              <div className="space-y-4 rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-fg">
                    Quais são os teus maiores desafios este semestre?
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {CHALLENGE_OPTIONS.map((ch) => {
                      const active = learningChallenges.includes(ch.id);
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => toggleLearningChallenge(ch.id)}
                          className={cx(
                            'inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition',
                            active
                              ? 'border-accent bg-accent-soft text-accent'
                              : 'border-line bg-bg text-muted hover:text-fg',
                          )}
                        >
                          {active && <Check size={12} />}
                          {ch.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2.5 border-t border-line pt-3">
                  <div>
                    <span className="block text-xs font-semibold text-fg">
                      Tens trabalho, desporto, associação ou outras atividades extra?
                    </span>
                    <p className="text-[11px] text-muted">
                      O criador do plano semanal reduz automaticamente a carga nos dias em que estás ocupado.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {EXTRA_ACTIVITY_PRESETS.map((preset) => {
                      const active = extraActivities.some((a) => a.label === preset.label);
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => toggleExtraPreset(preset)}
                          className={cx(
                            'inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition',
                            active
                              ? 'border-accent bg-accent text-accent-fg'
                              : 'border-line bg-bg text-fg hover:bg-surface-2',
                          )}
                        >
                          {active ? <Check size={12} /> : <Plus size={12} />}
                          {preset.label} ({preset.hoursPerWeek}h)
                        </button>
                      );
                    })}
                  </div>

                  {/* Adição rápida de atividade própria */}
                  <div className="grid gap-2 sm:grid-cols-[1.5fr_88px_auto]">
                    <Input
                      value={customExtraLabel}
                      onChange={(e) => setCustomExtraLabel(e.target.value)}
                      placeholder="Outra atividade (ex: Estágio, Explicações)"
                    />
                    <Input
                      type="number"
                      min={1}
                      max={40}
                      value={customExtraHours}
                      onChange={(e) => setCustomExtraHours(Math.max(1, Number(e.target.value) || 1))}
                      aria-label="Horas por semana"
                      className="text-center tabular"
                    />
                    <Button variant="secondary" size="sm" onClick={handleAddCustomExtra}>
                      <Plus size={14} /> Juntar
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                    <span>Dias da atividade personalizada:</span>
                    {DAY_LABELS.map((d) => {
                      const on = customExtraDays.includes(d.day);
                      return (
                        <button
                          key={d.day}
                          type="button"
                          onClick={() =>
                            setCustomExtraDays((prev) =>
                              prev.includes(d.day)
                                ? prev.filter((x) => x !== d.day)
                                : [...prev, d.day],
                            )
                          }
                          className={cx(
                            'min-h-[28px] rounded-lg px-2 font-semibold transition',
                            on
                              ? 'bg-ink-cta text-ink-cta-fg'
                              : 'border border-line bg-bg text-muted hover:text-fg',
                          )}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>

                  {extraActivities.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {extraActivities.map((act) => (
                        <div
                          key={act.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-line bg-bg px-3 py-2 text-xs"
                        >
                          <span className="truncate font-medium text-fg">
                            {act.label} · {act.hoursPerWeek}h/sem (
                            {act.weekdays
                              .map((w) => DAY_LABELS.find((d) => d.day === w)?.label ?? '')
                              .filter(Boolean)
                              .join(', ')}
                            )
                          </span>
                          <button
                            type="button"
                            aria-label={`Remover ${act.label}`}
                            onClick={() =>
                              setExtraActivities((prev) => prev.filter((a) => a.id !== act.id))
                            }
                            className="inline-flex size-7 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-coral"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PASSO 2: CADEIRAS REAIS, MESTRADOS, IMPORTS E ADIÇÃO MANUAL */}
          {activeStepId === 'cadeiras' && (
            <div className="space-y-4">
              <div className="flex flex-col justify-between gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#9EE5C9]/45 ring-1 ring-line">
                    <UniBuddy mood="curious" size={48} interactive={false} />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-fg sm:text-xl">
                      As tuas cadeiras <em className="font-editorial text-accent">deste semestre</em>
                    </h2>
                    <p className="text-xs text-muted">
                      Marca o que estás a fazer agora, o que já despachaste ou adiciona manualmente cadeiras de outros anos/mestrados.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-accent-soft px-3 py-1 font-bold text-accent tabular">
                    {doingCount} ativas
                  </span>
                  <span className="rounded-full bg-surface-2 px-3 py-1 font-medium text-muted tabular">
                    {approvedCount} aprovadas
                  </span>
                  {!isSecondarySchool && (
                    <span className="rounded-full bg-surface-2 px-3 py-1 font-mono font-semibold text-fg tabular">
                      {approvedEctsFromList + activeEctsFromList}/{targetTotalEcts} ECTS
                    </span>
                  )}
                  {weightedAvg !== null && (
                    <span className="rounded-full bg-ok/15 px-3 py-1 font-semibold text-ok tabular">
                      Média {weightedAvg.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>

              {/* Atalhos rápidos de importação */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-4 py-3">
                <span className="text-xs font-semibold text-muted">Importar em segundos:</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setScheduleImportMode('photo')}
                  >
                    <Camera size={14} /> Foto do horário
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setScheduleImportMode('gcal')}
                  >
                    <CalendarDays size={14} /> Google Agenda
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setShowPastePlan((v) => !v);
                      void hapticTap();
                    }}
                  >
                    <ClipboardPaste size={14} /> Colar Plano / Guia
                  </Button>
                  <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg shadow-sm transition hover:opacity-90">
                    {ocrBusy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                    {ocrBusy ? 'A ler prints…' : 'Print Horário / Pauta'}
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      disabled={ocrBusy}
                      onChange={(e) => {
                        const files = e.target.files;
                        e.target.value = '';
                        void handleScreenshotUpload(files);
                      }}
                    />
                  </label>
                </div>
              </div>

              {showPastePlan && (
                <div className="space-y-3 rounded-2xl border border-accent/35 bg-surface p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-fg">
                        Colar plano curricular (Portal académico, Guia de Curso ou lista de cadeiras)
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        Se o plano mudou este ano ou vens de outro curso, copia a tabela com semestres, nomes e ECTS e cola abaixo — funciona offline sem gastar IA.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPastePlan(false)}
                      aria-label="Fechar caixa de importação"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <Textarea
                    rows={5}
                    value={pastedPlanText}
                    onChange={(e) => setPastedPlanText(e.target.value)}
                    placeholder={`1.º Semestre\n13493\tCálculo I D\t6.0\n13501\tFísica Experimental\t6.0\nOpções:\n14123\tFabrico Aditivo\t6.0`}
                  />
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleApplyPastedCurriculum('merge')}
                    >
                      Adicionar à lista
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleApplyPastedCurriculum('replace')}
                    >
                      Substituir plano atual
                    </Button>
                  </div>
                </div>
              )}

              {ocrFeedback && (
                <p className="flex items-center gap-1.5 rounded-xl bg-ok/10 px-3 py-2 text-xs text-ok">
                  <CheckCircle2 size={14} /> {ocrFeedback}
                </p>
              )}
              {ocrError && (
                <p className="flex items-center gap-1.5 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
                  <AlertCircle size={14} /> {ocrError}
                </p>
              )}

              {/* Adicionar cadeira manualmente (qualquer ano / mestrado) */}
              <div className="rounded-2xl border border-dashed border-accent/40 bg-surface p-3.5">
                <p className="mb-2 text-xs font-semibold text-fg">
                  + Adicionar outra cadeira (ex: cadeira em atraso ou de Mestrado)
                </p>
                <div className="grid gap-2 sm:grid-cols-[110px_1fr_132px_72px_auto]">
                  <Input
                    value={newCourseCode}
                    onChange={(e) => setNewCourseCode(e.target.value)}
                    placeholder="Sigla (ex: OM1)"
                  />
                  <Input
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                    placeholder="Nome completo da cadeira"
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomRecord();
                      }
                    }}
                  />
                  <Select
                    aria-label="Ano da cadeira"
                    value={String(newCourseYear)}
                    onChange={(e) => setNewCourseYear(Number(e.target.value))}
                  >
                    {(isSecondarySchool ? [1, 2, 3] : [1, 2, 3, 4, 5]).map((y) => (
                      <option key={y} value={y}>
                        {formatAcademicYearShort(y, isSecondarySchool)}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    aria-label="ECTS"
                    value={newCourseEcts}
                    onChange={(e) => setNewCourseEcts(Number(e.target.value))}
                    className="tabular"
                  />
                  <Button variant="primary" size="sm" onClick={addCustomRecord}>
                    <Plus size={14} /> Adicionar
                  </Button>
                </div>
              </div>

              {/* Tabs por ano */}
              {availableRecordYears.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setYearFilter('all')}
                    className={cx(
                      'min-h-[36px] rounded-full px-3 text-xs font-semibold transition',
                      yearFilter === 'all'
                        ? 'bg-ink-cta text-ink-cta-fg'
                        : 'border border-line bg-surface text-muted hover:text-fg',
                    )}
                  >
                    Todos ({records.filter((r) => !(r.isOptional && r.status === 'por_fazer')).length})
                  </button>
                  {availableRecordYears.map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setYearFilter(y)}
                      className={cx(
                        'min-h-[36px] rounded-full px-3 text-xs font-semibold transition',
                        yearFilter === y
                          ? 'bg-ink-cta text-ink-cta-fg'
                          : 'border border-line bg-surface text-muted hover:text-fg',
                      )}
                    >
                      {formatAcademicYearShort(y, isSecondarySchool)} (
                      {records.filter((r) => r.year === y && r.status === 'a_fazer').length})
                    </button>
                  ))}
                </div>
              )}

              {/* Lista editorial de cadeiras obrigatórias / escolhidas (sem poluir com opcionais soltas) */}
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-3xl border border-line bg-surface p-3">
                {mainFilteredRecords.length === 0 ? (
                  <p className="p-6 text-center text-xs text-muted">
                    Ainda sem cadeiras obrigatórias neste filtro. Podes escolher opcionais abaixo ou usar «+ Adicionar» / «Print Horário / Pauta».
                  </p>
                ) : (
                  mainFilteredRecords.map((r) => (
                    <div
                      key={r.id}
                      className={cx(
                        'flex flex-col gap-2.5 rounded-2xl border px-3.5 py-2.5 text-xs transition sm:flex-row sm:items-center sm:justify-between',
                        r.status === 'a_fazer'
                          ? 'border-accent/45 bg-accent-soft/35'
                          : r.status === 'aprovada'
                            ? 'border-ok/30 bg-bg'
                            : 'border-line/70 bg-bg/70 opacity-75',
                      )}
                    >
                      <div className="min-w-0 w-full sm:flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent">
                            {r.code}
                          </span>
                          <span className="break-words font-semibold text-fg">{r.name}</span>
                          {r.isOptional && (
                            <span className="shrink-0 rounded-md bg-surface-2/80 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                              Opcional selecionada
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {formatAcademicYearLabel(r.year, isSecondarySchool)} · {r.semester}.º Sem · {r.ects} ECTS
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
                        {(
                          [
                            { value: 'a_fazer', label: 'Ativa agora' },
                            { value: 'aprovada', label: 'Aprovada' },
                            { value: 'por_fazer', label: 'Depois' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateRecordStatus(r.id, opt.value)}
                            className={cx(
                              'min-h-[34px] rounded-xl px-2.5 text-[11px] font-semibold transition',
                              r.status === opt.value
                                ? opt.value === 'a_fazer'
                                  ? 'bg-accent text-accent-fg shadow-sm'
                                  : opt.value === 'aprovada'
                                    ? 'bg-ok text-white'
                                    : 'bg-ink-cta text-ink-cta-fg'
                                : 'border border-line bg-surface text-muted hover:text-fg',
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                        {r.status === 'aprovada' && (
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={20}
                            step="0.5"
                            placeholder="Nota"
                            aria-label={`Nota de ${r.name}`}
                            value={r.grade ?? ''}
                            onChange={(e) => updateRecordGrade(r.id, e.target.value)}
                            className="h-8 w-14 rounded-lg border border-line bg-surface px-1.5 text-center text-xs tabular text-fg"
                          />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Gaveta colapsável para escolher cadeiras opcionais de Mestrado/Licenciatura */}
              {records.some((r) => r.isOptional && r.status === 'por_fazer') && (
                <div className="rounded-3xl border border-dashed border-line bg-surface/70 p-3.5">
                  <button
                    type="button"
                    onClick={() => {
                      void hapticTap();
                      setShowOptionalCourses((v) => !v);
                    }}
                    className="flex min-h-[40px] w-full items-center justify-between gap-2 text-left text-xs font-semibold text-fg"
                  >
                    <span>
                      {showOptionalCourses ? '− Esconder cadeiras opcionais disponíveis' : '+ Ver / escolher cadeiras opcionais disponíveis'}{' '}
                      <span className="font-mono text-muted">
                        ({filteredRecords.filter((r) => r.isOptional && r.status === 'por_fazer').length})
                      </span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] text-muted">
                      {showOptionalCourses ? 'Fechar' : 'Abrir'}
                    </span>
                  </button>

                  {showOptionalCourses && (
                    <div className="mt-3 space-y-2.5">
                      <Input
                        value={optionalSearch}
                        onChange={(e) => setOptionalSearch(e.target.value)}
                        placeholder="Filtrar opcional por sigla ou nome…"
                      />
                      <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                        {optionalAvailableRecords.length === 0 ? (
                          <p className="py-3 text-center text-xs text-muted">
                            Nenhuma opcional encontrada neste filtro.
                          </p>
                        ) : (
                          optionalAvailableRecords.map((optCourse) => (
                            <div
                              key={optCourse.id}
                              className="flex flex-col gap-2 rounded-2xl border border-line bg-bg px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <span className="font-mono text-[10px] font-bold text-accent">
                                  {optCourse.code}
                                </span>{' '}
                                <span className="font-semibold text-fg">{optCourse.name}</span>
                                <span className="block text-[11px] text-muted">
                                  {formatAcademicYearLabel(optCourse.year, isSecondarySchool)} · {optCourse.semester}.º Sem · {optCourse.ects} ECTS
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => updateRecordStatus(optCourse.id, 'a_fazer')}
                                  className="min-h-[34px] rounded-xl bg-accent px-2.5 text-[11px] font-semibold text-accent-fg transition hover:opacity-90"
                                >
                                  + Ativa agora
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateRecordStatus(optCourse.id, 'aprovada')}
                                  className="min-h-[34px] rounded-xl border border-line bg-surface px-2.5 text-[11px] font-semibold text-muted hover:text-fg"
                                >
                                  Já feita
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 py-2 text-xs text-fg">
                <input
                  type="checkbox"
                  checked={replaceCoursesWithCurriculum}
                  onChange={(e) => setReplaceCoursesWithCurriculum(e.target.checked)}
                  className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                />
                Aplicar estas <strong>{doingCount} cadeiras ativas</strong> ao meu painel
              </label>
            </div>
          )}

          {/* PASSO 3: CONTAS SEPARADAS, CHAVE GEMINI, PRIVACIDADE & RITMO */}
          {activeStepId === 'ritmo' && (
            <div className="space-y-5">
              <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#FCE99F]/55 ring-1 ring-line">
                  <UniBuddy mood="celebrate" size={58} interactive={false} />
                </div>
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-ok/15 px-2.5 py-0.5 text-[11px] font-bold text-ok">
                    Último passo
                  </span>
                  <h2 className="font-display text-xl font-bold text-fg sm:text-2xl">
                    Contas separadas, <em className="font-editorial text-accent">Uni e ritmo</em>
                  </h2>
                  <p className="text-xs text-muted sm:text-sm">
                    Liga opcionalmente o teu email institucional da faculdade, configura a chave Gemini se quiseres mensagens ilimitadas e define o teu ritmo semanal.
                  </p>
                  {extraActivities.length > 0 && (
                    <p className="text-[11px] font-semibold text-accent">
                      ✓ Atividades extra consideradas ({extraActivities.reduce((s, a) => s + a.hoursPerWeek, 0)}h/semana ajustadas no plano).
                    </p>
                  )}
                </div>
              </div>

              {/* Ligação estrita de Email Institucional vs Pessoal */}
              <div className="space-y-3 rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Mail size={16} className="text-accent" />
                      <h3 className="font-display text-sm font-bold text-fg">
                        Email Institucional da Faculdade (Correio Académico)
                      </h3>
                      <Badge tone={academicMailConnected ? 'ok' : 'neutral'}>
                        {academicMailConnected ? 'Ligado' : 'Opcional'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      Totalmente separado da tua conta pessoal{activePersonalEmail ? ` (${activePersonalEmail})` : ''}. Nunca lemos emails pessoais.
                    </p>
                  </div>
                </div>

                {academicMailConnected ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ok/30 bg-ok/10 px-3.5 py-2.5 text-xs">
                    <span className="font-medium text-fg">
                      Conta institucional ativa:{' '}
                      <strong className="font-mono text-ok">
                        {academicEmail || academicHint || 'Conta Google Académica'}
                      </strong>
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void connectAcademicMail(true, academicEmail || undefined)}
                    >
                      Trocar conta
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="email"
                      value={academicHint}
                      onChange={(e) => setAcademicHint(e.target.value)}
                      placeholder="Ex: p.silva@campus.fct.unl.pt"
                      className="flex-1"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={academicBusy}
                      onClick={() => void handleConnectAcademic()}
                    >
                      {academicBusy ? 'A abrir Google…' : 'Ligar Email Académico'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Uni + Chave Gemini & Armazenamento */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col justify-between gap-3 rounded-3xl border border-line bg-surface p-4">
                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={aiConsent}
                        onChange={(e) => {
                          setAiConsent(e.target.checked);
                          void hapticTap();
                        }}
                        className="mt-1 h-4 w-4 rounded border-line text-accent focus:ring-accent"
                      />
                      <div>
                        <p className="text-xs font-bold text-fg">Ativar Uni (Tutor & OCR)</p>
                        <p className="text-[11px] text-muted">
                          Tens cota diária gratuita ou podes pôr a tua chave gratuita Gemini (sem limite de 15 msgs).
                        </p>
                      </div>
                    </label>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowGeminiModal(true)}
                  >
                    <KeyRound size={14} />{' '}
                    {settings.geminiApiKey ? 'Chave Gemini configurada' : 'Adicionar chave Gemini'}
                  </Button>
                </div>

                <div className="space-y-2 rounded-3xl border border-line bg-surface p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-fg">
                    <ShieldCheck size={15} className="text-accent" /> Onde guardar o caderno?
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={!cloudSyncConsent}
                      onClick={() => {
                        setCloudSyncConsent(false);
                        void hapticTap();
                      }}
                      className={cx(
                        'flex min-h-[54px] flex-col items-start justify-center rounded-2xl border px-3 py-2 text-left text-[11px] transition',
                        !cloudSyncConsent
                          ? 'border-accent bg-accent-soft text-accent'
                          : 'border-line bg-bg text-muted',
                      )}
                    >
                      <span className="flex items-center gap-1 font-bold">
                        <HardDrive size={12} /> Local
                      </span>
                      <span>Só neste dispositivo</span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={cloudSyncConsent}
                      onClick={() => {
                        setCloudSyncConsent(true);
                        void hapticTap();
                      }}
                      className={cx(
                        'flex min-h-[54px] flex-col items-start justify-center rounded-2xl border px-3 py-2 text-left text-[11px] transition',
                        cloudSyncConsent
                          ? 'border-accent bg-accent-soft text-accent'
                          : 'border-line bg-bg text-muted',
                      )}
                    >
                      <span className="flex items-center gap-1 font-bold">
                        <Cloud size={12} /> Cloud
                      </span>
                      <span>Sincronizado</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Ritmo semanal */}
              <div className="space-y-4 rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
                <div role="group" aria-label="Dias disponíveis para estudar" className="space-y-1.5">
                  <span className="block text-xs font-medium text-muted">
                    Dias disponíveis para estudar
                  </span>
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAY_LABELS.map((d) => {
                      const active = studyDays.includes(d.day);
                      return (
                        <button
                          key={d.day}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleStudyDay(d.day)}
                          className={cx(
                            'flex min-h-[44px] items-center justify-center rounded-xl border text-xs font-semibold transition',
                            active
                              ? 'border-accent bg-accent text-accent-fg shadow-sm'
                              : 'border-line bg-bg text-muted hover:text-fg',
                          )}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div role="group" aria-label="Meta diária de foco" className="space-y-1.5">
                  <span className="block text-xs font-medium text-muted">Meta diária de foco</span>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {DAILY_PRESETS.map((preset) => {
                      const selected = dailyMinutes === preset.minutes;
                      return (
                        <button
                          key={preset.minutes}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setDailyMinutes(preset.minutes);
                            void hapticTap();
                          }}
                          className={cx(
                            'min-h-[54px] rounded-2xl border p-2.5 text-left transition',
                            selected
                              ? 'border-accent bg-accent-soft text-accent'
                              : 'border-line bg-bg hover:bg-surface-2',
                          )}
                        >
                          <p className="font-display text-base font-bold tabular">{preset.label}</p>
                          <p className="text-[11px] text-muted">{preset.hint}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {activeCandidates.length > 0 && (
                  <div
                    role="group"
                    aria-label="Cadeiras que precisam de mais atenção"
                    className="space-y-1.5"
                  >
                    <span className="block text-xs font-medium text-muted">
                      Cadeiras que precisam de mais atenção
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeCandidates.map((item) => {
                        const selected = difficultKeys.includes(item.key);
                        return (
                          <button
                            key={item.key}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleDifficult(item.key)}
                            className={cx(
                              'inline-flex min-h-[36px] items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition',
                              selected
                                ? 'border-accent bg-accent-soft text-accent'
                                : 'border-line bg-bg text-muted hover:text-fg',
                            )}
                          >
                            {selected && <Check size={12} />}
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Field label="Notas para o Uni adaptar o teu plano (opcional)">
                  <Textarea
                    rows={2}
                    value={difficultNotes}
                    onChange={(e) => setDifficultNotes(e.target.value)}
                    placeholder="Ex: Preciso de reforço em integrais múltiplos ou equilíbrio de fases…"
                  />
                </Field>

                <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-2xl border border-line bg-bg px-3.5 py-2 text-xs text-fg">
                  <input
                    type="checkbox"
                    checked={launchTour}
                    onChange={(e) => setLaunchTour(e.target.checked)}
                    className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                  />
                  <span>
                    Mostrar o <strong>guia rápido do Uni</strong> quando abrir o painel
                  </span>
                </label>
              </div>

              {!settings.ageConfirmed13Plus && !storedProfile.onboardingCompleted && (
                <div className="rounded-2xl border border-line bg-surface p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={ageConfirmed}
                      onChange={(e) => {
                        setAgeConfirmed(e.target.checked);
                        void hapticTap();
                      }}
                      className="mt-1 h-5 w-5 shrink-0 rounded border-line accent-accent"
                    />
                    <span className="text-xs leading-relaxed text-fg sm:text-sm">
                      Confirmo que tenho pelo menos <strong>{LEGAL_INFO.minimumAgePT} anos</strong> (ou autorização) e aceito a{' '}
                      <button
                        type="button"
                        onClick={() => setLegalPreview('privacy')}
                        className="inline-link font-semibold text-accent underline underline-offset-2"
                      >
                        Política de Privacidade
                      </button>{' '}
                      e os{' '}
                      <button
                        type="button"
                        onClick={() => setLegalPreview('terms')}
                        className="inline-link font-semibold text-accent underline underline-offset-2"
                      >
                        Termos de Utilização
                      </button>
                      .
                    </span>
                  </label>
                  {!ageConfirmed && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-coral">
                      <AlertCircle size={14} className="shrink-0" />
                      Marca esta caixa para concluir e abrir o teu caderno.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </main>

      {/* Rodapé CTA */}
      <footer className="sticky bottom-0 z-10 border-t border-line bg-bg/92 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-6 sm:pb-4">
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
              aria-label="Passo seguinte"
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
              disabled={!ageConfirmed}
              onClick={handleFinish}
              whileTap={{ scale: 0.96 }}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-ink-cta px-6 text-sm font-bold text-ink-cta-fg shadow-card transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
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
                    O teu email institucional da faculdade é ligado de forma independente do Gmail pessoal.
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
                  className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline"
                >
                  Abrir página completa <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <GeminiKeyGuideModal open={showGeminiModal} onClose={() => setShowGeminiModal(false)} />

      {scheduleImportMode && (
        <SmartScheduleImportModal
          initialMode={scheduleImportMode}
          onClose={() => {
            setScheduleImportMode(null);
            const storeCourses = useStore.getState().courses;
            if (storeCourses.length > 0) {
              setRecords((prev) => {
                const next = [...prev];
                for (const c of storeCourses) {
                  const idx = next.findIndex(
                    (r) =>
                      r.code.toLowerCase() === c.code.toLowerCase() ||
                      r.name.toLowerCase() === c.name.toLowerCase(),
                  );
                  if (idx >= 0) {
                    if (next[idx].status === 'por_fazer') {
                      next[idx] = { ...next[idx], status: 'a_fazer' };
                    }
                  } else {
                    next.unshift({
                      id: c.id,
                      code: c.code,
                      name: c.name,
                      year: primaryAcademicYear,
                      semester: currentSemester,
                      ects: c.ects,
                      status: 'a_fazer',
                    });
                  }
                }
                return next;
              });
            }
          }}
        />
      )}
    </div>
  );
}

export default function OnboardingExperience({ onClose, fullScreen = true }: OnboardingExperienceProps) {
  return (
    <OnboardingProvider<OnboardingContextData>
      steps={ONBOARDING_STEPS}
      initialContext={{ flowData: {}, flowVersion: LEGAL_INFO.policyVersion }}
    >
      <OnboardingFlowBody onClose={onClose} fullScreen={fullScreen} />
    </OnboardingProvider>
  );
}
