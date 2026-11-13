import {
  Calendar,
  CheckCircle2,
  GraduationCap,
  HardDrive,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useGoogleAccounts } from '../../hooks/useGoogleData';
import { useStore } from '../../store/useStore';
import { Badge, Button, Field, Input, Modal } from '../ui';
import { IntegrationCard } from './shared';

export default function GoogleCard() {
  const status = useStore((s) => s.integrations.google);
  const personalNotebookUrl = useStore((s) => s.settings.personalNotebookUrl);
  const updateSettings = useStore((s) => s.updateSettings);

  const [confirmOff, setConfirmOff] = useState(false);

  const {
    personalEmail,
    academicEmail,
    isPersonalConnected,
    isAcademicConnected,
    personalBusy,
    academicBusy,
    scanningDrive,
    message,
    loginPersonal,
    switchPersonal,
    logoutPersonal,
    scanDrive,
    cleanJunk,
    connectAcademic,
    disconnectAcademic,
    syncCalendar,
    disconnectAll,
  } = useGoogleAccounts();

  const effectiveStatus = {
    ...status,
    connected: isPersonalConnected || isAcademicConnected,
    error: isPersonalConnected || isAcademicConnected ? undefined : status.error,
  };

  const handleDisconnectAll = () => {
    disconnectAll();
    setConfirmOff(false);
  };

  return (
    <>
      <IntegrationCard
        icon={<HardDrive size={18} />}
        title="Google & Contas Dual (Pessoal e Académica)"
        description="Gere as tuas duas contas de forma independente: conta pessoal para Google Drive, nuvem e Gemini AI; e conta académica (@campus.fct.unl.pt) para avisos dos docentes no Gmail e CLIP."
        status={effectiveStatus}
      >
        <div className="space-y-4">
          {/* 1. Conta Pessoal Principal */}
          <div className="rounded-xl border border-line bg-surface-2/40 p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent font-semibold">
                  <HardDrive size={17} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-fg text-sm">
                      Conta Principal (Pessoal)
                    </p>
                    {isPersonalConnected ? (
                      <Badge tone="ok">Ligada</Badge>
                    ) : (
                      <Badge tone="warn">Por ligar</Badge>
                    )}
                  </div>
                  <p className="text-muted text-xs">
                    {personalEmail || (isPersonalConnected ? 'Sessão Google pessoal ativa' : 'Opcional · Liga apenas se quiseres importar do Drive ou Agenda')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="accent">Google Drive</Badge>
                <Badge tone="accent">Agenda</Badge>
              </div>
            </div>

            <p className="text-muted leading-relaxed">
              Opcional: permite ler as pastas do Google Drive que associares às tuas cadeiras e importar eventos da Google Agenda. Para iniciar sessão na Unipedia, recomendamos usar Email e Palavra-passe em Conta.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line/60">
              {isPersonalConnected ? (
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={scanDrive}
                    disabled={personalBusy || scanningDrive}
                  >
                    {scanningDrive ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    Varrer Drive e LEMc
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={cleanJunk}
                    disabled={personalBusy || scanningDrive}
                    title="Remove faturas, recibos e ficheiros pessoais erroneamente importados"
                  >
                    <Trash2 size={13} />
                    Limpar Ficheiros Irrelevantes
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={syncCalendar}
                    disabled={personalBusy || scanningDrive}
                  >
                    <Calendar size={13} />
                    Sincronizar Agenda
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={switchPersonal}
                    disabled={personalBusy || scanningDrive}
                  >
                    Trocar Conta Pessoal
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={logoutPersonal}
                    disabled={personalBusy || scanningDrive}
                    className="text-danger hover:text-danger"
                  >
                    Terminar Sessão Pessoal
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={loginPersonal}
                  disabled={personalBusy}
                >
                  <KeyRound size={13} />
                  Iniciar Sessão com Conta Pessoal
                </Button>
              )}
            </div>
          </div>

          {/* 2. Conta Académica da Faculdade */}
          <div className="rounded-xl border border-line bg-surface-2/40 p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="grid size-9 place-items-center rounded-lg bg-[#FCE99F]/70 text-[#6B4800] dark:bg-[#352D14] dark:text-[#FDE68A] font-semibold">
                  <GraduationCap size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-fg text-sm">
                      Conta Académica (Gmail Institucional &amp; CLIP)
                    </p>
                    {isAcademicConnected ? (
                      <Badge tone="ok">Ativa</Badge>
                    ) : (
                      <Badge tone="warn">Por ligar</Badge>
                    )}
                  </div>
                  <p className="text-muted text-xs">
                    {academicEmail || 'Opcional · Email institucional da tua faculdade'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="accent">Gmail Professores</Badge>
                <Badge tone="accent">Só Leitura</Badge>
              </div>
            </div>

            <p className="text-muted leading-relaxed">
              Lê avisos de docentes sobre salas, testes e horários diretamente na caixa académica, em modo só de leitura.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line/60">
              {isAcademicConnected ? (
                <>
                  <div className="flex items-center gap-1.5 text-ok font-medium">
                    <CheckCircle2 size={14} />
                    <span>Conectada: {academicEmail || 'Conta académica ativa'}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={connectAcademic}
                    disabled={academicBusy}
                  >
                    {academicBusy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    Reautenticar / Renovar Token
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={disconnectAcademic}
                    disabled={academicBusy}
                    className="text-danger hover:text-danger"
                  >
                    Desligar Conta Académica
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={connectAcademic}
                  disabled={academicBusy}
                >
                  {academicBusy ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                  Ligar Conta Académica FCT (@campus.fct.unl.pt)
                </Button>
              )}
            </div>
          </div>

          {/* Configuração de Caderno NotebookLM Pessoal */}
          <div className="pt-1">
            <Field label="Link do teu Caderno NotebookLM Pessoal (opcional)">
              <Input
                value={personalNotebookUrl ?? ''}
                placeholder="https://notebooklm.google.com/notebook/..."
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => updateSettings({ personalNotebookUrl: e.target.value.trim() })}
              />
            </Field>
            <p className="mt-1 text-[11px] text-muted">
              Cola aqui o link de partilha do teu caderno no NotebookLM (criado com a tua conta pessoal) para acederes com 1 clique a partir da barra lateral e de cada cadeira.
            </p>
          </div>

          {message && (
            <div className="rounded-lg bg-surface-2 p-2.5 text-xs text-ok font-medium border border-line">
              {message}
            </div>
          )}

          <p className="text-[11px] text-muted">
            Acesso só de leitura. Os tokens de acesso vivem apenas em memória e sessionStorage e nunca são gravados em bases de dados públicas.
          </p>
        </div>
      </IntegrationCard>

      <Modal
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        title="Desligar as contas Google?"
        footer={
          <>
            <Button onClick={() => setConfirmOff(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDisconnectAll}>
              Desligar e apagar eventos
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Os eventos importados da Google Agenda serão removidos desta aplicação. As tuas contas Google não sofrerão alterações.
        </p>
      </Modal>
    </>
  );
}
