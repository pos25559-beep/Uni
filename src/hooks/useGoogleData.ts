import { useCallback, useEffect, useRef, useState } from 'react';
import { tr } from '../i18n/tr';
import { googleService, type AcademicEmail, type AutoScanProgress } from '../services/googleService';
import { useStore } from '../store/useStore';

/**
 * Hook para leitura e ligação ao correio académico institucional.
 * Reutiliza a cache em memória entre trocas de cadeiras sem chamadas redundantes à API.
 */
export function useAcademicEmails(triggerKey?: string) {
  const courses = useStore((s) => s.courses);
  const savedAcademicEmail = useStore((s) => s.settings.academicEmail);
  const updateSettings = useStore((s) => s.updateSettings);

  const [fetchedEmails, setFetchedEmails] = useState<AcademicEmail[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [tokenLive, setTokenLive] = useState(() => googleService.isGmailConnected());
  const [needsPermission, setNeedsPermission] = useState(false);
  const [academicEmail, setAcademicEmail] = useState<string | null>(
    () =>
      googleService.getAcademicAccountStatus().email ||
      (savedAcademicEmail?.trim() ? savedAcademicEmail.trim() : null),
  );

  const resolvedAcademicEmail =
    googleService.getAcademicAccountStatus().email ||
    academicEmail ||
    (savedAcademicEmail?.trim() ? savedAcademicEmail.trim() : null);
  const hasLiveToken = tokenLive || googleService.isGmailConnected();
  const connected = Boolean(hasLiveToken || resolvedAcademicEmail);
  const emails =
    fetchedEmails ??
    googleService.getCachedAcademicEmails() ??
    googleService.loadPersistedAcademicEmails(courses, resolvedAcademicEmail);

  const fetchLiveEmails = useCallback(
    async (forceRefresh: boolean) => {
      setLoading(true);
      try {
        const res = await googleService.fetchAcademicEmails(courses, forceRefresh);
        const live = googleService.isGmailConnected();
        setTokenLive(live);
        const currentEmail =
          googleService.getAcademicAccountStatus().email ||
          (savedAcademicEmail?.trim() ? savedAcademicEmail.trim() : null);
        if (currentEmail) setAcademicEmail(currentEmail);

        if (!res.hasPermission && res.error === 'insufficient_scopes') {
          setNeedsPermission(true);
          setFetchedEmails(googleService.loadPersistedAcademicEmails(courses, currentEmail));
        } else {
          setNeedsPermission(false);
          setFetchedEmails(res.emails);
        }
      } finally {
        setLoading(false);
      }
    },
    [courses, savedAcademicEmail],
  );

  const connect = useCallback(
    async (forceConsent = false, loginHint?: string) => {
      try {
        const hint = loginHint ?? resolvedAcademicEmail ?? undefined;
        const res = await googleService.connectAcademicAccount(forceConsent, hint);
        setTokenLive(true);
        setNeedsPermission(false);
        const resolved =
          res.email ||
          googleService.getAcademicAccountStatus().email ||
          resolvedAcademicEmail ||
          null;
        setAcademicEmail(resolved);
        if (resolved) {
          updateSettings({ academicEmail: resolved });
        }
        await fetchLiveEmails(true);
      } catch (err) {
        console.warn('Erro ao ligar ao Google Académico:', err);
      }
    },
    [fetchLiveEmails, resolvedAcademicEmail, updateSettings],
  );

  const loadEmails = useCallback(
    async (forceRefresh = false) => {
      const cached = googleService.getCachedAcademicEmails();
      const isConn = googleService.isGmailConnected();
      setTokenLive(isConn);
      if (resolvedAcademicEmail) setAcademicEmail(resolvedAcademicEmail);

      if (!forceRefresh && cached !== null) {
        setFetchedEmails(cached);
        return;
      }

      if (!isConn) {
        if (forceRefresh && resolvedAcademicEmail) {
          await connect(false, resolvedAcademicEmail);
          return;
        }
        setFetchedEmails(googleService.loadPersistedAcademicEmails(courses, resolvedAcademicEmail));
        setNeedsPermission(false);
        return;
      }

      await fetchLiveEmails(forceRefresh);
    },
    [connect, courses, fetchLiveEmails, resolvedAcademicEmail],
  );

  useEffect(() => {
    const isConn = googleService.isGmailConnected();
    const cached = googleService.getCachedAcademicEmails();
    if (!isConn || cached !== null) return;

    let cancelled = false;
    void googleService.fetchAcademicEmails(courses, false).then((res) => {
      if (cancelled) return;
      setTokenLive(googleService.isGmailConnected());
      const latestEmail =
        googleService.getAcademicAccountStatus().email || resolvedAcademicEmail;
      if (latestEmail) setAcademicEmail(latestEmail);
      if (!res.hasPermission && res.error === 'insufficient_scopes') {
        setNeedsPermission(true);
        setFetchedEmails(googleService.loadPersistedAcademicEmails(courses, latestEmail));
      } else {
        setNeedsPermission(false);
        setFetchedEmails(res.emails);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [courses, resolvedAcademicEmail, triggerKey]);

  return {
    emails,
    loading,
    connected,
    hasLiveToken,
    needsPermission,
    academicEmail: resolvedAcademicEmail,
    loadEmails,
    connect,
  };
}

/**
 * Hook partilhado para executar a varredura autónoma do Google Drive (pastas pessoais e LEMc).
 */
export function useDriveAutoScan() {
  const courses = useStore((s) => s.courses);
  const sharedHubDriveUrls = useStore((s) => s.settings.sharedHubDriveUrls);
  const [scanning, setScanning] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [progress, setProgress] = useState<AutoScanProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancelScan = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const runScan = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setScanning(true);
    setFeedback(null);
    setProgress({ foldersScanned: 0, filesFound: 0, stage: tr('common:googleSvc.connectingDrive') });
    try {
      const res = await googleService.scanDriveForCourses(courses, true, {
        extraFolderUrls: sharedHubDriveUrls ?? [],
        signal: controller.signal,
        timeoutMs: 45_000,
        onProgress: (p) => setProgress(p),
      });
      if (res.cancelled) {
        setFeedback(
          res.added > 0
            ? tr('common:googleSvc.scanCancelledSaved', { added: res.added })
            : tr('common:googleSvc.scanCancelled'),
        );
      } else if (res.timedOut) {
        setFeedback(
          res.added > 0
            ? tr('common:googleSvc.scanTimeoutAdded', { added: res.added, folders: res.foldersScanned })
            : tr('common:googleSvc.scanTimeoutEmpty', { folders: res.foldersScanned }),
        );
      } else if (res.added > 0) {
        setFeedback(tr('common:googleSvc.scanDoneAdded', { added: res.added, folders: res.foldersScanned }));
      } else {
        setFeedback(
          tr('common:googleSvc.scanDoneSynced', {
            folders: res.foldersScanned,
            total: res.totalFound,
          }),
        );
      }
      setTimeout(() => setFeedback(null), 7000);
    } catch (err: unknown) {
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code === 'auth/popup-blocked') {
        setFeedback(tr('common:googleSvc.popupBlocked'));
      } else if (code !== 'auth/popup-closed-by-user') {
        const msg = err instanceof Error ? err.message : tr('common:googleSvc.driveAccessErr');
        setFeedback(msg);
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setScanning(false);
      setProgress(null);
    }
  }, [courses, sharedHubDriveUrls]);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  return {
    scanning,
    progress,
    feedback,
    isDriveConnected: googleService.isDriveConnected(),
    runScan,
    cancelScan,
    clearFeedback,
  };
}

/**
 * Hook completo para gerir as duas contas Google (Pessoal e Académica FCT) no ecrã de Definições.
 */
export function useGoogleAccounts() {
  const courses = useStore((s) => s.courses);
  const savedAcademicEmail = useStore((s) => s.settings.academicEmail);
  const updateSettings = useStore((s) => s.updateSettings);
  const replaceSource = useStore((s) => s.replaceSource);
  const setIntegration = useStore((s) => s.setIntegration);
  const cleanupMismatchedMaterials = useStore((s) => s.cleanupMismatchedMaterials);

  const [personalBusy, setPersonalBusy] = useState(false);
  const [academicBusy, setAcademicBusy] = useState(false);
  const [scanningDrive, setScanningDrive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [liveAcademicEmail, setLiveAcademicEmail] = useState<string | null>(
    () => googleService.getAcademicAccountStatus().email,
  );

  const personal = googleService.getPersonalAccountStatus();
  const academic = googleService.getAcademicAccountStatus();
  const academicEmail =
    liveAcademicEmail ||
    academic.email ||
    (savedAcademicEmail?.trim() ? savedAcademicEmail.trim() : null);
  const isPersonalConnected = personal.connected;
  const isAcademicTokenLive = academic.hasToken;
  const isAcademicConnected = Boolean(academic.hasToken || academicEmail);

  const loginPersonal = useCallback(async () => {
    setPersonalBusy(true);
    setMessage(null);
    try {
      const user = await googleService.connectPersonalAccount(false);
      setIntegration('google', {
        connected: true,
        lastSync: new Date().toISOString(),
        error: undefined,
      });
      setMessage(tr('common:googleSvc.personalLoginBusy', { email: user.email ?? '' }));
      const res = await googleService.scanDriveForCourses(courses, false).catch(() => null);
      if (res && res.added > 0) {
        setMessage(tr('common:googleSvc.personalActiveAdded', { email: user.email ?? '', added: res.added }));
      } else {
        setMessage(tr('common:googleSvc.personalActiveSynced', { email: user.email ?? '' }));
      }
    } catch (err: unknown) {
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code !== 'auth/popup-closed-by-user') {
        setMessage(err instanceof Error ? err.message : tr('common:googleSvc.personalLoginErr'));
      }
    } finally {
      setPersonalBusy(false);
    }
  }, [courses, setIntegration]);

  const switchPersonal = useCallback(async () => {
    setPersonalBusy(true);
    setMessage(null);
    try {
      const user = await googleService.switchPersonalAccount();
      setIntegration('google', {
        connected: true,
        lastSync: new Date().toISOString(),
        error: undefined,
      });
      setMessage(tr('common:googleSvc.personalSwitched', { email: user.email ?? '' }));
    } catch (err: unknown) {
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code !== 'auth/popup-closed-by-user') {
        setMessage(err instanceof Error ? err.message : tr('common:googleSvc.switchErr'));
      }
    } finally {
      setPersonalBusy(false);
    }
  }, [setIntegration]);

  const logoutPersonal = useCallback(async () => {
    setPersonalBusy(true);
    try {
      await googleService.disconnectPersonalAccount();
      setIntegration('google', { connected: isAcademicConnected, error: undefined });
      setMessage(tr('common:googleSvc.personalLoggedOut'));
    } finally {
      setPersonalBusy(false);
    }
  }, [isAcademicConnected, setIntegration]);

  const scanDrive = useCallback(async () => {
    setScanningDrive(true);
    setMessage(null);
    try {
      const extraUrls = useStore.getState().settings.sharedHubDriveUrls ?? [];
      const res = await googleService.scanDriveForCourses(courses, true, extraUrls);
      if (res.added > 0) {
        setMessage(tr('common:googleSvc.scanSettingsAdded', { added: res.added }));
      } else {
        setMessage(tr('common:googleSvc.scanSettingsSynced'));
      }
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : tr('common:googleSvc.driveScanErr'));
    } finally {
      setScanningDrive(false);
    }
  }, [courses]);

  const cleanJunk = useCallback(() => {
    const removed = cleanupMismatchedMaterials();
    if (removed > 0) {
      setMessage(tr('common:googleSvc.junkRemoved', { removed }));
    } else {
      setMessage(tr('common:googleSvc.junkClean'));
    }
  }, [cleanupMismatchedMaterials]);

  const connectAcademic = useCallback(async () => {
    setAcademicBusy(true);
    setMessage(null);
    try {
      const shouldForceConsent = !academicEmail || academic.hasToken;
      const res = await googleService.connectAcademicAccount(
        shouldForceConsent,
        academicEmail || undefined,
      );
      setLiveAcademicEmail(res.email);
      if (res.email) {
        updateSettings({ academicEmail: res.email });
      }
      setMessage(tr('common:googleSvc.academicConnected', { email: res.email }));
    } catch (err: unknown) {
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code !== 'auth/popup-closed-by-user') {
        setMessage(err instanceof Error ? err.message : tr('common:googleSvc.academicErr'));
      }
    } finally {
      setAcademicBusy(false);
    }
  }, [academic.hasToken, academicEmail, updateSettings]);

  const disconnectAcademic = useCallback(() => {
    googleService.disconnectAcademicAccount();
    setLiveAcademicEmail(null);
    updateSettings({ academicEmail: '' });
    setMessage(tr('common:googleSvc.academicDisconnected'));
  }, [updateSettings]);

  const syncCalendar = useCallback(async () => {
    setPersonalBusy(true);
    setMessage(null);
    try {
      if (!googleService.isDriveConnected()) {
        await googleService.connectPersonalAccount(false);
      }
      const n = await googleService.syncCalendar();
      setMessage(tr('common:googleSvc.calSynced', { count: n }));
    } catch (err: unknown) {
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code !== 'auth/popup-closed-by-user') {
        setMessage(err instanceof Error ? err.message : tr('common:googleSvc.calSyncErr'));
      }
    } finally {
      setPersonalBusy(false);
    }
  }, []);

  const disconnectAll = useCallback(() => {
    googleService.disconnectAll();
    replaceSource('events', 'google', []);
    setIntegration('google', { connected: false, lastSync: undefined, error: undefined });
    updateSettings({ academicEmail: '' });
    setLiveAcademicEmail(null);
    setMessage(null);
  }, [replaceSource, setIntegration, updateSettings]);

  return {
    personalEmail: personal.email,
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
  };
}
