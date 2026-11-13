// Camada de Serviço Unificada para APIs e Autenticação Google (Pessoal & Académica).
// Isola os componentes UI de detalhes de tokens, cache e chamadas HTTP diretas.

import {
  auth,
  academicAuth,
  getAcademicGoogleAccessToken,
  getAcademicGoogleEmail,
  getCachedGoogleAccessToken,
  loginAcademicGoogle,
  loginWithGoogle,
  logoutAcademicGoogle,
  logoutFirebase,
  type User,
} from '../lib/firebase';
import { signOutGoogle } from '../integrations/googleAuth';
import {
  driveFolderIdFromUrl,
  listDriveFolder,
  listRecentDriveFiles,
  listSharedWithMe,
  scanAndAutoLinkGoogleDrive,
  searchDriveFiles,
  type AutoScanResult,
  type CloudFile,
} from '../integrations/drive';
import {
  clearAcademicEmailsCache,
  fetchAcademicEmailsDetailed,
  getCachedAcademicEmails,
  isGmailConnected as checkGmailConnected,
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
    const email = getAcademicGoogleEmail() ?? academicAuth.currentUser?.email ?? null;
    return {
      connected: Boolean(token || email),
      hasToken: Boolean(token),
      email,
    };
  },

  isDriveConnected(): boolean {
    return Boolean(getCachedGoogleAccessToken() || auth.currentUser);
  },

  isGmailConnected(): boolean {
    return checkGmailConnected();
  },

  async connectPersonalAccount(forceConsent = false): Promise<User> {
    return loginWithGoogle({ forceConsent });
  },

  async switchPersonalAccount(): Promise<User> {
    await logoutFirebase();
    return loginWithGoogle({ forceConsent: true });
  },

  async disconnectPersonalAccount(): Promise<void> {
    await logoutFirebase();
  },

  async connectAcademicAccount(forceConsent = false): Promise<{ email: string; token: string }> {
    const result = await loginAcademicGoogle({ forceConsent });
    clearAcademicEmailsCache();
    return result;
  },

  disconnectAcademicAccount(): void {
    logoutAcademicGoogle();
    clearAcademicEmailsCache();
  },

  disconnectAll(): void {
    signOutGoogle();
    logoutAcademicGoogle();
    clearAcademicEmailsCache();
  },

  // --- Google Drive ---

  async scanDriveForCourses(
    courses: Course[],
    ensureAuth = false,
    extraFolderUrls: string[] = [],
  ): Promise<AutoScanResult> {
    if (ensureAuth && !this.isDriveConnected()) {
      await this.connectPersonalAccount(false);
    }
    return scanAndAutoLinkGoogleDrive(courses, extraFolderUrls);
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
};

export type { AcademicEmail, AutoScanResult, CloudFile, GmailFetchDetailedResult };
