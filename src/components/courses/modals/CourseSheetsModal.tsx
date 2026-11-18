import { BookOpen, Copy, FileText, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type NotebookSourceInput, extractTopicSheetFromSources, hasCustomGeminiKey } from '../../../integrations/gemini';
import { getDailyQuotaSnapshot } from '../../../lib/aiQuota';
import { deleteTopicSheet, putTopicSheet } from '../../../lib/localDb';
import type { TopicSheetRecord } from '../../../lib/localDb';
import { getAiMaterialLimit, resolveMaterialsForAI } from '../../../lib/materialContent';
import { cx, showToast } from '../../../lib/uiHelpers';
import { newId, useStore } from '../../../store/useStore';
import type { Course, Material } from '../../../types';
import { Markdown } from '../../assistant/Markdown';
import LoadingUnis from '../../brand/LoadingUnis';
import { Button, Field, Modal, Textarea } from '../../ui';

export function CourseSheetsModal({
  open,
  onClose,
  course,
  materials,
  sheets,
  onRefreshSheets,
  onOpenInTutor,
}: {
  open: boolean;
  onClose: () => void;
  course: Course;
  materials: Material[];
  sheets: TopicSheetRecord[];
  onRefreshSheets: () => Promise<void>;
  onOpenInTutor: () => void;
}) {
  const { t } = useTranslation(['uni', 'common']);
  const aiConsent = useStore((s) => s.settings.aiConsent);
  const [selectedTopicId, setSelectedTopicId] = useState<string>(course.topics[0]?.id ?? '');
  const [selectedMatIds, setSelectedMatIds] = useState<string[]>(() =>
    materials.slice(0, 2).map((m) => m.id),
  );
  const [manualText, setManualText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewSheet, setPreviewSheet] = useState<TopicSheetRecord | null>(sheets[0] ?? null);

  const customKey = hasCustomGeminiKey();
  const maxFiles = getAiMaterialLimit(customKey);
  const quota = getDailyQuotaSnapshot(customKey);

  const selectedTopic = course.topics.find((tp) => tp.id === selectedTopicId);

  const toggleMat = (matId: string) => {
    setSelectedMatIds((prev) =>
      prev.includes(matId)
        ? prev.filter((id) => id !== matId)
        : prev.length >= maxFiles
          ? prev
          : [...prev, matId],
    );
  };

  const handleGenerateSheet = async () => {
    setBusy(true);
    setError(null);
    try {
      const pickedMats = materials.filter((m) => selectedMatIds.includes(m.id));
      const resolved =
        pickedMats.length > 0
          ? await resolveMaterialsForAI(pickedMats, { maxFiles })
          : { attachments: [], textExcerpts: [], readTitles: [], skipped: [], needsDriveAuth: false, contextTokens: 0, contextTokenBudget: null };

      if (resolved.needsDriveAuth) {
        showToast(t('memory.needDriveAuth'));
      }

      const sources: NotebookSourceInput[] = resolved.textExcerpts.map((e) => ({
        title: e.title,
        content: e.content,
      }));
      if (manualText.trim()) {
        sources.push({
          title: selectedTopic?.title ? t('memory.notesPrefix', { topic: selectedTopic.title }) : t('memory.courseNotesPrefix', { course: course.shortName }),
          content: manualText.trim(),
        });
      }

      const extracted = await extractTopicSheetFromSources({
        topicTitle: selectedTopic?.title || course.name,
        courseName: course.shortName || course.name,
        sources,
        attachments: resolved.attachments,
      });

      const saved = await putTopicSheet({
        id: newId(),
        courseId: course.id,
        topicId: selectedTopic?.id,
        title: extracted.title,
        mode: 'guide',
        summary: extracted.summary,
        keyConcepts: extracted.keyConcepts,
        materialIds: pickedMats.map((m) => m.id),
        // oxlint-disable-next-line react/purity -- corre dentro do handler assíncrono, não durante o render
        updatedAt: new Date().toISOString(),
      });
      await onRefreshSheets();
      setPreviewSheet(saved);
      setManualText('');
      showToast(t('memory.sheetSaved'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('memory.sheetFail'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('memory.sheetsTitle', { course: course.shortName })}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button size="sm" variant="secondary" onClick={onOpenInTutor}>
            <Sparkles size={14} /> {t('memory.openInTutor')}
          </Button>
          <Button size="sm" variant="primary" onClick={onClose}>
            {t('memory.close')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-surface-2/60 p-3.5 text-xs text-muted">
          {t('memory.sheetsInfo')}
        </div>

        <div className="space-y-3 rounded-2xl border border-line bg-surface p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-fg">{t('memory.newSheet')}</p>
            <span className="text-xs text-muted">
              {customKey ? t('memory.keyUnlimited') : t('memory.todayN', { a: quota.notebookRemaining, b: quota.notebookLimit })}
            </span>
          </div>

          {course.topics.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs text-muted">{t('memory.topic')}</p>
              <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                {course.topics.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTopicId(t.id)}
                    className={cx(
                      'min-h-11 rounded-full border px-3 text-xs font-medium transition',
                      selectedTopicId === t.id
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-surface-2 text-muted hover:text-fg',
                    )}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {materials.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs text-muted">
                {t('memory.materials', { a: selectedMatIds.length, b: maxFiles })}
              </p>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {materials.map((m) => {
                  const active = selectedMatIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMat(m.id)}
                      className={cx(
                        'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition',
                        active
                          ? 'border-accent bg-accent-soft text-accent-ink'
                          : 'border-line bg-surface-2 text-muted hover:text-fg',
                      )}
                    >
                      <FileText size={12} />
                      <span className="max-w-[160px] truncate">{m.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Field label={t('memory.pasteLabel')}>
            <Textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={t('memory.pastePh')}
              className="min-h-20"
            />
          </Field>

          {!aiConsent && (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
              {t('memory.needConsent')}
            </p>
          )}

          {error && (
            <p className="rounded-xl bg-coral-soft px-3 py-2 text-xs font-medium text-coral">{error}</p>
          )}

          <Button
            variant="primary"
            className="w-full"
            disabled={busy || !aiConsent || (selectedMatIds.length === 0 && !manualText.trim())}
            onClick={() => void handleGenerateSheet()}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {busy ? t('memory.extracting') : t('memory.generate')}
          </Button>

          {busy && (
            <div className="rounded-2xl border border-line bg-surface-2/60 px-3 py-1.5">
              <LoadingUnis variant="grades" compact label={t('memory.extracting')} />
            </div>
          )}
        </div>

        {sheets.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted">{t('memory.savedN', { n: sheets.length })}</p>
            <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
              {sheets.map((sheet) => {
                const active = previewSheet?.id === sheet.id;
                return (
                  <div
                    key={sheet.id}
                    className={cx(
                      'flex items-center gap-1.5 rounded-2xl border p-1.5 transition',
                      active ? 'border-accent bg-accent-soft/40' : 'border-line bg-surface-2/60',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewSheet(sheet)}
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 text-left"
                    >
                      <BookOpen size={14} className="shrink-0 text-accent" />
                      <span className="min-w-0 truncate text-xs font-semibold text-fg">
                        {sheet.title}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={t('memory.copy', { title: sheet.title })}
                      onClick={async () => {
                        await navigator.clipboard?.writeText(sheet.summary);
                        showToast(t('memory.sheetCopied'));
                      }}
                      className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface hover:text-fg"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={t('memory.deleteSheet', { title: sheet.title })}
                      onClick={async () => {
                        await deleteTopicSheet(sheet.id);
                        await onRefreshSheets();
                        if (previewSheet?.id === sheet.id) setPreviewSheet(null);
                      }}
                      className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-coral-soft hover:text-coral"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            {previewSheet && (
              <div className="max-h-56 overflow-y-auto rounded-2xl border border-line bg-surface p-3.5 text-sm">
                <p className="mb-2 text-xs font-semibold text-accent">{previewSheet.title}</p>
                <Markdown text={previewSheet.summary} />
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
