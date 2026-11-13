import { Capacitor } from '@capacitor/core';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCEhC7Ppe8BsFitlgqfYeSgHFfN_sUS4ro',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'campus-erp-84964.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'campus-erp-84964',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'campus-erp-84964.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '829850599388',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:829850599388:web:d8a99af3adb0ce0f839919',
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
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    const siteKey =
      (import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY as string | undefined) ||
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

export function getAcademicGoogleEmail(): string | null {
  const token = getAcademicGoogleAccessToken();
  const personalToken = getCachedGoogleAccessToken();
  if (!token && !personalToken && !auth.currentUser) {
    return null;
  }
  return (
    cachedAcademicToken?.email ||
    sessionStorage.getItem('campus_academic_google_email') ||
    academicAuth.currentUser?.email ||
    (personalToken ? auth.currentUser?.email ?? null : null)
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
googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');
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

/** Inicia sessão na conta pessoal principal (Drive pessoal, nuvem, Gemini). */
export async function loginWithGoogle(opts?: { forceConsent?: boolean; loginHint?: string }): Promise<User> {
  const params: Record<string, string> = {
    prompt: opts?.forceConsent ? 'consent select_account' : 'select_account',
  };
  if (opts?.loginHint) {
    params.login_hint = opts.loginHint;
  }
  googleProvider.setCustomParameters(params);

  // No Android WebView nativo (Capacitor), popups são bloqueados; usar fluxo por redirecionamento
  if (Capacitor.isNativePlatform()) {
    await signInWithRedirect(auth, googleProvider);
    throw new Error('A redirecionar para autenticação Google…');
  }

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
export async function loginAcademicGoogle(opts?: { forceConsent?: boolean }): Promise<{ email: string; token: string }> {
  academicGoogleProvider.setCustomParameters({
    prompt: opts?.forceConsent ? 'consent select_account' : 'select_account',
  });
  if (Capacitor.isNativePlatform()) {
    await signInWithRedirect(academicAuth, academicGoogleProvider);
    throw new Error('A redirecionar para conta académica…');
  }
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
  await signOut(auth).catch(() => {});
}

/** Envia email de reposição de palavra-passe para contas Email/Password. */
export async function resetPasswordWithEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/** Remove permanentemente a conta Firebase Auth atual. */
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
