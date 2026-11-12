import { GraduationCap, Upload } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Button } from '../ui';
import ClipImportModal from './ClipImportModal';
import { HowTo, IntegrationCard } from './shared';

export default function ClipCard() {
  const status = useStore((s) => s.integrations.clip);
  const classCount = useStore((s) => s.classes.filter((c) => c.source === 'clip').length);
  const assessmentCount = useStore((s) => s.assessments.filter((a) => a.source === 'clip').length);
  const eventCount = useStore((s) => s.events.filter((e) => e.source === 'clip').length);
  const [open, setOpen] = useState(false);

  return (
    <>
      <IntegrationCard
        icon={<GraduationCap size={18} />}
        title="CLIP"
        description="Horário, avaliações e eventos da universidade."
        status={status}
      >
        <p className="text-sm text-muted">
          O CLIP não tem API pública nem exportação de calendário, por isso o horário importa-se copiando a página Horário.
          Os exames só aparecem no CLIP quando a faculdade os publica (página «Exames»); até lá, adiciona-os à mão em cada cadeira.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Upload size={16} />
            Importar do CLIP
          </Button>
          {status.connected && (
            <span className="text-xs text-muted">
              {classCount} aulas · {assessmentCount} avaliações · {eventCount} eventos vindos do CLIP
            </span>
          )}
        </div>

        <HowTo
          steps={[
            <>Abre o teu <b className="text-fg">Horário</b> no CLIP e seleciona tudo (Ctrl/Cmd+A), depois copia (Ctrl/Cmd+C).</>,
            <>Abre «Importar do CLIP» e cola na zona indicada (Ctrl/Cmd+V).</>,
            <>Revê a pré-visualização: confirma a cadeira de cada aula e desmarca o que não queres.</>,
            <>Importa. A nova importação substitui a anterior vinda do CLIP.</>,
          ]}
        />
      </IntegrationCard>

      {open && <ClipImportModal onClose={() => setOpen(false)} />}
    </>
  );
}
