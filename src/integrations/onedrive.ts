// OneDrive / SharePoint via Microsoft Graph — só leitura. Autenticação com @azure/msal-browser v5.
import { createStandardPublicClientApplication } from '@azure/msal-browser';
import { useStore } from '../store/useStore';
import type { CloudFile } from './drive';

const GRAPH = 'https://graph.microsoft.com/v1.0/me/drive';
const SCOPES = ['Files.Read', 'User.Read'];
const SELECT = 'id,name,file,folder,webUrl,lastModifiedDateTime';

type PublicApp = Awaited<ReturnType<typeof createStandardPublicClientApplication>>;

interface GraphItem {
  id: string;
  name: string;
  webUrl?: string;
  lastModifiedDateTime?: string;
  file?: { mimeType?: string };
  folder?: unknown;
}

interface GraphList {
  value?: GraphItem[];
}

let app: { clientId: string; promise: Promise<PublicApp> } | null = null;

function requireClientId(): string {
  const clientId = useStore.getState().settings.msClientId.trim();
  if (!clientId) throw new Error('Falta o Client ID da Microsoft. Configura-o nas Definições.');
  return clientId;
}

/** Instância MSAL única por Client ID (sessionStorage para não persistir tokens em disco). */
function getApp(): Promise<PublicApp> {
  const clientId = requireClientId();
  if (!app || app.clientId !== clientId) {
    const promise = createStandardPublicClientApplication({
      auth: {
        clientId,
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: 'sessionStorage' },
    });
    app = { clientId, promise };
    // Se a inicialização falhar, a próxima chamada tenta de novo.
    promise.catch(() => { if (app?.promise === promise) app = null; });
  }
  return app.promise;
}

/** Token de acesso: silencioso se possível, senão pop-up de login/consentimento. */
async function getAccessToken(): Promise<string> {
  const pca = await getApp();
  const account = pca.getActiveAccount() ?? pca.getAllAccounts()[0] ?? null;
  if (account) {
    try {
      const silent = await pca.acquireTokenSilent({ scopes: SCOPES, account });
      return silent.accessToken;
    } catch {
      // Sem token silencioso — pede novamente em pop-up.
    }
  }
  const result = account
    ? await pca.acquireTokenPopup({ scopes: SCOPES, account })
    : await pca.loginPopup({ scopes: SCOPES });
  pca.setActiveAccount(result.account);
  return result.accessToken;
}

async function graphGet(url: string): Promise<GraphList> {
  const token = await getAccessToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Erro Microsoft Graph ${res.status}`);
  }
  return res.json() as Promise<GraphList>;
}

function toCloudFile(item: GraphItem): CloudFile {
  return {
    id: item.id,
    name: item.name,
    mimeType: item.file?.mimeType,
    modifiedAt: item.lastModifiedDateTime,
    url: item.webUrl ?? '',
    isFolder: item.folder !== undefined,
  };
}

async function listItems(url: string): Promise<CloudFile[]> {
  const data = await graphGet(url);
  return (data.value ?? []).map(toCloudFile);
}

/** Conteúdo da raiz do OneDrive ou de uma pasta (itemId). */
export function listOneDriveFolder(itemId?: string): Promise<CloudFile[]> {
  const base = itemId ? `${GRAPH}/items/${encodeURIComponent(itemId)}/children` : `${GRAPH}/root/children`;
  return listItems(`${base}?$select=${SELECT}&$top=100`);
}

/** Procura ficheiros pelo nome. Apóstrofos são duplicados (literal OData). */
export function searchOneDriveFiles(text: string): Promise<CloudFile[]> {
  const literal = text.trim().replace(/'/g, "''");
  return listItems(`${GRAPH}/root/search(q='${encodeURIComponent(literal)}')?$select=${SELECT}&$top=100`);
}

/** Ficheiros usados recentemente. */
export function listRecentOneDriveFiles(): Promise<CloudFile[]> {
  return listItems(`${GRAPH}/recent?$select=${SELECT}`);
}

/** Username da conta Microsoft com sessão iniciada, ou null. */
export async function getOneDriveAccount(): Promise<string | null> {
  if (!useStore.getState().settings.msClientId.trim()) return null;
  const pca = await getApp();
  const account = pca.getActiveAccount() ?? pca.getAllAccounts()[0] ?? null;
  return account?.username ?? null;
}

/** Termina a sessão local (limpa a cache MSAL desta origem; não abre pop-up). */
export async function signOutOneDrive(): Promise<void> {
  if (!useStore.getState().settings.msClientId.trim()) return;
  const pca = await getApp();
  await pca.clearCache();
  app = null;
}
