import { CalendarDays, Camera, Check, CheckCircle2, FileText, Loader2, Sparkles, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { matchCourse } from '../../integrations/clip';
import {
  parseAcademicHistoryFromScreenshot,
  parseTimetableFromScreenshot,
  type ExtractedHistoryItem,
  type ExtractedSchedulePayload,
} from '../../integrations/gemini';
import { extractAcademicsFromGoogleCalendar, syncGoogleCalendar } from '../../integrations/gcal';
import { colorNames, kindLabel, weekdayLong } from '../../lib/colors';
import { deriveCourseAcronym, isCourseIdentityMatch } from '../../lib/portugalCurriculum';
import { newId, useStore } from '../../store/useStore';
import type { Assessment, ClassSlot, Course, CourseColor } from '../../types';
import { StickerBadge } from '../motion/Primitives';
import { Badge, Button, Modal, cx } from '../ui';

export type SmartImportInitialMode = 'photo' | 'gcal';

interface PreviewSlot {
  id: string;
  courseName: string;
  courseCode?: string;
  type: ClassSlot['type'];
  weekday: number;
  start: string;
  end: string;
  room?: string;
  selected: boolean;
}

interface PreviewAssessment {
  id: string;
  courseName: string;
  title: string;
  date: string;
  kind: Assessment['kind'];
  location?: string;
  selected: boolean;
}

interface PreviewCourse {
  id: string;
  name: string;
  code?: string;
  ects: number;
  selected: boolean;
}

function inferImageMimeType(file: File): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  return 'image/jpeg';
}

function readImageBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        base64: String(reader.result ?? ''),
        mimeType: inferImageMimeType(file),
      });
    reader.onerror = () => reject(new Error(`Não foi possível ler "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

function makeCourseShortName(name: string, code?: string): string {
  return deriveCourseAcronym(name, code);
}

export interface SmartScheduleImportSummary {
  activeCourses: Array<{ code?: string; name: string; ects?: number }>;
  otherSemesterCourses?: Array<{ code?: string; name: string; ects?: number; semester: 1 | 2 }>;
  classesCount: number;
  assessmentsCount: number;
  source: 'photo' | 'gcal';
}

export default function SmartScheduleImportModal({
  initialMode = 'photo',
  currentSemester,
  onClose,
  onOpenClipModal,
  onImported,
}: {
  initialMode?: SmartImportInitialMode;
  currentSemester?: 1 | 2;
  onClose: () => void;
  onOpenClipModal?: () => void;
  onImported?: (summary: SmartScheduleImportSummary) => void;
}) {
  const courses = useStore((s) => s.courses);
  const events = useStore((s) => s.events);
  const storeSemester = useStore((s) => s.academicProfile.currentSemester);
  const activeSemester: 1 | 2 = currentSemester ?? storeSemester ?? 1;
  const googleConnected = useStore((s) => s.integrations.google.connected);
  const appTone = useStore((s) => s.settings.appTone);
  const isExpressive = appTone !== 'serio';
  const aiConsent = Boolean(useStore((s) => s.settings.aiConsent));
  const updateSettings = useStore((s) => s.updateSettings);
  const upsertMany = useStore((s) => s.upsertMany);

  const [mode, setMode] = useState<SmartImportInitialMode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [pickedNames, setPickedNames] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<PreviewSlot[]>([]);
  const [assessments, setAssessments] = useState<PreviewAssessment[]>([]);
  const [detectedCourses, setDetectedCourses] = useState<PreviewCourse[]>([]);
  const [otherSemCourses, setOtherSemCourses] = useState<
    Array<{ code?: string; name: string; ects?: number; semester: 1 | 2 }>
  >([]);
  const [sourceLabel, setSourceLabel] = useState<'local' | 'google'>('local');
  const [importedSummary, setImportedSummary] = useState<string | null>(null);

  const googleEventsCount = useMemo(
    () => events.filter((e) => e.source === 'google').length,
    [events],
  );

  const applyExtracted = (
    payload: ExtractedSchedulePayload,
    src: 'local' | 'google',
    extraCourses: ExtractedHistoryItem[] = [],
  ) => {
    setSourceLabel(src);

    // Coalesce cadeiras detetadas do mesmo semestre (evitando duplicados sem/com sigla)
    const activeExtra: Array<{ name: string; code?: string; ects: number }> = [];
    const deferredOtherSem: Array<{ code?: string; name: string; ects?: number; semester: 1 | 2 }> = [];

    for (const item of extraCourses) {
      if (item.status === 'aprovada') continue;
      if (item.semester !== undefined && item.semester !== activeSemester) {
        deferredOtherSem.push({
          code: item.code,
          name: item.name,
          ects: item.ects ?? 6,
          semester: item.semester,
        });
        continue;
      }
      if (item.status === 'por_fazer') continue;

      const existingIdx = activeExtra.findIndex((c) =>
        isCourseIdentityMatch({ code: c.code, name: c.name }, { code: item.code, name: item.name }),
      );
      if (existingIdx >= 0) {
        const cur = activeExtra[existingIdx]!;
        activeExtra[existingIdx] = {
          name: item.name.length > cur.name.length ? item.name : cur.name,
          code: cur.code || item.code,
          ects: item.ects ?? cur.ects,
        };
      } else {
        activeExtra.push({
          name: item.name,
          code: item.code,
          ects: item.ects ?? 6,
        });
      }
    }

    // Enriquece slots com o nome completo quando vieram só com sigla, e evita duplicar em detectedCourses
    const enrichedSlots: PreviewSlot[] = payload.slots.map((s, idx) => {
      const matchedExtra = activeExtra.find((c) =>
        isCourseIdentityMatch({ code: c.code, name: c.name }, { code: s.courseCode, name: s.courseName }),
      );
      return {
        id: `slot-${idx}-${s.courseName}-${s.weekday}-${s.start}`,
        ...s,
        courseName:
          matchedExtra && matchedExtra.name.length > s.courseName.length
            ? matchedExtra.name
            : s.courseName,
        courseCode: s.courseCode || matchedExtra?.code,
        selected: true,
      };
    });

    const uniqueDetectedCourses = activeExtra.filter(
      (c) =>
        !enrichedSlots.some((s) =>
          isCourseIdentityMatch({ code: c.code, name: c.name }, { code: s.courseCode, name: s.courseName }),
        ),
    );

    setSlots(enrichedSlots);
    setAssessments(
      payload.assessments.map((a, idx) => ({
        id: `ass-${idx}-${a.courseName}-${a.date}`,
        ...a,
        selected: true,
      })),
    );
    setDetectedCourses(
      uniqueDetectedCourses.map((c, idx) => ({
        id: `crs-${idx}-${c.name}`,
        name: c.name,
        code: c.code || deriveCourseAcronym(c.name),
        ects: c.ects,
        selected: true,
      })),
    );
    setOtherSemCourses(deferredOtherSem);

    if (
      enrichedSlots.length === 0 &&
      payload.assessments.length === 0 &&
      uniqueDetectedCourses.length === 0
    ) {
      setError(
        'Não encontrei aulas, avaliações nem cadeiras reconhecíveis nestas imagens. Tenta prints mais nítidos da grelha de horário ou da lista de cadeiras.',
      );
    }
  };

  const handlePhotoPick = async (files?: File[] | FileList | null) => {
    const fileList = files ? Array.from(files) : [];
    if (fileList.length === 0) return;

    const imageFiles = fileList.filter((f) => {
      if (f.type.startsWith('image/')) return true;
      return /\.(png|jpe?g|webp|gif|heic|heif|bmp)$/i.test(f.name);
    });
    if (imageFiles.length === 0) {
      setError('Seleciona uma imagem (PNG, JPG, WebP ou print do horário).');
      return;
    }

    if (!aiConsent) {
      updateSettings({ aiConsent: true });
    }
    setPickedNames(imageFiles.map((f) => f.name));
    setBusy(true);
    setError(null);
    setImportedSummary(null);
    try {
      const combinedSlots: ExtractedSchedulePayload['slots'] = [];
      const combinedAssessments: ExtractedSchedulePayload['assessments'] = [];
      const combinedCourses: ExtractedHistoryItem[] = [];
      let firstError: Error | null = null;
      let anySucceeded = false;

      for (const file of imageFiles) {
        const { base64, mimeType } = await readImageBase64(file);

        try {
          const scheduleRes = await parseTimetableFromScreenshot(base64, mimeType);
          anySucceeded = true;
          combinedSlots.push(...scheduleRes.slots);
          combinedAssessments.push(...scheduleRes.assessments);
        } catch (err) {
          if (!firstError) {
            firstError = err instanceof Error ? err : new Error(String(err));
          }
        }

        try {
          const historyRes = await parseAcademicHistoryFromScreenshot(base64, mimeType, {
            currentSemester: activeSemester,
          });
          anySucceeded = true;
          combinedCourses.push(...historyRes);
        } catch (err) {
          if (!firstError) {
            firstError = err instanceof Error ? err : new Error(String(err));
          }
        }
      }

      if (!anySucceeded && firstError) {
        throw firstError;
      }

      applyExtracted(
        { slots: combinedSlots, assessments: combinedAssessments },
        'local',
        combinedCourses,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao analisar a foto do horário.');
    } finally {
      setBusy(false);
    }
  };

  const handleExtractGoogle = async (forceSync: boolean) => {
    setBusy(true);
    setError(null);
    setImportedSummary(null);
    try {
      if (forceSync || googleEventsCount === 0) {
        await syncGoogleCalendar();
      }
      const latestEvents = useStore.getState().events;
      const latestCourses = useStore.getState().courses;
      const extracted = extractAcademicsFromGoogleCalendar(latestEvents, latestCourses);
      applyExtracted(
        {
          slots: extracted.classes.map((c) => ({
            courseName: c.courseName,
            courseCode: c.shortName,
            type: c.type,
            weekday: c.weekday,
            start: c.start,
            end: c.end,
            room: c.room,
          })),
          assessments: extracted.assessments.map((a) => ({
            courseName: a.courseName,
            title: a.title,
            date: a.date,
            kind: a.kind,
          })),
        },
        'google',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao extrair aulas da Google Agenda.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmImport = () => {
    const selectedSlots = slots.filter((s) => s.selected);
    const selectedAssessments = assessments.filter((a) => a.selected);
    const selectedCourses = detectedCourses.filter((c) => c.selected);
    if (selectedSlots.length === 0 && selectedAssessments.length === 0 && selectedCourses.length === 0) return;

    const currentCourses = [...useStore.getState().courses];
    const createdCourses: Course[] = [];
    const importedCourseRefs = new Map<string, { code?: string; name: string; ects?: number }>();
    let colorIdx = currentCourses.length;

    const ensureCourseId = (courseName: string, courseCode?: string, ects = 6): string => {
      const existing =
        matchCourse(courseName, [...currentCourses, ...createdCourses]) ||
        (courseCode ? matchCourse(courseCode, [...currentCourses, ...createdCourses]) : undefined);
      if (existing) {
        if (!importedCourseRefs.has(existing.id)) {
          importedCourseRefs.set(existing.id, {
            code: existing.code || courseCode,
            name: existing.name || courseName,
            ects: existing.ects || ects,
          });
        }
        return existing.id;
      }

      const palette = colorNames.length > 0 ? colorNames : (['emerald', 'sky', 'amber'] as CourseColor[]);
      const color = palette[colorIdx % palette.length] ?? 'emerald';
      colorIdx++;
      const created: Course = {
        id: newId(),
        code: courseCode || makeCourseShortName(courseName),
        name: courseName,
        shortName: makeCourseShortName(courseName, courseCode),
        ects,
        color,
        targetGrade: 14,
        topics: [],
      };
      createdCourses.push(created);
      importedCourseRefs.set(created.id, {
        code: created.code,
        name: created.name,
        ects: created.ects,
      });
      return created.id;
    };

    for (const c of selectedCourses) {
      ensureCourseId(c.name, c.code, c.ects);
    }

    const newClasses: ClassSlot[] = selectedSlots.map((s) => ({
      id: newId(),
      courseId: ensureCourseId(s.courseName, s.courseCode),
      type: s.type,
      weekday: s.weekday,
      start: s.start,
      end: s.end,
      room: s.room,
      source: sourceLabel,
    }));

    const newAssessments: Assessment[] = selectedAssessments.map((a) => ({
      id: newId(),
      courseId: ensureCourseId(a.courseName),
      kind: a.kind,
      title: a.title,
      date: a.date,
      weight: 30,
      topicIds: [],
      location: a.location,
      source: sourceLabel,
    }));

    if (createdCourses.length > 0) upsertMany('courses', createdCourses);
    if (newClasses.length > 0) upsertMany('classes', newClasses);
    if (newAssessments.length > 0) upsertMany('assessments', newAssessments);

    onImported?.({
      activeCourses: Array.from(importedCourseRefs.values()),
      otherSemesterCourses: otherSemCourses,
      classesCount: newClasses.length,
      assessmentsCount: newAssessments.length,
      source: mode === 'gcal' ? 'gcal' : 'photo',
    });

    setImportedSummary(
      `Importado: ${createdCourses.length} cadeira(s) nova(s), ${newClasses.length} aula(s) e ${newAssessments.length} avaliação(ões).`,
    );
    setSlots([]);
    setAssessments([]);
    setDetectedCourses([]);
    setOtherSemCourses([]);
  };

  const hasPreview = slots.length > 0 || assessments.length > 0 || detectedCourses.length > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title="Importar horário ou agenda"
      maxWidthClass="sm:max-w-xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {onOpenClipModal ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onClose();
                onOpenClipModal();
              }}
            >
              <FileText size={14} /> Importar .ics / Portal
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button onClick={onClose}>Fechar</Button>
            {hasPreview && (
              <Button variant="primary" onClick={handleConfirmImport}>
                <Check size={15} /> Guardar selecionados
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('photo');
              setError(null);
            }}
            className={cx(
              'flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-xs font-semibold transition',
              mode === 'photo'
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line bg-surface-2 text-muted hover:text-fg',
            )}
          >
            <Camera size={15} /> Foto / Print (IA)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('gcal');
              setError(null);
            }}
            className={cx(
              'flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-xs font-semibold transition',
              mode === 'gcal'
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line bg-surface-2 text-muted hover:text-fg',
            )}
          >
            <CalendarDays size={15} /> Google Calendar
          </button>
        </div>

        {mode === 'photo' ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (busy) return;
              void handlePhotoPick(e.dataTransfer?.files);
            }}
            className={cx(
              'space-y-3 rounded-2xl border-2 border-dashed p-4 text-xs transition',
              isDragging
                ? 'border-accent bg-accent-soft/60'
                : isExpressive
                  ? 'border-[#141312]/15 bg-[#FCE99F]/70 text-[#141312] dark:border-white/15 dark:bg-[#352D14] dark:text-[#FAF6EC]'
                  : 'border-line bg-surface-2/70 text-fg',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              {isExpressive ? (
                <StickerBadge tone="mint" tilt={-1.5}>
                  <Camera size={11} /> Leitura rápida do horário
                </StickerBadge>
              ) : (
                <span className="font-semibold text-fg">Leitura de foto / print</span>
              )}
              <span className="text-[11px] opacity-75">PNG, JPG ou print</span>
            </div>
            <p className="leading-relaxed opacity-90">
              Envia 1 ou mais fotos ou prints (ou arrasta para aqui). O Uni lê as cadeiras, horas, dias e salas por ti.
            </p>
            <label className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full bg-ink-cta px-4 py-2 text-xs font-semibold text-ink-cta-fg shadow-card transition hover:opacity-90">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {busy ? 'A ler prints com o Uni…' : 'Escolher fotos ou prints'}
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = '';
                  void handlePhotoPick(files);
                }}
              />
            </label>
            {busy && pickedNames.length > 0 && (
              <p className="flex items-center gap-2 rounded-xl bg-white/75 px-3 py-2 text-[11px] font-medium text-[#141312] dark:bg-black/30 dark:text-[#FAF6EC]">
                <Loader2 size={13} className="shrink-0 animate-spin text-accent" />
                <span className="truncate">
                  A analisar {pickedNames.join(', ')}…
                </span>
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-line bg-surface-2/70 p-4 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-fg">Extrair da Google Agenda</span>
              <Badge tone={googleConnected ? 'ok' : 'neutral'}>
                {googleConnected ? `${googleEventsCount} eventos` : 'Por ligar'}
              </Badge>
            </div>
            <p className="leading-relaxed text-muted">
              Deteto aulas recorrentes e datas de testes na tua Google Agenda para preencher Cadeiras e Horários sem trabalho manual.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="primary"
                disabled={busy}
                onClick={() => void handleExtractGoogle(googleEventsCount === 0)}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {busy
                  ? 'A sincronizar e extrair…'
                  : googleEventsCount > 0
                    ? 'Extrair dos eventos sincronizados'
                    : 'Sincronizar Google Calendar & extrair'}
              </Button>
              {googleEventsCount > 0 && (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void handleExtractGoogle(true)}>
                  Atualizar agenda primeiro
                </Button>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
        )}

        {importedSummary && (
          <p className="flex items-center gap-2 rounded-xl bg-ok/10 px-3 py-2 text-xs font-medium text-ok">
            <CheckCircle2 size={15} /> {importedSummary}
          </p>
        )}

        {hasPreview && (
          <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {slots.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Aulas detetadas ({slots.length})
                </p>
                {slots.map((s) => {
                  const matched = matchCourse(s.courseName, courses);
                  return (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={s.selected}
                          onChange={(e) =>
                            setSlots((prev) =>
                              prev.map((x) => (x.id === s.id ? { ...x, selected: e.target.checked } : x)),
                            )
                          }
                          className="size-4 accent-accent"
                        />
                        <div>
                          <p className="font-semibold text-fg">
                            {s.courseName} · {s.type}
                          </p>
                          <p className="text-[11px] text-muted">
                            {weekdayLong[s.weekday]} {s.start}–{s.end}
                            {s.room ? ` · Sala ${s.room}` : ''}
                          </p>
                        </div>
                      </div>
                      <Badge tone={matched ? 'ok' : 'accent'}>
                        {matched ? `Liga a ${matched.shortName}` : 'Cria cadeira'}
                      </Badge>
                    </label>
                  );
                })}
              </div>
            )}

            {assessments.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Avaliações detetadas ({assessments.length})
                </p>
                {assessments.map((a) => (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={a.selected}
                        onChange={(e) =>
                          setAssessments((prev) =>
                            prev.map((x) => (x.id === a.id ? { ...x, selected: e.target.checked } : x)),
                          )
                        }
                        className="size-4 accent-accent"
                      />
                      <div>
                        <p className="font-semibold text-fg">
                          {a.courseName} · {a.title}
                        </p>
                        <p className="text-[11px] text-muted">
                          {kindLabel[a.kind]} · {a.date.slice(0, 16).replace('T', ' ')}
                        </p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {detectedCourses.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Cadeiras detetadas ({detectedCourses.length})
                </p>
                {detectedCourses.map((c) => {
                  const matched =
                    matchCourse(c.name, courses) ||
                    (c.code ? matchCourse(c.code, courses) : undefined);
                  return (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={c.selected}
                          onChange={(e) =>
                            setDetectedCourses((prev) =>
                              prev.map((x) => (x.id === c.id ? { ...x, selected: e.target.checked } : x)),
                            )
                          }
                          className="size-4 accent-accent"
                        />
                        <div>
                          <p className="font-semibold text-fg">{c.name}</p>
                          <p className="text-[11px] text-muted">
                            {c.code ? `${c.code} · ` : ''}
                            {c.ects} ECTS
                          </p>
                        </div>
                      </div>
                      <Badge tone={matched ? 'ok' : 'accent'}>
                        {matched ? `Liga a ${matched.shortName}` : 'Cria cadeira'}
                      </Badge>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
