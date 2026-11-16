import { BookOpen, ClipboardPaste, Copy, Download, ExternalLink, FileText, Image as ImageIcon, Loader2, Paperclip, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  fileToChatAttachment,
  generateNotebookBrief,
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
import type { UniAccessoryId, UniPersonaMode } from '../../lib/uniAccessories';
import { newId, useStore } from '../../store/useStore';
import type { ID, Material } from '../../types';
import { UniBuddy } from '../brand/UnipediaMarks';
import { Button, Modal, Textarea } from '../ui';
import { cx, showToast } from '../../lib/uiHelpers';
import { Markdown } from './Markdown';

function deriveSheetTitle(markdown: string, mode: 'guide' | 'quiz' | 'summary', courseName?: string): string {
  const heading = markdown
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('#'));
  if (heading) {
    return heading.replace(/^#+\s*/, '').slice(0, 72);
  }
  const modeLabel = mode === 'guide' ? 'Guia de Estudo' : mode === 'quiz' ? 'Quiz com Citações' : 'Resumo Rápido';
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
  const personalNotebookUrl = useStore((s) => s.settings.personalNotebookUrl?.trim() ?? '');
  const [notesSource, setNotesSource] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [mode, setMode] = useState<'guide' | 'quiz' | 'summary'>('guide');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [savedSheets, setSavedSheets] = useState<TopicSheetRecord[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      showToast(`Podes juntar até ${maxLocalUploadSlots} ficheiros por geração.`);
      return;
    }
    const next: ChatAttachment[] = [];
    for (const file of picked.slice(0, slots)) {
      try {
        next.push(await fileToChatAttachment(file));
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Ficheiro não suportado.');
      }
    }
    if (next.length > 0) setAttachments((prev) => [...prev, ...next]);
  };

  const handleGenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const resolved =
        attachedMaterials.length > 0
          ? await resolveMaterialsForAI(attachedMaterials, { maxFiles: maxAiFiles })
          : {
              attachments: [] as ChatAttachment[],
              textExcerpts: [],
              readTitles: [],
              skipped: [],
              needsDriveAuth: false,
            };

      if (resolved.needsDriveAuth) {
        showToast('Autoriza o Google Drive no Tutor/Materiais para o Caderno ler PDFs do Drive diretamente.');
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
            ? `Material de referência (${m.provider}): ${m.title} — ${m.url}`
            : `Material guardado: ${m.title}`,
        });
      }
      if (notesSource.trim()) {
        sources.push({
          title: courseName ? `Notas / Aula (${courseName})` : 'As minhas notas de estudo',
          content: notesSource.trim(),
        });
      }

      const mergedAttachments = [...resolved.attachments, ...attachments].slice(
        0,
        customKeyActive ? maxAiFiles + 2 : 4,
      );

      const result = await generateNotebookBrief({
        mode,
        sources,
        attachments: mergedAttachments,
        courseName,
        persona,
        accessory,
      });
      setOutput(result);
      const validTopicId =
        selectedTopicId && courseTopics.some((t) => t.id === selectedTopicId)
          ? selectedTopicId
          : undefined;
      const saved = await putTopicSheet({
        id: newId(),
        courseId: scopedCourseKey,
        ...(validTopicId ? { topicId: validTopicId } : {}),
        title: deriveSheetTitle(result, mode, courseName),
        mode,
        summary: result,
        keyConcepts: resolved.readTitles.slice(0, 6),
        materialIds: attachedMaterials.map((m) => m.id),
        updatedAt: new Date().toISOString(),
      });
      setActiveSheetId(saved.id);
      setSavedSheets((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar este caderno agora.');
    } finally {
      setBusy(false);
    }
  };

  const exportableMarkdown = output || notesSource.trim();

  const handleCopyMarkdown = async () => {
    if (!exportableMarkdown) return;
    try {
      await navigator.clipboard?.writeText(exportableMarkdown);
      showToast('Markdown copiado para a área de transferência!');
    } catch {
      showToast('Não foi possível copiar agora.', 'danger');
    }
  };

  const handleExportPdf = async () => {
    if (!exportableMarkdown) return;
    setExportingPdf(true);
    try {
      const modeTitle = mode === 'guide' ? 'Guia de Estudo' : mode === 'quiz' ? 'Quiz com Citações' : 'Resumo Rápido';
      const bytes = await buildNotebookPdfBytes({
        title: courseName ? `${modeTitle} · ${courseName}` : `Caderno do Uni · ${modeTitle}`,
        subtitle: `Gerado na Unipedia · ${new Date().toLocaleDateString('pt-PT')}`,
        markdown: exportableMarkdown,
      });
      const slug = (courseName || 'caderno-uni').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      downloadPdfFile(`unipedia-${slug || 'caderno'}.pdf`, bytes);
      showToast('PDF exportado com sucesso!');
    } catch {
      showToast('Não foi possível gerar o PDF agora.', 'danger');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={courseName ? `Caderno do Uni · ${courseName}` : 'Caderno do Uni'}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {personalNotebookUrl ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void openInAppBrowser(personalNotebookUrl)}
            >
              <ExternalLink size={14} /> Abrir caderno externo
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {exportableMarkdown && (
              <>
                <Button size="sm" variant="secondary" onClick={() => void handleCopyMarkdown()}>
                  <Copy size={14} /> Copiar .md
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleExportPdf()}
                  disabled={exportingPdf}
                >
                  <Download size={14} /> {exportingPdf ? 'A gerar PDF…' : 'Exportar PDF'}
                </Button>
              </>
            )}
            {output && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  onSendToChat(output);
                  onClose();
                }}
              >
                Usar no Tutor
              </Button>
            )}
            <Button size="sm" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl bg-[#FCE99F]/70 p-3.5 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]">
          <UniBuddy mood={busy ? 'thinking' : 'curious'} accessory={accessory} size={46} interactive={false} />
          <div className="min-w-0 text-xs">
            <p className="font-bold">Caderno do Uni dentro da app</p>
            <p className="opacity-80">
              Cola apontamentos da aula ou resumos de estudo e junta PDFs ou fotos para gerar fichas e quizzes com citações.
            </p>
          </div>
        </div>

        {attachedMaterials.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted">Fontes anexadas ({attachedMaterials.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {attachedMaterials.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg"
                >
                  <FileText size={12} className="text-accent" />
                  <span className="max-w-[160px] truncate">{m.title}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label className="min-w-0 text-xs font-semibold text-muted">
              Cola apontamentos, resumos ou anexa PDF
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
                      showToast('A área de transferência está vazia.');
                      return;
                    }
                    setNotesSource((prev) => (prev.trim() ? `${prev.trim()}\n\n${clip}` : clip));
                    showToast('Texto colado no caderno.');
                  } catch {
                    showToast('Copia o texto dos teus apontamentos e cola manualmente na caixa abaixo.');
                  }
                }}
                disabled={busy}
                className="inline-flex min-h-11 shrink-0 whitespace-nowrap items-center gap-1 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-fg transition hover:border-line-strong disabled:opacity-45"
              >
                <ClipboardPaste size={12} /> Colar texto
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy || attachments.length >= 3}
                className="inline-flex min-h-11 shrink-0 whitespace-nowrap items-center gap-1 rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold text-fg transition hover:border-line-strong disabled:opacity-45"
              >
                <Paperclip size={12} /> Anexar ficheiro
              </button>
            </div>
          </div>
          <Textarea
            value={notesSource}
            onChange={(e) => setNotesSource(e.target.value)}
            placeholder="Ex.: apontamentos da aula, Teorema de Rolle, resolução de exercícios..."
            className="min-h-28"
          />
          {attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {attachments.map((att, idx) => (
                <span
                  key={`${att.name}-${idx}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1.5 text-xs font-medium text-fg"
                >
                  {att.mimeType.startsWith('image/') ? (
                    <ImageIcon size={12} className="text-accent" />
                  ) : (
                    <FileText size={12} className="text-accent" />
                  )}
                  <span className="max-w-[140px] truncate">{att.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label={`Remover ${att.name}`}
                    className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {courseTopics.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted">
              Associar ficha a um tópico (ajuda o Tutor e o Foco)
            </p>
            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
              <button
                type="button"
                onClick={() => setSelectedTopicId('')}
                className={cx(
                  'min-h-11 rounded-full border px-3 text-xs font-medium transition',
                  !selectedTopicId
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-2 text-muted hover:text-fg',
                )}
              >
                Geral
              </button>
              {courseTopics.slice(0, 10).map((t) => (
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

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['guide', 'Guia de Estudo'],
                ['quiz', 'Quiz com Citações'],
                ['summary', 'Resumo Rápido'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cx(
                  'min-h-11 rounded-full border px-3.5 text-xs font-semibold transition',
                  mode === id
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-surface-2 text-muted hover:text-fg',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs font-medium text-muted">
            {customKeyActive
              ? 'Chave pessoal · ilimitado'
              : `${quota.notebookRemaining}/${quota.notebookLimit} gerações hoje`}
          </span>
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
          {busy ? 'O Uni está a organizar as fontes…' : 'Gerar a partir das fontes'}
        </Button>

        {error && (
          <p className="rounded-xl bg-coral-soft px-3 py-2 text-xs font-medium text-coral">{error}</p>
        )}

        {output && (
          <div className="max-h-64 overflow-y-auto rounded-[20px] border border-line bg-surface-2/60 p-4 text-sm">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-accent">
              <BookOpen size={13} /> Resultado do Caderno
            </div>
            <Markdown text={output} />
          </div>
        )}

        {savedSheets.length > 0 && (
          <div className="space-y-2 border-t border-line pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-muted">
                Fichas guardadas localmente ({savedSheets.length})
              </p>
            </div>
            <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
              {savedSheets.map((sheet) => {
                const isSelected = activeSheetId === sheet.id;
                const modeLabel =
                  sheet.mode === 'guide' ? 'Guia' : sheet.mode === 'quiz' ? 'Quiz' : 'Resumo';
                return (
                  <div
                    key={sheet.id}
                    className={cx(
                      'flex items-center gap-1.5 rounded-2xl border p-1.5 transition',
                      isSelected
                        ? 'border-accent bg-accent-soft/40'
                        : 'border-line bg-surface-2/50 hover:border-line-strong',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSheetId(sheet.id);
                        setMode(sheet.mode);
                        setOutput(sheet.summary);
                      }}
                      className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl px-2.5 text-left"
                    >
                      <span className="min-w-0 truncate text-xs font-semibold text-fg">
                        {sheet.title}
                      </span>
                      <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted">
                        {modeLabel}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Apagar ficha ${sheet.title}`}
                      onClick={async () => {
                        await deleteTopicSheet(sheet.id);
                        setSavedSheets((prev) => prev.filter((item) => item.id !== sheet.id));
                        if (activeSheetId === sheet.id) {
                          setActiveSheetId(null);
                          setOutput(null);
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
  );
}
