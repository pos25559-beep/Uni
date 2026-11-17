import { ArrowLeft, Loader2 } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../../lib/uiHelpers';

export interface TocEntry {
  id: string;
  label: string;
  /** Contagens pequenas (por exemplo, nos tópicos do guia). */
  meta?: string;
  /** Abre um novo grupo no índice lateral (linha de separação por cima). */
  separated?: boolean;
  /** Nível de indentação no índice lateral (0 por omissão). */
  depth?: 0 | 1;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const secondaryCls = 'border-line bg-surface-2 text-fg hover:border-line-strong';
const actionCls =
  'inline-flex size-11 shrink-0 items-center justify-center gap-2 rounded-full border text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-45 sm:w-auto sm:px-4';

/** Ação do cabeçalho: só ícone no telemóvel, ícone e texto a partir de `sm`. */
export function ReaderAction({
  icon: Icon,
  label,
  onClick,
  busy,
  disabled,
  primary,
}: {
  icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  label: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={label}
      className={cx(actionCls, primary ? 'border-transparent bg-ink-cta text-ink-cta-fg hover:opacity-90' : secondaryCls)}
    >
      {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Icon size={16} aria-hidden />}
      <span className="sr-only sm:not-sr-only">{label}</span>
    </button>
  );
}

/**
 * Estrutura comum das páginas de leitura em ecrã inteiro (guia, quiz, resumo, podcast):
 * <dialog> modal (Escape fecha, foco entra e volta), cabeçalho fixo com voltar, título,
 * subtítulo e ações, índice opcional (coluna à esquerda em ≥1024px, pílulas no telemóvel)
 * e o corpo com rolagem. Fica por cima do Caderno, que também é um <dialog>.
 */
export default function ReaderShell({
  open,
  onClose,
  title,
  subtitle,
  actions,
  toc,
  tocLabel,
  tocTitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  toc?: TocEntry[];
  tocLabel?: string;
  tocTitle?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation('assistant');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const entries = toc ?? [];
  const hasToc = entries.length > 0;
  const [activeId, setActiveId] = useState<string>(entries[0]?.id ?? '');

  // Abrir: guarda o foco anterior, mostra o <dialog> e foca o botão de voltar.
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    closeRef.current?.focus();
    scrollRef.current?.scrollTo({ top: 0 });
    return () => {
      const target = previousFocusRef.current;
      previousFocusRef.current = null;
      if (target?.isConnected) requestAnimationFrame(() => target.focus());
    };
  }, [open]);

  // Secção atual: faixa estreita perto do topo; no fim da página, a última.
  useEffect(() => {
    const root = scrollRef.current;
    if (!open || !root || !hasToc) return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-toc-id]'));
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (hits) => {
        if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) return;
        const hit = hits
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActiveId((hit.target as HTMLElement).dataset.tocId ?? '');
      },
      { root, rootMargin: '-8% 0px -80% 0px', threshold: 0 },
    );
    sections.forEach((s) => observer.observe(s));
    const onScroll = () => {
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) {
        setActiveId(sections[sections.length - 1].dataset.tocId ?? '');
      }
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      root.removeEventListener('scroll', onScroll);
    };
  }, [open, hasToc, entries.length]);

  // Pílulas no telemóvel: mantém a ativa à vista.
  useEffect(() => {
    const row = pillsRef.current;
    const pill = row?.querySelector<HTMLElement>(`[data-pill="${CSS.escape(activeId)}"]`);
    if (!row || !pill) return;
    const target = pill.offsetLeft - (row.clientWidth - pill.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, target), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [activeId]);

  const goTo = useCallback((id: string) => {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }, []);

  if (!open) return null;

  const navLabel = tocLabel ?? t('notebook.reader.toc');

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      className="m-0 h-dvh max-h-none w-dvw max-w-none flex-col overflow-hidden border-0 bg-bg p-0 text-fg open:flex"
    >
      <header className="z-10 shrink-0 border-b border-line bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-6">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('notebook.reader.back')}
            className="grid size-11 shrink-0 place-items-center rounded-full text-fg transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ArrowLeft size={20} aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h1
              id={titleId}
              className="line-clamp-1 font-display text-base font-bold leading-tight tracking-tight sm:line-clamp-2 sm:text-lg"
            >
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted sm:text-sm" title={subtitle}>
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">{actions}</div>}
        </div>

        {hasToc && (
          <nav aria-label={navLabel} className="lg:hidden">
            <div
              ref={pillsRef}
              className="flex gap-2 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
            >
              {entries.map((entry) => {
                const active = entry.id === activeId;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    data-pill={entry.id}
                    aria-current={active ? 'true' : undefined}
                    onClick={() => goTo(entry.id)}
                    className={cx(
                      'min-h-11 max-w-[15rem] shrink-0 truncate rounded-full border px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                      active
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line bg-surface text-muted hover:text-fg',
                    )}
                  >
                    {entry.label}
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div
          className={cx(
            'mx-auto w-full px-4 pb-[max(4rem,env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pt-10',
            hasToc
              ? 'max-w-6xl lg:grid lg:grid-cols-[15rem_minmax(0,47.5rem)] lg:justify-center lg:gap-14'
              : 'max-w-[calc(47.5rem+3rem)]',
          )}
        >
          {hasToc && (
            <nav aria-label={navLabel} className="hidden lg:block">
              <div className="sticky top-8 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-1">
                {tocTitle && (
                  <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">{tocTitle}</p>
                )}
                <ul className="space-y-0.5">
                  {entries.map((entry, i) => {
                    const active = entry.id === activeId;
                    return (
                      <li key={entry.id} className={cx(entry.separated && i > 0 && 'mt-3 border-t border-line pt-3')}>
                        <button
                          type="button"
                          aria-current={active ? 'true' : undefined}
                          onClick={() => goTo(entry.id)}
                          className={cx(
                            'block min-h-11 w-full rounded-xl px-3 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                            entry.depth === 1 && 'pl-6',
                            active ? 'bg-accent-soft text-accent-ink' : 'text-muted hover:bg-surface-2 hover:text-fg',
                          )}
                        >
                          <span className={cx('block text-sm leading-snug', active ? 'font-semibold' : 'font-medium')}>
                            {entry.label}
                          </span>
                          {entry.meta && <span className="mt-0.5 block text-xs opacity-80">{entry.meta}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </nav>
          )}
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </dialog>
  );
}
