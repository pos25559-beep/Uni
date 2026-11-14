import { ArrowRight, CalendarDays, Flame, Plus, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import type { UniAccessoryId } from '../../lib/uniAccessories';
import { hapticTap } from '../../lib/nativeBridge';
import { useStore } from '../../store/useStore';
import { UniBuddy } from '../brand/UnipediaMarks';
import { StickerBadge, UNIPEDIA_BOUNCE_SPRING } from '../motion/Primitives';
import { Badge, Button, Input, cx } from '../ui';

/**
 * Mosaico de formas orgânicas estilo "Daily highlights" (gotas, trevos, estrelas e stickers pastel).
 */
export function HighlightShapesGrid({
  focusedLabel,
  streakDays,
  sessionsLabel,
  pendingCount,
  onOpenProgress,
  onOpenPlan,
  onFocusTasks,
}: {
  focusedLabel: string;
  streakDays: number;
  sessionsLabel: string;
  pendingCount: number;
  onOpenProgress: () => void;
  onOpenPlan: () => void;
  onFocusTasks: () => void;
}) {
  return (
    <section aria-label="Destaques do dia" className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted">
          Destaques de hoje
        </h2>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink">
          <Flame size={13} />
          {streakDays > 0 ? `${streakDays}d seguidos` : 'Começa hoje'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Gota azul céu: Foco */}
        <motion.button
          type="button"
          whileHover={{ y: -2, scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          transition={UNIPEDIA_BOUNCE_SPRING}
          onClick={() => {
            void hapticTap();
            onOpenProgress();
          }}
          className="relative flex min-h-[126px] flex-col items-center justify-center overflow-hidden rounded-[30px] rounded-tl-[12px] bg-pastel-sky p-3.5 text-center text-[#141312] shadow-card dark:bg-[#192A3D] dark:text-[#FAF6EC]"
        >
          <span className="text-xs font-bold uppercase tracking-wider opacity-70">Focado</span>
          <span className="mt-1 font-display text-2xl font-extrabold tabular">{focusedLabel}</span>
          <span className="mt-1 text-xs font-medium opacity-75">esta semana</span>
        </motion.button>

        {/* Trevo verde salva: Sequência */}
        <motion.button
          type="button"
          whileHover={{ y: -2, scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          transition={UNIPEDIA_BOUNCE_SPRING}
          onClick={() => {
            void hapticTap();
            onOpenProgress();
          }}
          className="relative flex min-h-[126px] flex-col items-center justify-center overflow-hidden rounded-[34px] rounded-br-[12px] bg-pastel-sage p-3.5 text-center text-[#141312] shadow-card dark:bg-[#23311B] dark:text-[#FAF6EC]"
        >
          <span className="text-xs font-bold uppercase tracking-wider opacity-70">Ritmo</span>
          <span className="mt-1 font-display text-2xl font-extrabold tabular">{streakDays}d</span>
          <span className="mt-1 text-xs font-medium opacity-75">sequência</span>
        </motion.button>

        {/* Cartão sol manteiga: Sessões */}
        <motion.button
          type="button"
          whileHover={{ y: -2, scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          transition={UNIPEDIA_BOUNCE_SPRING}
          onClick={() => {
            void hapticTap();
            onOpenPlan();
          }}
          className="relative flex min-h-[126px] flex-col items-center justify-center overflow-hidden rounded-[22px] rounded-tr-[38px] bg-pastel-butter p-3.5 text-center text-[#141312] shadow-card dark:bg-[#352D14] dark:text-[#FAF6EC]"
        >
          <span className="text-xs font-bold uppercase tracking-wider opacity-70">Sessões</span>
          <span className="mt-1 font-display text-2xl font-extrabold tabular">{sessionsLabel}</span>
          <span className="mt-1 text-xs font-medium opacity-75">concluídas</span>
        </motion.button>

        {/* Sticker pêssego: Tarefas */}
        <motion.button
          type="button"
          whileHover={{ y: -2, scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          transition={UNIPEDIA_BOUNCE_SPRING}
          onClick={() => {
            void hapticTap();
            onFocusTasks();
          }}
          className="relative flex min-h-[126px] flex-col items-center justify-center overflow-hidden rounded-[34px] rounded-bl-[12px] bg-pastel-peach p-3.5 text-center text-[#141312] shadow-card dark:bg-[#382317] dark:text-[#FAF6EC]"
        >
          <span className="text-xs font-bold uppercase tracking-wider opacity-70">Tarefas</span>
          <span className="mt-1 font-display text-2xl font-extrabold tabular">{pendingCount}</span>
          <span className="mt-1 text-xs font-medium opacity-75">por fechar</span>
        </motion.button>
      </div>
    </section>
  );
}

/**
 * Caderno pautado vivo para o "Foco de hoje" (substitui cartão branco plano).
 */
export function NotebookFocusSheet({
  isEmpty,
  onOpenPlan,
  uniAccessory,
  children,
}: {
  isEmpty: boolean;
  onOpenPlan: () => void;
  uniAccessory: UniAccessoryId;
  children?: ReactNode;
}) {
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');
  return (
    <section
      className={cx(
        'overflow-hidden border border-line text-fg shadow-card',
        isMinimal
          ? 'rounded-2xl bg-surface'
          : 'rounded-[28px] bg-bg dark:border-white/10 dark:bg-surface',
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
          <h2 className="font-display text-base font-bold">Foco de hoje</h2>
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
          Abrir plano <ArrowRight size={12} />
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
              <p className="font-display text-base font-bold">Dia livre para pôr ideias em ordem</p>
              <p className="mx-auto max-w-xs text-xs text-muted">
                {isMinimal
                  ? 'Cria um plano semanal com blocos curtos por cadeira.'
                  : 'Cria um plano semanal com blocos curtos e o Uni acompanha cada sessão contigo.'}
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={onOpenPlan}>
              Gerar plano agora <ArrowRight size={14} />
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
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');
  return (
    <section
      className={cx(
        'relative overflow-hidden border border-line p-5 shadow-card',
        isMinimal
          ? 'rounded-2xl bg-surface text-fg'
          : 'rounded-[28px] bg-pastel-butter/45 text-[#141312] dark:border-white/10 dark:bg-[#2C2512] dark:text-[#FAF6EC]',
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
        <h2 className="font-display text-base font-bold">Notas &amp; Tarefas</h2>
        {isMinimal ? (
          <Badge tone="neutral">
            {pendingCount} {pendingCount === 1 ? 'pendente' : 'pendentes'}
          </Badge>
        ) : (
          <StickerBadge tone="butter" tilt={2}>
            {pendingCount} {pendingCount === 1 ? 'pendente' : 'pendentes'}
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
          placeholder="Escreve uma tarefa e prime Enter…"
          aria-label="Nova tarefa"
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
  const isMinimal = useStore((s) => (s.settings.appTone ?? 'vibrante') === 'serio');
  return (
    <section
      className={cx(
        'overflow-hidden border border-line shadow-card',
        isMinimal
          ? 'rounded-2xl bg-surface text-fg'
          : 'rounded-[28px] bg-pastel-peach/35 text-[#141312] dark:border-white/10 dark:bg-[#2C1E17] dark:text-[#FAF6EC]',
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
          <h2 className="font-display text-base font-bold">Agenda de hoje</h2>
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
            <p className={cx('font-semibold', isMinimal && 'text-fg')}>Sem aulas ou blocos fixos hoje</p>
            <p className="mt-1 opacity-75">Aproveita a tarde livre para avançar ao teu ritmo.</p>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
