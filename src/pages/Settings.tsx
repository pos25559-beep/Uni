import {
  Bell,
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
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { UniBuddy } from '../components/brand/UnipediaMarks';
import { AnimatedPage, StickerBadge } from '../components/motion/Primitives';
import OnboardingModal from '../components/onboarding/OnboardingModal';
import { TabGuideBanner, TabGuideHelpButton } from '../components/onboarding/TabGuideBanner';
import { startUnipediaGuidedTour } from '../lib/tourRunner';
import ClipCard from '../components/settings/ClipCard';
import DataCard from '../components/settings/DataCard';
import DeviceStorageCard from '../components/settings/DeviceStorageCard';
import GeminiCard from '../components/settings/GeminiCard';
import GoogleCard from '../components/settings/GoogleCard';
import NotebookCard from '../components/settings/NotebookCard';
import NotificationsCard from '../components/settings/NotificationsCard';
import ProfileCard from '../components/settings/ProfileCard';
import { Badge, Button, ListGroup, ListRow, PageHeader, SegmentedControl, SubpageHeader, Switch } from '../components/ui';
import { showToast } from '../lib/uiHelpers';
import { APP_PALETTES } from '../lib/academicCredits';
import { auth, logoutFirebase, onAuthStateChanged, type User } from '../lib/firebase';
import { migrateLocalDataToCloud } from '../lib/firestoreSync';
import { fmtMinutes } from '../lib/selectors';
import { resolveUniAccessory } from '../lib/uniAccessories';
import { useStore } from '../store/useStore';
import type { AppTone, Settings as SettingsType } from '../types';

export default function SettingsPage() {
  const { t } = useTranslation('settings');
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
      showToast(t('hero.syncedToast'));
    } catch {
      showToast(t('hero.syncErrorToast'), 'danger');
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    await logoutFirebase();
    updateSettings({ guestMode: false, userName: '' });
    showToast(t('hero.loggedOutToast'), 'neutral');
  };

  if (section === 'estudo') {
    return (
      <AnimatedPage className="space-y-5">
        <SubpageHeader
          title={t('sections.estudo.title')}
          subtitle={t('sections.estudo.subtitle')}
          backTo="/definicoes"
        />
        <ProfileCard />
      </AnimatedPage>
    );
  }

  if (section === 'notificacoes') {
    return (
      <AnimatedPage className="space-y-5">
        <SubpageHeader
          title={t('sections.notificacoes.title')}
          subtitle={t('sections.notificacoes.subtitle')}
          backTo="/definicoes"
        />
        <NotificationsCard hideHeader />
      </AnimatedPage>
    );
  }

  if (section === 'ligacoes') {
    return (
      <AnimatedPage className="space-y-5">
        <SubpageHeader
          title={t('sections.ligacoes.title')}
          subtitle={t('sections.ligacoes.subtitle')}
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
          title={t('sections.tutor.title')}
          subtitle={t('sections.tutor.subtitle')}
          backTo="/definicoes"
        />
        <ListGroup title={t('sections.tutor.consentGroup')}>
          <ListRow
            icon={<Sparkles size={18} />}
            title={t('sections.tutor.consentTitle')}
            subtitle={t('sections.tutor.consentDesc')}
            trailing={
              <Switch
                checked={Boolean(settings.aiConsent)}
                onCheckedChange={(v) => updateSettings({ aiConsent: v })}
                label={t('sections.tutor.consentAria')}
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
          title={t('sections.dados.title')}
          subtitle={t('sections.dados.subtitle')}
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
    <AnimatedPage className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        accentTitle={t('accentTitle')}
        subtitle={[settings.semesterName.trim(), t(`appearance.themes.${settings.theme}`)].filter(Boolean).join(' · ')}
        actions={<TabGuideHelpButton tabKey="definicoes" />}
      />

      <TabGuideBanner tabKey="definicoes" />

      {/* Hero unificado de Perfil & Cloud estilo Caderno Vivo */}
      <section
        className={
          isMinimal
            ? 'flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between'
            : 'flex flex-col gap-4 rounded-3xl bg-pastel-butter/75 p-5 text-[#141312] shadow-card dark:bg-surface-2 dark:text-[#FAF6EC] sm:flex-row sm:items-center sm:justify-between'
        }
      >
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
            <div className="grid size-15 shrink-0 place-items-center rounded-full bg-white/80 shadow-card dark:bg-black/25">
              <UniBuddy
                mood="happy"
                accessory={resolveUniAccessory(settings.uniAccessory, academicProfile.degreeName, courses[0]?.name)}
                skin={settings.uniSkin}
                size={46}
                interactive={false}
              />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-lg font-bold">
                {settings.userName || user?.displayName || t('hero.defaultName')}
              </h2>
              {isMinimal ? (
                <Badge tone={user ? 'ok' : 'neutral'}>
                  {user ? t('hero.cloudActive') : t('hero.localOnly')}
                </Badge>
              ) : (
                <StickerBadge tone={user ? 'mint' : 'peach'} tilt={-2}>
                  {user ? t('hero.cloudActive') : t('hero.localOnlyShort')}
                </StickerBadge>
              )}
            </div>
            <p className="mt-1 truncate text-xs opacity-75">
              {academicProfile.degreeName
                ? [academicProfile.universityName, academicProfile.degreeName].filter(Boolean).join(' · ')
                : t('hero.completeProfileHint')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate('/definicoes/estudo')}>
            {isMinimal ? t('hero.editProfileMinimal') : t('hero.editProfileUni')}
          </Button>
          {user ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleManualSync()}
                disabled={syncing}
                aria-label={t('hero.syncAria')}
              >
                <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">{t('hero.sync')}</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void handleLogout()}
                aria-label={t('hero.signOutAria')}
                className="opacity-80 hover:text-coral-ink hover:opacity-100"
              >
                <LogOut size={15} />
                <span className="hidden sm:inline">{t('hero.signOut')}</span>
              </Button>
            </>
          ) : (
            <Button size="sm" variant="primary" onClick={() => navigate('/entrar')}>
              {t('hero.signInToSync')}
            </Button>
          )}
        </div>
      </section>

      {/* Aparência rápida: Tema & Estilo (Expressivo vs Sério & Minimal) num só sítio (em desktop fica acima; no telemóvel as 5 categorias aparecem primeiro) */}
      <section
        className={
          isMinimal
            ? 'order-3 space-y-3 rounded-2xl border border-line/70 bg-surface-2/65 p-4 md:order-2'
            : 'order-3 space-y-3 rounded-3xl bg-pastel-sky/50 p-5 text-[#141312] shadow-card dark:bg-surface-2 dark:text-[#FAF6EC] md:order-2'
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-sm font-bold">{t('appearance.title')}</p>
            <p className="text-xs opacity-75">{t('appearance.paletteHint', { name: activePaletteName })}</p>
          </div>
          <SegmentedControl
            layoutId="settings-theme-pill"
            value={settings.theme}
            onChange={(v) => updateSettings({ theme: v as SettingsType['theme'] })}
            items={[
              { id: 'system', label: t('appearance.themes.system') },
              { id: 'light', label: t('appearance.themes.light') },
              { id: 'dark', label: t('appearance.themes.dark') },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3 dark:border-white/10">
          <div className="min-w-0">
            <p className="font-display text-sm font-bold">{t('appearance.toneTitle')}</p>
            <p className="text-xs opacity-75">
              {isMinimal ? t('appearance.toneMinimalHint') : t('appearance.toneVibrantHint')}
            </p>
          </div>
          <SegmentedControl
            layoutId="settings-tone-pill"
            value={appTone}
            onChange={(v) => updateSettings({ appTone: v as AppTone })}
            items={[
              { id: 'vibrante', label: t('appearance.toneVibrant') },
              { id: 'serio', label: t('appearance.toneMinimal') },
            ]}
          />
        </div>

        <div className="space-y-2 border-t border-black/10 pt-3 dark:border-white/10">
          <p className="font-display text-sm font-bold">{t('appearance.paletteTitle')}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {APP_PALETTES.map((pal) => {
              const active = (settings.themePalette ?? 'caderno') === pal.id;
              return (
                <button
                  key={pal.id}
                  type="button"
                  onClick={() => updateSettings({ themePalette: pal.id })}
                  className={
                    active
                      ? 'flex min-h-[44px] items-center gap-2 rounded-2xl border border-accent bg-white/90 px-3 py-2 text-left text-xs font-semibold text-[#141312] shadow-card dark:bg-surface dark:text-fg'
                      : 'flex min-h-[44px] items-center gap-2 rounded-2xl border border-black/10 bg-white/45 px-3 py-2 text-left text-xs font-medium text-[#141312]/85 transition hover:bg-white/75 dark:border-white/10 dark:bg-black/20 dark:text-fg/85'
                  }
                >
                  <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
                    <span
                      className="size-3.5 rounded-full border border-black/15"
                      style={{ backgroundColor: pal.bgHex }}
                    />
                    <span
                      className="size-3.5 rounded-full border border-black/15"
                      style={{ backgroundColor: pal.accentHex }}
                    />
                  </span>
                  <span className="min-w-0 truncate">{pal.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="order-2 space-y-6 md:order-3">
      {/* Grupo 1: Caderno & Estudo */}
      <ListGroup title={t('groups.studyTitle')}>
        <ListRow
          icon={<Sliders size={18} />}
          title={t('groups.semesterRowTitle')}
          subtitle={[
            settings.semesterName.trim(),
            t('groups.perDaySuffix', { time: fmtMinutes(settings.dailyStudyMinutes) }),
          ]
            .filter(Boolean)
            .join(' · ')}
          onClick={() => navigate('/definicoes/estudo')}
        />
        <ListRow
          icon={<Bell size={18} />}
          title={t('groups.remindersRowTitle')}
          subtitle={
            settings.notifications?.enabled
              ? t('groups.remindersOn', {
                  max: settings.notifications.maxDailyNudges ?? 2,
                  start: settings.notifications.quietStart ?? '22:30',
                  end: settings.notifications.quietEnd ?? '08:30',
                })
              : t('groups.remindersOff')
          }
          trailing={
            <Badge tone={settings.notifications?.enabled ? 'ok' : 'neutral'}>
              {settings.notifications?.enabled
                ? t('groups.remindersActiveBadge')
                : t('groups.remindersOptInBadge')}
            </Badge>
          }
          onClick={() => navigate('/definicoes/notificacoes')}
        />
        <ListRow
          icon={<GraduationCap size={18} />}
          title={t('groups.curriculumRowTitle')}
          subtitle={
            academicProfile.universityName || academicProfile.degreeName
              ? [academicProfile.universityName, academicProfile.degreeName].filter(Boolean).join(' · ')
              : t('groups.curriculumSubtitleEmpty')
          }
          onClick={() => setWizardOpen(true)}
        />
        <ListRow
          icon={<Compass size={18} />}
          title={t('groups.tourRowTitle')}
          subtitle={t('groups.tourSubtitle')}
          onClick={() => {
            navigate('/');
            window.setTimeout(() => startUnipediaGuidedTour(), 350);
          }}
        />
      </ListGroup>

      {/* Grupo 2: Ligações & IA */}
      <ListGroup title={t('groups.connectionsTitle')}>
        <ListRow
          icon={<Cloud size={18} />}
          title={t('groups.connectionsRowTitle')}
          subtitle={t('groups.connectionsRowSubtitle')}
          badge={googleConnected ? t('groups.connectedBadge') : undefined}
          badgeTone="ok"
          onClick={() => navigate('/definicoes/ligacoes')}
        />
        <ListRow
          icon={<Sparkles size={18} />}
          title={t('groups.tutorRowTitle')}
          subtitle={
            settings.geminiApiKey ? t('groups.tutorKeyConnected') : t('groups.tutorNativeIncluded')
          }
          badge={settings.aiConsent ? t('groups.activeBadge') : t('groups.pausedBadge')}
          badgeTone={settings.aiConsent ? 'accent' : 'neutral'}
          onClick={() => navigate('/definicoes/tutor')}
        />
      </ListGroup>

      {/* Grupo 3: Privacidade & Dados */}
      <ListGroup title={t('groups.privacyTitle')}>
        <ListRow
          icon={<Database size={18} />}
          title={t('groups.backupRowTitle')}
          subtitle={t('groups.backupRowSubtitle')}
          onClick={() => navigate('/definicoes/dados')}
        />
        <ListRow
          icon={<Shield size={18} />}
          title={t('groups.privacyPolicyRowTitle')}
          subtitle={t('groups.privacyPolicyRowSubtitle')}
          onClick={() => navigate('/privacidade')}
        />
        <ListRow
          icon={<FileText size={18} />}
          title={t('groups.termsRowTitle')}
          onClick={() => navigate('/termos')}
        />
      </ListGroup>
      </div>

      {/* Zona de perigo isolada */}
      <section className="order-4 rounded-2xl border border-coral/35 bg-coral-soft/45 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-coral-ink">{t('dangerZone.title')}</h3>
            <p className="mt-0.5 text-xs text-muted">{t('dangerZone.body')}</p>
          </div>
          <Button variant="danger" size="sm" onClick={() => navigate('/eliminar-conta')}>
            <Trash2 size={15} />
            {t('dangerZone.cta')}
          </Button>
        </div>
      </section>

      <OnboardingModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        initialStepId="curso"
        title={t('groups.curriculumRowTitle')}
      />
    </AnimatedPage>
  );
}
