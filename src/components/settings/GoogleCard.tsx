import { Calendar, Unplug } from 'lucide-react';
import { useState } from 'react';
import { signOutGoogle } from '../../integrations/googleAuth';
import { syncGoogleCalendar } from '../../integrations/gcal';
import { useStore } from '../../store/useStore';
import { Button, Field, Input, Modal } from '../ui';
import { CopyField, HowTo, IntegrationCard } from './shared';

export default function GoogleCard() {
  const status = useStore((s) => s.integrations.google);
  const clientId = useStore((s) => s.settings.googleClientId);
  const updateSettings = useStore((s) => s.updateSettings);
  const replaceSource = useStore((s) => s.replaceSource);
  const setIntegration = useStore((s) => s.setIntegration);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);

  const origin = window.location.origin;

  const sync = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const n = await syncGoogleCalendar();
      setMessage(`${n} ${n === 1 ? 'evento importado' : 'eventos importados'}`);
    } catch {
      // O erro fica guardado na integração e aparece no cartão de estado.
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    signOutGoogle();
    replaceSource('events', 'google', []);
    setIntegration('google', { connected: false, lastSync: undefined, error: undefined });
    setConfirmOff(false);
    setMessage(null);
  };

  return (
    <>
      <IntegrationCard
        icon={<Calendar size={18} />}
        title="Google (Drive + Agenda)"
        description="Eventos da Google Agenda e ficheiros do Drive."
        status={status}
      >
        <HowTo
          steps={[
            <>Abre <a className="text-accent underline-offset-2 hover:underline" href="https://console.cloud.google.com" target="_blank" rel="noreferrer">console.cloud.google.com</a> e cria um projeto.</>,
            <>Em «APIs e serviços» → «Biblioteca», ativa a <b className="text-fg">Google Drive API</b> e a <b className="text-fg">Google Calendar API</b>.</>,
            <>Em «Ecrã de consentimento OAuth», escolhe <b className="text-fg">Externo</b> e adiciona a tua conta Google como utilizador de teste.</>,
            <>Em «Credenciais», escolhe «Criar credenciais» → «ID do cliente OAuth» e o tipo <b className="text-fg">Aplicação Web</b>.</>,
            <>Em «Origens JavaScript autorizadas», adiciona a origem mostrada abaixo.</>,
            <>Copia o Client ID gerado e cola-o aqui.</>,
          ]}
        />

        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-muted">Origem JavaScript autorizada</span>
          <CopyField value={origin} label="a origem" />
        </div>

        <Field label="Client ID">
          <Input
            value={clientId}
            placeholder="xxxxxxxx.apps.googleusercontent.com"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => updateSettings({ googleClientId: e.target.value.trim() })}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={sync} disabled={busy || !clientId.trim()}>
            <Calendar size={16} />
            {busy ? 'A sincronizar…' : 'Ligar e sincronizar agenda'}
          </Button>
          {status.connected && (
            <Button variant="danger" onClick={() => setConfirmOff(true)} disabled={busy}>
              <Unplug size={16} />
              Desligar
            </Button>
          )}
        </div>

        {message && <p className="text-sm text-ok">{message}</p>}

        <p className="text-xs text-muted">
          Acesso só de leitura. O token fica apenas em memória e é pedido de novo ao recarregar a página.
        </p>
      </IntegrationCard>

      <Modal
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        title="Desligar a Google?"
        footer={
          <>
            <Button onClick={() => setConfirmOff(false)}>Cancelar</Button>
            <Button variant="danger" onClick={disconnect}>Desligar e apagar eventos</Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Os eventos importados da Google Agenda serão removidos desta app. Os da tua conta Google não são alterados.
        </p>
      </Modal>
    </>
  );
}
