// Google Drive (API v3) — só leitura. Usa o token partilhado de googleAuth.ts.
import { googleFetch } from './googleAuth';
import { getAcademicGoogleAccessToken } from '../lib/firebase';
import type { Course, Material } from '../types';
import { matchCourseByText, normalizeAliasText, parseFilenameToParsedItem, isNonAcademicDocument } from '../lib/courseAliases';
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

interface DriveRequestOpts {
  tokenOverride?: string;
  signal?: AbortSignal;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const count = Math.min(limit, items.length);
  await Promise.all(
    Array.from({ length: count }, async () => {
      while (nextIndex < items.length) {
        const idx = nextIndex++;
        results[idx] = await worker(items[idx]);
      }
    }),
  );
  return results;
}

async function listFiles(
  params: Record<string, string>,
  maxPages = 6,
  opts?: DriveRequestOpts,
): Promise<CloudFile[]> {
  const collected: CloudFile[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    if (opts?.signal?.aborted) break;
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

    const data = await googleFetch<DriveList>(`${FILES_URL}?${search.toString()}`, {
      tokenOverride: opts?.tokenOverride,
      signal: opts?.signal,
    });
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
export function listDriveFolder(folderId = 'root', opts?: DriveRequestOpts): Promise<CloudFile[]> {
  return listFiles(
    {
      q: `'${escapeQ(folderId)}' in parents and trashed = false`,
      orderBy: 'folder,name',
    },
    6,
    opts,
  );
}

/** Procura ficheiros pelo nome. */
export function searchDriveFiles(text: string, opts?: DriveRequestOpts): Promise<CloudFile[]> {
  return listFiles(
    {
      q: `name contains '${escapeQ(text.trim())}' and trashed = false`,
      orderBy: 'modifiedTime desc',
    },
    3,
    opts,
  );
}

/** Ficheiros e pastas partilhados com o utilizador ("Partilhados comigo"). */
export function listSharedWithMe(opts?: DriveRequestOpts): Promise<CloudFile[]> {
  return listFiles(
    {
      q: `sharedWithMe = true and trashed = false`,
      orderBy: 'folder,modifiedTime desc',
    },
    6,
    opts,
  );
}

/** Ficheiros abertos recentemente pelo utilizador (sem pastas). */
export function listRecentDriveFiles(opts?: DriveRequestOpts): Promise<CloudFile[]> {
  return listFiles(
    {
      q: `trashed = false and mimeType != '${DRIVE_FOLDER_MIME}'`,
      orderBy: 'viewedByMeTime desc',
      pageSize: '40',
    },
    1,
    opts,
  );
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

/** Reconhece pastas académicas na raiz (inclui nomes sem espaço como FCT2627, 25/26, LEMc, etc.). */
export function isLikelyAcademicDriveFolderName(folderName: string, courses: Course[]): boolean {
  const norm = normalizeAliasText(folderName);
  if (!norm) return false;
  if (matchCourseByText(folderName, courses)) return true;
  if (
    /(lemc|memc|fct|nova|ist|feup|ua\b|uc\b|uminho|isel|iscte|universidade|faculdade|cadeira|semestre|trimestre|exame|teste|calculo|analise|mecanica|termodinamica|algebra|apontamentos|sebenta|estudo|\buni\b|\bucs?\b)/.test(
      norm,
    )
  ) {
    return true;
  }
  return /(?:^|\D)(?:202[0-9]|2[3-9]2[4-9])(?:\D|$)/.test(norm);
}

/**
 * Faz uma varredura BFS autónoma de uma pasta do Google Drive até `maxDepth` níveis:
 * Recolhe ficheiros de todas as subpastas relevantes (ex: "FCT2627 / C3D / AM3D 2025.pdf"),
 * resolvendo atalhos e preservando o caminho completo das pastas no nome para deteção de cadeira.
 */
export async function scanDriveFolderRecursively(
  folderIdOrUrl: string,
  options?: {
    maxDepth?: number;
    maxFolders?: number;
    initialPrefix?: string;
    tokenOverride?: string;
    signal?: AbortSignal;
    onFolderVisited?: (folderName: string) => void;
  },
): Promise<CloudFile[]> {
  const rootFolderId = driveFolderIdFromUrl(folderIdOrUrl);
  if (!rootFolderId) {
    throw new Error('Link ou ID da pasta do Google Drive inválido.');
  }

  const maxDepth = options?.maxDepth ?? 5;
  const maxFolders = options?.maxFolders ?? 140;
  const visitedFolders = new Set<string>();
  const files: CloudFile[] = [];
  let frontier: Array<{ id: string; prefix: string; depth: number }> = [
    { id: rootFolderId, prefix: options?.initialPrefix?.trim() ?? '', depth: 0 },
  ];

  while (frontier.length > 0 && visitedFolders.size < maxFolders && !options?.signal?.aborted) {
    const batch = [];
    while (frontier.length > 0 && visitedFolders.size < maxFolders && batch.length < 4) {
      const next = frontier.shift()!;
      if (visitedFolders.has(next.id)) continue;
      visitedFolders.add(next.id);
      batch.push(next);
    }
    if (batch.length === 0) break;

    const nextFrontier: Array<{ id: string; prefix: string; depth: number }> = [];
    await mapWithConcurrency(batch, 4, async (current) => {
      if (options?.signal?.aborted) return;
      options?.onFolderVisited?.(current.prefix || 'Pasta');
      let items: CloudFile[];
      try {
        items = await listDriveFolder(current.id, {
          tokenOverride: options?.tokenOverride,
          signal: options?.signal,
        });
      } catch (err) {
        if (options?.signal?.aborted) return;
        if (isAuthError(err) || current.depth === 0) {
          throw err;
        }
        return;
      }

      for (const item of items) {
        const fullPath = current.prefix ? `${current.prefix} / ${item.name}` : item.name;
        if (item.isFolder) {
          if (current.depth < maxDepth && !visitedFolders.has(item.id)) {
            nextFrontier.push({ id: item.id, prefix: fullPath, depth: current.depth + 1 });
          }
        } else {
          files.push({
            ...item,
            name: fullPath,
          });
        }
      }
    });

    frontier = [...nextFrontier, ...frontier];
  }

  return files;
}

export interface AutoScanProgress {
  foldersScanned: number;
  filesFound: number;
  stage?: string;
}

export interface AutoScanOptions {
  extraFolderUrls?: string[];
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: (progress: AutoScanProgress) => void;
}

export interface AutoScanResult {
  added: number;
  totalFound: number;
  foldersScanned: number;
  coursesFound: string[];
  timedOut?: boolean;
  cancelled?: boolean;
}

interface DiscoveredDriveEntry {
  file: CloudFile;
  fallbackCourseId?: string;
  allowImages: boolean;
}

/**
 * Varredura autónoma do Google Drive (conta pessoal e académica quando ligadas):
 * 1. Pastas pré-configuradas das cadeiras e pastas extra do utilizador.
 * 2. Pastas e ficheiros "Partilhados comigo" em paralelo controlado.
 * 3. Pastas académicas no "Meu Drive" (até 2 níveis abaixo da raiz) + pesquisa por sigla de cadeira.
 * 4. Guardião de timeout (45s) e suporte a cancelamento para nunca prender no telemóvel.
 */
export async function scanAndAutoLinkGoogleDrive(
  courses: Course[],
  extraUrlsOrOpts: string[] | AutoScanOptions = [],
): Promise<AutoScanResult> {
  const opts: AutoScanOptions = Array.isArray(extraUrlsOrOpts)
    ? { extraFolderUrls: extraUrlsOrOpts }
    : extraUrlsOrOpts;

  const extraFolderUrls = opts.extraFolderUrls ?? [];
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const controller = new AbortController();
  let scanTimedOut = false;

  const onExternalAbort = () => controller.abort(opts.signal?.reason);
  if (opts.signal) {
    if (opts.signal.aborted) {
      return { added: 0, totalFound: 0, foldersScanned: 0, coursesFound: [], cancelled: true };
    }
    opts.signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const timer = setTimeout(() => {
    scanTimedOut = true;
    controller.abort(new Error('scan-timeout'));
  }, timeoutMs);

  const discoveredById = new Map<string, DiscoveredDriveEntry>();
  let foldersScanned = 0;

  const emitProgress = (stage?: string) => {
    opts.onProgress?.({
      foldersScanned,
      filesFound: discoveredById.size,
      stage,
    });
  };

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

  try {
    // 1. Pastas explícitas de cadeiras e links extra
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

    const runAccountPass = async (tokenOverride?: string, isPrimary = true) => {
      if (controller.signal.aborted) return;

      // 1a. Pastas associadas diretamente (apenas na passagem principal para não repetir)
      if (isPrimary && folderTargets.size > 0) {
        await mapWithConcurrency(Array.from(folderTargets.entries()), 3, async ([folderId, meta]) => {
          if (controller.signal.aborted) return;
          try {
            foldersScanned++;
            emitProgress(meta.initialPrefix);
            const scanned = await scanDriveFolderRecursively(folderId, {
              maxDepth: 5,
              maxFolders: 100,
              initialPrefix: meta.initialPrefix,
              signal: controller.signal,
            });
            for (const f of scanned) registerFile(f, meta.fallbackCourseId, true);
            emitProgress();
          } catch (err) {
            if (controller.signal.aborted) return;
            if (isAuthError(err)) throw err;
          }
        });
      }

      // 2. "Partilhados comigo" (concorrência limitada para não bloquear no mobile)
      if (!controller.signal.aborted) {
        try {
          foldersScanned++;
          emitProgress('Partilhados comigo');
          const sharedItems = await listSharedWithMe({ tokenOverride, signal: controller.signal });
          const sharedFolders = sharedItems.filter((it) => it.isFolder).slice(0, 28);
          for (const item of sharedItems) {
            if (!item.isFolder) registerFile(item, undefined, true);
          }
          await mapWithConcurrency(sharedFolders, 4, async (item) => {
            if (controller.signal.aborted) return;
            try {
              foldersScanned++;
              emitProgress(item.name);
              const scanned = await scanDriveFolderRecursively(item.id, {
                maxDepth: 4,
                maxFolders: 60,
                initialPrefix: item.name,
                tokenOverride,
                signal: controller.signal,
              });
              for (const sub of scanned) registerFile(sub, undefined, true);
              emitProgress();
            } catch (err) {
              if (controller.signal.aborted) return;
              if (isAuthError(err)) throw err;
            }
          });
        } catch (err) {
          if (!controller.signal.aborted && isAuthError(err) && isPrimary) throw err;
        }
      }

      // 3. Pastas académicas no "Meu Drive" raiz (espreita até 2 subníveis: ex. Escola > Semestre > Cadeira)
      if (!controller.signal.aborted) {
        try {
          emitProgress('Meu Drive');
          const rootItems = await listDriveFolder('root', { tokenOverride, signal: controller.signal });
          const academicRoots: CloudFile[] = [];

          await mapWithConcurrency(rootItems.filter((it) => it.isFolder), 4, async (item) => {
            if (controller.signal.aborted) return;
            if (isLikelyAcademicDriveFolderName(item.name, courses)) {
              academicRoots.push(item);
              return;
            }
            try {
              const level1 = await listFiles(
                {
                  q: `'${escapeQ(item.id)}' in parents and mimeType = '${DRIVE_FOLDER_MIME}' and trashed = false`,
                  orderBy: 'name',
                },
                1,
                { tokenOverride, signal: controller.signal },
              );
              if (level1.some((sub) => isLikelyAcademicDriveFolderName(sub.name, courses))) {
                academicRoots.push(item);
                return;
              }
              // Espreita 2º nível dentro das primeiras subpastas organizadoras (ex.: Ano > Semestre > Cadeira)
              for (const sub of level1.slice(0, 8)) {
                if (controller.signal.aborted) break;
                const level2 = await listFiles(
                  {
                    q: `'${escapeQ(sub.id)}' in parents and mimeType = '${DRIVE_FOLDER_MIME}' and trashed = false`,
                    orderBy: 'name',
                  },
                  1,
                  { tokenOverride, signal: controller.signal },
                );
                if (level2.some((deep) => isLikelyAcademicDriveFolderName(deep.name, courses))) {
                  academicRoots.push(sub);
                }
              }
            } catch (err) {
              if (!controller.signal.aborted && isAuthError(err) && isPrimary) throw err;
            }
          });

          await mapWithConcurrency(academicRoots, 3, async (item) => {
            if (controller.signal.aborted) return;
            try {
              foldersScanned++;
              emitProgress(item.name);
              const scanned = await scanDriveFolderRecursively(item.id, {
                maxDepth: 5,
                maxFolders: 90,
                initialPrefix: item.name,
                tokenOverride,
                signal: controller.signal,
              });
              for (const sub of scanned) registerFile(sub, undefined, true);
              emitProgress();
            } catch (err) {
              if (!controller.signal.aborted && isAuthError(err) && isPrimary) throw err;
            }
          });
        } catch (err) {
          if (!controller.signal.aborted && isAuthError(err) && isPrimary) throw err;
        }
      }

      // 4. Pesquisa direta pelas siglas das cadeiras (apanha PDFs soltos em qualquer pasta profunda)
      if (!controller.signal.aborted && courses.length > 0) {
        const terms = Array.from(
          new Set(
            courses
              .map((c) => (c.shortName || '').trim())
              .filter((s) => s.length >= 2 && s.length <= 14),
          ),
        ).slice(0, 10);

        await mapWithConcurrency(terms, 3, async (term) => {
          if (controller.signal.aborted) return;
          try {
            const matched = await searchDriveFiles(term, { tokenOverride, signal: controller.signal });
            for (const f of matched) {
              if (!f.isFolder && !isNonAcademicDocument(f.name, { allowImages: false })) {
                registerFile(f, undefined, false);
              }
            }
          } catch {
            // pesquisa auxiliar é best-effort
          }
        });
      }

      // 5. Ficheiros recentes do utilizador (só documentos, rejeita imagens soltas)
      if (!controller.signal.aborted && isPrimary) {
        try {
          const recent = await listRecentDriveFiles({ tokenOverride, signal: controller.signal });
          for (const r of recent) {
            if (!isNonAcademicDocument(r.name, { allowImages: false })) {
              registerFile(r, undefined, false);
            }
          }
        } catch (err) {
          if (!controller.signal.aborted && isAuthError(err)) throw err;
        }
      }
    };

    await runAccountPass(undefined, true);

    const academicToken = getAcademicGoogleAccessToken();
    if (academicToken && !controller.signal.aborted) {
      await runAccountPass(academicToken, false);
    }
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onExternalAbort);
  }

  // Converte e categoriza os ficheiros descobertos (salva mesmo se atingiu timeout parcial)
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
    timedOut: scanTimedOut,
    cancelled: Boolean(opts.signal?.aborted && !scanTimedOut),
  };
}

