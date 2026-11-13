import { FileText, Image as ImageIcon, Paperclip, Send, Square, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { fileToChatAttachment, type ChatAttachment } from '../../integrations/gemini';
import { showToast } from '../ui';

interface Props {
  disabled?: boolean;
  loading: boolean;
  onSend: (text: string, attachments?: ChatAttachment[]) => void;
  onStop: () => void;
}

const MAX_HEIGHT = 160;
const MAX_ATTACHMENTS = 3;

export function Composer({ disabled, loading, onSend, onStop }: Props) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Cresce com o conteúdo até um limite; depois passa a fazer scroll.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [text]);

  const trimmed = text.trim();
  const canSend = !disabled && !loading && (trimmed.length > 0 || attachments.length > 0);

  const handleFilePick = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    const room = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    if (room === 0) {
      showToast(`Podes anexar até ${MAX_ATTACHMENTS} fotos ou PDFs por mensagem.`, 'neutral');
      return;
    }

    const next: ChatAttachment[] = [];
    for (const file of files.slice(0, room)) {
      try {
        next.push(await fileToChatAttachment(file));
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Ficheiro inválido', 'danger');
      }
    }
    if (next.length > 0) {
      setAttachments((prev) => [...prev, ...next]);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const submit = () => {
    if (!canSend) return;
    const payloadText =
      trimmed || 'Analisa os ficheiros anexados e resume os pontos mais importantes para o meu estudo.';
    const payloadAtts = attachments.length > 0 ? attachments : undefined;
    onSend(payloadText, payloadAtts);
    setText('');
    setAttachments([]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      submit();
    }
  };

  return (
    <div className="space-y-2 rounded-2xl border border-line bg-surface p-2 focus-within:border-accent">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1 pt-0.5">
          {attachments.map((att) => (
            <span
              key={att.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg"
            >
              {att.mimeType.startsWith('image/') ? (
                <ImageIcon size={12} className="text-accent" />
              ) : (
                <FileText size={12} className="text-accent" />
              )}
              <span className="max-w-[140px] truncate">{att.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                aria-label={`Remover ${att.name}`}
                className="rounded-full p-0.5 text-muted hover:text-danger"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => void handleFilePick(e)}
        />
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => fileRef.current?.click()}
          aria-label="Anexar foto ou PDF de apontamentos"
          title="Anexar foto ou PDF"
          className="grid size-11 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Paperclip size={18} />
        </button>

        <textarea
          ref={ref}
          value={text}
          rows={1}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Pergunta algo ou envia fotos/PDFs da sebenta…"
          aria-label="Mensagem para o assistente"
          style={{ minHeight: 40 }}
          className="max-h-40 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2 text-sm text-fg placeholder:text-muted/70 focus:outline-none disabled:cursor-not-allowed"
        />

        {loading ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Parar"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-sm font-medium text-fg hover:border-muted/50"
          >
            <Square size={14} className="fill-current" />
            Parar
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label="Enviar mensagem"
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={17} />
          </button>
        )}
      </div>
    </div>
  );
}
