import { CalendarDays, Camera, Check, CheckCircle2, FileText, Loader2, Sparkles, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { matchCourse } from '../../integrations/clip';
import {
  parseAcademicHistoryFromScreenshot,
  parseTimetableFromScreenshot,
  type ExtractedHistoryItem,
  type ExtractedSchedulePayload,
} from '../../integrations/gemini';
import { extractAcademicsFromGoogleCalendar, syncGoogleCalendar } from '../../integrations/gcal';
import { colorNames, kindLabel, weekdayLong } from '../../lib/colors';
import {
  collectKnownCourseCandidates,
  deriveCourseAcronym,
  getDegreeCurriculum,
  isCourseIdentityMatch,
  resolveKnownCourseIdentity,
  type CurriculumCourseTemplate,
} from '../../lib/portugalCurriculum';
import { readNormalizedScreenshot } from '../../lib/imageUpload';
import { newId, useStore } from '../../store/useStore';
import type { Assessment, ClassSlot, Course, CourseColor } from '../../types';
import { StickerBadge } from '../motion/Primitives';
import { Badge, Button, Modal, Select } from '../ui';
import { cx } from '../../lib/uiHelpers';

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

function makeCourseShortName(name: string, code?: string): string {
  return deriveCourseAcronym(name, code);
}

export interface SmartScheduleImportSummary {
  activeCourses: Array<{ code?: string; name: string; ects?: number }>;
  otherSemesterCourses?: Array<{ code?: string; name: string; ects?: number; semester: 1 | 2 }>;
  classesCount: number;
  assessmentsCount: number;
  source: 'photo' | 'gcal';
  slotSummaries?: string[];
}

export default function SmartScheduleImportModal({
  initialMode = 'photo',
  focus = 'schedule',
  currentSemester,
  onClose,
  onOpenClipModal,
  onImported,
}: {
  initialMode?: SmartImportInitialMode;
  focus?: 'schedule' | 'assessments';
  currentSemester?: 1 | 2;
  onClose: () => void;
  onOpenClipModal?: () => void;
  onImported?: (summary: SmartScheduleImportSummary) => void;
}) {
  const { t } = useTranslation('courses');
  const courses = useStore((s) => s.courses);
  const existingClasses = useStore((s) => s.classes);
  const events = useStore((s) => s.events);
  const storeSemester = useStore((s) => s.academicProfile.currentSemester);
  const activeSemester: 1 | 2 = currentSemester ?? storeSemester ?? 1;
  const googleConnected = Boolean(useStore((s) => s.integrations?.google?.connected));
  const appTone = useStore((s) => s.settings.appTone);
  const isExpressive = appTone !== 'serio';
  const aiConsent = Boolean(useStore((s) => s.settings.aiConsent));
  const updateSettings = useStore((s) => s.updateSettings);
  const upsertMany = useStore((s) => s.upsertMany);
  const remove = useStore((s) => s.remove);
  const reconcileFuturePlan = useStore((s) => s.reconcileFuturePlan);

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
  const [replaceExistingClasses, setReplaceExistingClasses] = useState(false);
  const [importedSummary, setImportedSummary] = useState<string | null>(null);

  const googleEventsCount = useMemo(
    () => events.filter((e) => e.source === 'google').length,
    [events],
  );

  const getKnownCourseContext = () => {
    const state = useStore.getState();
    const profile = state.academicProfile;
    const degreeTemplates: CurriculumCourseTemplate[] =
      profile?.universityId && profile?.degreeId
        ? (getDegreeCurriculum(profile.universityId, profile.degreeId)?.courses ?? [])
        : [];
    const knownCourses = collectKnownCourseCandidates({
      courses: state.courses,
      completedCourses: profile?.completedCourses ?? [],
      degreeTemplates,
    });
    return { degreeTemplates, knownCourses };
  };

  const applyExtracted = (
    payload: ExtractedSchedulePayload,
    src: 'local' | 'google',
    extraCourses: ExtractedHistoryItem[] = [],
  ) => {
    setSourceLabel(src);
    const { degreeTemplates, knownCourses } = getKnownCourseContext();
    const resolveCourse = (raw: { code?: string; name: string }) =>
      resolveKnownCourseIdentity(raw, knownCourses, degreeTemplates);

    // Coalesce cadeiras detetadas do mesmo semestre (evitando duplicados sem/com sigla)
    const activeExtra: Array<{ name: string; code?: string; ects: number }> = [];
    const deferredOtherSem: Array<{ code?: string; name: string; ects?: number; semester: 1 | 2 }> = [];

    for (const item of extraCourses) {
      const resolved = resolveCourse({ code: item.code, name: item.name });
      const resolvedName = resolved?.name ?? item.name;
      const resolvedCode = resolved?.shortName || resolved?.code || item.code;
      const resolvedEcts = item.ects ?? resolved?.ects ?? 6;

      if (item.status === 'aprovada') continue;
      if (item.semester !== undefined && item.semester !== activeSemester) {
        deferredOtherSem.push({
          code: resolvedCode,
          name: resolvedName,
          ects: resolvedEcts,
          semester: item.semester,
        });
        continue;
      }
      if (item.status === 'por_fazer') continue;

      const existingIdx = activeExtra.findIndex((c) =>
        isCourseIdentityMatch({ code: c.code, name: c.name }, { code: resolvedCode, name: resolvedName }, degreeTemplates),
      );
      if (existingIdx >= 0) {
        const cur = activeExtra[existingIdx]!;
        activeExtra[existingIdx] = {
          name: resolvedName.length > cur.name.length ? resolvedName : cur.name,
          code: cur.code || resolvedCode,
          ects: resolvedEcts ?? cur.ects,
        };
      } else {
        activeExtra.push({
          name: resolvedName,
          code: resolvedCode,
          ects: resolvedEcts,
        });
      }
    }

    // Resolve slots contra cadeiras reais do aluno/plano (sobrepõe nomes alucinados por siglas reais)
    const enrichedSlots: PreviewSlot[] = payload.slots.map((s, idx) => {
      const resolved = resolveCourse({ code: s.courseCode, name: s.courseName });
      const matchedExtra = !resolved
        ? activeExtra.find((c) =>
            isCourseIdentityMatch({ code: c.code, name: c.name }, { code: s.courseCode, name: s.courseName }, degreeTemplates),
          )
        : undefined;
      return {
        id: `slot-${idx}-${s.courseName}-${s.weekday}-${s.start}`,
        ...s,
        courseName:
          resolved?.name ??
          (matchedExtra && matchedExtra.name.length > s.courseName.length
            ? matchedExtra.name
            : s.courseName),
        courseCode: resolved?.shortName || resolved?.code || s.courseCode || matchedExtra?.code,
        selected: true,
      };
    });

    const resolvedAssessments = payload.assessments.map((a) => {
      const resolved = resolveCourse({ name: a.courseName });
      return resolved ? { ...a, courseName: resolved.name } : a;
    });

    const uniqueDetectedCourses = activeExtra.filter(
      (c) =>
        !enrichedSlots.some((s) =>
          isCourseIdentityMatch({ code: c.code, name: c.name }, { code: s.courseCode, name: s.courseName }, degreeTemplates),
        ),
    );

    setSlots(enrichedSlots);
    setReplaceExistingClasses(existingClasses.length > 0 && enrichedSlots.length >= 3);
    setAssessments(
      resolvedAssessments.map((a, idx) => ({
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
      resolvedAssessments.length === 0 &&
      uniqueDetectedCourses.length === 0
    ) {
      setError(
        t('smartImport.err.nothing'),
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
      setError(t('smartImport.err.pickImage'));
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
      const { knownCourses } = getKnownCourseContext();
      const combinedSlots: ExtractedSchedulePayload['slots'] = [];
      const combinedAssessments: ExtractedSchedulePayload['assessments'] = [];
      const combinedCourses: ExtractedHistoryItem[] = [];
      let firstError: Error | null = null;
      let anySucceeded = false;

      for (const file of imageFiles) {
        const { base64, mimeType } = await readNormalizedScreenshot(file);

        try {
          const scheduleRes = await parseTimetableFromScreenshot(base64, mimeType, {
            focus,
            knownCourses,
          });
          anySucceeded = true;
          combinedSlots.push(...scheduleRes.slots);
          combinedAssessments.push(...scheduleRes.assessments);
        } catch (err) {
          if (!firstError) {
            firstError = err instanceof Error ? err : new Error(String(err));
          }
        }

        if (focus === 'schedule') {
          try {
            const historyRes = await parseAcademicHistoryFromScreenshot(base64, mimeType, {
              currentSemester: activeSemester,
              knownCourses,
            });
            anySucceeded = true;
            combinedCourses.push(...historyRes);
          } catch (err) {
            if (!firstError) {
              firstError = err instanceof Error ? err : new Error(String(err));
            }
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
      setError(e instanceof Error ? e.message : t('smartImport.err.photo'));
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
      setError(e instanceof Error ? e.message : t('smartImport.err.gcal'));
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
      const existing = matchCourse(courseName, [...currentCourses, ...createdCourses], courseCode);
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

    const allKnownCourses = [...currentCourses, ...createdCourses];
    const slotSummaries = selectedSlots.map((s, idx) => {
      const cls = newClasses[idx];
      const crs = cls ? allKnownCourses.find((c) => c.id === cls.courseId) : undefined;
      const dayLabel = weekdayLong[s.weekday]?.slice(0, 3) ?? '';
      return `${dayLabel} ${s.start}–${s.end} · ${crs?.shortName || crs?.name || s.courseName} (${s.type})`;
    });

    if (createdCourses.length > 0) upsertMany('courses', createdCourses);
    if (newClasses.length > 0) {
      if (replaceExistingClasses && existingClasses.length > 0) {
        for (const oldClass of existingClasses) {
          remove('classes', oldClass.id);
        }
      }
      upsertMany('classes', newClasses);
    }
    if (newAssessments.length > 0) upsertMany('assessments', newAssessments);
    if (createdCourses.length > 0 || newClasses.length > 0 || newAssessments.length > 0) {
      reconcileFuturePlan(true);
    }

    onImported?.({
      activeCourses: Array.from(importedCourseRefs.values()),
      otherSemesterCourses: otherSemCourses,
      classesCount: newClasses.length,
      assessmentsCount: newAssessments.length,
      source: mode === 'gcal' ? 'gcal' : 'photo',
      slotSummaries,
    });

    setImportedSummary(
      t('smartImport.summary', { courses: createdCourses.length, classes: newClasses.length, assessments: newAssessments.length }),
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
      title={focus === 'assessments' ? t('smartImport.titleAssess') : t('smartImport.title')}
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
              <FileText size={14} /> {t('smartImport.icsPortal')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button onClick={onClose}>{t('smartImport.close')}</Button>
            {hasPreview && (
              <Button variant="primary" onClick={handleConfirmImport}>
                <Check size={15} /> {t('smartImport.saveSelected')}
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
            <Camera size={15} /> {t('smartImport.tabPhoto')}
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
                  <Camera size={11} /> {focus === 'assessments' ? t('smartImport.badgeAssess') : t('smartImport.badge')}
                </StickerBadge>
              ) : (
                <span className="font-semibold text-fg">
                  {focus === 'assessments' ? t('smartImport.headAssess') : t('smartImport.head')}
                </span>
              )}
              <span className="text-xs opacity-75">{t('smartImport.formats')}</span>
            </div>
            <p className="leading-relaxed opacity-90">
              {focus === 'assessments'
                ? t('smartImport.bodyAssess')
                : t('smartImport.body')}
            </p>
            <label className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full bg-ink-cta px-4 py-2 text-xs font-semibold text-ink-cta-fg shadow-card transition hover:opacity-90">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {busy ? t('smartImport.reading') : t('smartImport.choose')}
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
              <p className="flex items-center gap-2 rounded-xl bg-white/75 px-3 py-2 text-xs font-medium text-[#141312] dark:bg-black/30 dark:text-[#FAF6EC]">
                <Loader2 size={13} className="shrink-0 animate-spin text-accent" />
                <span className="truncate">
                  {t('smartImport.analysing', { names: pickedNames.join(', ') })}
                </span>
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-line bg-surface-2/70 p-4 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-fg">{t('smartImport.gcalTitle')}</span>
              <Badge tone={googleConnected ? 'ok' : 'neutral'}>
                {googleConnected ? t('smartImport.events', { n: googleEventsCount }) : t('smartImport.notConnected')}
              </Badge>
            </div>
            <p className="leading-relaxed text-muted">
              {t('smartImport.gcalBody')}
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
                  ? t('smartImport.syncing')
                  : googleEventsCount > 0
                    ? t('smartImport.extract')
                    : t('smartImport.syncExtract')}
              </Button>
              {googleEventsCount > 0 && (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void handleExtractGoogle(true)}>
                  {t('smartImport.refreshFirst')}
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    {t('smartImport.slots', { n: slots.length })}
                  </p>
                  {existingClasses.length > 0 && (
                    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium text-fg">
                      <input
                        type="checkbox"
                        checked={replaceExistingClasses}
                        onChange={(e) => setReplaceExistingClasses(e.target.checked)}
                        className="size-4 accent-accent"
                      />
                      {t('smartImport.replace', { n: existingClasses.length })}
                    </label>
                  )}
                </div>
                {slots.map((s) => {
                  const matched = matchCourse(s.courseName, courses, s.courseCode);
                  const displayName = matched?.name || s.courseName;
                  return (
                    <div
                      key={s.id}
                      onClick={() =>
                        setSlots((prev) =>
                          prev.map((x) => (x.id === s.id ? { ...x, selected: !x.selected } : x)),
                        )
                      }
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={s.selected}
                          aria-label={`Selecionar ${displayName}`}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            setSlots((prev) =>
                              prev.map((x) => (x.id === s.id ? { ...x, selected: e.target.checked } : x)),
                            )
                          }
                          className="size-4 accent-accent"
                        />
                        <div>
                          <p className="font-semibold text-fg">
                            {displayName} · {s.type}
                          </p>
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted"
                          >
                            <Select
                              value={s.weekday}
                              onChange={(e) => {
                                const nextDay = Number(e.target.value);
                                setSlots((prev) =>
                                  prev.map((x) => (x.id === s.id ? { ...x, weekday: nextDay } : x)),
                                );
                              }}
                              aria-label={t('smartImport.weekdayFor', { name: displayName })}
                              className="!min-h-11 !rounded-lg !px-2.5 !py-1 !text-xs font-medium"
                            >
                              {weekdayLong.map((dayName, idx) => (
                                <option key={idx} value={idx}>
                                  {dayName}
                                </option>
                              ))}
                            </Select>
                            <span>
                              {s.start}–{s.end}
                              {s.room ? ` · ${t('smartImport.room', { room: s.room })}` : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge tone={matched ? 'ok' : 'accent'}>
                        {matched ? t('smartImport.linksTo', { name: matched.shortName }) : t('smartImport.creates')}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}

            {assessments.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {t('smartImport.assess', { n: assessments.length })}
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
                        <p className="text-xs text-muted">
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
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {t('smartImport.courses', { n: detectedCourses.length })}
                </p>
                {detectedCourses.map((c) => {
                  const matched = matchCourse(c.name, courses, c.code);
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
                          <p className="font-semibold text-fg">{matched?.name || c.name}</p>
                          <p className="text-xs text-muted">
                            {c.code ? `${c.code} · ` : ''}
                            {c.ects} ECTS
                          </p>
                        </div>
                      </div>
                      <Badge tone={matched ? 'ok' : 'accent'}>
                        {matched ? t('smartImport.linksTo', { name: matched.shortName }) : t('smartImport.creates')}
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
