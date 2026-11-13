import { CalendarDays, Camera, Check, CheckCircle2, FileText, Loader2, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { matchCourse } from '../../integrations/clip';
import { parseTimetableFromScreenshot, type ExtractedSchedulePayload } from '../../integrations/gemini';
import { extractAcademicsFromGoogleCalendar, syncGoogleCalendar } from '../../integrations/gcal';
import { colorNames, kindLabel, weekdayLong } from '../../lib/colors';
import { newId, useStore } from '../../store/useStore';
import type { Assessment, ClassSlot, Course, CourseColor } from '../../types';
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

function readImageBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        base64: String(reader.result ?? ''),
        mimeType: file.type || 'image/jpeg',
      });
    reader.onerror = () => reject(new Error(`Não foi possível ler "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

function makeCourseShortName(name: string, code?: string): string {
  if (code && code.length <= 12) return code;
  const words = name.split(/\s+/).filter((w) => w.length > 2);
  if (words.length >= 2) {
    return words
      .slice(0, 3)
      .map((w) => w[0]!.toUpperCase())
      .join('');
  }
  return name.slice(0, 12);
}

export default function SmartScheduleImportModal({
  initialMode = 'photo',
  onClose,
  onOpenClipModal,
}: {
  initialMode?: SmartImportInitialMode;
  onClose: () => void;
  onOpenClipModal?: () => void;
}) {
  const courses = useStore((s) => s.courses);
  const events = useStore((s) => s.events);
  const googleConnected = useStore((s) => s.integrations.google.connected);
  const aiConsent = Boolean(useStore((s) => s.settings.aiConsent));
  const updateSettings = useStore((s) => s.updateSettings);
  const upsertMany = useStore((s) => s.upsertMany);

  const [mode, setMode] = useState<SmartImportInitialMode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<PreviewSlot[]>([]);
  const [assessments, setAssessments] = useState<PreviewAssessment[]>([]);
  const [sourceLabel, setSourceLabel] = useState<'local' | 'google'>('local');
  const [importedSummary, setImportedSummary] = useState<string | null>(null);

  const googleEventsCount = useMemo(
    () => events.filter((e) => e.source === 'google').length,
    [events],
  );

  const applyExtracted = (payload: ExtractedSchedulePayload, src: 'local' | 'google') => {
    setSourceLabel(src);
    setSlots(
      payload.slots.map((s, idx) => ({
        id: `slot-${idx}-${s.courseName}-${s.weekday}-${s.start}`,
        ...s,
        selected: true,
      })),
    );
    setAssessments(
      payload.assessments.map((a, idx) => ({
        id: `ass-${idx}-${a.courseName}-${a.date}`,
        ...a,
        selected: true,
      })),
    );
    if (payload.slots.length === 0 && payload.assessments.length === 0) {
      setError('Não encontrei aulas nem avaliações nesta fonte. Tenta outra imagem mais nítida ou sincroniza primeiro a Google Agenda.');
    }
  };

  const handlePhotoPick = async (file?: File) => {
    if (!file) return;
    if (!aiConsent) {
      updateSettings({ aiConsent: true });
    }
    setBusy(true);
    setError(null);
    setImportedSummary(null);
    try {
      const { base64, mimeType } = await readImageBase64(file);
      const parsed = await parseTimetableFromScreenshot(base64, mimeType);
      applyExtracted(parsed, 'local');
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
    if (selectedSlots.length === 0 && selectedAssessments.length === 0) return;

    const currentCourses = [...useStore.getState().courses];
    const createdCourses: Course[] = [];
    let colorIdx = currentCourses.length;

    const ensureCourseId = (courseName: string, courseCode?: string): string => {
      const existing = matchCourse(courseName, [...currentCourses, ...createdCourses]);
      if (existing) return existing.id;

      const palette = colorNames.length > 0 ? colorNames : (['emerald', 'sky', 'amber'] as CourseColor[]);
      const color = palette[colorIdx % palette.length] ?? 'emerald';
      colorIdx++;
      const created: Course = {
        id: newId(),
        code: courseCode || makeCourseShortName(courseName),
        name: courseName,
        shortName: makeCourseShortName(courseName, courseCode),
        ects: 6,
        color,
        targetGrade: 14,
        topics: [],
      };
      createdCourses.push(created);
      return created.id;
    };

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

    setImportedSummary(
      `Importado: ${createdCourses.length} cadeira(s) nova(s), ${newClasses.length} aula(s) e ${newAssessments.length} avaliação(ões).`,
    );
    setSlots([]);
    setAssessments([]);
  };

  const hasPreview = slots.length > 0 || assessments.length > 0;

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
              <FileText size={14} /> Usar CLIP / .ics
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
          <div className="space-y-3 rounded-2xl border border-line bg-surface-2/70 p-4 text-xs">
            <p className="leading-relaxed text-fg">
              Envia uma foto ou print do teu horário semanal, pauta ou agenda de papel. O Uni lê as cadeiras, horas, dias e salas por ti.
            </p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink-cta px-4 py-2 text-xs font-semibold text-ink-cta-fg transition hover:opacity-90">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              {busy ? 'A ler horário com o Uni…' : 'Escolher foto ou print do horário'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  void handlePhotoPick(file);
                }}
              />
            </label>
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
          </div>
        )}
      </div>
    </Modal>
  );
}
