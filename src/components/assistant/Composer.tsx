import { FileText, Image as ImageIcon, Paperclip, ArrowUp, Square, X } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { fileToChatAttachment, type ChatAttachment } from '../../integrations/gemini';
import { cx, showToast } from '../../lib/uiHelpers';

export interface ComposerSlotHelpers {
  openFilePicker: () => void;
}

interface Props {
  disabled?: boolean;
  loading: boolean;
  onSend: (text: string, attachments?: ChatAttachment[]) => void;
  onStop: () => void;
  leadingSlot?: ReactNode | ((helpers: ComposerSlotHelpers) => ReactNode);
  topSlot?: ReactNode | ((helpers: ComposerSlotHelpers) => ReactNode);
  hidePaperclipOnMobile?: boolean;
  placeholder?: string;
}

const MAX_HEIGHT = 160;
const MAX_ATTACHMENTS = 3;

export function Composer({
  disabled,
  loading,
  onSend,
  onStop,
  leadingSlot,
  topSlot,
  hidePaperclipOnMobile = false,
  placeholder,
}: Props) {
  const { t } = useTranslation('assistant');
  const resolvedPlaceholder = placeholder ?? t('placeholder');
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const fileInputId = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const slotHelpers: ComposerSlotHelpers = {
    openFilePicker: () => {
      const el = document.getElementById(fileInputId);
      if (el instanceof HTMLInputElement) el.click();
    },
  };
  const resolvedTopSlot = typeof topSlot === 'function' ? topSlot(slotHelpers) : topSlot;
  const resolvedLeadingSlot =
    typeof leadingSlot === 'function' ? leadingSlot(slotHelpers) : leadingSlot;

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
      showToast(t('composer.maxAttachments', { count: MAX_ATTACHMENTS }), 'neutral');
      return;
    }

    const next: ChatAttachment[] = [];
    for (const file of files.slice(0, room)) {
      try {
        next.push(await fileToChatAttachment(file));
      } catch (err) {
        showToast(err instanceof Error ? err.message : t('composer.invalidFile'), 'danger');
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
    const payloadText = trimmed || t('composer.analyzeAttachments');
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
    <div className="space-y-2 rounded-[28px] border border-line/75 bg-surface px-2.5 py-2 shadow-card transition focus-within:border-accent">
      {resolvedTopSlot}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1 pt-0.5">
          {attachments.map((att) => (
            <span
              key={att.id}
              className="inline-flex min-h-11 items-center gap-1 rounded-full bg-surface-2 pl-3 pr-0.5 text-xs font-medium text-fg"
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
                aria-label={t('composer.removeAttachment', { name: att.name })}
                className="grid size-11 place-items-center rounded-full text-muted hover:text-danger"
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5">
        {resolvedLeadingSlot}
        <input
          id={fileInputId}
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
          aria-label={t('composer.attachAria')}
          title={t('composer.attachTitle')}
          className={cx(
            'place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 size-11 shrink-0',
            hidePaperclipOnMobile ? 'hidden md:grid' : 'grid',
          )}
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
          placeholder={resolvedPlaceholder}
          aria-label={t('composer.inputAria')}
          style={{ minHeight: 44 }}
          className="max-h-40 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2.5 text-sm text-fg placeholder:text-muted/75 focus:outline-none disabled:cursor-not-allowed"
        />

        {loading ? (
          <button
            type="button"
            onClick={onStop}
            aria-label={t('composer.stop')}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 text-sm font-medium text-fg hover:border-muted/50"
          >
            <Square size={13} className="fill-current" />
            {t('composer.stop')}
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label={t('composer.sendAria')}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-ink-cta text-ink-cta-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ArrowUp size={18} strokeWidth={2.2} />
          </button>
        )}
      </div>
    </div>
  );
}
