import { useCopy } from '../i18n';
import { ShotCrop, type ShotId } from '../screens';
import { Reveal, SectionHead } from '../ui';

/** Quatro momentos reais do dia, em grelha compacta, cada um com um recorte do ecrã que lhe corresponde. */
export default function Moments() {
  const { moments } = useCopy();
  // Foco de hoje, prática no fim do bloco, «Ficou para trás» e revisões devidas.
  const crops: { id: ShotId; top: number }[] = [
    { id: 'hoje', top: 0.3 },
    { id: 'pratica', top: 0.42 },
    { id: 'plano', top: 0.25 },
    { id: 'progresso', top: 0.33 },
  ];
  const dots = ['bg-pastel-sky', 'bg-pastel-butter', 'bg-pastel-blush', 'bg-pastel-mint'];

  return (
    <section aria-labelledby="moments-title" className="paper-lines border-y border-line bg-surface-2/60">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHead id="moments-title" kicker={moments.kicker} title={moments.title} em={moments.titleEm} />
        <ol className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {moments.items.map((it, i) => (
            <li key={it.when}>
              <Reveal delay={i * 0.06}>
                <ShotCrop id={crops[i].id} top={crops[i].top} />
                <p className="mt-4 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-coral-ink">
                  <span aria-hidden="true" className={`grid size-6 place-items-center rounded-full ${dots[i]} text-xs text-[#141312]`}>{i + 1}</span>
                  {it.when}
                </p>
                <h3 className="font-display mt-2 text-xl font-bold leading-snug">{it.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{it.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
