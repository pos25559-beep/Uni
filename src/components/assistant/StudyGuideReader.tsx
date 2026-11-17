import { Copy, Download, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useCallback, useId, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { topicCounts, type StudyGuide } from '../../lib/studyGuide';
import { ListenButton } from '../audio/ListenButton';
import {
  studyGuideSpeechMarkdown,
  studyGuideTopicSpeechMarkdown,
  type GuideSpeechLabels,
} from '../audio/speechText';
import StudyGuideView, {
  GUIDE_CHECK_ID,
  GUIDE_PLAN_ID,
  GUIDE_TOPIC_ID,
  GUIDE_TRAPS_ID,
} from './StudyGuideView';
import ReaderShell, { ReaderAction, type TocEntry } from './reader/ReaderShell';

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
 * A estrutura (dialog, índice, cabeçalho) vem do ReaderShell, partilhado com as outras páginas.
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
  const { t: tc } = useTranslation('common');
  const speechLabels = useMemo<GuideSpeechLabels>(
    () => ({
      keyIdeas: t('notebook.guide.keyIdeas'),
      formulas: t('notebook.guide.formulas'),
      workedExample: t('notebook.guide.workedExample'),
      pitfalls: t('notebook.guide.pitfalls'),
    }),
    [t],
  );
  const guideSpeech = useMemo(() => studyGuideSpeechMarkdown(guide, speechLabels), [guide, speechLabels]);
  const guideSourceId = useId();
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
    const extras: TocEntry[] = [];
    if (guide.examTraps.length) extras.push({ id: GUIDE_TRAPS_ID, label: t('notebook.guide.examTraps') });
    if (guide.revisionPlan.length) extras.push({ id: GUIDE_PLAN_ID, label: t('notebook.guide.revisionPlan') });
    if (guide.selfCheck.length) extras.push({ id: GUIDE_CHECK_ID, label: t('notebook.guide.selfCheck') });
    if (extras.length) extras[0] = { ...extras[0], separated: true };
    return [...entries, ...extras];
  }, [guide, t]);

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

  return (
    <ReaderShell
      open={open}
      onClose={onClose}
      title={title}
      subtitle={guide.goal || courseName}
      toc={toc}
      tocLabel={t('notebook.reader.toc')}
      tocTitle={t('notebook.reader.tocTitle')}
      actions={
        <>
          <ListenButton
            sourceId={`guide:${guideSourceId}`}
            text={guideSpeech}
            size="sm"
            label={tc('audio.listenGuide')}
            className="border border-line bg-surface-2 !text-fg hover:border-line-strong"
          />
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
      <StudyGuideView
        guide={guide}
        variant="reader"
        busyTopic={busyTopic}
        topicFooter={(idx) => (
          <>
            <div className="mt-6 flex items-center gap-2 border-t border-line pt-3">
              <ListenButton
                sourceId={`guide:${guideSourceId}:topic:${idx}`}
                text={studyGuideTopicSpeechMarkdown(guide.topics[idx], speechLabels)}
                label={tc('audio.listenTopic', { title: guide.topics[idx].title })}
              />
            </div>
            <RefineForm
              topicTitle={guide.topics[idx].title}
              busy={busyTopic === idx}
              disabled={busyTopic !== null}
              onSubmit={(instruction) => refine(idx, instruction)}
            />
          </>
        )}
      />
    </ReaderShell>
  );
}
