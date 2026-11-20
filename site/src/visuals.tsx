import type { ReactNode } from 'react';
import { useCopy } from './i18n';
import type { FeatureId } from './routes';
import { PhoneShot, ShotCrop, type ShotId } from './screens';

type Crop = { crop: ShotId; top: number };
type Entry = ShotId | ShotId[] | Crop;

/**
 * Ecrãs reais usados nas secções de cada página (um por secção, pela ordem do texto).
 * Onde o ecrã da abertura se repetiria, usa-se um recorte ampliado (`crop`), que também deixa ler a interface.
 */
const SECTION_SHOTS: Record<FeatureId, Entry[]> = {
  comecar: ['onboarding', { crop: 'onboarding-cadeiras', top: 0.08 }, 'hub-passos', 'hub'],
  plano: ['calendario', { crop: 'plano', top: 0.25 }, 'hoje', ['foco', 'pratica']],
  materiais: ['materiais-origens', 'hub-passos', { crop: 'materiais', top: 0.42 }, 'tutor'],
  progresso: [{ crop: 'progresso', top: 0.33 }, 'cadeira', 'estante', ['estante', 'uni-adotar']],
  uni: ['uni-adotar', 'cadeira', 'estante', 'tutor'],
};

/** Dois telemóveis lado a lado, ligeiramente desencontrados. */
export function Pair({ a, b }: { a: ShotId; b: ShotId }) {
  return (
    <div className="flex items-start justify-center">
      <PhoneShot id={a} size="sm" className="relative z-10 -rotate-3" />
      <PhoneShot id={b} size="sm" className="-ml-16 mt-12 rotate-3 sm:-ml-10" />
    </div>
  );
}

/** Os 4 modos do Caderno do Uni (nomes reais da app), ao lado do ecrã do Tutor. */
function NotebookModes() {
  const { app } = useCopy();
  const modes = [
    { label: app.uni.guide, tone: 'bg-pastel-sky', icon: 'M5 4h10l4 4v12H5zM9 12h6M9 16h6' },
    { label: app.uni.quiz, tone: 'bg-pastel-peach', icon: 'M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.6V14M12 18h.01' },
    { label: app.uni.summary, tone: 'bg-pastel-butter', icon: 'M5 6h14M5 12h10M5 18h7' },
    { label: app.uni.podcast, tone: 'bg-pastel-mint', icon: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3ZM6 11a6 6 0 0 0 12 0M12 17v4' },
  ];
  return (
    <div className="w-full max-w-[220px] rounded-[22px] bg-surface p-3.5 shadow-card ring-1 ring-line">
      <p className="text-sm font-semibold">{app.uni.notebook}</p>
      <ul className="mt-2.5 space-y-2">
        {modes.map((m) => (
          <li key={m.label} className={`flex items-center gap-2.5 rounded-xl ${m.tone} px-3 py-2.5 text-sm font-semibold text-fg`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={m.icon} />
            </svg>
            {m.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SectionVisual({ page, index }: { page: FeatureId; index: number }) {
  const entry = SECTION_SHOTS[page][index];
  let content: ReactNode;
  if (page === 'uni' && index === 3) {
    content = (
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-end sm:justify-center">
        <PhoneShot id="tutor" size="sm" />
        <NotebookModes />
      </div>
    );
  } else if (Array.isArray(entry)) {
    content = <Pair a={entry[0]} b={entry[1]} />;
  } else if (typeof entry === 'object') {
    content = <ShotCrop id={entry.crop} top={entry.top} className="mx-auto max-w-md" />;
  } else {
    content = (
      <div className="flex justify-center">
        <PhoneShot id={entry} />
      </div>
    );
  }
  return <div className="py-2">{content}</div>;
}
