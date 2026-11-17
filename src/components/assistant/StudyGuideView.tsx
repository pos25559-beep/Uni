import { Square, SquareCheckBig, X } from 'lucide-react';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  asDisplayMath,
  formatSourceChip,
  splitCitations,
  topicCounts,
  type StudyGuide,
  type StudyGuideCheck,
  type StudyGuideSource,
  type StudyGuideTopic,
} from '../../lib/studyGuide';
import { cx } from '../../lib/uiHelpers';
import { Badge } from '../ui';
import { Markdown } from './Markdown';

/** «reader»: leitura em ecrã inteiro. «print»: PDF (tudo aberto, blocos marcados com data-guide-block). */
type Variant = 'reader' | 'print';

/** Ids das secções, usados pelo índice do leitor. */
export const GUIDE_TOPIC_ID = (idx: number) => `sg-topic-${idx}`;
export const GUIDE_TRAPS_ID = 'sg-traps';
export const GUIDE_PLAN_ID = 'sg-plan';
export const GUIDE_CHECK_ID = 'sg-check';

interface CitationInfo {
  n: number;
  source: StudyGuideSource;
}
const CitationContext = createContext<((info: CitationInfo, el: HTMLElement) => void) | null>(null);

/** Texto com citações «[1]» a pílulas (leitor) ou a números em expoente (PDF). */
function Rich({
  text,
  sources = [],
  variant,
}: {
  text: string;
  sources?: StudyGuideSource[];
  variant: Variant;
}) {
  const { t } = useTranslation('assistant');
  const openCitation = useContext(CitationContext);
  const pageLabel = (page: string) => t('notebook.guide.page', { page });

  const blocks = useMemo(
    () =>
      text.split(/\n{2,}/).map((block) => ({
        block,
        segments: splitCitations(block, sources.length),
      })),
    [text, sources.length],
  );
  if (!blocks.some((b) => b.segments.some((s) => s.type === 'cite'))) return <Markdown text={text} />;

  return (
    <div className="space-y-4 break-words text-sm leading-relaxed [&>div]:[font-size:inherit] [&>div]:[line-height:inherit]">
      {blocks.map(({ block, segments }, bi) => {
        if (!segments.some((s) => s.type === 'cite')) return <Markdown key={bi} text={block} />;
        return (
          <div key={bi}>
            {segments.map((seg, si) => {
              if (seg.type === 'text') {
                if (!seg.text.trim()) return seg.text ? ' ' : null;
                const nextCite = segments[si + 1]?.type === 'cite';
                return (
                  <span
                    key={si}
                    className="[&>div]:inline [&>div]:[font-size:inherit] [&>div]:[line-height:inherit] [&>div>p]:inline"
                  >
                    <Markdown text={nextCite ? seg.text.trimEnd() : seg.text} />
                  </span>
                );
              }
              return seg.numbers.map((n) => {
                const source = sources[n - 1];
                if (variant === 'print' || !openCitation) {
                  return (
                    <sup key={`${si}-${n}`} className="mx-px text-xs font-semibold text-accent-ink">
                      {n}
                    </sup>
                  );
                }
                return (
                  <button
                    key={`${si}-${n}`}
                    type="button"
                    aria-label={t('notebook.reader.sourceAria', {
                      n,
                      source: formatSourceChip(source, pageLabel),
                    })}
                    onClick={(e) => openCitation({ n, source }, e.currentTarget)}
                    className="relative mx-px inline-flex min-w-5 -translate-y-1 items-center justify-center rounded-full bg-accent-soft px-1.5 align-baseline text-xs font-semibold leading-5 text-accent-ink transition after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-[''] hover:bg-accent hover:text-accent-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {n}
                  </button>
                );
              });
            })}
          </div>
        );
      })}
    </div>
  );
}

function BulletList({
  items,
  sources,
  variant,
  tone = 'accent',
}: {
  items: string[];
  sources?: StudyGuideSource[];
  variant: Variant;
  tone?: 'accent' | 'coral';
}) {
  const reader = variant === 'reader';
  return (
    <ul className={cx('text-fg', reader ? 'space-y-3' : 'space-y-1.5 text-sm')}>
      {items.map((item, i) => (
        <li key={`${i}-${item.slice(0, 24)}`} className="flex gap-3">
          <span
            aria-hidden
            className={cx(
              'shrink-0 rounded-full',
              tone === 'coral' ? 'bg-coral' : 'bg-accent',
              reader ? 'mt-[0.7rem] size-1.5' : 'mt-2 size-1.5',
            )}
          />
          <div className={cx('min-w-0 flex-1', reader && READER_PROSE)}>
            <Rich text={item} sources={sources} variant={variant} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Tipografia de leitura sobre o Markdown (que traz text-sm e espaçamento apertado). */
const READER_PROSE = '[&>div]:space-y-4 [&>div]:text-base [&>div]:leading-[1.75]';

function SectionLabel({ children, variant }: { children: string; variant: Variant }) {
  if (variant === 'reader') {
    return <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">{children}</h3>;
  }
  return <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{children}</p>;
}

function QaList({
  items,
  variant,
  sources,
}: {
  items: StudyGuideCheck[];
  variant: Variant;
  sources?: StudyGuideSource[];
}) {
  const { t } = useTranslation('assistant');
  const [shown, setShown] = useState<Record<number, boolean>>({});
  const reader = variant === 'reader';
  return (
    <ol className={reader ? 'space-y-3' : 'space-y-2'}>
      {items.map((c, i) => {
        const visible = variant === 'print' || Boolean(shown[i]);
        return (
          <li
            key={`${i}-${c.question.slice(0, 24)}`}
            data-guide-block
            className={cx('rounded-2xl border border-line bg-surface', reader ? 'p-4' : 'p-3')}
          >
            <div className="flex gap-2.5 font-medium text-fg">
              <span className="tabular shrink-0 font-mono text-muted">{i + 1}.</span>
              <div className={cx('min-w-0 flex-1', reader ? READER_PROSE : 'text-sm')}>
                <Rich text={c.question} sources={sources} variant={variant} />
              </div>
            </div>
            {reader && (
              <button
                type="button"
                aria-expanded={visible}
                onClick={() => setShown((prev) => ({ ...prev, [i]: !visible }))}
                className="mt-2 inline-flex min-h-11 items-center rounded-full border border-line bg-surface-2 px-4 text-sm font-semibold text-accent-ink transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {visible ? t('notebook.guide.hideAnswer') : t('notebook.guide.showAnswer')}
              </button>
            )}
            {visible && (
              <div
                className={cx(
                  'mt-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-fg',
                  reader ? READER_PROSE : 'text-sm',
                )}
              >
                {variant === 'print' && (
                  <span className="mr-1 font-semibold text-muted">{t('notebook.guide.answer')}:</span>
                )}
                <Rich text={c.answer} sources={sources} variant={variant} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function TopicBody({ topic, variant }: { topic: StudyGuideTopic; variant: Variant }) {
  const { t } = useTranslation('assistant');
  const reader = variant === 'reader';
  const pageLabel = (page: string) => t('notebook.guide.page', { page });
  const ex = topic.workedExample;
  const src = topic.sources;
  const prose = reader ? READER_PROSE : 'text-sm';
  return (
    <div className={reader ? 'space-y-9' : 'space-y-3.5'}>
      {topic.summary && (
        <div data-guide-block className={cx('text-fg', reader ? cx(prose, 'text-pretty') : 'text-sm leading-relaxed')}>
          <Rich text={topic.summary} sources={src} variant={variant} />
        </div>
      )}

      {topic.keyIdeas.length > 0 && (
        <div data-guide-block>
          <SectionLabel variant={variant}>{t('notebook.guide.keyIdeas')}</SectionLabel>
          <BulletList items={topic.keyIdeas} sources={src} variant={variant} />
        </div>
      )}

      {topic.formulaDetails && topic.formulaDetails.length > 0 ? (
        <div>
          <SectionLabel variant={variant}>{t('notebook.guide.formulas')}</SectionLabel>
          <div className={reader ? 'space-y-4' : 'space-y-2'}>
            {topic.formulaDetails.map((f, i) => (
              <div
                key={`${i}-${f.latex.slice(0, 24)}`}
                data-guide-block
                className={cx(
                  reader
                    ? 'rounded-2xl border border-line bg-surface p-4 sm:p-5'
                    : 'rounded-xl bg-surface-2 px-3 py-2.5 text-sm',
                )}
              >
                <div
                  className={cx(
                    'overflow-x-auto',
                    reader &&
                      'rounded-xl bg-surface-2 px-3 py-3 [&_div.overflow-x-auto]:border-transparent [&_div.overflow-x-auto]:bg-transparent [&_div.overflow-x-auto]:p-0 [&_.katex]:text-[1.12em]',
                  )}
                >
                  <Markdown text={asDisplayMath(f.latex)} />
                </div>
                {f.meaning && (
                  <div className={cx('text-fg', reader ? cx('mt-3', prose) : 'mt-1')}>
                    <Rich text={f.meaning} sources={src} variant={variant} />
                  </div>
                )}
                {(f.units || f.validity) && (
                  <div
                    className={cx(
                      'text-muted',
                      reader ? 'mt-3 flex flex-wrap gap-2 text-sm' : 'mt-1.5 space-y-0.5 text-xs',
                    )}
                  >
                    {f.units && (
                      <p className={reader ? 'rounded-lg bg-surface-2 px-2.5 py-1' : undefined}>
                        <span className="font-semibold">{t('notebook.guide.units')}: </span>
                        {f.units}
                      </p>
                    )}
                    {f.validity && (
                      <p className={reader ? 'rounded-lg bg-surface-2 px-2.5 py-1' : undefined}>
                        <span className="font-semibold">{t('notebook.guide.validity')}: </span>
                        {f.validity}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        topic.formulas.length > 0 && (
          <div data-guide-block>
            <SectionLabel variant={variant}>{t('notebook.guide.formulas')}</SectionLabel>
            <div
              className={cx(
                'space-y-1.5 overflow-x-auto text-sm',
                reader
                  ? 'rounded-2xl border border-line bg-surface p-4 sm:p-5'
                  : 'rounded-xl bg-surface-2 px-3 py-2',
              )}
            >
              {topic.formulas.map((f, i) => (
                <Markdown key={`${i}-${f.slice(0, 24)}`} text={asDisplayMath(f)} />
              ))}
            </div>
          </div>
        )
      )}

      {ex && (
        <div
          data-guide-block
          className={cx(
            'border border-accent/30 bg-accent-soft/40',
            reader ? 'rounded-2xl p-4 sm:p-5' : 'rounded-2xl p-3',
          )}
        >
          <SectionLabel variant={variant}>{t('notebook.guide.workedExample')}</SectionLabel>
          <div className={cx('font-medium text-fg', prose)}>
            <Rich text={ex.statement} sources={src} variant={variant} />
          </div>
          <ol className={cx('text-fg', reader ? 'mt-4 space-y-3' : 'mt-2 space-y-1.5 text-sm')}>
            {ex.steps.map((step, i) => (
              <li key={`${i}-${step.slice(0, 24)}`} className="flex gap-3">
                {reader ? (
                  <span
                    aria-hidden
                    className="tabular mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-surface font-mono text-xs font-semibold text-accent-ink"
                  >
                    {i + 1}
                  </span>
                ) : (
                  <span className="tabular shrink-0 font-mono text-xs leading-6 text-muted">{i + 1}</span>
                )}
                <div className={cx('min-w-0 flex-1', prose)}>
                  <Rich text={step} sources={src} variant={variant} />
                </div>
              </li>
            ))}
          </ol>
          {ex.result && (
            <div
              className={cx(
                'mt-3 rounded-xl bg-surface px-3.5 py-2.5 font-semibold text-fg',
                reader ? READER_PROSE : 'text-sm',
              )}
            >
              <Rich text={ex.result} sources={src} variant={variant} />
            </div>
          )}
          {ex.source && (
            <p className="mt-2 text-xs text-muted">{formatSourceChip(ex.source, pageLabel)}</p>
          )}
        </div>
      )}

      {topic.examPattern && (
        <div data-guide-block className={reader ? 'border-l-2 border-accent pl-4' : undefined}>
          <SectionLabel variant={variant}>{t('notebook.guide.examPattern')}</SectionLabel>
          <div className={cx('text-fg', prose)}>
            <Rich text={topic.examPattern} sources={src} variant={variant} />
          </div>
        </div>
      )}

      {topic.pitfalls.length > 0 && (
        <div
          data-guide-block
          className={reader ? 'rounded-2xl border border-coral/30 bg-coral-soft/50 p-4 sm:p-5' : undefined}
        >
          <SectionLabel variant={variant}>{t('notebook.guide.pitfalls')}</SectionLabel>
          <BulletList items={topic.pitfalls} sources={src} variant={variant} tone={reader ? 'coral' : 'accent'} />
        </div>
      )}

      {topic.practice && topic.practice.length > 0 && (
        <div>
          <SectionLabel variant={variant}>{t('notebook.guide.practice')}</SectionLabel>
          <QaList items={topic.practice} variant={variant} sources={src} />
        </div>
      )}

      {src.length > 0 &&
        (reader || variant === 'print' ? (
          <div data-guide-block>
            <SectionLabel variant={variant}>{t('notebook.guide.sources')}</SectionLabel>
            <ol className={cx('space-y-1 text-muted', reader ? 'text-sm' : 'text-xs')}>
              {src.map((s, i) => (
                <li key={`${i}-${s.title}`} className="flex gap-2">
                  <span className="tabular w-5 shrink-0 text-right font-mono font-semibold text-accent-ink">{i + 1}</span>
                  <span className="min-w-0 break-words">{formatSourceChip(s, pageLabel)}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {src.map((s, i) => (
              <Badge key={`${i}-${s.title}`} tone="accent">
                {formatSourceChip(s, pageLabel)}
              </Badge>
            ))}
          </div>
        ))}
    </div>
  );
}

/** Folha de fonte que abre ao tocar numa citação. */
function CitationSheet({ info, onClose }: { info: CitationInfo; onClose: () => void }) {
  const { t } = useTranslation('assistant');
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <>
      <div aria-hidden className="fixed inset-0 z-20 bg-black/25" onClick={onClose} />
      <div
        role="dialog"
        aria-label={t('notebook.reader.sourceLabel', { n: info.n })}
        className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md rounded-t-[26px] border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-fg shadow-float sm:bottom-6 sm:rounded-[24px]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent-ink">
              {t('notebook.reader.sourceLabel', { n: info.n })}
            </p>
            <p className="mt-1 break-words text-base font-semibold">{info.source.title}</p>
            {info.source.page && (
              <p className="mt-0.5 text-sm text-muted">{t('notebook.guide.page', { page: info.source.page })}</p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('notebook.reader.sourceClose')}
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
      </div>
    </>
  );
}

function CountChips({ topic }: { topic: StudyGuideTopic }) {
  const { t } = useTranslation('assistant');
  const c = topicCounts(topic);
  const chips = [
    c.formulas > 0 && t('notebook.reader.formulasCount', { count: c.formulas }),
    c.example > 0 && t('notebook.reader.exampleCount', { count: c.example }),
    c.questions > 0 && t('notebook.reader.questionsCount', { count: c.questions }),
  ].filter(Boolean) as string[];
  if (chips.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <li key={chip} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">
          {chip}
        </li>
      ))}
    </ul>
  );
}

/**
 * Guia de estudo estruturado. «reader» é a leitura em ecrã inteiro (todos os tópicos abertos,
 * citações clicáveis); «print» alimenta o PDF (cada bloco marcado com data-guide-block para a
 * paginação não cortar a meio).
 */
export default function StudyGuideView({
  guide,
  variant = 'reader',
  topicFooter,
  busyTopic = null,
}: {
  guide: StudyGuide;
  variant?: Variant;
  /** Só no leitor: conteúdo no fim de cada tópico (pedir alteração). */
  topicFooter?: (idx: number) => ReactNode;
  busyTopic?: number | null;
}) {
  const { t } = useTranslation('assistant');
  const [doneSteps, setDoneSteps] = useState<Record<number, boolean>>({});
  const [citation, setCitation] = useState<CitationInfo | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const print = variant === 'print';
  const reader = !print;

  const openCitation = useMemo(
    () => (info: CitationInfo, el: HTMLElement) => {
      triggerRef.current = el;
      setCitation(info);
    },
    [],
  );
  const closeCitation = useMemo(
    () => () => {
      setCitation(null);
      const el = triggerRef.current;
      if (el?.isConnected) requestAnimationFrame(() => el.focus());
    },
    [],
  );

  return (
    <CitationContext.Provider value={reader ? openCitation : null}>
      <div className={reader ? 'space-y-14' : 'space-y-4'}>
        {print && guide.title && (
          <h1 data-guide-block className="text-xl font-bold tracking-tight text-fg">
            {guide.title}
          </h1>
        )}
        {guide.goal && (
          <p
            data-guide-block
            className={cx(
              'bg-accent-soft font-medium text-accent-ink',
              reader ? 'rounded-2xl px-5 py-4 text-base leading-relaxed' : 'rounded-2xl px-3.5 py-3 text-sm',
            )}
          >
            <span className="font-bold">{t('notebook.guide.goal')}: </span>
            {guide.goal}
          </p>
        )}

        <div className={reader ? 'space-y-14' : 'space-y-2'}>
          {guide.topics.map((topic, idx) => {
            const busy = busyTopic === idx;
            return reader ? (
              <section
                key={`${idx}-${topic.title}`}
                id={GUIDE_TOPIC_ID(idx)}
                data-toc-id={GUIDE_TOPIC_ID(idx)}
                aria-labelledby={`${GUIDE_TOPIC_ID(idx)}-h`}
                aria-busy={busy}
                className="scroll-mt-4"
              >
                <header className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent-ink">
                    {t('notebook.reader.topicOf', { n: idx + 1, total: guide.topics.length })}
                  </p>
                  <h2
                    id={`${GUIDE_TOPIC_ID(idx)}-h`}
                    className="mt-1.5 text-balance font-display text-2xl font-bold tracking-tight text-fg sm:text-[1.75rem] sm:leading-tight"
                  >
                    {topic.title}
                  </h2>
                  <CountChips topic={topic} />
                </header>
                <div className={cx('transition-opacity', busy && 'pointer-events-none opacity-50')}>
                  <TopicBody topic={topic} variant={variant} />
                </div>
                {topicFooter?.(idx)}
              </section>
            ) : (
              <section key={`${idx}-${topic.title}`} className="rounded-2xl border border-line bg-surface">
                <h2 data-guide-block className="px-3.5 pt-3 text-base font-bold text-fg">
                  {topic.title}
                </h2>
                <div className="px-3.5 py-3">
                  <TopicBody topic={topic} variant={variant} />
                </div>
              </section>
            );
          })}
        </div>

        {guide.examTraps.length > 0 && (
          <section
            id={GUIDE_TRAPS_ID}
            data-toc-id={GUIDE_TRAPS_ID}
            data-guide-block
            aria-labelledby={`${GUIDE_TRAPS_ID}-h`}
            className={cx(
              reader
                ? 'scroll-mt-4 rounded-3xl border border-coral/30 bg-coral-soft/50 p-5 sm:p-6'
                : 'rounded-2xl border border-line bg-surface-2/60 p-3.5',
            )}
          >
            {reader ? (
              <h2
                id={`${GUIDE_TRAPS_ID}-h`}
                className="mb-4 font-display text-xl font-bold tracking-tight text-fg"
              >
                {t('notebook.guide.examTraps')}
              </h2>
            ) : (
              <SectionLabel variant={variant}>{t('notebook.guide.examTraps')}</SectionLabel>
            )}
            <BulletList items={guide.examTraps} variant={variant} tone={reader ? 'coral' : 'accent'} />
          </section>
        )}

        {guide.revisionPlan.length > 0 && (
          <section
            id={GUIDE_PLAN_ID}
            data-toc-id={GUIDE_PLAN_ID}
            aria-labelledby={`${GUIDE_PLAN_ID}-h`}
            className="scroll-mt-4"
          >
            {reader ? (
              <h2
                id={`${GUIDE_PLAN_ID}-h`}
                className="mb-4 font-display text-xl font-bold tracking-tight text-fg"
              >
                {t('notebook.guide.revisionPlan')}
              </h2>
            ) : (
              <SectionLabel variant={variant}>{t('notebook.guide.revisionPlan')}</SectionLabel>
            )}
            <ul className="space-y-2">
              {guide.revisionPlan.map((step, i) => {
                const done = !print && Boolean(doneSteps[i]);
                const body = (
                  <>
                    {done ? (
                      <SquareCheckBig size={20} className="mt-0.5 shrink-0 text-accent" />
                    ) : (
                      <Square size={20} className="mt-0.5 shrink-0 text-muted" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted">
                        {step.day && <span>{step.day}</span>}
                        {step.minutes > 0 && <Badge>{t('notebook.guide.minutes', { count: step.minutes })}</Badge>}
                      </span>
                      <span className={cx('block text-sm text-fg', reader && 'text-base', done && 'text-muted line-through')}>
                        {step.task}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li key={`${i}-${step.task.slice(0, 24)}`} data-guide-block>
                    {print ? (
                      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2">{body}</div>
                    ) : (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={done}
                        aria-label={t('notebook.guide.doneStep', { task: step.task })}
                        onClick={() => setDoneSteps((prev) => ({ ...prev, [i]: !done }))}
                        className="flex min-h-11 w-full items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {guide.selfCheck.length > 0 && (
          <section
            id={GUIDE_CHECK_ID}
            data-toc-id={GUIDE_CHECK_ID}
            aria-labelledby={`${GUIDE_CHECK_ID}-h`}
            className="scroll-mt-4"
          >
            {reader ? (
              <h2
                id={`${GUIDE_CHECK_ID}-h`}
                className="mb-4 font-display text-xl font-bold tracking-tight text-fg"
              >
                {t('notebook.guide.selfCheck')}
              </h2>
            ) : (
              <SectionLabel variant={variant}>{t('notebook.guide.selfCheck')}</SectionLabel>
            )}
            <QaList items={guide.selfCheck} variant={variant} />
          </section>
        )}
      </div>
      {citation && <CitationSheet info={citation} onClose={closeCitation} />}
    </CitationContext.Provider>
  );
}
