// Google Drive (API v3) — só leitura. Usa o token partilhado de googleAuth.ts.
import { googleFetch } from './googleAuth';

export interface CloudFile {
  id: string;
  name: string;
  mimeType?: string;
  /** ISO datetime */
  modifiedAt?: string;
  url: string;
  isFolder: boolean;
}

const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const FIELDS = 'files(id,name,mimeType,modifiedTime,webViewLink)';

interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

interface DriveList {
  files?: DriveFile[];
}

/** Escapa um texto para ser usado dentro de um literal de string da query do Drive. */
const escapeQ = (text: string) => text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

function toCloudFile(f: DriveFile): CloudFile {
  const isFolder = f.mimeType === DRIVE_FOLDER_MIME;
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedAt: f.modifiedTime,
    url: f.webViewLink ?? (isFolder
      ? `https://drive.google.com/drive/folders/${f.id}`
      : `https://drive.google.com/file/d/${f.id}/view`),
    isFolder,
  };
}

async function listFiles(params: Record<string, string>): Promise<CloudFile[]> {
  const search = new URLSearchParams({ fields: FIELDS, pageSize: '100', ...params });
  const data = await googleFetch<DriveList>(`${FILES_URL}?${search.toString()}`);
  return (data.files ?? []).map(toCloudFile);
}

/** Conteúdo de uma pasta (por omissão, a raiz do Drive). */
export function listDriveFolder(folderId = 'root'): Promise<CloudFile[]> {
  return listFiles({
    q: `'${escapeQ(folderId)}' in parents and trashed = false`,
    orderBy: 'folder,name',
  });
}

/** Procura ficheiros pelo nome. */
export function searchDriveFiles(text: string): Promise<CloudFile[]> {
  return listFiles({
    q: `name contains '${escapeQ(text.trim())}' and trashed = false`,
    orderBy: 'modifiedTime desc',
  });
}

/** Ficheiros abertos recentemente pelo utilizador (sem pastas). */
export function listRecentDriveFiles(): Promise<CloudFile[]> {
  return listFiles({
    q: `trashed = false and mimeType != '${DRIVE_FOLDER_MIME}'`,
    orderBy: 'viewedByMeTime desc',
    pageSize: '30',
  });
}

/** Extrai o id de uma pasta de um URL https://drive.google.com/drive/folders/<id>… */
export function driveFolderIdFromUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.hostname.toLowerCase() !== 'drive.google.com') return null;
  const match = /\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]+)/.exec(u.pathname);
  return match ? match[1] : null;
}
