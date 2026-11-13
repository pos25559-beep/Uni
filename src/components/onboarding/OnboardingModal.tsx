import {
  AlertCircle,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { parseAcademicHistoryFromScreenshot } from '../../integrations/gemini';
import { auth } from '../../lib/firebase';
import {
  fetchSharedCurriculaFromCloud,
  publishSharedCurriculum,
} from '../../lib/firestoreSync';
import {
  buildInitialCompletedRecords,
  computeWeightedAverage,
  getUniversityById,
  mergeCurriculumCatalog,
  PORTUGAL_CURRICULA,
} from '../../lib/portugalCurriculum';
import { useStore } from '../../store/useStore';
import type { AcademicProfile, CompletedCourseRecord } from '../../types';
import { Badge, Button, Field, Input, Modal, Select, Textarea, cx } from '../ui';

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

const DAY_LABELS = [
  { day: 1, label: 'Seg' },
  { day: 2, label: 'Ter' },
  { day: 3, label: 'Qua' },
  { day: 4, label: 'Qui' },
  { day: 5, label: 'Sex' },
  { day: 6, label: 'Sáb' },
  { day: 0, label: 'Dom' },
];

export default function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const settings = useStore((s) => s.settings);
  const existingCourses = useStore((s) => s.courses);
  const storedProfile = useStore((s) => s.academicProfile);
  const isDemo = useStore((s) => s.isDemo);
  const updateSettings = useStore((s) => s.updateSettings);
  const saveAcademicProfile = useStore((s) => s.saveAcademicProfile);
  const applyCurriculumCourses = useStore((s) => s.applyCurriculumCourses);

  const [step, setStep] = useState<1 | 2 | 3>(1);
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

  const [difficultKeys, setDifficultKeys] = useState<string[]>(storedProfile.difficultCourseIds);
  const [difficultNotes, setDifficultNotes] = useState(storedProfile.difficultTopicsNotes ?? '');
  const [dailyMinutes, setDailyMinutes] = useState<number>(settings.dailyStudyMinutes || 180);
  const [studyDays, setStudyDays] = useState<number[]>(settings.studyDays);
  const [replaceCoursesWithCurriculum, setReplaceCoursesWithCurriculum] = useState(!isDemo);

  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrFeedback, setOcrFeedback] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [catalog, setCatalog] = useState(PORTUGAL_CURRICULA);

  useEffect(() => {
    if (!open || !auth.currentUser) return;
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
  }, [open]);

  const selectedUniversity = useMemo(() => getUniversityById(universityId, catalog), [universityId, catalog]);
  const availableDegrees = selectedUniversity?.degrees ?? [];

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
      setRecords(buildInitialCompletedRecords(universityId, nextDegId, currentAcademicYear, currentSemester, catalog));
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
        ects: 6,
        status: 'a_fazer',
      },
    ]);
    setNewCourseCode('');
    setNewCourseName('');
  };

  const handleScreenshotUpload = async (file: File | undefined) => {
    if (!file) return;
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
        setOcrError('Nenhuma cadeira ou nota foi reconhecida na imagem. Tenta um print mais nítido da pauta.');
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
              ects: item.ects ?? 6,
              grade: item.grade,
              status: item.status,
            });
          }
        }
        return next;
      });

      setOcrFeedback(`${extracted.length} cadeiras extraídas e sincronizadas a partir do print.`);
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
    setDifficultKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const toggleStudyDay = (day: number) => {
    setStudyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  };

  const weightedAvg = useMemo(() => computeWeightedAverage(records), [records]);
  const approvedCount = records.filter((r) => r.status === 'aprovada').length;
  const doingCount = records.filter((r) => r.status === 'a_fazer').length;

  const handleFinish = () => {
    const uniName =
      universityId === 'outra'
        ? customUniversity.trim() || 'Outra Universidade'
        : selectedUniversity?.name ?? 'Universidade Portuguesa';
    const degName =
      degreeId === 'outro'
        ? customDegree.trim() || 'Curso Superior'
        : availableDegrees.find((d) => d.id === degreeId)?.name ?? 'Licenciatura';

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
    });

    if (replaceCoursesWithCurriculum && doingCount > 0) {
      applyCurriculumCourses(profile);
    } else {
      saveAcademicProfile(profile);
    }

    if (auth.currentUser && (universityId === 'outra' || degreeId === 'outro') && records.length > 0) {
      const customUniSlug = (uniName || 'outra')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 40) || 'outra';
      const customDegSlug = (degName || 'curso')
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

    onClose();
  };

  const handleSkip = () => {
    saveAcademicProfile({ onboardingCompleted: true });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bem-vindo à Unipedia"
      maxWidthClass="sm:max-w-2xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
                <ChevronLeft size={16} /> Anterior
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Saltar
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {step < 3 ? (
              <Button variant="primary" onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}>
                Seguinte <ChevronRight size={16} />
              </Button>
            ) : (
              <Button variant="primary" onClick={handleFinish}>
                <Sparkles size={16} /> Guardar e iniciar Unipedia
              </Button>
            )}
          </div>
        </div>
      }
    >
      <p className="-mt-1 text-xs text-muted">
        Passo {step} de 3 · Personaliza o teu plano de estudo e tutor semanal
      </p>

      {/* Barra de progresso dos 3 passos */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1.5 text-xs">
        {[
          { num: 1, label: '1. Curso & Período' },
          { num: 2, label: '2. Histórico & Notas' },
          { num: 3, label: '3. Dificuldades & Ritmo' },
        ].map((item) => (
          <button
            key={item.num}
            type="button"
            onClick={() => setStep(item.num as 1 | 2 | 3)}
            className={cx(
              'rounded-lg px-2.5 py-1.5 text-left font-medium transition',
              step === item.num
                ? 'bg-accent text-accent-fg'
                : step > item.num
                  ? 'bg-accent-soft text-accent'
                  : 'text-muted hover:text-fg',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Corpo */}
      <div className="space-y-4">
        {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Diz-nos onde estudas e em que ano vais. Estes dados estruturam o teu plano curricular
                sem precisares de configurar nada à mão.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="O teu nome">
                  <Input
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Ex.: Pedro Silva"
                  />
                </Field>
                <Field label="Ano de ingresso na faculdade">
                  <Input
                    type="number"
                    min={2015}
                    max={2030}
                    value={entryYear}
                    onChange={(e) => setEntryYear(Number(e.target.value) || 2024)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Faculdade / Universidade (Portugal)">
                  <Select value={universityId} onChange={(e) => handleUniversityChange(e.target.value)}>
                    {catalog.map((uni) => (
                      <option key={uni.id} value={uni.id}>
                        {uni.name}
                      </option>
                    ))}
                    <option value="outra">Outra instituição em Portugal</option>
                  </Select>
                </Field>

                {universityId === 'outra' ? (
                  <Field label="Nome da faculdade">
                    <Input
                      value={customUniversity}
                      onChange={(e) => setCustomUniversity(e.target.value)}
                      placeholder="Ex.: ISEL, UAlg, IPS..."
                    />
                  </Field>
                ) : (
                  <Field label="Licenciatura / Curso">
                    <Select value={degreeId} onChange={(e) => handleDegreeChange(e.target.value)}>
                      {availableDegrees.map((deg) => (
                        <option key={deg.id} value={deg.id}>
                          {deg.name}
                        </option>
                      ))}
                      <option value="outro">Outro curso</option>
                    </Select>
                  </Field>
                )}
              </div>

              {(universityId === 'outra' || degreeId === 'outro') && (
                <Field label="Nome do curso">
                  <Input
                    value={customDegree}
                    onChange={(e) => setCustomDegree(e.target.value)}
                    placeholder="Ex.: Licenciatura em Engenharia Biomédica"
                  />
                </Field>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ano curricular atual">
                  <Select
                    value={String(currentAcademicYear)}
                    onChange={(e) => handlePeriodChange(Number(e.target.value) as 1 | 2 | 3, currentSemester)}
                  >
                    <option value="1">1.º Ano</option>
                    <option value="2">2.º Ano</option>
                    <option value="3">3.º Ano</option>
                  </Select>
                </Field>
                <Field label="Período / Semestre atual">
                  <Select
                    value={String(currentSemester)}
                    onChange={(e) => handlePeriodChange(currentAcademicYear, Number(e.target.value) as 1 | 2)}
                  >
                    <option value="1">1.º Semestre</option>
                    <option value="2">2.º Semestre</option>
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {/* Banner OCR de Print do CLIP/Fénix/Sigarra */}
              <div className="rounded-xl border border-accent/30 bg-accent-soft/40 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Camera size={18} className="mt-0.5 shrink-0 text-accent" />
                    <div>
                      <p className="text-sm font-medium">Importar por print do CLIP, Fénix ou Sigarra</p>
                      <p className="text-xs text-muted">
                        Como o histórico académico está protegido no portal, podes carregar uma captura de ecrã das tuas notas e o Gemini preenche automaticamente.
                      </p>
                    </div>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-xs font-medium text-accent-fg transition hover:opacity-90">
                    {ocrBusy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {ocrBusy ? 'A ler print...' : 'Carregar print'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={ocrBusy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        void handleScreenshotUpload(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                {ocrFeedback && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-ok">
                    <CheckCircle2 size={14} /> {ocrFeedback}
                  </p>
                )}
                {ocrError && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-danger">
                    <AlertCircle size={14} /> {ocrError}
                  </p>
                )}
              </div>

              {/* Resumo rápido */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Badge tone="ok">{approvedCount} concluídas</Badge>
                  <Badge tone="accent">{doingCount} em curso</Badge>
                  {weightedAvg !== null && (
                    <Badge tone="neutral">Média ponderada: {weightedAvg.toFixed(1)} val.</Badge>
                  )}
                </div>
                <span className="text-muted">Marca o estado e a nota (opcional)</span>
              </div>

              {/* Lista de cadeiras do plano curricular */}
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {records.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-muted">
                    Adiciona cadeiras abaixo ou carrega um print do teu portal para preencher o histórico.
                  </p>
                ) : (
                  records.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-fg">{rec.code}</span>
                          <span className="truncate text-fg">{rec.name}</span>
                        </div>
                        <span className="text-[11px] text-muted">
                          {rec.year}.º Ano · {rec.semester}.º Sem · {rec.ects} ECTS
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <select
                          aria-label={`Estado de ${rec.name}`}
                          value={rec.status}
                          onChange={(e) =>
                            updateRecordStatus(rec.id, e.target.value as CompletedCourseRecord['status'])
                          }
                          className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-fg"
                        >
                          <option value="aprovada">Já concluída</option>
                          <option value="a_fazer">A fazer agora</option>
                          <option value="por_fazer">Por fazer</option>
                        </select>

                        {rec.status === 'aprovada' && (
                          <input
                            type="number"
                            min={10}
                            max={20}
                            placeholder="Nota"
                            aria-label={`Nota de ${rec.name}`}
                            value={rec.grade ?? ''}
                            onChange={(e) => updateRecordGrade(rec.id, e.target.value)}
                            className="h-8 w-16 rounded-lg border border-line bg-surface px-2 text-center text-xs tabular text-fg"
                          />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Adicionar cadeira extra */}
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <Input
                  value={newCourseCode}
                  onChange={(e) => setNewCourseCode(e.target.value)}
                  placeholder="Sigla (ex.: AM3)"
                  className="h-9 w-28 text-xs"
                />
                <Input
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="Adicionar cadeira extra ou em atraso..."
                  className="h-9 flex-1 text-xs"
                />
                <Button size="sm" onClick={addCustomRecord} disabled={!newCourseName.trim()}>
                  <Plus size={14} /> Adicionar
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <span className="mb-1.5 block text-xs font-medium text-muted">
                  Em que cadeiras sentes mais dificuldade? (o plano dará mais blocos a estas cadeiras)
                </span>
                {activeCandidates.length === 0 ? (
                  <p className="text-xs text-muted">
                    Ainda não há cadeiras marcadas em curso. Podes definir isto mais tarde.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {activeCandidates.map((item) => {
                      const active = difficultKeys.includes(item.key);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => toggleDifficult(item.key)}
                          className={cx(
                            'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition',
                            active
                              ? 'border-warn bg-warn/15 text-warn'
                              : 'border-line bg-surface-2 text-muted hover:text-fg',
                          )}
                        >
                          {active ? <Check size={13} /> : <BookOpen size={13} />}
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <Field label="Tópicos ou bases onde sentes mais dificuldade (opcional)">
                <Textarea
                  value={difficultNotes}
                  onChange={(e) => setDifficultNotes(e.target.value)}
                  placeholder="Ex.: Integrais triplos e Stokes em Cálculo III; critérios de cedência em MS2; diagramas de Bode..."
                  className="min-h-20"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Meta diária de estudo (minutos)"
                  hint={`${Math.round((dailyMinutes / 60) * 10) / 10}h por dia de estudo`}
                >
                  <Input
                    type="number"
                    min={30}
                    max={720}
                    step={15}
                    value={dailyMinutes}
                    onChange={(e) => setDailyMinutes(Number(e.target.value) || 180)}
                  />
                </Field>
                <div>
                  <span className="mb-1.5 block text-xs font-medium text-muted">Dias de estudo</span>
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_LABELS.map(({ day, label }) => {
                      const active = studyDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleStudyDay(day)}
                          className={cx(
                            'h-9 min-w-10 rounded-xl border px-2.5 text-xs font-medium transition',
                            active
                              ? 'border-accent bg-accent-soft text-accent'
                              : 'border-line bg-surface-2 text-muted hover:text-fg',
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {doingCount > 0 && (
                <label className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 p-3 text-xs">
                  <input
                    type="checkbox"
                    checked={replaceCoursesWithCurriculum}
                    onChange={(e) => setReplaceCoursesWithCurriculum(e.target.checked)}
                    className="mt-0.5 rounded border-line"
                  />
                  <span>
                    <strong className="text-fg">Atualizar as minhas cadeiras ativas</strong> com as {doingCount} cadeiras
                    marcadas como &ldquo;A fazer agora&rdquo; no passo anterior (desmarca se quiseres manter os dados atuais/demo intactos).
                  </span>
                </label>
              )}
            </div>
          )}
      </div>
    </Modal>
  );
}
