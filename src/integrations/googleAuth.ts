// Autenticação Google partilhada (Drive + Calendar) via Google Identity Services ou Firebase Google Auth.
// Só leitura. O token vive em memória — nunca é guardado em disco.
import { useStore } from '../store/useStore';
import {
  clearGoogleAccessToken,
  getCachedGoogleAccessToken,
  setGoogleAccessToken,
  logoutFirebase,
} from '../lib/firebase';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
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

export function hasValidGisToken(): boolean {
  return Boolean(cached && cached.expiresAt > Date.now() + 60_000);
}

/** Devolve um access token válido, verificando primeiro a sessão Firebase e depois o Google Identity Services. */
export async function getGoogleToken(): Promise<string> {
  const fbToken = getCachedGoogleAccessToken();
  if (fbToken) return fbToken;

  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const clientId = useStore.getState().settings.googleClientId.trim();
  if (!clientId) {
    throw new Error('Autoriza o acesso ao Google Drive na janela de ligação (ou configura um Client ID nas Definições).');
  }
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
        setGoogleAccessToken(r.access_token, r.expires_in ?? 3600);
        resolve(r.access_token);
      },
      error_callback: (e) => reject(new Error(e.message ?? 'Login Google cancelado.')),
    });
    client.requestAccessToken({ prompt: cached ? '' : 'consent' });
  });
}

export interface GoogleFetchOptions {
  tokenOverride?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function buildTimedSignal(externalSignal?: AbortSignal, timeoutMs = 15_000): {
  signal: AbortSignal;
  cleanup: () => void;
  didTimeout: () => boolean;
} {
  const controller = new AbortController();
  let timedOut = false;
  const onExternalAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error('Tempo limite excedido ao comunicar com a Google.'));
  }, timeoutMs);
  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    },
  };
}

/** fetch autenticado para as APIs Google; lança Error com a mensagem da API ou timeout. */
export async function googleFetch<T>(
  url: string,
  tokenOrOpts?: string | GoogleFetchOptions,
): Promise<T> {
  const opts: GoogleFetchOptions =
    typeof tokenOrOpts === 'string' ? { tokenOverride: tokenOrOpts } : (tokenOrOpts ?? {});
  const token = opts.tokenOverride || (await getGoogleToken());
  const { signal, cleanup, didTimeout } = buildTimedSignal(opts.signal, opts.timeoutMs ?? 15_000);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
  } catch (err) {
    cleanup();
    if (didTimeout()) {
      throw new Error('A ligação ao Google Drive demorou demasiado no telemóvel. Tenta novamente.');
    }
    throw err;
  }
  cleanup();

  if (res.status === 401) {
    if (!opts.tokenOverride) {
      cached = null;
      clearGoogleAccessToken();
    }
    throw new Error('A sessão do Google Drive expirou ou precisa de nova autorização. Clica em «Autorizar Google Drive».');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Erro Google ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function signOutGoogle() {
  if (cached) window.google?.accounts.oauth2.revoke(cached.token);
  cached = null;
  logoutFirebase().catch(() => {});
}
