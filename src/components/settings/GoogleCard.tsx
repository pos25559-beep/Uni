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
import { useTranslation } from 'react-i18next';
import { useGoogleAccounts } from '../../hooks/useGoogleData';
import { useStore } from '../../store/useStore';
import { Badge, Button, Modal } from '../ui';
import { IntegrationCard } from './shared';

export default function GoogleCard() {
  const { t } = useTranslation('settings');
  const status = useStore((s) => s.integrations.google);

  const [confirmOff, setConfirmOff] = useState(false);

  const {
    personalEmail,
    academicEmail,
    isPersonalConnected,
    isAcademicConnected,
    isAcademicTokenLive,
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
        title={t('google.title')}
        description={t('google.desc')}
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
                      {t('google.personal')}
                    </p>
                    {isPersonalConnected ? (
                      <Badge tone="ok">{t('google.linked')}</Badge>
                    ) : (
                      <Badge tone="warn">{t('google.notLinked')}</Badge>
                    )}
                  </div>
                  <p className="text-muted text-xs">
                    {personalEmail || (isPersonalConnected ? t('google.personalActive') : t('google.personalOptional'))}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="accent">Google Drive</Badge>
                <Badge tone="accent">{t('google.calendar')}</Badge>
              </div>
            </div>

            <p className="text-muted leading-relaxed">
              {t('google.personalInfo')}
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
                    {t('google.scanDrive')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={cleanJunk}
                    disabled={personalBusy || scanningDrive}
                    title={t('google.cleanupTitle')}
                  >
                    <Trash2 size={13} />
                    {t('google.cleanup')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={syncCalendar}
                    disabled={personalBusy || scanningDrive}
                  >
                    <Calendar size={13} />
                    {t('google.syncCal')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={switchPersonal}
                    disabled={personalBusy || scanningDrive}
                  >
                    {t('google.switch')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={logoutPersonal}
                    disabled={personalBusy || scanningDrive}
                    className="text-danger hover:text-danger"
                  >
                    {t('google.signOutPersonal')}
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
                  {t('google.signInPersonal')}
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
                      {t('google.academic')}
                    </p>
                    {isAcademicConnected ? (
                      isAcademicTokenLive ? (
                        <Badge tone="ok">{t('google.active')}</Badge>
                      ) : (
                        <Badge tone="accent">{t('google.stored')}</Badge>
                      )
                    ) : (
                      <Badge tone="warn">{t('google.notLinked')}</Badge>
                    )}
                  </div>
                  <p className="text-muted text-xs">
                    {isAcademicConnected && academicEmail ? academicEmail : t('google.academicOptional')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="accent">{t('google.teachersGmail')}</Badge>
                <Badge tone="accent">{t('google.readOnly')}</Badge>
              </div>
            </div>

            <p className="text-muted leading-relaxed">
              {t('google.academicInfo')}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line/60">
              {isAcademicConnected ? (
                <>
                  <div className="flex items-center gap-1.5 text-ok font-medium">
                    <CheckCircle2 size={14} />
                    <span>{t('google.connectedTo', { email: academicEmail || t('google.academicActive') })}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={connectAcademic}
                    disabled={academicBusy}
                  >
                    {academicBusy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    {isAcademicTokenLive ? t('google.reauth') : t('google.renew')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={disconnectAcademic}
                    disabled={academicBusy}
                    className="text-danger hover:text-danger"
                  >
                    {t('google.disconnectAcademic')}
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
                  {t('google.connectAcademic')}
                </Button>
              )}
            </div>
          </div>

          {message && (
            <div className="rounded-lg bg-surface-2 p-2.5 text-xs text-ok font-medium border border-line">
              {message}
            </div>
          )}

          <p className="text-xs text-muted">
            {t('google.tokensInfo')}
          </p>
        </div>
      </IntegrationCard>

      <Modal
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        title={t('google.offTitle')}
        footer={
          <>
            <Button onClick={() => setConfirmOff(false)}>{t('google.cancel')}</Button>
            <Button variant="danger" onClick={handleDisconnectAll}>
              {t('google.offConfirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {t('google.offBody')}
        </p>
      </Modal>
    </>
  );
}
