import { ArrowLeft, Copy, Download, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { topicCounts, type StudyGuide } from '../../lib/studyGuide';
import { cx } from '../../lib/uiHelpers';
import StudyGuideView, {
  GUIDE_CHECK_ID,
  GUIDE_PLAN_ID,
  GUIDE_TOPIC_ID,
  GUIDE_TRAPS_ID,
} from './StudyGuideView';

interface TocEntry {
  id: string;
  label: string;
  /** Contagens pequenas (só nos tópicos). */
  meta?: string;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function RefineForm({
  topicTitle,
  busy,
  disabled,
  onSubmit,
}: {
  topicTitle: string;
  busy: boolean;
  disabled: boolean;
  onSubmit: (instruction: string) => Promise<string | null>;
}) {
  const { t } = useTranslation('assistant');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inputId = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const instruction = value.trim();
    if (!instruction || busy || disabled) return;
    setError(null);
    setDone(false);
    const failure = await onSubmit(instruction);
    if (failure) {
      setError(failure);
    } else {
      setValue('');
      setDone(true);
    }
  };

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="mt-8 rounded-2xl border border-dashed border-line bg-surface-2/50 p-4"
    >
      <label htmlFor={inputId} className="flex items-center gap-2 text-sm font-semibold text-fg">
        <Wand2 size={15} className="text-accent-ink" aria-hidden />
        {t('notebook.reader.refineLabel')}
      </label>
      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
        <input
          id={inputId}
          type="text"
          value={value}
          maxLength={400}
          disabled={busy}
          onChange={(e) => {
            setValue(e.target.value);
            setDone(false);
          }}
          placeholder={t('notebook.reader.refinePlaceholder')}
          aria-label={`${t('notebook.reader.refineLabel')}: ${topicTitle}`}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-base text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-60 sm:text-sm"
        />
        <button
          type="submit"
          disabled={!value.trim() || busy || disabled}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-ink-cta px-4 text-sm font-semibold text-ink-cta-fg transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-45"
        >
          {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Sparkles size={15} aria-hidden />}
          {busy ? t('notebook.reader.refineBusy') : t('notebook.reader.refineBtn')}
        </button>
      </div>
      <div role="status" aria-live="polite">
        {error && <p className="mt-2 rounded-lg bg-coral-soft px-3 py-2 text-sm font-medium text-coral">{error}</p>}
        {done && !error && <p className="mt-2 text-sm font-medium text-accent-ink">{t('notebook.reader.refineDone')}</p>}
      </div>
    </form>
  );
}

/**
 * Leitor do guia de estudo em ecrã inteiro (como o guia do NotebookLM): cabeçalho fixo com
 * ações, índice lateral no desktop e em pílulas no telemóvel, texto numa coluna confortável.
 * É um <dialog> modal: fica por cima do Caderno (que também é um <dialog>) e traz Escape e
 * armadilha de foco de origem.
 */
export default function StudyGuideReader({
  open,
  guide,
  courseName,
  onClose,
  onCopy,
  onExportPdf,
  exportingPdf,
  onUseInTutor,
  onRefineTopic,
}: {
  open: boolean;
  guide: StudyGuide;
  courseName?: string;
  onClose: () => void;
  onCopy: () => void;
  onExportPdf: () => void;
  exportingPdf: boolean;
  onUseInTutor: () => void;
  /** Devolve null se correu bem, ou a mensagem de erro a mostrar no tópico. */
  onRefineTopic: (idx: number, instruction: string) => Promise<string | null>;
}) {
  const { t } = useTranslation('assistant');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [activeId, setActiveId] = useState<string>(GUIDE_TOPIC_ID(0));
  const [busyTopic, setBusyTopic] = useState<number | null>(null);

  const title = guide.title.trim() || t('notebook.reader.fallbackTitle');

  const toc = useMemo<TocEntry[]>(() => {
    const entries: TocEntry[] = guide.topics.map((topic, idx) => {
      const c = topicCounts(topic);
      const meta = [
        c.formulas > 0 && t('notebook.reader.formulasCount', { count: c.formulas }),
        c.example > 0 && t('notebook.reader.exampleCount', { count: c.example }),
        c.questions > 0 && t('notebook.reader.questionsCount', { count: c.questions }),
      ]
        .filter(Boolean)
        .join(' · ');
      return { id: GUIDE_TOPIC_ID(idx), label: topic.title, ...(meta ? { meta } : {}) };
    });
    if (guide.examTraps.length) entries.push({ id: GUIDE_TRAPS_ID, label: t('notebook.guide.examTraps') });
    if (guide.revisionPlan.length) entries.push({ id: GUIDE_PLAN_ID, label: t('notebook.guide.revisionPlan') });
    if (guide.selfCheck.length) entries.push({ id: GUIDE_CHECK_ID, label: t('notebook.guide.selfCheck') });
    return entries;
  }, [guide, t]);

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
    if (!open || !root) return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-toc-id]'));
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) return;
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
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
  }, [open, guide.topics.length, guide.examTraps.length, guide.revisionPlan.length, guide.selfCheck.length]);

  // Pílulas no telemóvel: mantém a ativa à vista.
  useEffect(() => {
    const row = pillsRef.current;
    const pill = row?.querySelector<HTMLElement>(`[data-pill="${activeId}"]`);
    if (!row || !pill) return;
    const target = pill.offsetLeft - (row.clientWidth - pill.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, target), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [activeId]);

  const goTo = useCallback((id: string) => {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }, []);

  const refine = useCallback(
    async (idx: number, instruction: string) => {
      setBusyTopic(idx);
      try {
        return await onRefineTopic(idx, instruction);
      } finally {
        setBusyTopic(null);
      }
    },
    [onRefineTopic],
  );

  if (!open) return null;

  const secondaryCls = 'border-line bg-surface-2 text-fg hover:border-line-strong';
  const actionCls =
    'inline-flex size-11 shrink-0 items-center justify-center gap-2 rounded-full border text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-45 sm:w-auto sm:px-4';

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
            <h1 id={titleId} className="line-clamp-1 font-display sm:line-clamp-2 text-base font-bold leading-tight tracking-tight sm:text-lg">
              {title}
            </h1>
            {(guide.goal || courseName) && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted sm:text-sm" title={guide.goal || courseName}>
                {guide.goal || courseName}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button type="button" onClick={onCopy} title={t('notebook.copyMd')} className={cx(actionCls, secondaryCls)}>
              <Copy size={16} aria-hidden />
              <span className="sr-only sm:not-sr-only">{t('notebook.copyMd')}</span>
            </button>
            <button
              type="button"
              onClick={onExportPdf}
              disabled={exportingPdf}
              title={t('notebook.pdfExport')}
              className={cx(actionCls, secondaryCls)}
            >
              {exportingPdf ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />}
              <span className="sr-only sm:not-sr-only">{exportingPdf ? t('notebook.pdfBusy') : t('notebook.pdfExport')}</span>
            </button>
            <button
              type="button"
              onClick={onUseInTutor}
              title={t('notebook.useInTutor')}
              className={cx(actionCls, 'border-transparent bg-ink-cta text-ink-cta-fg hover:opacity-90')}
            >
              <Sparkles size={16} aria-hidden />
              <span className="sr-only sm:not-sr-only">{t('notebook.useInTutor')}</span>
            </button>
          </div>
        </div>

        <nav aria-label={t('notebook.reader.toc')} className="lg:hidden">
          <div
            ref={pillsRef}
            className="flex gap-2 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
          >
            {toc.map((entry) => {
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
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-6xl px-4 pb-[max(4rem,env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pt-10 lg:grid lg:grid-cols-[15rem_minmax(0,47.5rem)] lg:justify-center lg:gap-14">
          <nav aria-label={t('notebook.reader.toc')} className="hidden lg:block">
            <div className="sticky top-8 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-1">
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                {t('notebook.reader.tocTitle')}
              </p>
              <ul className="space-y-0.5">
                {toc.map((entry, i) => {
                  const active = entry.id === activeId;
                  const firstExtra = i > 0 && entry.id === toc.find((x) => !x.id.startsWith('sg-topic-'))?.id;
                  return (
                    <li key={entry.id} className={cx(firstExtra && 'mt-3 border-t border-line pt-3')}>
                      <button
                        type="button"
                        aria-current={active ? 'true' : undefined}
                        onClick={() => goTo(entry.id)}
                        className={cx(
                          'block min-h-11 w-full rounded-xl px-3 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
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

          <main className="min-w-0">
            <StudyGuideView
              guide={guide}
              variant="reader"
              busyTopic={busyTopic}
              topicFooter={(idx) => (
                <RefineForm
                  topicTitle={guide.topics[idx].title}
                  busy={busyTopic === idx}
                  disabled={busyTopic !== null}
                  onSubmit={(instruction) => refine(idx, instruction)}
                />
              )}
            />
          </main>
        </div>
      </div>
    </dialog>
  );
}
