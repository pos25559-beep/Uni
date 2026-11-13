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
        title="Importar horário e pauta"
        description="Calendário .ics ou página de horário do portal da tua escola."
        status={status}
      >
        <p className="text-sm text-muted">
          Importa rapidamente o teu ficheiro de calendário (.ics) ou cola a tabela de horários do portal da tua faculdade para preencher aulas e exames.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Upload size={16} />
            Importar horário
          </Button>
          {status.connected && (
            <span className="text-xs text-muted">
              {classCount} aulas · {assessmentCount} avaliações · {eventCount} eventos importados
            </span>
          )}
        </div>

        <HowTo
          steps={[
            <>Exporta o teu horário em formato <b className="text-fg">.ics</b> ou copia a tabela no portal académico.</>,
            <>Carrega em «Importar horário» e escolhe o ficheiro ou cola o texto.</>,
            <>Confirma a cadeira correspondente a cada aula e importa sem perder o resto dos teus dados.</>,
          ]}
        />
      </IntegrationCard>

      {open && <ClipImportModal onClose={() => setOpen(false)} />}
    </>
  );
}
