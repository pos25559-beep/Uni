import { Cloud } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { Field, Input } from '../ui';
import { CopyField, HowTo, IntegrationCard } from './shared';

export default function MicrosoftCard() {
  const status = useStore((s) => s.integrations.microsoft);
  const clientId = useStore((s) => s.settings.msClientId);
  const updateSettings = useStore((s) => s.updateSettings);
  const origin = window.location.origin;

  return (
    <IntegrationCard
      icon={<Cloud size={18} />}
      title="Microsoft OneDrive"
      description="Ficheiros do OneDrive ligados às cadeiras."
      status={status}
    >
      <HowTo
        steps={[
          <>Abre <a className="text-accent underline-offset-2 hover:underline" href="https://portal.azure.com" target="_blank" rel="noreferrer">portal.azure.com</a> e vai a «Microsoft Entra ID» → «Registos de aplicações» → «Novo registo».</>,
          <>Em «Tipos de conta suportados», escolhe <b className="text-fg">qualquer diretório organizacional e contas Microsoft pessoais</b>.</>,
          <>Em «URI de redirecionamento», escolhe a plataforma <b className="text-fg">Single-page application (SPA)</b> e cola a origem abaixo.</>,
          <>Em «Permissões de API», adiciona do Microsoft Graph as permissões delegadas <b className="text-fg">Files.Read</b> e <b className="text-fg">User.Read</b>.</>,
          <>Copia o «ID da aplicação (cliente)» e cola-o aqui.</>,
        ]}
      />

      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-muted">URI de redirecionamento (SPA)</span>
        <CopyField value={origin} label="o URI" />
      </div>

      <Field label="ID da aplicação (cliente)">
        <Input
          value={clientId}
          placeholder="00000000-0000-0000-0000-000000000000"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => updateSettings({ msClientId: e.target.value.trim() })}
        />
      </Field>

      <p className="text-sm text-muted">
        O início de sessão acontece na primeira vez que importares ficheiros na página{' '}
        <Link to="/materiais" className="text-accent underline-offset-2 hover:underline">Materiais</Link>.
      </p>
    </IntegrationCard>
  );
}
