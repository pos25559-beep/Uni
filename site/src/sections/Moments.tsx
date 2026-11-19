import { useCopy } from '../i18n';
import { ShotCrop } from '../screens';
import { Reveal, SectionHead } from '../ui';

export default function Moments() {
  const { moments } = useCopy();
  // Recortes de ecrãs reais: foco de hoje, fim do bloco, «Ficou para trás» e revisões devidas.
  const crops = [
    { id: 'hoje', top: 0.3 },
    { id: 'foco', top: 0.16 },
    { id: 'plano', top: 0.26 },
    { id: 'progresso', top: 0.34 },
  ] as const;
  const dots = ['bg-pastel-sky', 'bg-pastel-butter', 'bg-pastel-blush', 'bg-pastel-mint'];

  return (
    <section aria-labelledby="moments-title" className="paper-lines border-y border-line bg-surface-2/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHead id="moments-title" kicker={moments.kicker} title={moments.title} em={moments.titleEm} />
        </div>
        <ol className="relative space-y-8 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-[2px] before:bg-line">
          {moments.items.map((it, i) => (
            <li key={it.when} className="relative pl-12">
              <span aria-hidden="true" className={`absolute left-0 top-0.5 grid size-8 place-items-center rounded-full ${dots[i]} font-mono text-xs font-bold ring-4 ring-bg`}>
                {i + 1}
              </span>
              <Reveal delay={0.05}>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-coral-ink">{it.when}</p>
                <h3 className="font-display mt-1.5 text-2xl font-bold">{it.title}</h3>
                <p className="mt-2 max-w-lg text-base leading-relaxed text-muted">{it.body}</p>
                <ShotCrop id={crops[i].id} top={crops[i].top} className="mt-4 max-w-sm" />
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
