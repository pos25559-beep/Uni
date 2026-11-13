import { Check, HelpCircle, Sparkles, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { TAB_GUIDES, type AppTabKey } from '../../lib/tabGuides';
import { resolveUniAccessory } from '../../lib/uniAccessories';
import { useStore } from '../../store/useStore';
import { UniBuddy } from '../brand/UnipediaMarks';
import { Button, cx } from '../ui';

const EMPTY_SEEN_GUIDES: AppTabKey[] = [];

export function TabGuideBanner({
  tabKey,
  isEmpty = false,
  actions,
}: {
  tabKey: AppTabKey;
  isEmpty?: boolean;
  actions?: ReactNode;
}) {
  const seen = useStore((s) => s.settings.seenTabGuides) ?? EMPTY_SEEN_GUIDES;
  const courses = useStore((s) => s.courses);
  const degreeName = useStore((s) => s.academicProfile.degreeName);
  const uniPreference = useStore((s) => s.settings.uniAccessory);
  const updateSettings = useStore((s) => s.updateSettings);

  if (seen.includes(tabKey)) return null;

  const spec = TAB_GUIDES[tabKey];
  const accessory = resolveUniAccessory(uniPreference, degreeName, courses[0]?.name);
  const body = isEmpty && spec.emptySummary ? spec.emptySummary : spec.summary;

  const dismiss = () => {
    if (!seen.includes(tabKey)) {
      updateSettings({ seenTabGuides: [...seen, tabKey] });
    }
  };

  return (
    <section
      aria-label={`Guia rápido da aba ${spec.title}`}
      className={cx(
        'relative overflow-hidden rounded-[26px] border p-4 shadow-card transition sm:p-5',
        spec.tintClass,
      )}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar guia desta aba"
        className="absolute top-3 right-3 rounded-full p-1.5 text-muted transition hover:bg-black/5 hover:text-fg dark:hover:bg-white/10"
      >
        <X size={15} />
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex items-center gap-3 sm:block">
          <UniBuddy
            mood={spec.mood}
            accessory={accessory}
            size={60}
            interactive={false}
          />
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent sm:hidden dark:bg-black/25">
            <Sparkles size={10} /> {spec.eyebrow}
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-2 pr-4">
          <p className="hidden text-[11px] font-bold uppercase tracking-[0.12em] text-accent sm:block">
            {spec.eyebrow}
          </p>
          <h2 className="font-display text-base font-bold text-fg sm:text-lg">{spec.title}</h2>
          <p className="text-xs leading-relaxed text-fg/90 sm:text-sm">{body}</p>

          <ul className="space-y-1 pt-0.5">
            {spec.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2 text-xs text-muted">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#E04F33]" />
                <span>{h}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            {actions}
            <Button size="sm" variant="secondary" onClick={dismiss}>
              <Check size={14} /> Entendido
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Botão discreto no cabeçalho da página para reabrir o guia do Uni desta aba. */
export function TabGuideHelpButton({ tabKey }: { tabKey: AppTabKey }) {
  const seen = useStore((s) => s.settings.seenTabGuides) ?? EMPTY_SEEN_GUIDES;
  const updateSettings = useStore((s) => s.updateSettings);

  if (!seen.includes(tabKey)) return null;

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => updateSettings({ seenTabGuides: seen.filter((k) => k !== tabKey) })}
      aria-label="Reabrir guia do Uni para esta aba"
      title="O que faz esta aba? (Guia do Uni)"
    >
      <HelpCircle size={15} />
      <span className="hidden sm:inline">Guia</span>
    </Button>
  );
}
