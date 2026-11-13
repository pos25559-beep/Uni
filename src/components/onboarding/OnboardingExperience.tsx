import { OnboardingProvider, useOnboarding } from '@onboardjs/react';
import type { OnboardingStep } from '@onboardjs/core';
import confetti from 'canvas-confetti';
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  ExternalLink,
  HardDrive,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { parseAcademicHistoryFromScreenshot } from '../../integrations/gemini';
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
  getUniversityById,
  mergeCurriculumCatalog,
  PORTUGAL_CURRICULA,
} from '../../lib/portugalCurriculum';
import { useStore } from '../../store/useStore';
import type { AcademicProfile, CompletedCourseRecord } from '../../types';
import { OnboardingSceneArt, UnipediaLogoMark } from '../brand/UnipediaMarks';
import { UNIPEDIA_SPRING } from '../motion/Primitives';
import { Badge, Button, Field, Input, Select, Textarea, cx } from '../ui';
import { startUnipediaGuidedTour } from './TourManager';

type OnboardingContextData = {
  flowData: Record<string, unknown>;
  flowVersion: string;
};

const ONBOARDING_STEPS: OnboardingStep<OnboardingContextData>[] = [
  { id: 'welcome', type: 'INFORMATION', nextStep: 'privacy' },
  { id: 'privacy', type: 'INFORMATION', previousStep: 'welcome', nextStep: 'curriculum' },
  { id: 'curriculum', type: 'INFORMATION', previousStep: 'privacy', nextStep: 'rhythm' },
  { id: 'rhythm', type: 'CONFIRMATION', previousStep: 'curriculum', nextStep: null },
];

const STEP_META = [
  { id: 'welcome', label: 'Boas-vindas', scene: 'welcome' as const },
  { id: 'privacy', label: 'Privacidade', scene: 'privacy' as const },
  { id: 'curriculum', label: 'Estudos', scene: 'curriculum' as const },
  { id: 'rhythm', label: 'Ritmo', scene: 'rhythm' as const },
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

function fireCompletionConfetti() {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  try {
    void confetti({
      particleCount: 55,
      spread: 68,
      origin: { y: 0.65 },
      colors: ['#4f46e5', '#818cf8', '#10b981', '#f59e0b'],
    });
  } catch {
    // Silencioso caso o ambiente headless não suporte canvas
  }
}

function OnboardingFlowBody({ onClose, fullScreen = true }: OnboardingExperienceProps) {
  const settings = useStore((s) => s.settings);
  const existingCourses = useStore((s) => s.courses);
  const storedProfile = useStore((s) => s.academicProfile);
  const isDemo = useStore((s) => s.isDemo);
  const updateSettings = useStore((s) => s.updateSettings);
  const saveAcademicProfile = useStore((s) => s.saveAcademicProfile);
  const applyCurriculumCourses = useStore((s) => s.applyCurriculumCourses);
  const loadDemo = useStore((s) => s.loadDemo);

  const { currentStep, next, previous } = useOnboarding<OnboardingContextData>();
  const activeStepId = (currentStep?.id as 'welcome' | 'privacy' | 'curriculum' | 'rhythm') ?? 'welcome';
  const stepIndex = Math.max(0, STEP_META.findIndex((s) => s.id === activeStepId));
  const [direction, setDirection] = useState(1);

  // Passo 1: RGPD & Idade mínima (13 anos PT)
  const [ageConfirmed, setAgeConfirmed] = useState<boolean>(
    Boolean(settings.ageConfirmed13Plus || storedProfile.onboardingCompleted),
  );
  const [legalPreview, setLegalPreview] = useState<'privacy' | 'terms' | null>(null);

  // Passo 2: Privacidade & Consentimento explícito (RGPD + EU AI Act)
  const [cloudSyncConsent, setCloudSyncConsent] = useState<boolean>(
    Boolean(settings.cloudSyncConsent),
  );
  const [aiConsent, setAiConsent] = useState<boolean>(Boolean(settings.aiConsent));

  // Passo 3: Escola / Universidade & Currículo
  const [userName, setUserName] = useState(settings.userName);
  const [universityId, setUniversityId] = useState(storedProfile.universityId || 'nova-fct');
  const [customUniversity, setCustomUniversity] = useState(
    storedProfile.universityId === 'outra' ? storedProfile.universityName : '',
  );
  const [degreeId, setDegreeId] = useState(storedProfile.degreeId || 'lemc');
  const [customDegree, setCustomDegree] = useState(
    storedProfile.degreeId === 'outro' ? storedProfile.degreeName : '',
  );
  const [entryYear, setEntryYear] = useState<number>(storedProfile.entryYear || 2024);
  const [currentAcademicYear, setCurrentAcademicYear] = useState<1 | 2 | 3>(
    storedProfile.currentAcademicYear || 2,
  );
  const [currentSemester, setCurrentSemester] = useState<1 | 2>(
    storedProfile.currentSemester || 2,
  );
  const [records, setRecords] = useState<CompletedCourseRecord[]>(() =>
    storedProfile.completedCourses.length > 0
      ? storedProfile.completedCourses
      : buildInitialCompletedRecords(
          storedProfile.universityId || 'nova-fct',
          storedProfile.degreeId || 'lemc',
          storedProfile.currentAcademicYear || 2,
          storedProfile.currentSemester || 2,
        ),
  );
  const [replaceCoursesWithCurriculum, setReplaceCoursesWithCurriculum] = useState(!isDemo);
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [catalog, setCatalog] = useState(PORTUGAL_CURRICULA);

  // OCR opcional (apenas com aiConsent + chave Gemini)
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrFeedback, setOcrFeedback] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Passo 4: Ritmo Semanal & Tour
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

  const handleUniversityChange = (nextUniId: string) => {
    setUniversityId(nextUniId);
    const uni = getUniversityById(nextUniId, catalog);
    const firstDegreeId = uni?.degrees[0]?.id ?? 'outro';
    setDegreeId(firstDegreeId);
    if (nextUniId !== 'outra' && firstDegreeId !== 'outro') {
      setRecords(
        buildInitialCompletedRecords(nextUniId, firstDegreeId, currentAcademicYear, currentSemester, catalog),
      );
    } else {
      setRecords([]);
    }
  };

  const handleDegreeChange = (nextDegId: string) => {
    setDegreeId(nextDegId);
    if (universityId !== 'outra' && nextDegId !== 'outro') {
      setRecords(
        buildInitialCompletedRecords(universityId, nextDegId, currentAcademicYear, currentSemester, catalog),
      );
    } else {
      setRecords([]);
    }
  };

  const handlePeriodChange = (year: 1 | 2 | 3, semester: 1 | 2) => {
    setCurrentAcademicYear(year);
    setCurrentSemester(semester);
    if (universityId !== 'outra' && degreeId !== 'outro') {
      setRecords(buildInitialCompletedRecords(universityId, degreeId, year, semester, catalog));
    }
  };

  const updateRecordStatus = (id: string, status: CompletedCourseRecord['status']) => {
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

  const addCustomRecord = () => {
    const name = newCourseName.trim();
    if (!name) return;
    const code = (newCourseCode.trim() || name.slice(0, 5)).toUpperCase();
    setRecords((prev) => [
      ...prev,
      {
        id: `hist-custom-${Date.now().toString(36)}`,
        code,
        name,
        year: currentAcademicYear,
        semester: currentSemester,
        ects: isSecondarySchool ? 4 : 6,
        status: 'a_fazer',
      },
    ]);
    setNewCourseCode('');
    setNewCourseName('');
    void hapticTap();
  };

  const handleScreenshotUpload = async (file: File | undefined) => {
    if (!file) return;
    if (!aiConsent) {
      setOcrError('Ativa o consentimento de Inteligência Artificial no passo anterior para ler pautas por imagem.');
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
            next.push({
              id: `hist-ocr-${Math.random().toString(36).slice(2, 8)}`,
              code: (item.code ?? item.name.slice(0, 5)).toUpperCase(),
              name: item.name,
              year: currentAcademicYear,
              semester: currentSemester,
              ects: item.ects ?? (isSecondarySchool ? 4 : 6),
              grade: item.grade,
              status: item.status,
            });
          }
        }
        return next;
      });

      setOcrFeedback(`${extracted.length} disciplinas sincronizadas a partir da imagem.`);
      void hapticSuccess();
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : 'Erro ao analisar o print com Gemini Vision.');
    } finally {
      setOcrBusy(false);
    }
  };

  const activeCandidates = useMemo(() => {
    const activeFromRecords = records.filter((r) => r.status === 'a_fazer');
    if (replaceCoursesWithCurriculum && activeFromRecords.length > 0) {
      return activeFromRecords.map((r) => ({ key: r.code, label: `${r.code} — ${r.name}` }));
    }
    return existingCourses.map((c) => ({ key: c.id, label: `${c.shortName} — ${c.name}` }));
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

  const persistConsent = () => {
    updateSettings({
      ageConfirmed13Plus: ageConfirmed,
      gdprAcceptedAt: settings.gdprAcceptedAt || new Date().toISOString(),
      gdprPolicyVersion: LEGAL_INFO.policyVersion,
      aiConsent,
      cloudSyncConsent,
    });
  };

  const handleGoNext = async () => {
    if (activeStepId === 'welcome' && !ageConfirmed) return;
    if (activeStepId === 'privacy') {
      persistConsent();
    }
    setDirection(1);
    void hapticTap();
    await next();
  };

  const handleGoPrev = async () => {
    setDirection(-1);
    void hapticTap();
    await previous();
  };

  const handleStartDemo = () => {
    if (!ageConfirmed) return;
    loadDemo();
    updateSettings({
      ageConfirmed13Plus: true,
      gdprAcceptedAt: new Date().toISOString(),
      gdprPolicyVersion: LEGAL_INFO.policyVersion,
      tourCompleted: !launchTour,
    });
    saveAcademicProfile({ onboardingCompleted: true });
    fireCompletionConfetti();
    void hapticSuccess();
    onClose();
    if (launchTour) {
      window.setTimeout(() => startUnipediaGuidedTour(), 360);
    }
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
      currentAcademicYear,
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
          year: ([1, 2, 3].includes(r.year) ? r.year : 1) as 1 | 2 | 3,
          semester: r.semester,
          ects: r.ects || 6,
          topics: [r.name],
        })),
      }).catch(() => {});
    }

    fireCompletionConfetti();
    void hapticSuccess();
    onClose();
    if (launchTour) {
      window.setTimeout(() => startUnipediaGuidedTour(), 360);
    }
  };

  const canSkipDirectly = storedProfile.onboardingCompleted && ageConfirmed;

  return (
    <div
      className={cx(
        'flex flex-col bg-bg text-fg',
        fullScreen ? 'min-h-[100dvh] w-full' : 'w-full rounded-2xl',
      )}
    >
      {/* Topo editorial com barra de progresso contínua */}
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <UnipediaLogoMark size={30} />
            <div>
              <p className="font-display text-sm font-bold leading-tight text-fg">Unipedia</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted tabular">
                Passo {stepIndex + 1} de {STEP_META.length} · {STEP_META[stepIndex]?.label}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canSkipDirectly && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                Fechar
              </Button>
            )}
          </div>
        </div>

        {/* Barra de progresso segmentada com mola */}
        <div className="mx-auto mt-3 grid max-w-3xl grid-cols-4 gap-1.5" aria-hidden="true">
          {STEP_META.map((item, idx) => (
            <div key={item.id} className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={false}
                animate={{ width: idx <= stepIndex ? '100%' : '0%' }}
                transition={UNIPEDIA_SPRING}
              />
            </div>
          ))}
        </div>
      </header>

      {/* Conteúdo animado do passo */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-5 pb-28 sm:px-6 sm:py-8">
        <motion.div
          key={activeStepId}
          initial={{ opacity: 0, x: direction * 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-6"
        >
            {activeStepId === 'welcome' && (
              <div className="space-y-6">
                <div className="overflow-hidden rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-8">
                  <div className="grid items-center gap-6 sm:grid-cols-[1.15fr_0.85fr]">
                    <div className="space-y-4">
                      <Badge tone="accent">Escola & Universidade · Portugal</Badge>
                      <h1 className="font-display text-3xl font-extrabold leading-[1.08] tracking-tight text-fg sm:text-4xl">
                        Estuda com <em className="font-editorial text-accent">calma</em>, avança com clareza.
                      </h1>
                      <p className="text-sm leading-relaxed text-muted sm:text-base">
                        A Unipedia reúne cadeiras ou disciplinas, prazos de avaliações, sessões diárias e um tutor focado no teu programa.
                      </p>

                      <ul className="grid gap-2 pt-1 text-xs font-medium text-fg sm:grid-cols-2">
                        <li className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
                          <CalendarDays size={15} className="shrink-0 text-accent" />
                          Plano semanal realista
                        </li>
                        <li className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
                          <BookOpen size={15} className="shrink-0 text-ok" />
                          Secundário & Ensino Superior
                        </li>
                      </ul>
                    </div>

                    <div className="flex items-center justify-center rounded-2xl bg-surface-2/70 p-4">
                      <OnboardingSceneArt scene="welcome" className="h-44 w-full max-w-[230px]" />
                    </div>
                  </div>
                </div>

                {/* Confirmação obrigatória RGPD & Idade mínima em Portugal (Lei n.º 58/2019, Art. 16.º) */}
                <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={ageConfirmed}
                      onChange={(e) => {
                        setAgeConfirmed(e.target.checked);
                        void hapticTap();
                      }}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-line text-accent focus:ring-accent"
                    />
                    <span className="text-xs leading-relaxed text-fg sm:text-sm">
                      Confirmo que tenho pelo menos <strong>{LEGAL_INFO.minimumAgePT} anos</strong> (nos termos do RGPD e da Lei n.º 58/2019) e aceito a{' '}
                      <button
                        type="button"
                        onClick={() => setLegalPreview('privacy')}
                        className="font-semibold text-accent underline underline-offset-2"
                      >
                        Política de Privacidade
                      </button>{' '}
                      e os{' '}
                      <button
                        type="button"
                        onClick={() => setLegalPreview('terms')}
                        className="font-semibold text-accent underline underline-offset-2"
                      >
                        Termos de Utilização
                      </button>
                      .
                    </span>
                  </label>
                  {!ageConfirmed && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                      <AlertCircle size={13} className="shrink-0 text-warn" />
                      Obrigatório confirmar antes de criar o teu plano ou carregar o modo de demonstração.
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeStepId === 'privacy' && (
              <div className="space-y-5">
                <div className="grid items-center gap-5 rounded-3xl border border-line bg-surface p-5 shadow-card sm:grid-cols-[0.8fr_1.2fr] sm:p-6">
                  <div className="flex items-center justify-center rounded-2xl bg-surface-2/70 p-4">
                    <OnboardingSceneArt scene="privacy" className="h-36 w-full max-w-[190px]" />
                  </div>
                  <div className="space-y-2">
                    <Badge tone="ok">RGPD & Zero Rastreio</Badge>
                    <h2 className="font-display text-2xl font-bold tracking-tight text-fg">
                      Os teus estudos ficam no <em className="font-editorial text-accent">teu controlo</em>
                    </h2>
                    <p className="text-xs leading-relaxed text-muted sm:text-sm">
                      Sem anúncios, sem cookies publicitários e sem partilha de dados com terceiros. Podes exportar um backup JSON ou apagar tudo a qualquer instante.
                    </p>
                  </div>
                </div>

                {/* Escolha de Armazenamento */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Onde queres guardar o progresso?
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      aria-pressed={!cloudSyncConsent}
                      onClick={() => {
                        setCloudSyncConsent(false);
                        void hapticTap();
                      }}
                      className={cx(
                        'flex flex-col gap-2 rounded-2xl border p-4 text-left transition',
                        !cloudSyncConsent
                          ? 'border-accent bg-accent-soft/60 shadow-sm'
                          : 'border-line bg-surface hover:bg-surface-2',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <HardDrive size={18} className={!cloudSyncConsent ? 'text-accent' : 'text-muted'} />
                        {!cloudSyncConsent && <Badge tone="accent">Selecionado</Badge>}
                      </div>
                      <p className="font-display text-sm font-bold text-fg">100% Local neste dispositivo</p>
                      <p className="text-xs text-muted">
                        Tudo fica guardado offline na memória do telemóvel ou navegador. Máxima privacidade.
                      </p>
                    </button>

                    <button
                      type="button"
                      aria-pressed={cloudSyncConsent}
                      onClick={() => {
                        setCloudSyncConsent(true);
                        void hapticTap();
                      }}
                      className={cx(
                        'flex flex-col gap-2 rounded-2xl border p-4 text-left transition',
                        cloudSyncConsent
                          ? 'border-accent bg-accent-soft/60 shadow-sm'
                          : 'border-line bg-surface hover:bg-surface-2',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Cloud size={18} className={cloudSyncConsent ? 'text-accent' : 'text-muted'} />
                        {cloudSyncConsent && <Badge tone="accent">Selecionado</Badge>}
                      </div>
                      <p className="font-display text-sm font-bold text-fg">Local + Sincronização Cloud</p>
                      <p className="text-xs text-muted">
                        Permite sincronizar entre telemóvel e computador via conta Firebase (podes desligar depois).
                      </p>
                    </button>
                  </div>
                </div>

                {/* Consentimento opcional EU AI Act Art. 50 / RGPD */}
                <div className="rounded-2xl border border-line bg-surface p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={aiConsent}
                      onChange={(e) => {
                        setAiConsent(e.target.checked);
                        void hapticTap();
                      }}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-line text-accent focus:ring-accent"
                    />
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-fg">
                          Ativar Assistente IA & Leitura de Pautas (Opcional)
                        </span>
                        <Badge tone="neutral">EU AI Act Art. 50</Badge>
                      </div>
                      <p className="text-xs leading-relaxed text-muted">
                        Quando ativado e após inserires a tua própria chave Gemini gratuita nas Definições, as perguntas que escreves no Assistente são enviadas à API Google Gemini para gerar planos e explicações marcadas como conteúdo gerado por IA.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {activeStepId === 'curriculum' && (
              <div className="space-y-5">
                <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 sm:flex-row sm:items-center">
                  <div className="flex h-28 w-36 shrink-0 items-center justify-center rounded-2xl bg-surface-2/80 p-2">
                    <OnboardingSceneArt scene="curriculum" className="h-24 w-32" />
                  </div>
                  <div className="space-y-1.5">
                    <Badge tone="accent">Currículo & Disciplinas</Badge>
                    <h2 className="font-display text-xl font-bold text-fg sm:text-2xl">
                      O teu percurso <em className="font-editorial text-accent">académico</em>
                    </h2>
                    <p className="text-xs text-muted">
                      Escolhe a tua universidade, Ensino Secundário (Portugal) ou cria a tua lista personalizada de disciplinas.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
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
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Instituição / Nível de Ensino">
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

                  <Field label={isSecondarySchool ? 'Área / Curso' : 'Curso / Licenciatura'}>
                    {universityId === 'outra' ? (
                      <Input
                        value={customDegree}
                        onChange={(e) => setCustomDegree(e.target.value)}
                        placeholder="Ex: Eng. Informática ou 11.º Ano"
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
                </div>

                {(universityId === 'outra' || degreeId === 'outro') && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {universityId === 'outra' && (
                      <Field label="Nome da Escola ou Universidade">
                        <Input
                          value={customUniversity}
                          onChange={(e) => setCustomUniversity(e.target.value)}
                          placeholder="Ex: Escola Secundária / IPS"
                        />
                      </Field>
                    )}
                    {degreeId === 'outro' && universityId !== 'outra' && (
                      <Field label="Nome do curso ou área">
                        <Input
                          value={customDegree}
                          onChange={(e) => setCustomDegree(e.target.value)}
                          placeholder="Ex: Artes Visuais / Economia"
                        />
                      </Field>
                    )}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={isSecondarySchool ? 'Ano escolar' : 'Ano curricular'}>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([1, 2, 3] as const).map((y) => (
                        <button
                          key={y}
                          type="button"
                          onClick={() => handlePeriodChange(y, currentSemester)}
                          className={cx(
                            'h-10 rounded-xl border text-xs font-semibold transition',
                            currentAcademicYear === y
                              ? 'border-accent bg-accent-soft text-accent'
                              : 'border-line bg-surface text-muted hover:text-fg',
                          )}
                        >
                          {isSecondarySchool ? `${9 + y}.º Ano` : `${y}.º Ano`}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label={isSecondarySchool ? 'Período' : 'Semestre atual'}>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([1, 2] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handlePeriodChange(currentAcademicYear, s)}
                          className={cx(
                            'h-10 rounded-xl border text-xs font-semibold transition',
                            currentSemester === s
                              ? 'border-accent bg-accent-soft text-accent'
                              : 'border-line bg-surface text-muted hover:text-fg',
                          )}
                        >
                          {s}.º Semestre
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>

                {/* Resumo + OCR opcional */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface p-3.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>
                      <strong className="text-fg tabular">{approvedCount}</strong> aprovadas
                    </span>
                    <span>·</span>
                    <span>
                      <strong className="text-fg tabular">{doingCount}</strong> ativas agora
                    </span>
                    {weightedAvg !== null && (
                      <>
                        <span>·</span>
                        <span className="tabular font-semibold text-ok">Média {weightedAvg.toFixed(1)}</span>
                      </>
                    )}
                  </div>

                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20">
                    {ocrBusy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                    {ocrBusy ? 'A analisar…' : 'Ler print pauta (IA)'}
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

                {/* Lista compacta das disciplinas */}
                <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-2xl border border-line bg-surface p-2">
                  {records.length === 0 ? (
                    <p className="p-4 text-center text-xs text-muted">
                      Sem disciplinas carregadas ainda. Adiciona as tuas em baixo.
                    </p>
                  ) : (
                    records.map((r) => (
                      <div
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/60 bg-bg px-3 py-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-fg">
                            <span className="font-mono text-[11px] text-accent">{r.code}</span> · {r.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <select
                            aria-label={`Estado de ${r.name}`}
                            value={r.status}
                            onChange={(e) =>
                              updateRecordStatus(r.id, e.target.value as CompletedCourseRecord['status'])
                            }
                            className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-fg"
                          >
                            <option value="aprovada">Aprovada</option>
                            <option value="a_fazer">A fazer</option>
                            <option value="por_fazer">Por fazer</option>
                          </select>
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
                              className="h-8 w-16 rounded-lg border border-line bg-surface px-2 text-center text-xs tabular text-fg"
                            />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Adicionar disciplina */}
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={newCourseCode}
                    onChange={(e) => setNewCourseCode(e.target.value)}
                    placeholder="Sigla (ex: MAT)"
                    className="w-28"
                  />
                  <Input
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                    placeholder="Nome da disciplina ou cadeira"
                    className="min-w-[180px] flex-1"
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomRecord();
                      }
                    }}
                  />
                  <Button variant="secondary" size="sm" onClick={addCustomRecord}>
                    <Plus size={14} /> Adicionar
                  </Button>
                </div>

                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={replaceCoursesWithCurriculum}
                    onChange={(e) => setReplaceCoursesWithCurriculum(e.target.checked)}
                    className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                  />
                  Aplicar estas disciplinas ativas ao meu painel ({doingCount})
                </label>
              </div>
            )}

            {activeStepId === 'rhythm' && (
              <div className="space-y-5">
                <div className="grid items-center gap-5 rounded-3xl border border-line bg-surface p-5 shadow-card sm:grid-cols-[0.75fr_1.25fr]">
                  <div className="flex items-center justify-center rounded-2xl bg-surface-2/80 p-3">
                    <OnboardingSceneArt scene="rhythm" className="h-32 w-full max-w-[175px]" />
                  </div>
                  <div className="space-y-1.5">
                    <Badge tone="accent">Último passo</Badge>
                    <h2 className="font-display text-2xl font-bold text-fg">
                      O teu <em className="font-editorial text-accent">ritmo semanal</em>
                    </h2>
                    <p className="text-xs leading-relaxed text-muted sm:text-sm">
                      Ajusta os dias e o tempo diário para que o gerador de sessões respeite o teu descanso.
                    </p>
                  </div>
                </div>

                <Field label="Dias disponíveis para estudar">
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
                            'flex h-11 items-center justify-center rounded-xl border text-xs font-semibold transition',
                            active
                              ? 'border-accent bg-accent text-accent-fg shadow-sm'
                              : 'border-line bg-surface text-muted hover:text-fg',
                          )}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field label="Meta diária de foco">
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
                            'rounded-2xl border p-3 text-left transition',
                            selected
                              ? 'border-accent bg-accent-soft text-accent'
                              : 'border-line bg-surface hover:bg-surface-2',
                          )}
                        >
                          <p className="font-display text-base font-bold tabular">{preset.label}</p>
                          <p className="text-[11px] text-muted">{preset.hint}</p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Input
                      type="number"
                      min={30}
                      max={600}
                      step={15}
                      aria-label="Minutos diários personalizados"
                      value={dailyMinutes}
                      onChange={(e) => setDailyMinutes(Number(e.target.value))}
                      className="w-28 tabular"
                    />
                    <span className="text-xs text-muted">minutos por dia de estudo</span>
                  </div>
                </Field>

                {activeCandidates.length > 0 && (
                  <Field label="Cadeiras/Disciplinas que merecem reforço">
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
                              'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                              selected
                                ? 'border-accent bg-accent-soft text-accent'
                                : 'border-line bg-surface text-muted hover:text-fg',
                            )}
                          >
                            {selected && <Check size={12} />}
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                )}

                <Field label="Temas onde sentes mais dificuldade (opcional)">
                  <Textarea
                    rows={2}
                    value={difficultNotes}
                    onChange={(e) => setDifficultNotes(e.target.value)}
                    placeholder="Ex: Primitivas, estruturas de dados ou preparação para exames nacionais…"
                  />
                </Field>

                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 text-xs text-fg">
                  <input
                    type="checkbox"
                    checked={launchTour}
                    onChange={(e) => setLaunchTour(e.target.checked)}
                    className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                  />
                  <span>
                    Iniciar <strong>tour guiado rápido (4 passos)</strong> para conhecer o painel e o plano semanal
                  </span>
                </label>
              </div>
            )}
          </motion.div>
      </main>

      {/* Rodapé sticky seguro sobre o teclado e gestos do sistema */}
      <footer className="sticky bottom-0 z-10 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-6 sm:pb-4">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
          {activeStepId === 'welcome' ? (
            <>
              <Button
                variant="secondary"
                disabled={!ageConfirmed}
                onClick={handleStartDemo}
              >
                <Sparkles size={15} /> Modo Demo
              </Button>
              <Button
                variant="primary"
                disabled={!ageConfirmed}
                onClick={() => void handleGoNext()}
              >
                Começar configuração <ChevronRight size={16} />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => void handleGoPrev()}>
                <ChevronLeft size={16} /> Anterior
              </Button>

              {activeStepId !== 'rhythm' ? (
                <Button variant="primary" onClick={() => void handleGoNext()}>
                  Seguinte <ChevronRight size={16} />
                </Button>
              ) : (
                <Button variant="primary" onClick={handleFinish}>
                  <ShieldCheck size={16} /> Concluir e abrir o meu dia
                </Button>
              )}
            </>
          )}
        </div>
      </footer>

      {/* Pré-visualização rápida legal dentro do Onboarding */}
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
                {legalPreview === 'privacy' ? 'Política de Privacidade (RGPD)' : 'Termos de Utilização'}
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
                    O Assistente IA é 100% opcional (requer consentimento explícito e a tua chave pessoal Gemini). Não recolhemos publicidade, analytics comportamentais nem perfis de seguimento.
                  </p>
                  <p>
                    Podes exportar os teus dados em JSON ou eliminar permanentemente a tua conta e documentos a qualquer momento em Definições → Dados e Privacidade.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    A {LEGAL_INFO.appName} é uma ferramenta gratuita de apoio ao estudo para estudantes do Ensino Secundário e Superior (idade mínima {LEGAL_INFO.minimumAgePT} anos em Portugal).
                  </p>
                  <p>
                    Manténs 100% da propriedade sobre os teus dados e apontamentos. As sugestões geradas por IA podem conter imprecisões — confirma sempre datas de exames e programas oficiais junto da tua instituição.
                  </p>
                </>
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
