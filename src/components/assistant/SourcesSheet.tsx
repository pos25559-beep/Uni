import { ChevronDown, FileText, Library, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../lib/uiHelpers';
import {
  citedSources,
  groupSources,
  matchesSourceQuery,
  type SourceGroupKey,
} from '../../lib/tutorSources';
import type { Material } from '../../types';
import { Button, Modal } from '../ui';

const GROUP_LABEL: Record<SourceGroupKey, string> = {
  lessons: 'sources.groupLessons',
  tests: 'sources.groupTests',
  problems: 'sources.groupProblems',
  images: 'sources.groupImages',
  other: 'sources.groupOther',
};

/** Pílula única junto ao seletor de cadeira: quantas fontes o Uni vai usar. */
export function SourcesPill({
  count,
  onClick,
  className,
}: {
  count: number;
  onClick: () => void;
  className?: string;
}) {
  const { t } = useTranslation('common');
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('sources.pillLabel')}
      className={cx(
        'inline-flex min-h-11 min-w-0 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        count > 0
          ? 'border-accent bg-accent-soft text-accent-ink'
          : 'border-line bg-surface text-muted hover:text-fg',
        className,
      )}
    >
      <Library size={14} aria-hidden="true" className="shrink-0" />
      <span className="truncate">{count > 0 ? t('sources.pill', { count }) : t('sources.pillNone')}</span>
    </button>
  );
}

export function SourcesSheet({
  open,
  onClose,
  materials,
  selectedIds,
  onToggle,
  onSelectMany,
  onOpenAttach,
}: {
  open: boolean;
  onClose: () => void;
  materials: Material[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** Substitui a seleção (a mesma ação que o seletor antigo usava). */
  onSelectMany: (ids: string[]) => void;
  onOpenAttach: () => void;
}) {
  const { t } = useTranslation('common');
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const groups = useMemo(
    () => groupSources(materials.filter((m) => matchesSourceQuery(m.title, query))),
    [materials, query],
  );

  const chosenHere = materials.filter((m) => selected.has(m.id)).length;

  const providerLabel = (m: Material) =>
    m.provider === 'gdrive'
      ? t('sources.providerDrive')
      : m.provider === 'upload'
        ? t('sources.providerLocal')
        : m.provider === 'notebooklm'
          ? t('sources.providerNotebook')
          : m.provider.toUpperCase();

  const selectGroup = (items: Material[]) => {
    const ids = new Set(selectedIds);
    for (const m of items) ids.add(m.id);
    onSelectMany([...ids]);
  };
  const clearGroup = (items: Material[]) => {
    // toggle regista também o "dispensado", para o auto-fixar não os repor.
    for (const m of items) if (selected.has(m.id)) onToggle(m.id);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        setQuery('');
        onClose();
      }}
      title={t('sources.title')}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="min-w-0 text-sm text-muted" aria-live="polite">
            {t('sources.footerCount', { selected: chosenHere, total: materials.length })}
          </span>
          <Button
            variant="primary"
            onClick={() => {
              setQuery('');
              onClose();
            }}
          >
            {t('sources.done')}
          </Button>
        </div>
      }
    >
      <button
        type="button"
        onClick={() => {
          setQuery('');
          onClose();
          onOpenAttach();
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface-2 px-4 text-sm font-semibold text-fg transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <FileText size={15} aria-hidden="true" />
        {t('sources.attachNotes')}
      </button>

      {materials.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">{t('sources.noMaterials')}</p>
      ) : (
        <>
          <label className="relative block">
            <span className="sr-only">{t('sources.searchLabel')}</span>
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('sources.searchPlaceholder')}
              className="h-11 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-3 text-sm text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </label>

          {groups.length === 0 && (
            <p className="py-4 text-center text-sm text-muted">{t('sources.empty')}</p>
          )}

          {groups.map((g) => {
            const allOn = g.items.every((m) => selected.has(m.id));
            const onCount = g.items.filter((m) => selected.has(m.id)).length;
            return (
              <section key={g.key} aria-label={t(GROUP_LABEL[g.key])}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="min-w-0 truncate text-xs font-bold uppercase tracking-wide text-muted">
                    {t(GROUP_LABEL[g.key])}{' '}
                    <span className="font-semibold normal-case tracking-normal">
                      {onCount}/{g.items.length}
                    </span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => (allOn ? clearGroup(g.items) : selectGroup(g.items))}
                    className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-xs font-semibold text-accent-ink hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:text-accent"
                  >
                    {allOn ? t('sources.clearAll') : t('sources.selectAll')}
                  </button>
                </div>
                <ul className="divide-y divide-line">
                  {g.items.map((m) => {
                    const checked = selected.has(m.id);
                    return (
                      <li key={m.id}>
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-1 py-1.5 hover:bg-surface-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggle(m.id)}
                            className="size-5 shrink-0 rounded border-line accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-fg">{m.title}</span>
                            <span className="block truncate text-xs text-muted">{providerLabel(m)}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </Modal>
  );
}

const CHIP =
  'inline-flex min-h-7 max-w-full items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg';

/** Rodapé da resposta: só as fontes que a resposta citou (ou, sem citações, um resumo expansível). */
export function AnswerSources({ text, titles }: { text: string; titles: string[] }) {
  const { t } = useTranslation('common');
  const [expanded, setExpanded] = useState(false);
  const unique = useMemo(() => [...new Set(titles)], [titles]);
  const cited = useMemo(() => citedSources(text, unique), [text, unique]);

  if (unique.length === 0) return null;

  const chip = (title: string) => (
    <span key={title} className={CHIP} title={title}>
      <FileText size={12} aria-hidden="true" className="shrink-0 text-accent" />
      <span className="max-w-[11rem] truncate">{title}</span>
    </span>
  );

  const toggleBase =
    'relative inline-flex min-h-7 items-center gap-1 rounded-full bg-surface-2 px-2.5 text-xs font-medium text-muted before:absolute before:inset-x-0 before:-inset-y-2 before:content-[\'\'] hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

  if (cited.length === 0) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={toggleBase}
        >
          {t('sources.consulted', { count: unique.length })}
          <ChevronDown
            size={12}
            aria-hidden="true"
            className={cx('transition-transform', expanded && 'rotate-180')}
          />
        </button>
        {expanded && unique.map(chip)}
      </div>
    );
  }

  const visible = expanded ? cited : cited.slice(0, 3);
  const rest = cited.length - 3;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label={t('sources.cited')}>
      {visible.map(chip)}
      {rest > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? t('sources.hide') : t('sources.moreLabel', { count: rest })}
          className={toggleBase}
        >
          {expanded ? <ChevronDown size={12} aria-hidden="true" className="rotate-180" /> : t('sources.more', { count: rest })}
        </button>
      )}
    </div>
  );
}
