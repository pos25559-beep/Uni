import { OnboardingProvider, useOnboarding } from '@onboardjs/react';
import type { OnboardingStep } from '@onboardjs/core';
import {
  AlertCircle,
  ArrowRight,
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
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useAcademicEmails } from '../../hooks/useGoogleData';
import { parseAcademicHistoryFromScreenshot } from '../../integrations/gemini';
import { parseCurriculumFromText } from '../../lib/curriculumParser';
import { auth } from '../../lib/firebase';
import {
  fetchSharedCurriculaFromCloud,
  publishSharedCurriculum,
} from '../../lib/firestoreSync';
import { LEGAL_INFO } from '../../lib/legal';
import { hapticSuccess, hapticTap } from '../../lib/nativeBridge';
import {
  buildInitialCompletedRecords,
  computeWeightedAverage,
  formatAcademicYearLabel,
  formatAcademicYearShort,
  getUniversityById,
  mergeCurriculumCatalog,
  PORTUGAL_CURRICULA,
} from '../../lib/portugalCurriculum';
import { useStore } from '../../store/useStore';
import type { AcademicProfile, CompletedCourseRecord } from '../../types';
import { UniBuddy, UnipediaLogoMark } from '../brand/UnipediaMarks';
import SmartScheduleImportModal, {
  type SmartImportInitialMode,
} from '../courses/SmartScheduleImportModal';
import { celebrateStationery, UNIPEDIA_SPRING } from '../motion/Primitives';
import GeminiKeyGuideModal from '../settings/GeminiKeyGuideModal';
import { Badge, Button, Field, Input, Select, Textarea, cx } from '../ui';
import { startUnipediaGuidedTour } from './TourManager';

type OnboardingStepId = 'percurso' | 'cadeiras' | 'ritmo';
type AcademicCycleMode = 'licenciatura' | 'mestrado' | 'misto';

type OnboardingContextData = {
  flowData: Record<string, unknown>;
  flowVersion: string;
};

const ONBOARDING_STEPS: OnboardingStep<OnboardingContextData>[] = [
  { id: 'percurso', type: 'INFORMATION', nextStep: 'cadeiras' },
  { id: 'cadeiras', type: 'INFORMATION', previousStep: 'percurso', nextStep: 'ritmo' },
  { id: 'ritmo', type: 'CONFIRMATION', previousStep: 'cadeiras', nextStep: null },
];

const STEP_META: Array<{ id: OnboardingStepId; label: string }> = [
  { id: 'percurso', label: 'Tu e o teu Percurso' },
  { id: 'cadeiras', label: 'Cadeiras & Histórico' },
  { id: 'ritmo', label: 'Contas, Uni & Ritmo' },
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
  const activeStepId = (currentStep?.id as OnboardingStepId) ?? 'percurso';
  const stepIndex = Math.max(0, STEP_META.findIndex((s) => s.id === activeStepId));
  const [direction, setDirection] = useState(1);
  const [finishingWipe, setFinishingWipe] = useState(false);

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

  // Passo 2: Filtros por ano, adição manual e OCR
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');
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
    if (nextUniId === 'escola-secundario') {
      setAcademicCycle('licenciatura');
      const cleaned = [1];
      setActiveYears(cleaned);
      rebuildRecords(nextUniId, firstDegreeId, cleaned, currentSemester);
      return;
    }
    rebuildRecords(nextUniId, firstDegreeId, activeYears, currentSemester);
  };

  const handleDegreeChange = (nextDegId: string) => {
    setDegreeId(nextDegId);
    let nextYears = activeYears;
    if (nextDegId === 'memec') {
      setAcademicCycle('mestrado');
      nextYears = activeYears.filter((y) => y >= 4);
      if (nextYears.length === 0) nextYears = [4];
      setActiveYears(nextYears);
    } else if (nextDegId === 'lemc-memec') {
      setAcademicCycle('misto');
    }
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
    setNewCourseYear(nextYears[nextYears.length - 1] ?? 1);
    rebuildRecords(universityId, nextDeg, nextYears, currentSemester);
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

  const handleScreenshotUpload = async (file: File | undefined) => {
    if (!file) return;
    if (!aiConsent) {
      setOcrError('Ativa a permissão do Uni (IA) no Passo 3 antes de analisar pautas por imagem.');
      return;
    }
    setOcrBusy(true);
    setOcrError(null);
    setOcrFeedback(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
        reader.readAsDataURL(file);
      });

      const extracted = await parseAcademicHistoryFromScreenshot(base64, file.type || 'image/png');
      if (extracted.length === 0) {
        setOcrError('Nenhuma disciplina foi reconhecida. Tenta um print mais nítido da pauta.');
        return;
      }

      setRecords((prev) => {
        const next = [...prev];
        for (const item of extracted) {
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
        }
        return next;
      });

      setOcrFeedback(`${extracted.length} disciplinas atualizadas pelo print.`);
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
      difficultCourseIds: difficultKeys,
      difficultTopicsNotes: difficultNotes.trim(),
      completedCourses: records,
    };

    updateSettings({
      userName: userName.trim() || 'Estudante',
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
          {/* PASSO 1: IDENTIDADE, CICLO E MÚLTIPLOS ANOS */}
          {activeStepId === 'percurso' && (
            <div className="space-y-5">
              <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[#FCE99F]/45 ring-1 ring-line">
                  <UniBuddy mood="happy" size={68} interactive={false} />
                </div>
                <div className="space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold text-accent">
                    <Sparkles size={11} /> Olá! Eu sou o Uni
                  </span>
                  <h2 className="font-display text-xl font-bold tracking-tight text-fg sm:text-2xl">
                    Vamos preparar o teu <em className="font-editorial text-accent">semestre real</em>
                  </h2>
                  <p className="text-xs leading-relaxed text-muted sm:text-sm">
                    Quer estejas num único ano, em Licenciatura + Mestrado em simultâneo ou com cadeiras misturadas, configuramos o plano exatamente como é o teu percurso.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 rounded-3xl border border-line bg-surface p-4 shadow-sm sm:grid-cols-2 sm:p-5">
                <Field label="Como te chamas?">
                  <Input
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Ex: Pedro Silva"
                  />
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
                    {ocrBusy ? 'A ler print…' : 'Print Horário / Pauta'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={ocrBusy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        void handleScreenshotUpload(file);
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
                    Todos ({records.length})
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

              {/* Lista editorial de cadeiras */}
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-3xl border border-line bg-surface p-3">
                {filteredRecords.length === 0 ? (
                  <p className="p-6 text-center text-xs text-muted">
                    Ainda sem cadeiras neste filtro. Usa «+ Adicionar» acima ou «Print Horário / Pauta».
                  </p>
                ) : (
                  filteredRecords.map((r) => (
                    <div
                      key={r.id}
                      className={cx(
                        'flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-xs transition',
                        r.status === 'a_fazer'
                          ? 'border-accent/45 bg-accent-soft/35'
                          : r.status === 'aprovada'
                            ? 'border-ok/30 bg-bg'
                            : 'border-line/70 bg-bg/70 opacity-75',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent">
                            {r.code}
                          </span>
                          <span className="font-semibold text-fg">{r.name}</span>
                          {r.isOptional && (
                            <span className="rounded-md bg-surface-2/80 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                              Opcional
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {formatAcademicYearLabel(r.year, isSecondarySchool)} · {r.semester}.º Sem · {r.ects} ECTS
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
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
                const map = new Map(prev.map((r) => [r.name.toLowerCase(), r]));
                for (const c of storeCourses) {
                  if (!map.has(c.name.toLowerCase())) {
                    map.set(c.name.toLowerCase(), {
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
                return [...map.values()];
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
