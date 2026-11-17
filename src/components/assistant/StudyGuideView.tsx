import { ChevronDown, Square, SquareCheckBig } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { asDisplayMath, formatSourceChip, type StudyGuide } from '../../lib/studyGuide';
import { cx } from '../../lib/uiHelpers';
import { Badge } from '../ui';
import { Markdown } from './Markdown';

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

export default function StudyGuideView({ guide }: { guide: StudyGuide }) {
  const { t } = useTranslation('assistant');
  const [openTopics, setOpenTopics] = useState<Record<number, boolean>>({ 0: true });
  const [doneSteps, setDoneSteps] = useState<Record<number, boolean>>({});
  const [shownAnswers, setShownAnswers] = useState<Record<number, boolean>>({});
  const pageLabel = (page: string) => t('notebook.guide.page', { page });

  return (
    <div className="space-y-4">
      {guide.goal && (
        <p className="rounded-2xl bg-accent-soft px-3.5 py-3 text-sm font-medium text-accent-ink">
          <span className="font-bold">{t('notebook.guide.goal')}: </span>
          {guide.goal}
        </p>
      )}

      <div className="space-y-2">
        {guide.topics.map((topic, idx) => {
          const open = Boolean(openTopics[idx]);
          return (
            <section key={`${idx}-${topic.title}`} className="rounded-2xl border border-line bg-surface">
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
              {open && (
                <div className="space-y-3 border-t border-line px-3.5 py-3">
                  {topic.keyIdeas.length > 0 && (
                    <div>
                      <SectionLabel>{t('notebook.guide.keyIdeas')}</SectionLabel>
                      <BulletList items={topic.keyIdeas} />
                    </div>
                  )}
                  {topic.formulas.length > 0 && (
                    <div>
                      <SectionLabel>{t('notebook.guide.formulas')}</SectionLabel>
                      <div className="space-y-1.5 overflow-x-auto rounded-xl bg-surface-2 px-3 py-2 text-sm">
                        {topic.formulas.map((f, i) => (
                          <Markdown key={`${i}-${f.slice(0, 24)}`} text={asDisplayMath(f)} />
                        ))}
                      </div>
                    </div>
                  )}
                  {topic.pitfalls.length > 0 && (
                    <div>
                      <SectionLabel>{t('notebook.guide.pitfalls')}</SectionLabel>
                      <BulletList items={topic.pitfalls} />
                    </div>
                  )}
                  {topic.sources.length > 0 && (
                    <div>
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
              )}
            </section>
          );
        })}
      </div>

      {guide.examTraps.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface-2/60 p-3.5">
          <SectionLabel>{t('notebook.guide.examTraps')}</SectionLabel>
          <BulletList items={guide.examTraps} />
        </div>
      )}

      {guide.revisionPlan.length > 0 && (
        <div>
          <SectionLabel>{t('notebook.guide.revisionPlan')}</SectionLabel>
          <ul className="space-y-1.5">
            {guide.revisionPlan.map((step, i) => {
              const done = Boolean(doneSteps[i]);
              return (
                <li key={`${i}-${step.task.slice(0, 24)}`}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    aria-label={t('notebook.guide.doneStep', { task: step.task })}
                    onClick={() => setDoneSteps((prev) => ({ ...prev, [i]: !done }))}
                    className="flex min-h-11 w-full items-start gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2 text-left"
                  >
                    {done ? (
                      <SquareCheckBig size={18} className="mt-0.5 shrink-0 text-accent" />
                    ) : (
                      <Square size={18} className="mt-0.5 shrink-0 text-muted" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted">
                        {step.day && <span>{step.day}</span>}
                        {step.minutes > 0 && (
                          <Badge>{t('notebook.guide.minutes', { count: step.minutes })}</Badge>
                        )}
                      </span>
                      <span className={cx('block text-sm text-fg', done && 'text-muted line-through')}>
                        {step.task}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {guide.selfCheck.length > 0 && (
        <div>
          <SectionLabel>{t('notebook.guide.selfCheck')}</SectionLabel>
          <ul className="space-y-2">
            {guide.selfCheck.map((c, i) => {
              const shown = Boolean(shownAnswers[i]);
              return (
                <li key={`${i}-${c.question.slice(0, 24)}`} className="rounded-2xl border border-line bg-surface p-3">
                  <div className="text-sm font-medium text-fg">
                    <Markdown text={c.question} />
                  </div>
                  <button
                    type="button"
                    aria-expanded={shown}
                    onClick={() => setShownAnswers((prev) => ({ ...prev, [i]: !shown }))}
                    className="mt-1 inline-flex min-h-11 items-center rounded-full border border-line bg-surface-2 px-3.5 text-xs font-semibold text-accent-ink"
                  >
                    {shown ? t('notebook.guide.hideAnswer') : t('notebook.guide.showAnswer')}
                  </button>
                  {shown && (
                    <div className="mt-1 rounded-xl bg-surface-2 px-3 py-2 text-sm text-fg">
                      <Markdown text={c.answer} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
