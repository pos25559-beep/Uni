import { Copy, Sparkles } from 'lucide-react';
import { Suspense, lazy, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { estimatePodcastMinutes } from '../../../lib/podcastMeta';
import type { PodcastScript } from '../../../lib/uniVoice';
import type { UniPersonaMode } from '../../../lib/uniAccessories';
import type { UniVoiceConfig } from '../../../types';
import ReaderShell, { ReaderAction } from './ReaderShell';

const PodcastPlayer = lazy(() => import('../PodcastPlayer'));

/**
 * Página do podcast: o leitor de áudio e a transcrição numa coluna centrada, em ecrã inteiro.
 * Sem índice (é um só episódio).
 */
export default function PodcastReader({
  open,
  sheetId,
  script,
  language,
  persona,
  agent,
  globalVoice,
  onClose,
  onCopy,
  onUseInTutor,
}: {
  open: boolean;
  sheetId: string;
  script: PodcastScript;
  language: string;
  persona: UniPersonaMode;
  agent?: { voiceConfig?: UniVoiceConfig; personaId?: UniPersonaMode } | null;
  globalVoice?: UniVoiceConfig;
  onClose: () => void;
  onCopy: () => void;
  onUseInTutor: () => void;
}) {
  const { t } = useTranslation('assistant');
  const minutes = useMemo(() => estimatePodcastMinutes(script), [script]);
  const subtitle = t('notebook.reader.podcastSubtitle', { minutes });

  return (
    <ReaderShell
      open={open}
      onClose={onClose}
      title={script.title.trim() || t('notebook.podcast.episode')}
      subtitle={subtitle}
      actions={
        <>
          <ReaderAction icon={Copy} label={t('notebook.podcast.copy')} onClick={onCopy} />
          <ReaderAction icon={Sparkles} label={t('notebook.useInTutor')} onClick={onUseInTutor} primary />
        </>
      }
    >
      {/* Em ecrãs largos a transcrição aproveita a altura da página. */}
      <div className="lg:[&_ol]:max-h-[55dvh]">
        <Suspense fallback={null}>
          <PodcastPlayer
            key={sheetId}
            sheetId={sheetId}
            script={script}
            language={language}
            persona={persona}
            agent={agent}
            globalVoice={globalVoice}
          />
        </Suspense>
      </div>
    </ReaderShell>
  );
}
