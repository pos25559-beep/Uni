import { Copy, Download, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  isAnswersHeading,
  markdownHeadings,
  markdownTitle,
  splitAnswerItems,
  splitMarkdownSections,
  type MarkdownSection,
} from '../../../lib/markdownSections';
import type { TopicSheetMode } from '../../../lib/localDb';
import { cx } from '../../../lib/uiHelpers';
import { Markdown } from '../Markdown';
import ReaderShell, { ReaderAction, type TocEntry } from './ReaderShell';

/** Tipografia de leitura: corpo maior, entrelinha folgada e espaço entre blocos. */
const PROSE =
  'text-base leading-7 text-fg [&>*+*]:mt-4 [&>div]:space-y-4 [&>div]:text-base [&>div]:leading-7 [&_li]:leading-7 [&_p]:text-pretty';

function SectionHeading({ section }: { section: MarkdownSection }) {
  const h = section.heading;
  if (!h) return null;
  const Tag = h.level === 2 ? 'h2' : 'h3';
  return (
    <Tag
      className={cx(
        'scroll-mt-4 font-display font-bold leading-snug tracking-tight text-fg',
        h.level === 2 ? 'text-xl sm:text-2xl' : 'text-lg',
      )}
    >
      {h.text}
    </Tag>
  );
}

function AnswersBlock({ body, label }: { body: string; label: (n: number) => string }) {
  const items = useMemo(() => splitAnswerItems(body), [body]);
  if (!items) return <Markdown text={body} />;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <details key={item.n} className="group rounded-2xl border border-line bg-surface-2/60 open:bg-surface">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-2 text-sm font-semibold text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
            <span>{label(item.n)}</span>
            <span
              aria-hidden
              className="text-lg leading-none text-muted transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div className={cx('border-t border-line px-4 py-3', PROSE)}>
            <Markdown text={item.text} />
          </div>
        </details>
      ))}
    </div>
  );
}

/**
 * Página de leitura para o Quiz e o Resumo: o Markdown guardado na ficha, com índice a partir
 * dos títulos e, no quiz, as respostas escondidas atrás de «Ver resposta» quando a estrutura
 * o permite.
 */
export default function MarkdownReader({
  open,
  markdown,
  mode,
  fallbackTitle,
  courseName,
  onClose,
  onCopy,
  onExportPdf,
  exportingPdf,
  onUseInTutor,
}: {
  open: boolean;
  markdown: string;
  mode: TopicSheetMode;
  fallbackTitle: string;
  courseName?: string;
  onClose: () => void;
  onCopy: () => void;
  onExportPdf: () => void;
  exportingPdf: boolean;
  onUseInTutor: () => void;
}) {
  const { t } = useTranslation('assistant');
  const title = markdownTitle(markdown) || fallbackTitle;
  const sections = useMemo(() => splitMarkdownSections(markdown), [markdown]);
  const toc = useMemo<TocEntry[]>(
    () =>
      markdownHeadings(markdown).map((h) => ({
        id: h.id,
        label: h.text,
        depth: h.level === 3 ? 1 : 0,
      })),
    [markdown],
  );
  const subtitle = [t(`notebook.mode.${mode}`), courseName].filter(Boolean).join(' · ');

  return (
    <ReaderShell
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      toc={toc.length >= 2 ? toc : undefined}
      tocLabel={t('notebook.reader.tocDoc')}
      tocTitle={t('notebook.reader.tocTitleDoc')}
      actions={
        <>
          <ReaderAction icon={Copy} label={t('notebook.copyMd')} onClick={onCopy} />
          <ReaderAction
            icon={Download}
            label={exportingPdf ? t('notebook.pdfBusy') : t('notebook.pdfExport')}
            onClick={onExportPdf}
            busy={exportingPdf}
          />
          <ReaderAction icon={Sparkles} label={t('notebook.useInTutor')} onClick={onUseInTutor} primary />
        </>
      }
    >
      <article className="space-y-8">
        {sections.map((section, idx) => {
          const isAnswers = mode === 'quiz' && section.heading && isAnswersHeading(section.heading.text);
          return (
            <section
              key={section.heading?.id ?? `intro-${idx}`}
              id={section.heading?.id}
              data-toc-id={section.heading?.id}
              className={cx('scroll-mt-4', PROSE)}
            >
              <SectionHeading section={section} />
              {section.body &&
                (isAnswers ? (
                  <AnswersBlock body={section.body} label={(n) => t('notebook.reader.showAnswer', { n })} />
                ) : (
                  <Markdown text={section.body} />
                ))}
            </section>
          );
        })}
      </article>
    </ReaderShell>
  );
}
