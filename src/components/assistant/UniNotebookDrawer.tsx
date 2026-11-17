import { BookOpen, ChevronDown, ClipboardPaste, Copy, Download, ExternalLink, FileText, Image as ImageIcon, Library, Loader2, Paperclip, Sparkles, Trash2, X } from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { resolveIntlLocale } from '../../lib/grading';
import {
  fileToChatAttachment,
  generateNotebookBrief,
  generateStudyGuide,
  getStudyGuideLabels,
  refineStudyGuideTopic,
  type NotebookAssessmentContext,
  hasCustomGeminiKey,
  type ChatAttachment,
  type NotebookSourceInput,
} from '../../integrations/gemini';
import { getDailyQuotaSnapshot } from '../../lib/aiQuota';
import {
  deleteTopicSheet,
  listTopicSheetsByCourse,
  putTopicSheet,
  type TopicSheetRecord,
} from '../../lib/localDb';
import { getAiMaterialLimit, resolveMaterialsForAI } from '../../lib/materialContent';
import { openInAppBrowser } from '../../lib/nativeBridge';
import { buildNotebookPdfBytes, downloadPdfFile } from '../../lib/pdfExport';
import { groupSources, type SourceGroupKey } from '../../lib/tutorSources';
import type { UniAccessoryId, UniPersonaMode } from '../../lib/uniAccessories';
import { newId, useStore } from '../../store/useStore';
import type { ID, Material } from '../../types';
import { UniBuddy } from '../brand/UnipediaMarks';
import { Button, Modal, PillSelect, Textarea } from '../ui';
import { cx, showToast } from '../../lib/uiHelpers';
import {
  deleteSheetGuide,
  loadSheetGuide,
  saveSheetGuide,
  studyGuideToMarkdown,
  type StudyGuide,
} from '../../lib/studyGuide';
import { Markdown } from './Markdown';

const SOURCE_GROUP_KEY: Record<SourceGroupKey, string> = {
  lessons: 'sources.groupLessons',
  tests: 'sources.groupTests',
  problems: 'sources.groupProblems',
  images: 'sources.groupImages',
  other: 'sources.groupOther',
};

const StudyGuideReader = lazy(() => import('./StudyGuideReader'));

/** Entradas da última geração, para «Refazer este tópico» sem voltar a ler os materiais. */
interface GenerationContext {
  sources: NotebookSourceInput[];
  attachments: ChatAttachment[];
  assessment: NotebookAssessmentContext | null;
}

function deriveSheetTitle(markdown: string, mode: 'guide' | 'quiz' | 'summary', courseName?: string): string {
  const heading = markdown
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('#'));
  if (heading) {
    return heading.replace(/^#+\s*/, '').slice(0, 72);
  }
  const modeLabel = i18n.t(`assistant:notebook.mode.${mode}`);
  return courseName ? `${modeLabel} · ${courseName}` : modeLabel;
}

export default function UniNotebookDrawer({
  open,
  onClose,
  courseId,
  courseName,
  courseTopics = [],
  attachedMaterials,
  accessory,
  persona,
  onSendToChat,
}: {
  open: boolean;
  onClose: () => void;
  courseId?: ID;
  courseName?: string;
  courseTopics?: Array<{ id: ID; title: string }>;
  attachedMaterials: Material[];
  accessory: UniAccessoryId;
  persona: UniPersonaMode;
  onSendToChat: (markdown: string) => void;
}) {
  const { t } = useTranslation('assistant');
  const { t: tCommon } = useTranslation('common');
  const assessments = useStore((s) => s.assessments);
  const personalNotebookUrl = useStore((s) => s.settings.personalNotebookUrl?.trim() ?? '');
  const [notesSource, setNotesSource] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [mode, setMode] = useState<'guide' | 'quiz' | 'summary'>('guide');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [guide, setGuide] = useState<StudyGuide | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const guideRef = useRef<StudyGuide | null>(null);
  const generationRef = useRef<GenerationContext | null>(null);
  const [savedSheets, setSavedSheets] = useState<TopicSheetRecord[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const groupedSources = useMemo(() => groupSources(attachedMaterials), [attachedMaterials]);

  const scopedCourseKey: ID | 'general' = courseId || 'general';

  useEffect(() => {
    if (!open) return;
    let active = true;
    void listTopicSheetsByCourse(scopedCourseKey).then((items) => {
      if (active) setSavedSheets(items);
    });
    return () => {
      active = false;
    };
  }, [open, scopedCourseKey]);

  useEffect(() => {
    guideRef.current = guide;
  }, [guide]);

  const customKeyActive = hasCustomGeminiKey();
  const maxAiFiles = getAiMaterialLimit(customKeyActive);
  const maxLocalUploadSlots = customKeyActive ? 8 : 3;
  const quota = getDailyQuotaSnapshot();

  const handlePickFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!picked.length) return;
    const slots = Math.max(0, maxLocalUploadSlots - attachments.length);
    if (slots === 0) {
      showToast(t('notebook.maxFiles', { count: maxLocalUploadSlots }));
      return;
    }
    const next: ChatAttachment[] = [];
    for (const file of picked.slice(0, slots)) {
      try {
        next.push(await fileToChatAttachment(file));
      } catch (err) {
        showToast(err instanceof Error ? err.message : t('notebook.unsupported'));
      }
    }
    if (next.length > 0) setAttachments((prev) => [...prev, ...next]);
  };

  const findNextAssessment = (): NotebookAssessmentContext | null => {
    if (!courseId) return null;
    const now = new Date();
    const next = assessments
      .filter((a) => a.courseId === courseId && a.grade === undefined && parseISO(a.date).getTime() >= now.getTime())
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (!next) return null;
    const titleById = new Map(courseTopics.map((topic) => [topic.id, topic.title]));
    return {
      title: next.title,
      date: next.date,
      daysLeft: Math.max(0, differenceInCalendarDays(parseISO(next.date), now)),
      ...(next.weight ? { weight: next.weight } : {}),
      topicTitles: next.topicIds.map((id) => titleById.get(id)).filter((x): x is string => Boolean(x)),
    };
  };

  /** Lê os materiais e junta fontes, anexos e notas: as entradas de qualquer geração. */
  const prepareInputs = async () => {
    const resolved =
      attachedMaterials.length > 0
        ? await resolveMaterialsForAI(attachedMaterials, { maxFiles: maxAiFiles })
        : {
            attachments: [] as ChatAttachment[],
            textExcerpts: [],
            readTitles: [] as string[],
            skipped: [],
            needsDriveAuth: false, contextTokens: 0, contextTokenBudget: null,
          };

    if (resolved.needsDriveAuth) {
      showToast(t('notebook.driveAuth'));
    }

    const sources: NotebookSourceInput[] = [];
    for (const excerpt of resolved.textExcerpts) {
      sources.push({
        title: excerpt.title,
        content: excerpt.content,
      });
    }
    for (const m of attachedMaterials) {
      if (resolved.readTitles.includes(m.title)) continue;
      sources.push({
        title: m.title,
        content: m.url
          ? t('notebook.refMaterial', { provider: m.provider, title: m.title, url: m.url })
          : t('notebook.savedMaterial', { title: m.title }),
      });
    }
    if (notesSource.trim()) {
      sources.push({
        title: courseName ? t('notebook.notesCourse', { course: courseName }) : t('notebook.myNotes'),
        content: notesSource.trim(),
      });
    }

    const mergedAttachments = [...resolved.attachments, ...attachments].slice(
      0,
      customKeyActive ? maxAiFiles + 2 : 4,
    );
    return { sources, mergedAttachments, readTitles: resolved.readTitles };
  };

  const handleGenerate = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { sources, mergedAttachments, readTitles } = await prepareInputs();
      const assessment = findNextAssessment();
      generationRef.current = { sources, attachments: mergedAttachments, assessment };

      let result: string;
      let structured: StudyGuide | null = null;
      if (mode === 'guide') {
        const generated = await generateStudyGuide({
          sources,
          attachments: mergedAttachments,
          courseName,
          persona,
          accessory,
          assessment,
          onProgress: (p) =>
            setProgressLabel(
              p.phase === 'mapping'
                ? t('notebook.guide.mapping')
                : t('notebook.guide.building', { done: p.done, total: p.total }),
            ),
        });
        result = generated.markdown;
        structured = generated.guide;
        if (generated.failedTopics > 0) setNotice(t('notebook.guide.partial', { count: generated.failedTopics }));
      } else {
        result = await generateNotebookBrief({
          mode,
          sources,
          attachments: mergedAttachments,
          courseName,
          persona,
          accessory,
        });
      }
      setOutput(result);
      setGuide(structured);
      const validTopicId =
        selectedTopicId && courseTopics.some((t) => t.id === selectedTopicId)
          ? selectedTopicId
          : undefined;
      const saved = await putTopicSheet({
        id: newId(),
        courseId: scopedCourseKey,
        ...(validTopicId ? { topicId: validTopicId } : {}),
        title: structured?.title.trim().slice(0, 72) || deriveSheetTitle(result, mode, courseName),
        mode,
        summary: result,
        keyConcepts: readTitles.slice(0, 6),
        materialIds: attachedMaterials.map((m) => m.id),
        updatedAt: new Date().toISOString(),
      });
      if (structured) {
        saveSheetGuide(saved.id, structured);
        setReaderOpen(true);
      }
      setActiveSheetId(saved.id);
      setSavedSheets((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('notebook.genError'));
    } finally {
      setBusy(false);
      setProgressLabel(null);
    }
  };

  const exportableMarkdown = output || notesSource.trim();

  const handleCopyMarkdown = async () => {
    if (!exportableMarkdown) return;
    try {
      await navigator.clipboard?.writeText(exportableMarkdown);
      showToast(t('notebook.copied'));
    } catch {
      showToast(t('notebook.copyFail'), 'danger');
    }
  };

  const handleExportPdf = async () => {
    if (!exportableMarkdown) return;
    setExportingPdf(true);
    try {
      const modeTitle = t(`notebook.mode.${mode}`);
      const subtitle = t('notebook.generatedOn', { date: new Date().toLocaleDateString(resolveIntlLocale(i18n.language)) });
      let bytes: Uint8Array | null = null;
      if (guide && mode === 'guide') {
        // Guia estruturado: PDF com o aspeto da app (fórmulas reais); se falhar, cai no PDF de texto.
        try {
          const [{ rasterizeStudyGuide }, { buildStudyGuidePdfBytes }] = await Promise.all([
            import('./StudyGuidePrintHost'),
            import('../../lib/studyGuidePdf'),
          ]);
          bytes = await buildStudyGuidePdfBytes(await rasterizeStudyGuide(guide, subtitle));
        } catch {
          bytes = null;
        }
      }
      bytes ??= await buildNotebookPdfBytes({
        title: courseName ? `${modeTitle} · ${courseName}` : `${t('notebook.title')} · ${modeTitle}`,
        subtitle,
        markdown: exportableMarkdown,
      });
      const slug = (courseName || 'caderno-uni').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      downloadPdfFile(`unipedia-${slug || 'caderno'}.pdf`, bytes);
      showToast(t('notebook.pdfOk'));
    } catch {
      showToast(t('notebook.pdfFail'), 'danger');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleUseInTutor = () => {
    if (!output) return;
    onSendToChat(output);
    setReaderOpen(false);
    onClose();
  };

  /** «Refazer este tópico»: devolve null se correu bem, ou a mensagem de erro para o tópico. */
  const handleRefineTopic = async (idx: number, instruction: string): Promise<string | null> => {
    const current = guideRef.current;
    const topic = current?.topics[idx];
    if (!current || !topic) return t('notebook.reader.refineFail');
    try {
      let ctx = generationRef.current;
      if (!ctx) {
        // Ficha reaberta noutra sessão: reaproveita as fontes que estão agora no caderno.
        const prepared = await prepareInputs();
        ctx = { sources: prepared.sources, attachments: prepared.mergedAttachments, assessment: findNextAssessment() };
        if (ctx.sources.length === 0 && ctx.attachments.length === 0) return t('notebook.reader.refineNoSources');
        generationRef.current = ctx;
      }
      const next = await refineStudyGuideTopic({
        sources: ctx.sources,
        attachments: ctx.attachments,
        courseName,
        persona,
        accessory,
        assessment: ctx.assessment,
        topic,
        instruction,
        otherTopicTitles: current.topics.filter((_, i) => i !== idx).map((x) => x.title),
      });
      if (!next) return t('notebook.reader.refineFail');
      const latest = guideRef.current ?? current;
      const nextGuide: StudyGuide = { ...latest, topics: latest.topics.map((x, i) => (i === idx ? next : x)) };
      const markdown = studyGuideToMarkdown(nextGuide, getStudyGuideLabels());
      setGuide(nextGuide);
      setOutput(markdown);
      const sheet = savedSheets.find((item) => item.id === activeSheetId);
      if (sheet) {
        const updated = await putTopicSheet({ ...sheet, summary: markdown, updatedAt: new Date().toISOString() });
        saveSheetGuide(updated.id, nextGuide);
        setSavedSheets((prev) => [updated, ...prev.filter((item) => item.id !== updated.id)]);
      }
      return null;
    } catch (e) {
      return e instanceof Error && e.message ? e.message : t('notebook.reader.refineFail');
    }
  };

  const guideReady = Boolean(guide && mode === 'guide');

  return (
    <>
    <Modal
      open={open}
      onClose={() => {
        setReaderOpen(false);
        onClose();
      }}
      title={courseName ? `${t('notebook.title')} · ${courseName}` : t('notebook.title')}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {personalNotebookUrl ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void openInAppBrowser(personalNotebookUrl)}
            >
              <ExternalLink size={14} /> {t('notebook.openExternal')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {exportableMarkdown && (
              <>
                <Button size="sm" variant="secondary" onClick={() => void handleCopyMarkdown()}>
                  <Copy size={14} /> {t('notebook.copyMd')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleExportPdf()}
                  disabled={exportingPdf}
                >
                  <Download size={14} /> {exportingPdf ? t('notebook.pdfBusy') : t('notebook.pdfExport')}
                </Button>
              </>
            )}
            {output && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleUseInTutor}
              >
                {t('notebook.useInTutor')}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                setReaderOpen(false);
                onClose();
              }}
            >
              {t('notebook.close')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl bg-[#FCE99F]/70 p-3 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]">
          <UniBuddy mood={busy ? 'thinking' : 'curious'} accessory={accessory} size={40} interactive={false} />
          <div className="min-w-0 text-xs leading-relaxed">
            <p className="font-bold">{t('notebook.introTitle')}</p>
            <p className="opacity-80">{t('notebook.introBody')}</p>
          </div>
        </div>

        {attachedMaterials.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-line bg-surface-2/50">
            <button
              type="button"
              onClick={() => setSourcesExpanded((v) => !v)}
              aria-expanded={sourcesExpanded}
              className="flex min-h-11 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition hover:bg-surface-2"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">
                  <Library size={15} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-fg">
                    {t('notebook.attachedSources', { count: attachedMaterials.length })}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {groupedSources
                      .map((g) => `${g.items.length} ${tCommon(SOURCE_GROUP_KEY[g.key]).toLowerCase()}`)
                      .join(' · ')}
                  </p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-accent-ink dark:text-accent">
                <span>{sourcesExpanded ? t('notebook.hideSources') : t('notebook.viewSources')}</span>
                <ChevronDown
                  size={15}
                  className={cx('transition-transform duration-150', sourcesExpanded && 'rotate-180')}
                  aria-hidden="true"
                />
              </span>
            </button>

            {sourcesExpanded && (
              <div className="max-h-52 space-y-3 overflow-y-auto border-t border-line/70 px-3.5 py-3">
                {groupedSources.map((group) => (
                  <div key={group.key} className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {tCommon(SOURCE_GROUP_KEY[group.key])} · {group.items.length}
                    </p>
                    <ul className="divide-y divide-line/50">
                      {group.items.map((m) => (
                        <li key={m.id} className="flex items-center gap-2 py-1.5 text-xs text-fg">
                          {group.key === 'images' ? (
                            <ImageIcon size={13} className="shrink-0 text-accent" aria-hidden="true" />
                          ) : (
                            <FileText size={13} className="shrink-0 text-accent" aria-hidden="true" />
                          )}
                          <span className="min-w-0 flex-1 truncate" title={m.title}>
                            {m.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="min-w-0 text-xs font-semibold text-muted">
              {t('notebook.pasteLabel')}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={handlePickFiles}
              className="hidden"
            />
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const clip = (await navigator.clipboard.readText()).trim();
                    if (!clip) {
                      showToast(t('notebook.clipboardEmpty'));
                      return;
                    }
                    setNotesSource((prev) => (prev.trim() ? `${prev.trim()}\n\n${clip}` : clip));
                    showToast(t('notebook.pasted'));
                  } catch {
                    showToast(t('notebook.pasteManual'));
                  }
                }}
                disabled={busy}
                className="inline-flex min-h-11 shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 text-xs font-semibold text-fg transition hover:border-line-strong disabled:opacity-45"
              >
                <ClipboardPaste size={13} /> {t('notebook.pasteBtn')}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy || attachments.length >= maxLocalUploadSlots}
                className="inline-flex min-h-11 shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 text-xs font-semibold text-fg transition hover:border-line-strong disabled:opacity-45"
              >
                <Paperclip size={13} /> {t('notebook.attachBtn')}
              </button>
            </div>
          </div>
          <Textarea
            value={notesSource}
            onChange={(e) => setNotesSource(e.target.value)}
            placeholder={t('notebook.placeholder')}
            className="min-h-24"
          />
          {attachments.length > 0 && (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface-2/50">
              {attachments.map((att, idx) => (
                <li
                  key={`${att.name}-${idx}`}
                  className="flex items-center justify-between gap-2 pl-3 pr-1 py-1 text-xs text-fg"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {att.mimeType.startsWith('image/') ? (
                      <ImageIcon size={13} className="shrink-0 text-accent" />
                    ) : (
                      <FileText size={13} className="shrink-0 text-accent" />
                    )}
                    <span className="truncate font-medium">{att.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label={t('notebook.remove', { name: att.name })}
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface hover:text-fg"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {courseTopics.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted">{t('notebook.linkTopic')}</p>
            <PillSelect
              value={selectedTopicId}
              onChange={setSelectedTopicId}
              ariaLabel={t('notebook.linkTopic')}
              className="w-full [&>button]:w-full [&>button]:max-w-none [&>button]:justify-between [&>button]:rounded-xl [&>button]:bg-surface-2/60"
              options={[
                { value: '', label: t('notebook.general') },
                ...courseTopics.map((topic) => ({
                  value: topic.id,
                  label: topic.title,
                })),
              ]}
            />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted">{t('notebook.title')}</span>
            <span className="text-xs font-medium text-muted">
              {customKeyActive
                ? t('notebook.keyUnlimited')
                : t('notebook.genToday', { remaining: quota.notebookRemaining, limit: quota.notebookLimit })}
            </span>
          </div>
          <div
            role="tablist"
            aria-label={t('notebook.title')}
            className="grid grid-cols-3 gap-1 rounded-2xl border border-line/80 bg-surface-2 p-1"
          >
            {(
              [
                ['guide', t('notebook.mode.guide')],
                ['quiz', t('notebook.mode.quiz')],
                ['summary', t('notebook.mode.summary')],
              ] as const
            ).map(([id, label]) => {
              const active = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(id)}
                  className={cx(
                    'flex min-h-11 items-center justify-center rounded-xl px-2 py-1.5 text-center text-xs font-semibold leading-tight transition',
                    active
                      ? 'bg-surface text-fg shadow-card'
                      : 'text-muted hover:text-fg',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <Button
          variant="primary"
          onClick={() => void handleGenerate()}
          disabled={
            busy || (!notesSource.trim() && attachedMaterials.length === 0 && attachments.length === 0)
          }
          className="w-full"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {busy ? (progressLabel ?? t('notebook.busy')) : t('notebook.generate')}
        </Button>
        {busy && progressLabel && (
          <p role="status" className="sr-only">
            {progressLabel}
          </p>
        )}
        {notice && !busy && (
          <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs font-medium text-muted">{notice}</p>
        )}

        {error && (
          <p className="rounded-xl bg-coral-soft px-3 py-2 text-xs font-medium text-coral">{error}</p>
        )}

        {output && guide && guideReady && (
          <div className="flex flex-wrap items-center gap-3 rounded-[20px] border border-accent/30 bg-accent-soft/50 p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface text-accent-ink">
              <BookOpen size={20} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-ink">{t('notebook.reader.readyTitle')}</p>
              <p className="truncate text-sm font-bold text-fg">{guide.title || t('notebook.reader.fallbackTitle')}</p>
              <p className="text-xs text-muted">{t('notebook.reader.topicsCount', { count: guide.topics.length })}</p>
            </div>
            <Button variant="primary" onClick={() => setReaderOpen(true)}>
              <BookOpen size={15} /> {t('notebook.reader.openGuide')}
            </Button>
          </div>
        )}

        {output && !guideReady && (
          <div className="max-h-[60vh] overflow-y-auto rounded-[20px] border border-line bg-surface-2/60 p-4 text-sm">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-accent">
              <BookOpen size={13} /> {t('notebook.result')}
            </div>
            <Markdown text={output} />
          </div>
        )}

        {savedSheets.length > 0 && (
          <div className="space-y-2 border-t border-line pt-3">
            <p className="text-xs font-semibold text-muted">
              {t('notebook.savedSheets', { count: savedSheets.length })}
            </p>
            <div className="max-h-48 divide-y divide-line overflow-y-auto rounded-2xl border border-line bg-surface-2/40">
              {savedSheets.map((sheet) => {
                const isSelected = activeSheetId === sheet.id;
                const modeLabel = t(`notebook.short.${sheet.mode}`);
                return (
                  <div
                    key={sheet.id}
                    className={cx(
                      'flex items-center gap-1.5 px-1.5 py-1 transition',
                      isSelected ? 'bg-accent-soft/40' : 'hover:bg-surface-2/70',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSheetId(sheet.id);
                        setMode(sheet.mode);
                        setOutput(sheet.summary);
                        const stored = sheet.mode === 'guide' ? loadSheetGuide(sheet.id) : null;
                        setGuide(stored);
                        if (stored) setReaderOpen(true);
                      }}
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 text-left"
                    >
                      <BookOpen size={14} className={cx('shrink-0', isSelected ? 'text-accent-ink' : 'text-muted')} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-fg">{sheet.title}</span>
                        <span className="block text-xs text-muted">{modeLabel}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={t('notebook.deleteSheet', { title: sheet.title })}
                      onClick={async () => {
                        await deleteTopicSheet(sheet.id);
                        deleteSheetGuide(sheet.id);
                        setSavedSheets((prev) => prev.filter((item) => item.id !== sheet.id));
                        if (activeSheetId === sheet.id) {
                          setActiveSheetId(null);
                          setOutput(null);
                          setGuide(null);
                          setReaderOpen(false);
                        }
                      }}
                      className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-coral-soft hover:text-coral"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
    {open && readerOpen && guide && guideReady && (
      <Suspense fallback={null}>
        <StudyGuideReader
          open
          guide={guide}
          courseName={courseName}
          onClose={() => setReaderOpen(false)}
          onCopy={() => void handleCopyMarkdown()}
          onExportPdf={() => void handleExportPdf()}
          exportingPdf={exportingPdf}
          onUseInTutor={handleUseInTutor}
          onRefineTopic={handleRefineTopic}
        />
      </Suspense>
    )}
    </>
  );
}
