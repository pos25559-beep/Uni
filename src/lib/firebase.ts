import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || 'AIzaSyCEhC7Ppe8BsFitlgqfYeSgHFfN_sUS4ro',
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || 'campus-erp-84964.firebaseapp.com',
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || 'campus-erp-84964',
  storageBucket:
    import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || 'campus-erp-84964.firebasestorage.app',
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '829850599388',
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || '1:829850599388:web:d8a99af3adb0ce0f839919',
};

export const app = !getApps().some((a) => a.name === '[DEFAULT]')
  ? initializeApp(firebaseConfig)
  : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

let appCheckInitialized = false;
let nativeAIInstance: AI | null = null;

/**
 * Inicializa o Firebase App Check (quando configurado) e devolve o cliente nativo Firebase AI Logic.
 */
export function getNativeAI(): AI {
  if (typeof window !== 'undefined' && !appCheckInitialized) {
    appCheckInitialized = true;
    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    const siteKey =
      (import.meta.env?.VITE_FIREBASE_APPCHECK_SITE_KEY as string | undefined) ||
      '6Lfx7B4uAAAAACgDpIV44UBaXW-HkLrlqZYF6DdY';
    if (siteKey?.trim()) {
      try {
        initializeAppCheck(app, {
          provider: new ReCaptchaEnterpriseProvider(siteKey.trim()),
          isTokenAutoRefreshEnabled: true,
        });
      } catch {
        // Ignora caso já tenha sido inicializado em HMR
      }
    }
  }
  nativeAIInstance ??= getAI(app, { backend: new GoogleAIBackend() });
  return nativeAIInstance;
}

// App secundária independente para a Conta Académica institucional
// Permite que o estudante mantenha a conta pessoal no Firebase/Drive e conecte a conta FCT para o Gmail dos professores
export const academicApp = !getApps().some((a) => a.name === 'academic')
  ? initializeApp(firebaseConfig, 'academic')
  : getApp('academic');
export const academicAuth = getAuth(academicApp);

// In-memory Google OAuth token cache for Google APIs (Drive, Calendar, Personal)
let cachedGoogleToken: { token: string; expiresAt: number } | null = null;
// Cache separado para a conta académica institucional
let cachedAcademicToken: { token: string; expiresAt: number; email?: string } | null = null;

export function getCachedGoogleAccessToken(): string | null {
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > Date.now() + 60_000) {
    return cachedGoogleToken.token;
  }
  const stored = sessionStorage.getItem('campus_google_access_token');
  const exp = sessionStorage.getItem('campus_google_token_exp');
  if (stored && exp && Number(exp) > Date.now() + 60_000) {
    cachedGoogleToken = { token: stored, expiresAt: Number(exp) };
    return stored;
  }
  return null;
}

export function setGoogleAccessToken(token: string, expiresInSeconds = 3600) {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  cachedGoogleToken = { token, expiresAt };
  try {
    sessionStorage.setItem('campus_google_access_token', token);
    sessionStorage.setItem('campus_google_token_exp', String(expiresAt));
  } catch {
    // Ignore storage quota
  }
}

/** Obtém o token de acesso da conta académica da faculdade para o Gmail/Drive institucional */
export function getAcademicGoogleAccessToken(): string | null {
  if (cachedAcademicToken && cachedAcademicToken.expiresAt > Date.now() + 60_000) {
    return cachedAcademicToken.token;
  }
  const stored = sessionStorage.getItem('campus_academic_google_token');
  const exp = sessionStorage.getItem('campus_academic_google_token_exp');
  const email = sessionStorage.getItem('campus_academic_google_email') || undefined;
  if (stored && exp && Number(exp) > Date.now() + 60_000) {
    cachedAcademicToken = { token: stored, expiresAt: Number(exp), email };
    return stored;
  }
  return null;
}

/**
 * Devolve o email da conta académica institucional (nunca mistura com a conta pessoal).
 */
export function getAcademicGoogleEmail(): string | null {
  return (
    cachedAcademicToken?.email ||
    sessionStorage.getItem('campus_academic_google_email') ||
    academicAuth.currentUser?.email ||
    null
  );
}

export function setAcademicGoogleToken(token: string, email?: string, expiresInSeconds = 3600) {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  cachedAcademicToken = { token, expiresAt, email };
  try {
    sessionStorage.setItem('campus_academic_google_token', token);
    sessionStorage.setItem('campus_academic_google_token_exp', String(expiresAt));
    if (email) sessionStorage.setItem('campus_academic_google_email', email);
  } catch {
    // Ignore storage quota
  }
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/calendar.readonly');
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const academicGoogleProvider = new GoogleAuthProvider();
academicGoogleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');
academicGoogleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
academicGoogleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Captura resultado de redirect OAuth quando regressa à app (apenas no browser quando há callback)
if (
  typeof window !== 'undefined' &&
  !Capacitor.isNativePlatform() &&
  (window.location.search.includes('state=') || window.location.hash.includes('access_token='))
) {
  getRedirectResult(auth)
    .then((result) => {
      if (!result) return;
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken && result.user.email) {
        setGoogleAccessToken(credential.accessToken);
        try {
          sessionStorage.setItem('unipedia_google_just_signed_in', '1');
        } catch {
          // ignore
        }
      }
    })
    .catch(() => {});
}

const GOOGLE_WEB_CLIENT_ID =
  import.meta.env?.VITE_GOOGLE_WEB_CLIENT_ID ||
  '829850599388-knstv0vbi1mqqjomcj9a7r1m46lfeqc9.apps.googleusercontent.com';

let nativeSocialInitialized = false;

async function loginGoogleNative(scopes: string[]): Promise<{ idToken: string; accessToken?: string; email?: string }> {
  if (!nativeSocialInitialized) {
    await SocialLogin.initialize({
      google: {
        webClientId: GOOGLE_WEB_CLIENT_ID,
        mode: 'online',
      },
    });
    nativeSocialInitialized = true;
  }
  const res = await SocialLogin.login({
    provider: 'google',
    options: { scopes },
  });
  if (res.result.responseType !== 'online' || !res.result.idToken) {
    throw new Error('Autenticação Google cancelada ou sem token de identidade.');
  }
  return {
    idToken: res.result.idToken,
    accessToken: res.result.accessToken?.token ?? undefined,
    email: res.result.profile?.email ?? undefined,
  };
}

/** Inicia sessão na conta pessoal principal (Drive pessoal, nuvem, Agenda). */
export async function loginWithGoogle(opts?: { forceConsent?: boolean; loginHint?: string }): Promise<User> {
  if (Capacitor.isNativePlatform()) {
    const { idToken, accessToken } = await loginGoogleNative([
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
    ]);
    const cred = GoogleAuthProvider.credential(idToken, accessToken);
    const result = await signInWithCredential(auth, cred);
    if (accessToken) setGoogleAccessToken(accessToken);
    return result.user;
  }

  const params: Record<string, string> = {
    prompt: opts?.forceConsent ? 'consent select_account' : 'select_account',
  };
  if (opts?.loginHint) {
    params.login_hint = opts.loginHint;
  }
  googleProvider.setCustomParameters(params);

  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    setGoogleAccessToken(credential.accessToken);
  }
  return result.user;
}

/** Inicia sessão com Email e Palavra-passe (multi-utilizador nativo para Android e Web). */
export async function loginWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  return result.user;
}

/** Cria uma nova conta Unipedia com Email e Palavra-passe no Firebase Auth. */
export async function registerWithEmail(name: string, email: string, password: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const cleanName = name.trim();
  if (cleanName) {
    await updateProfile(result.user, { displayName: cleanName }).catch(() => {});
  }
  return result.user;
}

/**
 * Inicia sessão com a conta académica institucional
 * na instância secundária independente (academicAuth).
 * Desta forma, a conta pessoal principal NÃO é alterada nem desconectada!
 */
export async function loginAcademicGoogle(opts?: {
  forceConsent?: boolean;
  loginHint?: string;
}): Promise<{ email: string; token: string }> {
  if (Capacitor.isNativePlatform()) {
    const { idToken, accessToken, email: nativeEmail } = await loginGoogleNative([
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ]);
    const cred = GoogleAuthProvider.credential(idToken, accessToken);
    const result = await signInWithCredential(academicAuth, cred);
    const email = result.user.email || nativeEmail || '';
    const token = accessToken || '';
    if (token) setAcademicGoogleToken(token, email);
    return { email, token };
  }

  const params: Record<string, string> = {
    prompt: opts?.forceConsent ? 'consent select_account' : 'select_account',
  };
  if (opts?.loginHint?.trim()) {
    params.login_hint = opts.loginHint.trim();
  }
  academicGoogleProvider.setCustomParameters(params);
  const result = await signInWithPopup(academicAuth, academicGoogleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken || '';
  const email = result.user.email || '';
  if (token) {
    setAcademicGoogleToken(token, email);
  }
  return { email, token };
}

export function logoutAcademicGoogle(): void {
  cachedAcademicToken = null;
  sessionStorage.removeItem('campus_academic_google_token');
  sessionStorage.removeItem('campus_academic_google_token_exp');
  sessionStorage.removeItem('campus_academic_google_email');
  signOut(academicAuth).catch(() => {});
}

export async function logoutFirebase(): Promise<void> {
  cachedGoogleToken = null;
  sessionStorage.removeItem('campus_google_access_token');
  sessionStorage.removeItem('campus_google_token_exp');
  logoutAcademicGoogle();
  if (Capacitor.isNativePlatform()) {
    await SocialLogin.logout({ provider: 'google' }).catch(() => {});
  }
  await signOut(auth).catch(() => {});
}

/** Envia email de reposição de palavra-passe para contas Email/Password. */
export async function resetPasswordWithEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

const MAGIC_EMAIL_STORAGE_KEY = 'unipedia_magic_email_for_signin';

/** Envia um link mágico de entrada direta só com o email (sem palavra-passe). */
export async function sendMagicEmailLink(email: string): Promise<void> {
  const clean = email.trim();
  const continueUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/entrar`
      : 'https://campus-erp-84964.web.app/entrar';
  await sendSignInLinkToEmail(auth, clean, {
    url: continueUrl,
    handleCodeInApp: true,
  });
  try {
    localStorage.setItem(MAGIC_EMAIL_STORAGE_KEY, clean);
  } catch {
    // ignore storage quota
  }
}

export function isIncomingEmailSignInLink(): boolean {
  if (typeof window === 'undefined') return false;
  return isSignInWithEmailLink(auth, window.location.href);
}

export function getPendingMagicLinkEmail(): string {
  try {
    return localStorage.getItem(MAGIC_EMAIL_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export async function completeMagicEmailLinkSignIn(explicitEmail?: string): Promise<User | null> {
  if (typeof window === 'undefined' || !isSignInWithEmailLink(auth, window.location.href)) {
    return null;
  }
  const email = (explicitEmail || getPendingMagicLinkEmail()).trim();
  if (!email) {
    return null;
  }
  const res = await signInWithEmailLink(auth, email, window.location.href);
  try {
    localStorage.removeItem(MAGIC_EMAIL_STORAGE_KEY);
    window.history.replaceState({}, '', '/entrar');
  } catch {
    // ignore
  }
  return res.user;
}

/** Indica se a sessão atual tem mais de 4 minutos e provavelmente exigirá reautenticação recente para apagar conta. */
export function sessionNeedsRecentLogin(maxAgeMs = 4 * 60 * 1000): boolean {
  const current = auth.currentUser;
  if (!current?.metadata?.lastSignInTime) return false;
  const lastMs = Date.parse(current.metadata.lastSignInTime);
  if (Number.isNaN(lastMs)) return false;
  return Date.now() - lastMs > maxAgeMs;
}

/**
 * Reautentica a sessão atual por clique explícito do utilizador antes de ações sensíveis.
 * Para contas Google na Web usa um provider limpo apenas de identidade (sem scopes de Drive/Agenda).
 */
export async function reauthenticateCurrentUser(password?: string): Promise<void> {
  const current = auth.currentUser;
  if (!current) return;

  const hasPassword = current.providerData.some((p) => p.providerId === 'password');
  const hasGoogle = current.providerData.some((p) => p.providerId === 'google.com');

  if (password && current.email) {
    const cred = EmailAuthProvider.credential(current.email, password);
    await reauthenticateWithCredential(current, cred);
    return;
  }

  if (hasGoogle) {
    if (Capacitor.isNativePlatform()) {
      const { idToken, accessToken } = await loginGoogleNative([]);
      const cred = GoogleAuthProvider.credential(idToken, accessToken);
      await reauthenticateWithCredential(current, cred);
      return;
    }

    // Provider isolado apenas para confirmar identidade (sem pedir permissões extra do Drive/Calendar)
    const cleanIdentityProvider = new GoogleAuthProvider();
    if (current.email) {
      cleanIdentityProvider.setCustomParameters({ login_hint: current.email });
    }
    await reauthenticateWithPopup(current, cleanIdentityProvider);
    return;
  }

  if (hasPassword && !password) {
    const err = new Error('Introduz a tua palavra-passe atual para confirmar.');
    (err as Error & { code?: string }).code = 'auth/missing-password';
    throw err;
  }
}

/** Remove permanentemente a conta Firebase Auth atual (sem disparar popups surpresa). */
export async function deleteCurrentFirebaseUser(): Promise<void> {
  const current = auth.currentUser;
  if (!current) return;
  await deleteUser(current);
  cachedGoogleToken = null;
  cachedAcademicToken = null;
  sessionStorage.clear();
}

export { onAuthStateChanged };
export type { User };
