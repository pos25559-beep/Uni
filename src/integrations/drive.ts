// Google Drive (API v3) — só leitura. Usa o token partilhado de googleAuth.ts.
import { googleFetch } from './googleAuth';
import type { Course, Material } from '../types';
import { parseFilenameToParsedItem, isNonAcademicDocument } from '../lib/courseAliases';
import { useStore } from '../store/useStore';

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
const DRIVE_SHORTCUT_MIME = 'application/vnd.google-apps.shortcut';
const FIELDS = 'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,shortcutDetails(targetId,targetMimeType))';

// Pastas partilhadas multi-cadeiras indicadas explicitamente pelo utilizador
const MULTI_COURSE_ROOT_IDS = new Set<string>();

interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
  webViewLink?: string;
  shortcutDetails?: {
    targetId?: string;
    targetMimeType?: string;
  };
}

interface DriveList {
  files?: DriveFile[];
  nextPageToken?: string;
}

/** Escapa um texto para ser usado dentro de um literal de string da query do Drive. */
const escapeQ = (text: string) => text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes('inicia sessão') ||
    msg.includes('invalid credentials') ||
    msg.includes('unauthorized') ||
    msg.includes('insufficient authentication scopes') ||
    msg.includes('401')
  );
}

function toCloudFile(f: DriveFile): CloudFile {
  const isShortcut = f.mimeType === DRIVE_SHORTCUT_MIME && !!f.shortcutDetails?.targetId;
  const resolvedId = isShortcut ? f.shortcutDetails!.targetId! : f.id;
  const resolvedMime = isShortcut ? (f.shortcutDetails?.targetMimeType ?? f.mimeType) : f.mimeType;
  const isFolder = resolvedMime === DRIVE_FOLDER_MIME;

  return {
    id: resolvedId,
    name: f.name,
    mimeType: resolvedMime,
    modifiedAt: f.modifiedTime,
    url: isShortcut
      ? (isFolder
          ? `https://drive.google.com/drive/folders/${resolvedId}`
          : `https://drive.google.com/file/d/${resolvedId}/view`)
      : (f.webViewLink ?? (isFolder
          ? `https://drive.google.com/drive/folders/${resolvedId}`
          : `https://drive.google.com/file/d/${resolvedId}/view`)),
    isFolder,
  };
}

async function listFiles(params: Record<string, string>, maxPages = 3): Promise<CloudFile[]> {
  const collected: CloudFile[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const search = new URLSearchParams({
      fields: FIELDS,
      pageSize: '100',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      corpora: 'allDrives',
      ...params,
    });
    if (pageToken) {
      search.set('pageToken', pageToken);
    }

    const data = await googleFetch<DriveList>(`${FILES_URL}?${search.toString()}`);
    if (data.files?.length) {
      collected.push(...data.files.map(toCloudFile));
    }

    if (!data.nextPageToken || params.pageSize) {
      break;
    }
    pageToken = data.nextPageToken;
  }

  return collected;
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

/** Ficheiros e pastas partilhados com o utilizador ("Partilhados comigo"). */
export function listSharedWithMe(): Promise<CloudFile[]> {
  return listFiles({
    q: `sharedWithMe = true and trashed = false`,
    orderBy: 'folder,modifiedTime desc',
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

/** Extrai o id de uma pasta de um URL do Google Drive ou devolve o próprio id se for uma string alfanumérica. */
export function driveFolderIdFromUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Se já for um id simples do Drive (ex.: 1A2b3C_...)
  if (/^[A-Za-z0-9_-]{15,}$/.test(trimmed)) {
    return trimmed;
  }

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }

  if (!u.hostname.toLowerCase().includes('drive.google.com')) return null;

  // Formato: /drive/folders/<id> ou /drive/u/0/folders/<id>
  const folderMatch = /\/folders\/([A-Za-z0-9_-]+)/.exec(u.pathname);
  if (folderMatch) return folderMatch[1];

  // Formato query: ?id=<id>
  const idParam = u.searchParams.get('id');
  if (idParam && /^[A-Za-z0-9_-]{15,}$/.test(idParam)) {
    return idParam;
  }

  return null;
}

/**
 * Faz uma varredura BFS autónoma de uma pasta do Google Drive até `maxDepth` níveis:
 * Recolhe ficheiros de todas as subpastas relevantes (ex: "2º Ano / AM3 / Testes / 1T.pdf"),
 * resolvendo atalhos e preservando o caminho completo das pastas no nome para deteção de cadeira.
 */
export async function scanDriveFolderRecursively(
  folderIdOrUrl: string,
  options?: { maxDepth?: number; maxFolders?: number; initialPrefix?: string },
): Promise<CloudFile[]> {
  const rootFolderId = driveFolderIdFromUrl(folderIdOrUrl);
  if (!rootFolderId) {
    throw new Error('Link ou ID da pasta do Google Drive inválido.');
  }

  const maxDepth = options?.maxDepth ?? 4;
  const maxFolders = options?.maxFolders ?? 60;
  const visitedFolders = new Set<string>();
  const files: CloudFile[] = [];
  const queue: Array<{ id: string; prefix: string; depth: number }> = [
    { id: rootFolderId, prefix: options?.initialPrefix?.trim() ?? '', depth: 0 },
  ];

  while (queue.length > 0 && visitedFolders.size < maxFolders) {
    const current = queue.shift()!;
    if (visitedFolders.has(current.id)) continue;
    visitedFolders.add(current.id);

    let items: CloudFile[];
    try {
      items = await listDriveFolder(current.id);
    } catch (err) {
      if (isAuthError(err) || current.depth === 0) {
        throw err;
      }
      // Continua se uma subpasta individual estiver sem permissão
      continue;
    }

    for (const item of items) {
      const fullPath = current.prefix ? `${current.prefix} / ${item.name}` : item.name;
      if (item.isFolder) {
        if (current.depth < maxDepth && !visitedFolders.has(item.id)) {
          queue.push({ id: item.id, prefix: fullPath, depth: current.depth + 1 });
        }
      } else {
        files.push({
          ...item,
          name: fullPath,
        });
      }
    }
  }

  return files;
}

export interface AutoScanResult {
  added: number;
  totalFound: number;
  foldersScanned: number;
  coursesFound: string[];
}

interface DiscoveredDriveEntry {
  file: CloudFile;
  fallbackCourseId?: string;
  allowImages: boolean;
}

/**
 * Varredura autónoma do Google Drive:
 * 1. Pastas pré-configuradas das cadeiras, pasta raiz LEMc e pastas extra do utilizador (BFS até 4 níveis).
 * 2. Pastas e ficheiros "Partilhados comigo" (recursivo, preservando nome da pasta partilhada no caminho).
 * 3. Pastas académicas no "Meu Drive" raiz e ficheiros recentes do utilizador (filtrando imagens pessoais).
 * 4. Categoriza cada ficheiro autonomamente (cadeira, teste, exame, ano, resolução) e adiciona ao repositório.
 */
export async function scanAndAutoLinkGoogleDrive(
  courses: Course[],
  extraFolderUrls: string[] = [],
): Promise<AutoScanResult> {
  const discoveredById = new Map<string, DiscoveredDriveEntry>();
  let foldersScanned = 0;

  const registerFile = (
    file: CloudFile,
    fallbackCourseId: string | undefined,
    allowImages: boolean,
  ) => {
    const existing = discoveredById.get(file.id);
    if (!existing) {
      discoveredById.set(file.id, { file, fallbackCourseId, allowImages });
      return;
    }
    // Prefere entradas com contexto explícito de cadeira / imagem permitida
    if (!existing.fallbackCourseId && fallbackCourseId) {
      existing.fallbackCourseId = fallbackCourseId;
    }
    if (!existing.allowImages && allowImages) {
      existing.allowImages = true;
    }
    if (file.name.includes(' / ') && !existing.file.name.includes(' / ')) {
      existing.file = file;
    }
  };

  // 1. Mapa de pastas alvo com eventual fallbackCourseId (apenas para pastas dedicadas de 1 cadeira)
  const folderTargets = new Map<string, { fallbackCourseId?: string; initialPrefix?: string }>();
  for (const c of courses) {
    if (c.driveFolderId) {
      folderTargets.set(c.driveFolderId, { fallbackCourseId: c.id, initialPrefix: c.shortName });
    }
    if (c.sharedDriveUrl) {
      const fid = driveFolderIdFromUrl(c.sharedDriveUrl);
      if (fid && !MULTI_COURSE_ROOT_IDS.has(fid)) {
        folderTargets.set(fid, { fallbackCourseId: c.id, initialPrefix: c.shortName });
      }
    }
  }

  for (const rawUrl of extraFolderUrls) {
    const fid = driveFolderIdFromUrl(rawUrl);
    if (fid && !folderTargets.has(fid)) {
      folderTargets.set(fid, {});
    }
  }

  for (const [folderId, meta] of folderTargets.entries()) {
    try {
      foldersScanned++;
      const scanned = await scanDriveFolderRecursively(folderId, {
        maxDepth: 4,
        maxFolders: 50,
        initialPrefix: meta.initialPrefix,
      });
      for (const f of scanned) {
        registerFile(f, meta.fallbackCourseId, true);
      }
    } catch (err) {
      if (isAuthError(err)) throw err;
      // Ignora pasta inacessível (404 / sem permissão) e continua com as outras
    }
  }

  // 2. Pastas e ficheiros "Partilhados comigo" (recursivo para captar pastas de cadeiras partilhadas por colegas)
  try {
    foldersScanned++;
    const sharedItems = await listSharedWithMe();
    for (const item of sharedItems) {
      if (item.isFolder) {
        try {
          foldersScanned++;
          const scanned = await scanDriveFolderRecursively(item.id, {
            maxDepth: 4,
            maxFolders: 40,
            initialPrefix: item.name,
          });
          for (const sub of scanned) {
            registerFile(sub, undefined, true);
          }
        } catch (err) {
          if (isAuthError(err)) throw err;
        }
      } else {
        registerFile(item, undefined, true);
      }
    }
  } catch (err) {
    if (isAuthError(err)) throw err;
  }

  // 3. Pastas académicas no "Meu Drive" raiz e atalhos salvos lá
  try {
    const rootItems = await listDriveFolder('root');
    const academicFolderHint = /\b(lemc|fct|nova|ist|feup|uni|faculdade|cadeira|semestre|exame|teste|calculo|mecanica|termodinamica|algebra)\b/i;
    for (const item of rootItems) {
      if (!item.isFolder) continue;
      const isAcademicFolder =
        academicFolderHint.test(item.name) ||
        courses.some((c) => item.name.toLowerCase().includes(c.shortName.toLowerCase()));
      if (!isAcademicFolder) continue;

      try {
        foldersScanned++;
        const scanned = await scanDriveFolderRecursively(item.id, {
          maxDepth: 3,
          maxFolders: 30,
          initialPrefix: item.name,
        });
        for (const sub of scanned) {
          registerFile(sub, undefined, true);
        }
      } catch (err) {
        if (isAuthError(err)) throw err;
      }
    }
  } catch (err) {
    if (isAuthError(err)) throw err;
  }

  // 4. Ficheiros recentes do utilizador (estrategicamente mais restritivo: rejeita imagens soltas)
  try {
    const recent = await listRecentDriveFiles();
    for (const r of recent) {
      if (!isNonAcademicDocument(r.name, { allowImages: false })) {
        registerFile(r, undefined, false);
      }
    }
  } catch (err) {
    if (isAuthError(err)) throw err;
  }

  // 5. Converte e categoriza os ficheiros descobertos
  const currentMaterials = useStore.getState().materials;
  const currentMaterialIds = new Set(currentMaterials.map((m) => m.id));
  const coursesWithMatches = new Set<string>();

  const newMaterials: Material[] = [];

  for (const entry of discoveredById.values()) {
    const { file, fallbackCourseId, allowImages } = entry;
    const materialId = `gdrive:${file.id}`;
    if (currentMaterialIds.has(materialId)) continue;

    const parsed = parseFilenameToParsedItem(
      file.name,
      courses,
      fallbackCourseId,
      'gdrive',
      undefined,
      file.url,
      { allowImages },
    );

    // CRÍTICO: Só adiciona ao repositório se tiver uma cadeira válida correspondente!
    // Ficheiros sem cadeira reconhecida NÃO poluem o repositório nem caem em Cálculo 3D.
    if (!parsed.courseId) continue;
    const validCourse = courses.some((c) => c.id === parsed.courseId);
    if (!validCourse) continue;

    coursesWithMatches.add(parsed.courseId);

    newMaterials.push({
      id: materialId,
      courseId: parsed.courseId,
      title: parsed.title,
      url: file.url,
      provider: 'gdrive',
      mimeType: file.mimeType,
      modifiedAt: file.modifiedAt,
      category: parsed.category,
      year: parsed.year,
      epoch: parsed.epoch,
      hasSolution: parsed.hasSolution,
    });
  }

  if (newMaterials.length > 0) {
    useStore.getState().upsertMany('materials', newMaterials);
  }

  return {
    added: newMaterials.length,
    totalFound: discoveredById.size,
    foldersScanned,
    coursesFound: Array.from(coursesWithMatches),
  };
}

