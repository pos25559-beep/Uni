import { Send, Square } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

interface Props {
  disabled?: boolean;
  loading: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

const MAX_HEIGHT = 160;

export function Composer({ disabled, loading, onSend, onStop }: Props) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  // Cresce com o conteúdo até um limite; depois passa a fazer scroll.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [text]);

  const trimmed = text.trim();
  const canSend = !disabled && !loading && trimmed.length > 0;

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed);
    setText('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 focus-within:border-accent">
      <textarea
        ref={ref}
        value={text}
        rows={1}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={disabled ? 'Configura a chave da Gemini para conversar' : 'Pergunta qualquer coisa sobre o teu semestre…'}
        aria-label="Mensagem para o assistente"
        style={{ minHeight: 40 }}
        className="max-h-40 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-fg placeholder:text-muted/70 focus:outline-none disabled:cursor-not-allowed"
      />
      {loading ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Parar"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-sm font-medium text-fg hover:border-muted/50"
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
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send size={17} />
        </button>
      )}
    </div>
  );
}
