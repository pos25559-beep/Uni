// Autenticação Google partilhada (Drive + Calendar) via Google Identity Services.
// Só leitura. O token vive em memória — nunca é guardado em disco.
import { useStore } from '../store/useStore';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

interface TokenResponse { access_token?: string; expires_in?: number; error?: string; error_description?: string }
interface TokenClient { requestAccessToken: (opts?: { prompt?: string }) => void }
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string; scope: string;
            callback: (r: TokenResponse) => void;
            error_callback?: (e: { type: string; message?: string }) => void;
          }) => TokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;
let cached: { token: string; expiresAt: number } | null = null;

function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { scriptPromise = null; reject(new Error('Não foi possível carregar o login da Google.')); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** Devolve um access token válido, pedindo consentimento ao utilizador se necessário. */
export async function getGoogleToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const clientId = useStore.getState().settings.googleClientId.trim();
  if (!clientId) throw new Error('Falta o Client ID da Google. Configura-o nas Definições.');
  await loadScript();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPES,
      callback: (r) => {
        if (r.error || !r.access_token) {
          reject(new Error(r.error_description ?? r.error ?? 'Login Google cancelado.'));
          return;
        }
        cached = { token: r.access_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 };
        resolve(r.access_token);
      },
      error_callback: (e) => reject(new Error(e.message ?? 'Login Google cancelado.')),
    });
    client.requestAccessToken({ prompt: cached ? '' : 'consent' });
  });
}

/** fetch autenticado para as APIs Google; lança Error com a mensagem da API em caso de falha. */
export async function googleFetch<T>(url: string): Promise<T> {
  const token = await getGoogleToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Erro Google ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function signOutGoogle() {
  if (cached) window.google?.accounts.oauth2.revoke(cached.token);
  cached = null;
}
