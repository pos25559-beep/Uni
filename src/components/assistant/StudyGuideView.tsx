import { ChevronDown, Square, SquareCheckBig } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  asDisplayMath,
  formatSourceChip,
  type StudyGuide,
  type StudyGuideCheck,
  type StudyGuideTopic,
} from '../../lib/studyGuide';
import { cx } from '../../lib/uiHelpers';
import { Badge } from '../ui';
import { Markdown } from './Markdown';

type Variant = 'interactive' | 'print';

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-sm text-fg">
      {items.map((item, i) => (
        <li key={`${i}-${item.slice(0, 24)}`} className="flex gap-2">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
          <div className="min-w-0 flex-1">
            <Markdown text={item} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{children}</p>;
}

function QaList({ items, variant }: { items: StudyGuideCheck[]; variant: Variant }) {
  const { t } = useTranslation('assistant');
  const [shown, setShown] = useState<Record<number, boolean>>({});
  return (
    <ol className="space-y-2">
      {items.map((c, i) => {
        const visible = variant === 'print' || Boolean(shown[i]);
        return (
          <li
            key={`${i}-${c.question.slice(0, 24)}`}
            data-guide-block
            className="rounded-2xl border border-line bg-surface p-3"
          >
            <div className="flex gap-2 text-sm font-medium text-fg">
              <span className="tabular shrink-0 font-mono text-muted">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <Markdown text={c.question} />
              </div>
            </div>
            {variant === 'interactive' && (
              <button
                type="button"
                aria-expanded={visible}
                onClick={() => setShown((prev) => ({ ...prev, [i]: !visible }))}
                className="mt-1 inline-flex min-h-11 items-center rounded-full border border-line bg-surface-2 px-3.5 text-xs font-semibold text-accent-ink"
              >
                {visible ? t('notebook.guide.hideAnswer') : t('notebook.guide.showAnswer')}
              </button>
            )}
            {visible && (
              <div className="mt-1.5 rounded-xl bg-surface-2 px-3 py-2 text-sm text-fg">
                {variant === 'print' && (
                  <span className="mr-1 font-semibold text-muted">{t('notebook.guide.answer')}:</span>
                )}
                <Markdown text={c.answer} />
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
  const pageLabel = (page: string) => t('notebook.guide.page', { page });
  const ex = topic.workedExample;
  return (
    <div className="space-y-3.5">
      {topic.summary && (
        <div data-guide-block className="text-sm leading-relaxed text-fg">
          <Markdown text={topic.summary} />
        </div>
      )}

      {topic.keyIdeas.length > 0 && (
        <div data-guide-block>
          <SectionLabel>{t('notebook.guide.keyIdeas')}</SectionLabel>
          <BulletList items={topic.keyIdeas} />
        </div>
      )}

      {topic.formulaDetails && topic.formulaDetails.length > 0 ? (
        <div>
          <SectionLabel>{t('notebook.guide.formulas')}</SectionLabel>
          <div className="space-y-2">
            {topic.formulaDetails.map((f, i) => (
              <div
                key={`${i}-${f.latex.slice(0, 24)}`}
                data-guide-block
                className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm"
              >
                <div className="overflow-x-auto">
                  <Markdown text={asDisplayMath(f.latex)} />
                </div>
                {f.meaning && (
                  <div className="mt-1 text-fg">
                    <Markdown text={f.meaning} />
                  </div>
                )}
                {(f.units || f.validity) && (
                  <div className="mt-1.5 space-y-0.5 text-xs text-muted">
                    {f.units && (
                      <p>
                        <span className="font-semibold">{t('notebook.guide.units')}: </span>
                        {f.units}
                      </p>
                    )}
                    {f.validity && (
                      <p>
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
            <SectionLabel>{t('notebook.guide.formulas')}</SectionLabel>
            <div className="space-y-1.5 overflow-x-auto rounded-xl bg-surface-2 px-3 py-2 text-sm">
              {topic.formulas.map((f, i) => (
                <Markdown key={`${i}-${f.slice(0, 24)}`} text={asDisplayMath(f)} />
              ))}
            </div>
          </div>
        )
      )}

      {ex && (
        <div data-guide-block className="rounded-2xl border border-accent/30 bg-accent-soft/40 p-3">
          <SectionLabel>{t('notebook.guide.workedExample')}</SectionLabel>
          <div className="text-sm font-medium text-fg">
            <Markdown text={ex.statement} />
          </div>
          <ol className="mt-2 space-y-1.5 text-sm text-fg">
            {ex.steps.map((step, i) => (
              <li key={`${i}-${step.slice(0, 24)}`} className="flex gap-2">
                <span className="tabular shrink-0 font-mono text-xs leading-6 text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Markdown text={step} />
                </div>
              </li>
            ))}
          </ol>
          {ex.result && (
            <div className="mt-2 rounded-xl bg-surface px-3 py-2 text-sm font-semibold text-fg">
              <Markdown text={ex.result} />
            </div>
          )}
          {ex.source && (
            <p className="mt-1.5 text-xs text-muted">{formatSourceChip(ex.source, pageLabel)}</p>
          )}
        </div>
      )}

      {topic.examPattern && (
        <div data-guide-block>
          <SectionLabel>{t('notebook.guide.examPattern')}</SectionLabel>
          <div className="text-sm text-fg">
            <Markdown text={topic.examPattern} />
          </div>
        </div>
      )}

      {topic.pitfalls.length > 0 && (
        <div data-guide-block>
          <SectionLabel>{t('notebook.guide.pitfalls')}</SectionLabel>
          <BulletList items={topic.pitfalls} />
        </div>
      )}

      {topic.practice && topic.practice.length > 0 && (
        <div>
          <SectionLabel>{t('notebook.guide.practice')}</SectionLabel>
          <QaList items={topic.practice} variant={variant} />
        </div>
      )}

      {topic.sources.length > 0 && (
        <div data-guide-block>
          <SectionLabel>{t('notebook.guide.sources')}</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {topic.sources.map((src, i) => (
              <Badge key={`${i}-${src.title}`} tone="accent">
                {formatSourceChip(src, pageLabel)}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Guia de estudo estruturado. «interactive» no caderno (tópicos recolhíveis, respostas
 * escondidas); «print» para o PDF (tudo aberto, cada bloco marcado com data-guide-block
 * para a paginação não cortar a meio).
 */
export default function StudyGuideView({ guide, variant = 'interactive' }: { guide: StudyGuide; variant?: Variant }) {
  const { t } = useTranslation('assistant');
  const [openTopics, setOpenTopics] = useState<Record<number, boolean>>({ 0: true });
  const [doneSteps, setDoneSteps] = useState<Record<number, boolean>>({});
  const print = variant === 'print';

  return (
    <div className="space-y-4">
      {print && guide.title && (
        <h1 data-guide-block className="text-xl font-bold tracking-tight text-fg">
          {guide.title}
        </h1>
      )}
      {guide.goal && (
        <p data-guide-block className="rounded-2xl bg-accent-soft px-3.5 py-3 text-sm font-medium text-accent-ink">
          <span className="font-bold">{t('notebook.guide.goal')}: </span>
          {guide.goal}
        </p>
      )}

      <div className="space-y-2">
        {guide.topics.map((topic, idx) => {
          const open = print || Boolean(openTopics[idx]);
          return (
            <section key={`${idx}-${topic.title}`} className="rounded-2xl border border-line bg-surface">
              {print ? (
                <h2 data-guide-block className="px-3.5 pt-3 text-base font-bold text-fg">
                  {topic.title}
                </h2>
              ) : (
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={t(open ? 'notebook.guide.topicClose' : 'notebook.guide.topicOpen', {
                    title: topic.title,
                  })}
                  onClick={() => setOpenTopics((prev) => ({ ...prev, [idx]: !open }))}
                  className="flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl px-3.5 py-2 text-left"
                >
                  <span className="min-w-0 text-sm font-bold text-fg">{topic.title}</span>
                  <ChevronDown
                    size={16}
                    className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')}
                  />
                </button>
              )}
              {open && (
                <div className={cx('px-3.5 py-3', !print && 'border-t border-line')}>
                  <TopicBody topic={topic} variant={variant} />
                </div>
              )}
            </section>
          );
        })}
      </div>

      {guide.examTraps.length > 0 && (
        <div data-guide-block className="rounded-2xl border border-line bg-surface-2/60 p-3.5">
          <SectionLabel>{t('notebook.guide.examTraps')}</SectionLabel>
          <BulletList items={guide.examTraps} />
        </div>
      )}

      {guide.revisionPlan.length > 0 && (
        <div>
          <SectionLabel>{t('notebook.guide.revisionPlan')}</SectionLabel>
          <ul className="space-y-1.5">
            {guide.revisionPlan.map((step, i) => {
              const done = !print && Boolean(doneSteps[i]);
              const body = (
                <>
                  {done ? (
                    <SquareCheckBig size={18} className="mt-0.5 shrink-0 text-accent" />
                  ) : (
                    <Square size={18} className="mt-0.5 shrink-0 text-muted" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted">
                      {step.day && <span>{step.day}</span>}
                      {step.minutes > 0 && <Badge>{t('notebook.guide.minutes', { count: step.minutes })}</Badge>}
                    </span>
                    <span className={cx('block text-sm text-fg', done && 'text-muted line-through')}>{step.task}</span>
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
                      className="flex min-h-11 w-full items-start gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2 text-left"
                    >
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {guide.selfCheck.length > 0 && (
        <div>
          <SectionLabel>{t('notebook.guide.selfCheck')}</SectionLabel>
          <QaList items={guide.selfCheck} variant={variant} />
        </div>
      )}
    </div>
  );
}
