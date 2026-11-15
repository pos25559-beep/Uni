// Camada de Serviço Unificada para APIs e Autenticação Google (Pessoal & Académica).
// Isola os componentes UI de detalhes de tokens, cache e chamadas HTTP diretas.

import {
  auth,
  getAcademicGoogleAccessToken,
  getAcademicGoogleEmail,
  getCachedGoogleAccessToken,
  loginAcademicGoogle,
  loginWithGoogle,
  logoutAcademicGoogle,
  logoutFirebase,
  type User,
} from '../lib/firebase';
import { hasValidGisToken, signOutGoogle } from '../integrations/googleAuth';
import {
  driveFolderIdFromUrl,
  listDriveFolder,
  listRecentDriveFiles,
  listSharedWithMe,
  scanAndAutoLinkGoogleDrive,
  searchDriveFiles,
  type AutoScanOptions,
  type AutoScanProgress,
  type AutoScanResult,
  type CloudFile,
} from '../integrations/drive';
import {
  clearAcademicEmailsCache,
  fetchAcademicEmailsDetailed,
  getCachedAcademicEmails,
  isGmailConnected as checkGmailConnected,
  loadPersistedAcademicEmails,
  type AcademicEmail,
  type GmailFetchDetailedResult,
} from '../integrations/gmail';
import { syncGoogleCalendar } from '../integrations/gcal';
import type { Course } from '../types';

export interface PersonalAccountStatus {
  connected: boolean;
  email: string | null;
  displayName: string | null;
}

export interface AcademicAccountStatus {
  connected: boolean;
  hasToken: boolean;
  email: string | null;
}

/**
 * Serviço central para gerir contas Google dual, Google Drive, Gmail Académico e Agenda.
 */
export const googleService = {
  // --- Estado das Contas (Dual Auth) ---

  getPersonalAccountStatus(): PersonalAccountStatus {
    const user = auth.currentUser;
    const token = getCachedGoogleAccessToken();
    return {
      connected: Boolean(user || token),
      email: user?.email ?? null,
      displayName: user?.displayName ?? null,
    };
  },

  getAcademicAccountStatus(): AcademicAccountStatus {
    const token = getAcademicGoogleAccessToken();
    const email = getAcademicGoogleEmail();
    return {
      connected: Boolean(token || email),
      hasToken: Boolean(token),
      email,
    };
  },

  isDriveConnected(): boolean {
    return Boolean(getCachedGoogleAccessToken() || hasValidGisToken());
  },

  isGmailConnected(): boolean {
    return checkGmailConnected();
  },

  async connectPersonalAccount(forceConsent = false, loginHint?: string): Promise<User> {
    return loginWithGoogle({
      forceConsent,
      loginHint: loginHint ?? auth.currentUser?.email ?? undefined,
    });
  },

  async switchPersonalAccount(): Promise<User> {
    await logoutFirebase();
    return loginWithGoogle({ forceConsent: true });
  },

  async disconnectPersonalAccount(): Promise<void> {
    await logoutFirebase();
  },

  async connectAcademicAccount(
    forceConsent = false,
    loginHint?: string,
  ): Promise<{ email: string; token: string }> {
    const result = await loginAcademicGoogle({ forceConsent, loginHint });
    clearAcademicEmailsCache();
    return result;
  },

  disconnectAcademicAccount(): void {
    logoutAcademicGoogle();
    clearAcademicEmailsCache(true);
  },

  disconnectAll(): void {
    signOutGoogle();
    logoutAcademicGoogle();
    clearAcademicEmailsCache(true);
  },

  // --- Google Drive ---

  async scanDriveForCourses(
    courses: Course[],
    ensureAuth = false,
    extraOrOpts: string[] | AutoScanOptions = [],
  ): Promise<AutoScanResult> {
    if (ensureAuth && !this.isDriveConnected() && !getAcademicGoogleAccessToken()) {
      await this.connectPersonalAccount(false, auth.currentUser?.email ?? undefined);
      if (!this.isDriveConnected() && !getAcademicGoogleAccessToken()) {
        throw new Error('A Google não devolveu permissão de leitura do Drive. Aceita o acesso ao Google Drive na janela de autenticação.');
      }
    }
    return scanAndAutoLinkGoogleDrive(courses, extraOrOpts);
  },

  listDriveFolder(folderId?: string): Promise<CloudFile[]> {
    return listDriveFolder(folderId);
  },

  searchDriveFiles(text: string): Promise<CloudFile[]> {
    return searchDriveFiles(text);
  },

  listSharedWithMe(): Promise<CloudFile[]> {
    return listSharedWithMe();
  },

  listRecentDriveFiles(): Promise<CloudFile[]> {
    return listRecentDriveFiles();
  },

  driveFolderIdFromUrl(url: string): string | null {
    return driveFolderIdFromUrl(url);
  },

  // --- Gmail Académico ---

  getCachedAcademicEmails(): AcademicEmail[] | null {
    return getCachedAcademicEmails();
  },

  loadPersistedAcademicEmails(courses: Course[] = [], expectedEmail?: string | null): AcademicEmail[] {
    return loadPersistedAcademicEmails(courses, expectedEmail);
  },

  clearAcademicEmailsCache(): void {
    clearAcademicEmailsCache();
  },

  fetchAcademicEmails(courses: Course[], forceRefresh = false): Promise<GmailFetchDetailedResult> {
    return fetchAcademicEmailsDetailed(courses, forceRefresh);
  },

  // --- Google Agenda ---

  syncCalendar(): Promise<number> {
    return syncGoogleCalendar();
  },

  /**
   * Associação automática pós-login Google: sincroniza Agenda, Drive e Email
   * com os tokens já autorizados no login, sem pedir novos popups ao utilizador.
   */
  async syncGoogleEcosystemAfterLogin(
    courses: Course[],
    extraFolderUrls: string[] = [],
  ): Promise<{
    calendarCount: number;
    driveAdded: number;
    emailsCount: number;
  }> {
    if (!getCachedGoogleAccessToken()) {
      return { calendarCount: 0, driveAdded: 0, emailsCount: 0 };
    }
    const [calRes, driveRes, mailRes] = await Promise.allSettled([
      this.syncCalendar(),
      courses.length > 0
        ? this.scanDriveForCourses(courses, false, extraFolderUrls)
        : Promise.resolve({ added: 0 }),
      this.fetchAcademicEmails(courses, false),
    ]);
    return {
      calendarCount: calRes.status === 'fulfilled' ? calRes.value : 0,
      driveAdded: driveRes.status === 'fulfilled' ? driveRes.value.added : 0,
      emailsCount: mailRes.status === 'fulfilled' ? mailRes.value.emails.length : 0,
    };
  },
};

export type { AcademicEmail, AutoScanOptions, AutoScanProgress, AutoScanResult, CloudFile, GmailFetchDetailedResult };
