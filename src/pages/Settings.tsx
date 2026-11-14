import {
  Cloud,
  Compass,
  Database,
  FileText,
  GraduationCap,
  LogOut,
  RefreshCw,
  Shield,
  Sliders,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UniBuddy } from '../components/brand/UnipediaMarks';
import { AnimatedPage } from '../components/motion/Primitives';
import OnboardingModal from '../components/onboarding/OnboardingModal';
import { TabGuideBanner, TabGuideHelpButton } from '../components/onboarding/TabGuideBanner';
import { startUnipediaGuidedTour } from '../components/onboarding/TourManager';
import ClipCard from '../components/settings/ClipCard';
import DataCard from '../components/settings/DataCard';
import DeviceStorageCard from '../components/settings/DeviceStorageCard';
import GeminiCard from '../components/settings/GeminiCard';
import GoogleCard from '../components/settings/GoogleCard';
import NotebookCard from '../components/settings/NotebookCard';
import ProfileCard from '../components/settings/ProfileCard';
import {
  Badge,
  Button,
  ListGroup,
  ListRow,
  PageHeader,
  SegmentedControl,
  SubpageHeader,
  Switch,
  showToast,
} from '../components/ui';
import { APP_PALETTES } from '../lib/academicCredits';
import { auth, logoutFirebase, onAuthStateChanged, type User } from '../lib/firebase';
import { migrateLocalDataToCloud } from '../lib/firestoreSync';
import { fmtMinutes } from '../lib/selectors';
import { resolveUniAccessory } from '../lib/uniAccessories';
import { useStore } from '../store/useStore';
import type { AppTone, Settings as SettingsType } from '../types';

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
  const courses = useStore((s) => s.courses);
  const integrations = useStore((s) => s.integrations);
  const updateSettings = useStore((s) => s.updateSettings);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await migrateLocalDataToCloud();
      showToast('Dados sincronizados com a nuvem!');
    } catch {
      showToast('Erro ao sincronizar agora. Tenta mais tarde.', 'danger');
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    await logoutFirebase();
    updateSettings({ guestMode: false, userName: '' });
    showToast('Sessão terminada.', 'neutral');
  };

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
          subtitle="Tutor nativo, autorização de IA e opções avançadas"
          backTo="/definicoes"
        />
        <ListGroup title="Autorização do Uni">
          <ListRow
            icon={<Sparkles size={18} />}
            title="Usar Uni com IA (Gemini)"
            subtitle="Permite que o Uni responda às tuas perguntas e processe os ficheiros que anexares."
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
  const appTone: AppTone = settings.appTone ?? 'vibrante';
  const isMinimal = appTone === 'serio';
  const activePaletteName =
    APP_PALETTES.find((p) => p.id === (settings.themePalette ?? 'caderno'))?.name ?? 'Caderno Vivo';

  return (
    <AnimatedPage className="space-y-6">
      <PageHeader
        eyebrow="Preferências"
        title="As tuas"
        accentTitle="definições"
        subtitle={`${settings.semesterName} · tema ${THEME_LABELS[settings.theme]}`}
        actions={<TabGuideHelpButton tabKey="definicoes" />}
      />

      <TabGuideBanner tabKey="definicoes" />

      {/* Hero unificado de Perfil & Cloud (sem duplicar cartão AuthStatus abaixo) */}
      <section className="flex flex-col gap-4 rounded-[24px] border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          {isMinimal && user?.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="size-14 shrink-0 rounded-full border border-line object-cover"
            />
          ) : isMinimal ? (
            <div className="grid size-14 shrink-0 place-items-center rounded-full border border-line bg-surface-2 font-display text-lg font-bold text-fg">
              {(settings.userName || user?.displayName || 'E').slice(0, 1).toUpperCase()}
            </div>
          ) : (
            <div className="grid size-14 shrink-0 place-items-center rounded-full bg-pastel-sage/75 dark:bg-surface-2">
              <UniBuddy
                mood="happy"
                accessory={resolveUniAccessory(settings.uniAccessory, academicProfile.degreeName, courses[0]?.name)}
                skin={settings.uniSkin}
                size={44}
                interactive={false}
              />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-lg font-bold text-fg">
                {settings.userName || user?.displayName || 'Estudante'}
              </h2>
              <Badge tone={user ? 'ok' : 'neutral'}>
                {user ? 'Cloud ativa' : 'Apenas neste dispositivo'}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted">
              {academicProfile.degreeName
                ? [academicProfile.universityName, academicProfile.degreeName].filter(Boolean).join(' · ')
                : 'Define o teu curso e ritmo abaixo'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate('/definicoes/estudo')}>
            {isMinimal ? 'Editar perfil & paleta' : 'Editar perfil & Uni'}
          </Button>
          {user ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void handleManualSync()}
                disabled={syncing}
                aria-label="Sincronizar agora"
              >
                <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Sincronizar</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void handleLogout()}
                aria-label="Terminar sessão"
                className="text-muted hover:text-coral-ink"
              >
                <LogOut size={15} />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </>
          ) : (
            <Button size="sm" variant="primary" onClick={() => navigate('/entrar')}>
              Entrar para sincronizar
            </Button>
          )}
        </div>
      </section>

      {/* Aparência rápida: Tema & Estilo (Expressivo vs Sério & Minimal) num só sítio */}
      <section className="space-y-3 rounded-[22px] border border-line/70 bg-surface-2/65 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg">Aparência do caderno</p>
            <p className="text-xs text-muted">Paleta atual: {activePaletteName}</p>
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/80 pt-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg">Estilo visual da app</p>
            <p className="text-xs text-muted">
              {isMinimal
                ? 'Sério & Minimal ativo: superfícies neutras, sem animações nem mascotes.'
                : 'Expressivo ativo: pastéis quentes, animações táteis e Unis vivos.'}
            </p>
          </div>
          <SegmentedControl
            layoutId="settings-tone-pill"
            value={appTone}
            onChange={(v) => updateSettings({ appTone: v as AppTone })}
            items={[
              { id: 'vibrante', label: 'Expressivo' },
              { id: 'serio', label: 'Sério & Minimal' },
            ]}
          />
        </div>
      </section>

      {/* Grupo 1: Caderno & Estudo */}
      <ListGroup title="Caderno & Estudo">
        <ListRow
          icon={<Sliders size={18} />}
          title="Semestre, meta, paleta e Uni"
          subtitle={`${settings.semesterName} · ${fmtMinutes(settings.dailyStudyMinutes)}/dia · ${activePaletteName}`}
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
          title="Uni · Tutor IA"
          subtitle={
            settings.geminiApiKey
              ? 'Chave pessoal ligada · Limite alargado'
              : 'Uni Nativo · Respostas diárias incluídas'
          }
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
          subtitle="Backup JSON, dados de exemplo e limpeza local"
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
      </ListGroup>

      {/* Zona de perigo isolada */}
      <section className="rounded-[22px] border border-coral/35 bg-coral-soft/45 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-coral-ink">Zona de perigo</h3>
            <p className="mt-0.5 text-xs text-muted">
              Remove permanentemente os dados deste dispositivo e, se tiveres conta, elimina a tua conta na nuvem.
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={() => navigate('/eliminar-conta')}>
            <Trash2 size={15} />
            Eliminar conta e dados
          </Button>
        </div>
      </section>

      <OnboardingModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        initialStepId="curso"
        title="Curso e histórico académico"
      />
    </AnimatedPage>
  );
}
