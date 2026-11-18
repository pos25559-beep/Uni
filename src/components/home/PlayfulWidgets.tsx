import { ArrowRight, CalendarDays, Plus, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { UniAccessoryId } from '../../lib/uniAccessories';
import { useStore } from '../../store/useStore';
import { UniBuddy } from '../brand/UnipediaMarks';
import { StickerBadge } from '../motion/Primitives';
import { Badge, Button, Input } from '../ui';
import { cx } from '../../lib/uiHelpers';

/**
 * Caderno pautado vivo para o "Foco de hoje" (substitui cartão branco plano).
 */
export function NotebookFocusSheet({
  isEmpty,
  onOpenPlan,
  uniAccessory,
  topSlot,
  children,
}: {
  isEmpty: boolean;
  onOpenPlan: () => void;
  uniAccessory: UniAccessoryId;
  topSlot?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useTranslation('today');
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');
  return (
    <section
      className={cx(
        'overflow-hidden border border-line text-fg shadow-card',
        isMinimal
          ? 'rounded-2xl bg-surface'
          : 'rounded-3xl bg-bg dark:border-white/10 dark:bg-surface',
      )}
    >
      {/* Cabeçalho com faixa verde salva de caderno (neutro em Sério & Minimal) */}
      <div
        className={cx(
          'flex items-center justify-between gap-3 px-5 py-3.5',
          isMinimal
            ? 'border-b border-line bg-surface-2/50 text-fg'
            : 'bg-pastel-sage/65 text-[#141312] dark:bg-[#23311B] dark:text-[#FAF6EC]',
        )}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={15} className={isMinimal ? 'text-accent-ink' : 'text-[#0F6344] dark:text-[#4ADE80]'} />
          <h2 className="font-display text-base font-bold">{t('todayFocus.title')}</h2>
        </div>
        <button
          type="button"
          onClick={onOpenPlan}
          className={cx(
            'inline-flex min-h-11 items-center gap-1 rounded-full px-3.5 text-xs font-semibold transition',
            isMinimal
              ? 'border border-line bg-surface text-fg hover:bg-surface-2'
              : 'bg-white/85 text-[#141312] shadow-sm hover:bg-white dark:bg-black/30 dark:text-[#FAF6EC]',
          )}
        >
          {t('todayFocus.openPlan')} <ArrowRight size={12} />
        </button>
      </div>

      {/* Folha pautada suave (limpa em Sério & Minimal) */}
      <div
        className={cx(
          'p-5',
          !isMinimal &&
            'bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_31px,rgba(20,19,18,0.045)_31px,rgba(20,19,18,0.045)_32px)] dark:bg-none',
        )}
      >
        {topSlot}
        {isEmpty ? (
          <div className="flex flex-col items-center gap-3 py-3 text-center">
            {isMinimal ? (
              <div className="grid size-11 place-items-center rounded-xl border border-line bg-surface-2 text-muted">
                <CalendarDays size={20} />
              </div>
            ) : (
              <UniBuddy mood="happy" accessory={uniAccessory} size={64} interactive={false} />
            )}
            <div className="space-y-1">
              <p className="font-display text-base font-bold">{t('todayFocus.emptyTitle')}</p>
              <p className="mx-auto max-w-xs text-xs text-muted">
                {isMinimal
                  ? t('todayFocus.emptyMinimalHint')
                  : t('todayFocus.emptyVibrantHint')}
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={onOpenPlan}>
              {t('todayFocus.emptyCta')} <ArrowRight size={14} />
            </Button>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/**
 * Bloco Post-it amarelo manteiga para as Tarefas rápidas.
 */
export function StickyTasksPad({
  pendingCount,
  draft,
  onDraftChange,
  onDraftKeyDown,
  inputId,
  children,
}: {
  pendingCount: number;
  draft: string;
  onDraftChange: (v: string) => void;
  onDraftKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputId?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation('today');
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');
  const pendingLabel =
    pendingCount === 1
      ? t('tasksPad.pendingOne')
      : t('tasksPad.pendingMany', { count: pendingCount });
  return (
    <section
      className={cx(
        'relative overflow-hidden border border-line p-5 shadow-card',
        isMinimal
          ? 'rounded-2xl bg-surface text-fg'
          : 'rounded-3xl bg-pastel-butter/45 text-[#141312] dark:border-white/10 dark:bg-[#2C2512] dark:text-[#FAF6EC]',
      )}
    >
      {/* Marcador coral estilo post-it */}
      {!isMinimal && (
        <div
          aria-hidden="true"
          className="mx-auto mb-2.5 h-1.5 w-14 rounded-full bg-coral/40"
        />
      )}

      <div className="mb-3.5 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold">{t('tasksPad.title')}</h2>
        {isMinimal ? (
          <Badge tone="neutral">{pendingLabel}</Badge>
        ) : (
          <StickerBadge tone="butter" tilt={2}>
            {pendingLabel}
          </StickerBadge>
        )}
      </div>

      <div className="relative mb-3">
        <Plus size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 opacity-60" />
        <Input
          id={inputId}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={onDraftKeyDown}
          placeholder={t('tasksPad.placeholder')}
          aria-label={t('tasksPad.ariaLabel')}
          className={cx(
            'pl-10',
            !isMinimal &&
              'border-[#141312]/10 bg-white/85 text-[#141312] placeholder:text-[#141312]/50 dark:border-white/10 dark:bg-black/25 dark:text-[#FAF6EC] dark:placeholder:text-white/45',
          )}
        />
      </div>

      {children}
    </section>
  );
}

/**
 * Folha destacável de agenda com cabeçalho pêssego quente.
 */
export function AgendaRibbonCard({
  dateBadge,
  isEmpty,
  children,
}: {
  dateBadge: string;
  isEmpty: boolean;
  children?: ReactNode;
}) {
  const { t } = useTranslation('today');
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');
  return (
    <section
      className={cx(
        'overflow-hidden border border-line shadow-card',
        isMinimal
          ? 'rounded-2xl bg-surface text-fg'
          : 'rounded-3xl bg-pastel-peach/35 text-[#141312] dark:border-white/10 dark:bg-[#2C1E17] dark:text-[#FAF6EC]',
      )}
    >
      <div
        className={cx(
          'flex items-center justify-between px-5 py-3.5',
          isMinimal
            ? 'border-b border-line bg-surface-2/50 text-fg'
            : 'bg-pastel-peach dark:bg-[#3B261C]',
        )}
      >
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="opacity-80" />
          <h2 className="font-display text-base font-bold">{t('agendaCard.title')}</h2>
        </div>
        <span
          className={cx(
            'rounded-full px-2.5 py-0.5 font-mono text-xs font-bold',
            isMinimal
              ? 'border border-line bg-surface text-fg'
              : 'bg-white/75 text-[#141312] dark:bg-black/30 dark:text-[#FAF6EC]',
          )}
        >
          {dateBadge}
        </span>
      </div>

      <div className="p-4">
        {isEmpty ? (
          <div
            className={cx(
              'rounded-2xl px-4 py-5 text-center text-xs',
              isMinimal ? 'bg-surface-2/60 text-muted' : 'bg-white/60 dark:bg-black/20',
            )}
          >
            <p className={cx('font-semibold', isMinimal && 'text-fg')}>{t('agendaCard.emptyTitle')}</p>
            <p className="mt-1 opacity-75">{t('agendaCard.emptyHint')}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
