import { useCallback, useEffect, useState } from 'react';
import { googleService, type AcademicEmail } from '../services/googleService';
import { useStore } from '../store/useStore';

/**
 * Hook para leitura e ligação ao correio académico institucional.
 * Reutiliza a cache em memória entre trocas de cadeiras sem chamadas redundantes à API.
 */
export function useAcademicEmails(triggerKey?: string) {
  const courses = useStore((s) => s.courses);
  const [emails, setEmails] = useState<AcademicEmail[]>(
    () => googleService.getCachedAcademicEmails() ?? [],
  );
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(() => googleService.isGmailConnected());
  const [needsPermission, setNeedsPermission] = useState(false);
  const [academicEmail, setAcademicEmail] = useState<string | null>(
    () => googleService.getAcademicAccountStatus().email,
  );

  const loadEmails = useCallback(
    async (forceRefresh = false) => {
      const cached = googleService.getCachedAcademicEmails();
      const isConn = googleService.isGmailConnected();
      setConnected(isConn);
      setAcademicEmail(googleService.getAcademicAccountStatus().email);

      if (!forceRefresh && cached !== null) {
        setEmails(cached);
        return;
      }

      if (!isConn) {
        setEmails([]);
        setNeedsPermission(false);
        return;
      }

      setLoading(true);
      try {
        const res = await googleService.fetchAcademicEmails(courses, forceRefresh);
        if (!res.hasPermission && res.error === 'insufficient_scopes') {
          setNeedsPermission(true);
          setEmails([]);
        } else {
          setNeedsPermission(false);
          setEmails(res.emails);
        }
      } finally {
        setLoading(false);
      }
    },
    [courses],
  );

  useEffect(() => {
    const isConn = googleService.isGmailConnected();
    const cached = googleService.getCachedAcademicEmails();
    if (!isConn || cached !== null) return;

    let cancelled = false;
    void googleService.fetchAcademicEmails(courses, false).then((res) => {
      if (cancelled) return;
      setConnected(true);
      setAcademicEmail(googleService.getAcademicAccountStatus().email);
      if (!res.hasPermission && res.error === 'insufficient_scopes') {
        setNeedsPermission(true);
        setEmails([]);
      } else {
        setNeedsPermission(false);
        setEmails(res.emails);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [courses, triggerKey]);

  const connect = useCallback(
    async (forceConsent = false) => {
      try {
        const res = await googleService.connectAcademicAccount(forceConsent);
        setConnected(true);
        setNeedsPermission(false);
        setAcademicEmail(res.email || googleService.getAcademicAccountStatus().email);
        await loadEmails(true);
      } catch (err) {
        console.warn('Erro ao ligar ao Google Académico:', err);
      }
    },
    [loadEmails],
  );

  return {
    emails,
    loading,
    connected,
    needsPermission,
    academicEmail,
    loadEmails,
    connect,
  };
}

/**
 * Hook partilhado para executar a varredura autónoma do Google Drive (pastas pessoais e LEMc).
 */
export function useDriveAutoScan() {
  const courses = useStore((s) => s.courses);
  const [scanning, setScanning] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    setScanning(true);
    setFeedback(null);
    try {
      const res = await googleService.scanDriveForCourses(courses, true);
      if (res.added > 0) {
        setFeedback(`Varredura concluída: ${res.added} novos materiais adicionados (${res.foldersScanned} pastas analisadas)!`);
      } else {
        setFeedback(`Varredura concluída (${res.foldersScanned} pastas, ${res.totalFound} ficheiros analisados): as pastas do Drive já estavam sincronizadas.`);
      }
      setTimeout(() => setFeedback(null), 6000);
    } catch (err: unknown) {
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code !== 'auth/popup-closed-by-user') {
        const msg = err instanceof Error ? err.message : 'Erro ao aceder ao Google Drive.';
        setFeedback(msg);
      }
    } finally {
      setScanning(false);
    }
  }, [courses]);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  return {
    scanning,
    feedback,
    isDriveConnected: googleService.isDriveConnected(),
    runScan,
    clearFeedback,
  };
}

/**
 * Hook completo para gerir as duas contas Google (Pessoal e Académica FCT) no ecrã de Definições.
 */
export function useGoogleAccounts() {
  const courses = useStore((s) => s.courses);
  const replaceSource = useStore((s) => s.replaceSource);
  const setIntegration = useStore((s) => s.setIntegration);
  const cleanupMismatchedMaterials = useStore((s) => s.cleanupMismatchedMaterials);

  const [personalBusy, setPersonalBusy] = useState(false);
  const [academicBusy, setAcademicBusy] = useState(false);
  const [scanningDrive, setScanningDrive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [academicEmail, setAcademicEmail] = useState<string | null>(
    () => googleService.getAcademicAccountStatus().email,
  );

  const personal = googleService.getPersonalAccountStatus();
  const academic = googleService.getAcademicAccountStatus();
  const isPersonalConnected = personal.connected;
  const isAcademicConnected = Boolean(academic.hasToken);

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
      setMessage(`Sessão pessoal iniciada com sucesso (${user.email}). A verificar pastas do Drive...`);
      const res = await googleService.scanDriveForCourses(courses, false).catch(() => null);
      if (res && res.added > 0) {
        setMessage(`Sessão pessoal ativa (${user.email}). ${res.added} novos materiais foram organizados no repositório.`);
      } else {
        setMessage(`Sessão pessoal ativa (${user.email}). Google Drive e Nuvem sincronizados.`);
      }
    } catch (err: unknown) {
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code !== 'auth/popup-closed-by-user') {
        setMessage(err instanceof Error ? err.message : 'Erro ao iniciar sessão com a conta pessoal Google.');
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
      setMessage(`Conta pessoal alterada para: ${user.email}`);
    } catch (err: unknown) {
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code !== 'auth/popup-closed-by-user') {
        setMessage(err instanceof Error ? err.message : 'Erro ao trocar de conta.');
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
      setMessage('Sessão pessoal da Google terminada.');
    } finally {
      setPersonalBusy(false);
    }
  }, [isAcademicConnected, setIntegration]);

  const scanDrive = useCallback(async () => {
    setScanningDrive(true);
    setMessage(null);
    try {
      const res = await googleService.scanDriveForCourses(courses, false);
      if (res.added > 0) {
        setMessage(`Varredura concluída: ${res.added} novos materiais académicos adicionados às tuas cadeiras!`);
      } else {
        setMessage('Varredura concluída: todas as pastas do Google Drive e do LEMc já se encontram sincronizadas.');
      }
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Erro ao varrer o Google Drive.');
    } finally {
      setScanningDrive(false);
    }
  }, [courses]);

  const cleanJunk = useCallback(() => {
    const removed = cleanupMismatchedMaterials();
    if (removed > 0) {
      setMessage(`${removed} ficheiros pessoais ou não académicos foram removidos do repositório.`);
    } else {
      setMessage('O repositório já se encontra livre de ficheiros irrelevantes ou duplicados.');
    }
  }, [cleanupMismatchedMaterials]);

  const connectAcademic = useCallback(async () => {
    setAcademicBusy(true);
    setMessage(null);
    try {
      const res = await googleService.connectAcademicAccount(true);
      setAcademicEmail(res.email);
      setMessage(`Conta académica ligada com sucesso: ${res.email}`);
    } catch (err: unknown) {
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code !== 'auth/popup-closed-by-user') {
        setMessage(err instanceof Error ? err.message : 'Erro ao autenticar a conta académica da faculdade.');
      }
    } finally {
      setAcademicBusy(false);
    }
  }, []);

  const disconnectAcademic = useCallback(() => {
    googleService.disconnectAcademicAccount();
    setAcademicEmail(null);
    setMessage('Conta académica da faculdade desligada.');
  }, []);

  const syncCalendar = useCallback(async () => {
    setPersonalBusy(true);
    setMessage(null);
    try {
      const n = await googleService.syncCalendar();
      setMessage(`${n} ${n === 1 ? 'evento importado' : 'eventos importados'} da agenda.`);
    } catch {
      // O erro fica registado no estado da integração
    } finally {
      setPersonalBusy(false);
    }
  }, []);

  const disconnectAll = useCallback(() => {
    googleService.disconnectAll();
    replaceSource('events', 'google', []);
    setIntegration('google', { connected: false, lastSync: undefined, error: undefined });
    setAcademicEmail(null);
    setMessage(null);
  }, [replaceSource, setIntegration]);

  return {
    personalEmail: personal.email,
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
  };
}
