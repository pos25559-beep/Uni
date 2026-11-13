import { BookOpen, ClipboardPaste, ExternalLink, FileText, Image as ImageIcon, Loader2, Paperclip, Sparkles, X } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import {
  fileToChatAttachment,
  generateNotebookBrief,
  hasCustomGeminiKey,
  type ChatAttachment,
  type NotebookSourceInput,
} from '../../integrations/gemini';
import { getDailyQuotaSnapshot } from '../../lib/aiQuota';
import { openInAppBrowser } from '../../lib/nativeBridge';
import type { UniAccessoryId, UniPersonaMode } from '../../lib/uniAccessories';
import { useStore } from '../../store/useStore';
import type { Material } from '../../types';
import { UniBuddy } from '../brand/UnipediaMarks';
import { Button, Modal, Textarea, cx, showToast } from '../ui';
import { Markdown } from './Markdown';

export default function UniNotebookDrawer({
  open,
  onClose,
  courseName,
  attachedMaterials,
  accessory,
  persona,
  onSendToChat,
}: {
  open: boolean;
  onClose: () => void;
  courseName?: string;
  attachedMaterials: Material[];
  accessory: UniAccessoryId;
  persona: UniPersonaMode;
  onSendToChat: (markdown: string) => void;
}) {
  const personalNotebookUrl = useStore((s) => s.settings.personalNotebookUrl?.trim() ?? '');
  const [notesSource, setNotesSource] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [mode, setMode] = useState<'guide' | 'quiz' | 'summary'>('guide');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const customKeyActive = hasCustomGeminiKey();
  const quota = getDailyQuotaSnapshot();

  const handlePickFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!picked.length) return;
    const slots = Math.max(0, 3 - attachments.length);
    if (slots === 0) {
      showToast('Podes juntar até 3 ficheiros por geração.');
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
      const sources: NotebookSourceInput[] = [];
      for (const m of attachedMaterials) {
        sources.push({
          title: m.title,
          content: m.url
            ? `Material de referência (${m.provider}): ${m.title} — ${m.url}`
            : `Material guardado: ${m.title}`,
        });
      }
      if (notesSource.trim()) {
        sources.push({
          title: courseName ? `Apontamentos de ${courseName}` : 'As minhas notas da aula',
          content: notesSource.trim(),
        });
      }

      const result = await generateNotebookBrief({
        mode,
        sources,
        attachments,
        courseName,
        persona,
        accessory,
      });
      setOutput(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar este caderno agora.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={courseName ? `Caderno do Uni · ${courseName}` : 'Caderno do Uni'}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              void openInAppBrowser(personalNotebookUrl || 'https://notebooklm.google.com/')
            }
          >
            <ExternalLink size={14} /> Abrir Gemini Notebook
          </Button>
          <div className="flex items-center gap-2">
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
        <div className="flex items-center gap-3 rounded-[20px] bg-[#FCE99F]/70 p-3.5 text-[#141312] dark:bg-surface-2 dark:text-[#FAF6EC]">
          <UniBuddy mood={busy ? 'thinking' : 'curious'} accessory={accessory} size={46} interactive={false} />
          <div className="min-w-0 text-xs">
            <p className="font-bold">Caderno privado sem links de partilha</p>
            <p className="opacity-80">
              Cola notas ou conversas do Gemini / NotebookLM e junta PDFs ou fotos. Também podes abrir a tua biblioteca privada em baixo.
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
              Cola notas/conversas Gemini ou anexa PDF
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
                    showToast('Copia o texto no Gemini/NotebookLM e cola manualmente na caixa abaixo.');
                  }
                }}
                disabled={busy}
                className="inline-flex min-h-[34px] shrink-0 whitespace-nowrap items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 text-[11px] font-semibold text-fg transition hover:border-line-strong disabled:opacity-45"
              >
                <ClipboardPaste size={12} /> Colar texto
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy || attachments.length >= 3}
                className="inline-flex min-h-[34px] shrink-0 whitespace-nowrap items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 text-[11px] font-semibold text-fg transition hover:border-line-strong disabled:opacity-45"
              >
                <Paperclip size={12} /> Anexar ficheiro
              </button>
            </div>
          </div>
          <Textarea
            value={notesSource}
            onChange={(e) => setNotesSource(e.target.value)}
            placeholder="Ex: conversa copiada do Gemini, Teorema de Rolle, apontamentos da aula..."
            className="min-h-28"
          />
          {attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {attachments.map((att, idx) => (
                <span
                  key={`${att.name}-${idx}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pl-2.5 pr-1.5 text-[11px] font-medium text-fg"
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
                    className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-surface hover:text-fg"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

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
                  'min-h-[38px] rounded-full border px-3 text-xs font-semibold transition',
                  mode === id
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-surface-2 text-muted hover:text-fg',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[11px] font-medium text-muted">
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
      </div>
    </Modal>
  );
}
