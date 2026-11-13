import { Capacitor } from '@capacitor/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCBfXOeOqvHsqCaAqY-RGYjcp9i-j_l6Jo',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'campus-erp-84964.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'campus-erp-84964',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'campus-erp-84964.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '829850599388',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:829850599388:web:campus-erp',
};

export const app = !getApps().some((a) => a.name === '[DEFAULT]')
  ? initializeApp(firebaseConfig)
  : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

// App secundária independente para a Conta Académica da Faculdade (@campus.fct.unl.pt)
// Permite que o estudante mantenha a conta pessoal no Firebase/Drive e conecte a conta FCT para o Gmail dos professores
export const academicApp = !getApps().some((a) => a.name === 'academic')
  ? initializeApp(firebaseConfig, 'academic')
  : getApp('academic');
export const academicAuth = getAuth(academicApp);

// In-memory Google OAuth token cache for Google APIs (Drive, Calendar, Personal)
let cachedGoogleToken: { token: string; expiresAt: number } | null = null;
// Cache separado para a conta académica da faculdade (@campus.fct.unl.pt)
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
googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const academicGoogleProvider = new GoogleAuthProvider();
academicGoogleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');
academicGoogleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
academicGoogleProvider.setCustomParameters({
  prompt: 'select_account',
  login_hint: '@campus.fct.unl.pt',
});

// Captura resultado de redirect OAuth quando regressa à app (mobile/PWA/Capacitor)
getRedirectResult(auth)
  .then((result) => {
    if (!result) return;
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setGoogleAccessToken(credential.accessToken);
      if (result.user.email?.toLowerCase().endsWith('@campus.fct.unl.pt')) {
        setAcademicGoogleToken(credential.accessToken, result.user.email);
      }
    }
  })
  .catch(() => {});

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
    // Se o utilizador autenticado for explicitamente da FCT, atualiza também a referência académica
    if (result.user.email?.toLowerCase().endsWith('@campus.fct.unl.pt')) {
      setAcademicGoogleToken(credential.accessToken, result.user.email);
    }
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
 * Inicia sessão com a conta académica da faculdade (@campus.fct.unl.pt)
 * na instância secundária independente (academicAuth).
 * Desta forma, a conta pessoal principal NÃO é alterada nem desconectada!
 */
export async function loginAcademicGoogle(opts?: { forceConsent?: boolean }): Promise<{ email: string; token: string }> {
  academicGoogleProvider.setCustomParameters({
    prompt: opts?.forceConsent ? 'consent select_account' : 'select_account',
    login_hint: '@campus.fct.unl.pt',
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
  await signOut(auth).catch(() => {});
}

export { onAuthStateChanged };
export type { User };
