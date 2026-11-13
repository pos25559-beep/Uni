import {
  Cloud,
  Compass,
  Database,
  FileText,
  GraduationCap,
  Shield,
  Sliders,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AuthStatus from '../components/auth/AuthStatus';
import { AnimatedPage } from '../components/motion/Primitives';
import OnboardingModal from '../components/onboarding/OnboardingModal';
import { startUnipediaGuidedTour } from '../components/onboarding/TourManager';
import ClipCard from '../components/settings/ClipCard';
import DataCard from '../components/settings/DataCard';
import DeviceStorageCard from '../components/settings/DeviceStorageCard';
import GeminiCard from '../components/settings/GeminiCard';
import GoogleCard from '../components/settings/GoogleCard';
import NotebookCard from '../components/settings/NotebookCard';
import ProfileCard from '../components/settings/ProfileCard';
import { ListGroup, ListRow, PageHeader, SegmentedControl, SubpageHeader, Switch } from '../components/ui';
import { fmtMinutes } from '../lib/selectors';
import { useStore } from '../store/useStore';
import type { Settings as SettingsType } from '../types';

const THEME_LABELS: Record<SettingsType['theme'], string> = {
  system: 'Sistema',
  light: 'Claro',
  dark: 'Escuro',
};

export default function SettingsPage() {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const settings = useStore((s) => s.settings);
  const academicProfile = useStore((s) => s.academicProfile);
  const integrations = useStore((s) => s.integrations);
  const updateSettings = useStore((s) => s.updateSettings);
  const [wizardOpen, setWizardOpen] = useState(false);

  if (section === 'estudo') {
    return (
      <AnimatedPage className="space-y-5">
        <SubpageHeader
          title="Perfil e estudo"
          subtitle="Nome, datas do semestre, meta diária e aparência"
          backTo="/definicoes"
        />
        <ProfileCard />
      </AnimatedPage>
    );
  }

  if (section === 'ligacoes') {
    return (
      <AnimatedPage className="space-y-5">
        <SubpageHeader
          title="Fontes de dados"
          subtitle="Liga apenas os serviços que queres usar na Unipedia"
          backTo="/definicoes"
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <GoogleCard />
          <DeviceStorageCard />
          <ClipCard />
          <NotebookCard />
        </div>
      </AnimatedPage>
    );
  }

  if (section === 'tutor') {
    return (
      <AnimatedPage className="space-y-5">
        <SubpageHeader
          title="Uni · Tutor IA"
          subtitle="Permissão de IA e chave Google Gemini"
          backTo="/definicoes"
        />
        <ListGroup title="Autorização do Uni">
          <ListRow
            icon={<Sparkles size={18} />}
            title="Usar Uni com IA (Gemini)"
            subtitle="Permite o envio de perguntas e apontamentos escolhidos por ti à API Google Gemini."
            trailing={
              <Switch
                checked={Boolean(settings.aiConsent)}
                onCheckedChange={(v) => updateSettings({ aiConsent: v })}
                label="Autorizar o Uni a usar Gemini"
              />
            }
          />
        </ListGroup>
        <GeminiCard />
      </AnimatedPage>
    );
  }

  if (section === 'dados') {
    return (
      <AnimatedPage className="space-y-5">
        <SubpageHeader
          title="Dados e cópias de segurança"
          subtitle="Exporta, restaura ou limpa os teus dados em segurança"
          backTo="/definicoes"
        />
        <DataCard />
      </AnimatedPage>
    );
  }

  const googleConnected = integrations.google.connected;

  return (
    <AnimatedPage className="space-y-6">
      <PageHeader
        eyebrow="Preferências"
        title="As tuas"
        accentTitle="definições"
        subtitle={`${settings.semesterName} · tema ${THEME_LABELS[settings.theme]}`}
      />

      {/* Conta e sincronização */}
      <AuthStatus />

      {/* Aparência rápida */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-surface-2/75 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">Aparência do caderno</p>
          <p className="text-xs text-muted">Segue o sistema ou escolhe claro/escuro</p>
        </div>
        <SegmentedControl
          layoutId="settings-theme-pill"
          value={settings.theme}
          onChange={(v) => updateSettings({ theme: v as SettingsType['theme'] })}
          items={[
            { id: 'system', label: 'Sistema' },
            { id: 'light', label: 'Claro' },
            { id: 'dark', label: 'Escuro' },
          ]}
        />
      </div>

      {/* Grupo 1: Caderno & Estudo */}
      <ListGroup title="Caderno & Estudo">
        <ListRow
          icon={<Sliders size={18} />}
          title="Perfil, semestre e meta diária"
          subtitle={`${settings.userName || 'Estudante'} · ${fmtMinutes(settings.dailyStudyMinutes)}/dia`}
          onClick={() => navigate('/definicoes/estudo')}
        />
        <ListRow
          icon={<GraduationCap size={18} />}
          title="Curso e histórico académico"
          subtitle={
            academicProfile.universityName || academicProfile.degreeName
              ? [academicProfile.universityName, academicProfile.degreeName].filter(Boolean).join(' · ')
              : 'Escolher escola ou universidade'
          }
          onClick={() => setWizardOpen(true)}
        />
        <ListRow
          icon={<Compass size={18} />}
          title="Repetir guia rápido"
          subtitle="Volta a ver os pontos principais do ecrã Hoje"
          onClick={() => {
            navigate('/');
            window.setTimeout(() => startUnipediaGuidedTour(), 350);
          }}
        />
      </ListGroup>

      {/* Grupo 2: Ligações & IA */}
      <ListGroup title="Ligações & Uni">
        <ListRow
          icon={<Cloud size={18} />}
          title="Ligações e importação"
          subtitle="Calendário, email, Drive, pasta local e horários (.ics)"
          badge={googleConnected ? 'Ligado' : undefined}
          badgeTone="ok"
          onClick={() => navigate('/definicoes/ligacoes')}
        />
        <ListRow
          icon={<Sparkles size={18} />}
          title="Uni · Tutor IA (Gemini)"
          subtitle={settings.geminiApiKey ? `Modelo ${settings.geminiModel}` : 'Configurar chave pessoal gratuita'}
          badge={settings.aiConsent ? 'Ativo' : 'Pausado'}
          badgeTone={settings.aiConsent ? 'accent' : 'neutral'}
          onClick={() => navigate('/definicoes/tutor')}
        />
      </ListGroup>

      {/* Grupo 3: Privacidade & Dados */}
      <ListGroup title="Privacidade & Dados">
        <ListRow
          icon={<Database size={18} />}
          title="Exportar cópia e gerir dados"
          subtitle="Backup JSON, restauro local ou limpar tudo"
          onClick={() => navigate('/definicoes/dados')}
        />
        <ListRow
          icon={<Shield size={18} />}
          title="Política de Privacidade"
          subtitle="Como protegemos os teus dados"
          onClick={() => navigate('/privacidade')}
        />
        <ListRow
          icon={<FileText size={18} />}
          title="Termos de Utilização"
          onClick={() => navigate('/termos')}
        />
        <ListRow
          icon={<Trash2 size={18} />}
          title="Eliminar conta e todos os dados"
          danger
          onClick={() => navigate('/eliminar-conta')}
        />
      </ListGroup>

      <OnboardingModal open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </AnimatedPage>
  );
}
