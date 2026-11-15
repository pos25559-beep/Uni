import { getGoogleToken, hasValidGisToken } from '../integrations/googleAuth';
import type { ChatAttachment } from '../integrations/gemini';
import { getCachedGoogleAccessToken } from './firebase';
import { getFileBlob } from './fileStorage';
import type { Material } from '../types';

export const MAX_AI_MATERIAL_FILES = 3;
const MAX_AI_MATERIAL_BYTES = 7.5 * 1024 * 1024;
const MAX_EXCERPT_CHARS = 12_000;
const MAX_CACHE_ENTRIES = 24;

export interface ResolvedMaterialExcerpt {
  id: string;
  title: string;
  provider: string;
  content: string;
}

export interface SkippedMaterialInfo {
  id: string;
  title: string;
  reason: string;
}

export interface ResolvedMaterialsBundle {
  attachments: ChatAttachment[];
  textExcerpts: ResolvedMaterialExcerpt[];
  readTitles: string[];
  skipped: SkippedMaterialInfo[];
  needsDriveAuth: boolean;
}

interface CachedMaterialResolution {
  attachment?: ChatAttachment;
  excerpt?: ResolvedMaterialExcerpt;
}

const contentCache = new Map<string, CachedMaterialResolution>();

export function clearMaterialContentCache(): void {
  contentCache.clear();
}

function setCacheEntry(key: string, value: CachedMaterialResolution): void {
  if (contentCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = contentCache.keys().next().value;
    if (oldestKey !== undefined) {
      contentCache.delete(oldestKey);
    }
  }
  contentCache.set(key, value);
}

/** Extrai o ID de ficheiro do Google Drive a partir do id `gdrive:<id>` ou URLs Drive/Docs/Slides. */
export function extractGoogleDriveFileId(urlOrId: string, materialId?: string): string | null {
  if (materialId && materialId.startsWith('gdrive:')) {
    const id = materialId.slice('gdrive:'.length).trim();
    if (/^[A-Za-z0-9_-]{10,}$/.test(id)) return id;
  }

  const trimmed = (urlOrId || '').trim();
  if (!trimmed) return null;
  if (/^[A-Za-z0-9_-]{15,}$/.test(trimmed)) return trimmed;

  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase();
    if (!host.includes('drive.google.com') && !host.includes('docs.google.com')) {
      return null;
    }
    const pathMatch = /\/(?:file|document|presentation|spreadsheets)\/d\/([A-Za-z0-9_-]+)/.exec(
      u.pathname,
    );
    if (pathMatch) return pathMatch[1];

    const idParam = u.searchParams.get('id');
    if (idParam && /^[A-Za-z0-9_-]{10,}$/.test(idParam)) return idParam;
  } catch {
    return null;
  }
  return null;
}

function isTextLike(mimeType: string | undefined, name: string): boolean {
  const m = (mimeType ?? '').toLowerCase();
  const lower = name.toLowerCase();
  if (m.startsWith('text/') || m === 'application/json') return true;
  return /\.(txt|md|markdown|csv|tsv|json|tex)$/i.test(lower);
}

function resolveBinaryMime(mimeType: string | undefined, name: string): string | null {
  const m = (mimeType ?? '').toLowerCase();
  const lower = name.toLowerCase();
  if (m === 'application/pdf' || lower.endsWith('.pdf')) return 'application/pdf';
  if (m.startsWith('image/')) return m;
  if (/\.(png|jpe?g|webp|gif)$/i.test(lower)) {
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  }
  return null;
}

function isGoogleWorkspaceDoc(mimeType: string | undefined): boolean {
  const m = (mimeType ?? '').toLowerCase();
  return (
    m === 'application/vnd.google-apps.document' ||
    m === 'application/vnd.google-apps.presentation' ||
    m === 'application/vnd.google-apps.spreadsheet'
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result ?? '');
      const comma = res.indexOf(',');
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.onerror = () => reject(new Error('Falha ao converter ficheiro para base64.'));
    reader.readAsDataURL(blob);
  });
}

function hasSilentDriveToken(): boolean {
  return Boolean(getCachedGoogleAccessToken() || hasValidGisToken());
}

async function resolveUploadMaterial(m: Material): Promise<CachedMaterialResolution> {
  const blob = await getFileBlob(m.id);
  if (!blob) {
    throw new Error('Ficheiro local não encontrado neste dispositivo.');
  }
  const mime = m.mimeType || blob.type;
  const filename = m.fileName || m.title;

  if (isTextLike(mime, filename)) {
    const text = (await blob.text()).trim().slice(0, MAX_EXCERPT_CHARS);
    if (!text) throw new Error('Ficheiro de texto vazio.');
    return {
      excerpt: {
        id: m.id,
        title: m.title,
        provider: m.provider,
        content: text,
      },
    };
  }

  const binaryMime = resolveBinaryMime(mime, filename);
  if (!binaryMime) {
    throw new Error('Formato não legível diretamente (suporta PDF, imagem ou texto).');
  }
  if (blob.size > MAX_AI_MATERIAL_BYTES) {
    throw new Error('Excede 7,5 MB (demasiado grande para envio direto ao chat).');
  }

  const dataBase64 = await blobToBase64(blob);
  return {
    attachment: {
      id: `mat-${m.id}`,
      name: m.title,
      mimeType: binaryMime,
      dataBase64,
      sizeBytes: blob.size,
    },
  };
}

async function resolveDriveMaterial(
  m: Material,
  signal?: AbortSignal,
): Promise<CachedMaterialResolution> {
  const fileId = extractGoogleDriveFileId(m.url, m.id);
  if (!fileId) {
    throw new Error('Link do Google Drive sem ID de ficheiro reconhecido.');
  }

  const token = await getGoogleToken();

  // Google Docs / Slides / Sheets -> exporta texto limpo
  if (isGoogleWorkspaceDoc(m.mimeType)) {
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text%2Fplain`;
    const res = await fetch(exportUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (!res.ok) {
      throw new Error(res.status === 401 ? 'Sessão do Drive expirada.' : 'Não foi possível exportar este Google Doc.');
    }
    const text = (await res.text()).trim().slice(0, MAX_EXCERPT_CHARS);
    if (!text) throw new Error('Documento sem texto extraível.');
    return {
      excerpt: {
        id: m.id,
        title: m.title,
        provider: 'gdrive',
        content: text,
      },
    };
  }

  const filename = m.fileName || m.title;
  const binaryMime = resolveBinaryMime(m.mimeType, filename);
  const textLike = isTextLike(m.mimeType, filename);
  if (!binaryMime && !textLike) {
    throw new Error('Tipo de ficheiro não legível pelo Tutor (usa PDF, Doc ou imagem).');
  }

  const mediaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Sessão do Drive expirada.' : `Erro ao descarregar do Drive (${res.status}).`);
  }

  const contentLen = Number(res.headers.get('content-length') ?? '0');
  if (contentLen > MAX_AI_MATERIAL_BYTES) {
    throw new Error('Ficheiro com mais de 7,5 MB.');
  }

  const blob = await res.blob();
  if (blob.size > MAX_AI_MATERIAL_BYTES) {
    throw new Error('Ficheiro com mais de 7,5 MB.');
  }

  if (textLike) {
    const text = (await blob.text()).trim().slice(0, MAX_EXCERPT_CHARS);
    if (!text) throw new Error('Ficheiro de texto vazio.');
    return {
      excerpt: {
        id: m.id,
        title: m.title,
        provider: 'gdrive',
        content: text,
      },
    };
  }

  const dataBase64 = await blobToBase64(blob);
  return {
    attachment: {
      id: `mat-${m.id}`,
      name: m.title,
      mimeType: binaryMime || blob.type || 'application/pdf',
      dataBase64,
      sizeBytes: blob.size,
    },
  };
}

/**
 * Resolve conteúdo real (PDF em anexo multimodal ou texto extraído) para até `maxFiles` materiais
 * selecionados/fixados pelo estudante, usando cache em memória entre mensagens.
 */
export async function resolveMaterialsForAI(
  materials: Material[],
  options?: { maxFiles?: number; signal?: AbortSignal },
): Promise<ResolvedMaterialsBundle> {
  const maxFiles = Math.max(1, Math.min(MAX_AI_MATERIAL_FILES, options?.maxFiles ?? MAX_AI_MATERIAL_FILES));
  const candidates = materials.slice(0, maxFiles);
  const overflow = materials.slice(maxFiles);

  const attachments: ChatAttachment[] = [];
  const textExcerpts: ResolvedMaterialExcerpt[] = [];
  const readTitles: string[] = [];
  const skipped: SkippedMaterialInfo[] = overflow.map((m) => ({
    id: m.id,
    title: m.title,
    reason: `Limite de ${maxFiles} documentos lidos por pergunta atingido.`,
  }));
  let needsDriveAuth = false;

  for (const m of candidates) {
    if (options?.signal?.aborted) break;

    const cacheKey = `${m.id}:${m.modifiedAt ?? ''}`;
    const cached = contentCache.get(cacheKey);
    if (cached) {
      if (cached.attachment) attachments.push(cached.attachment);
      if (cached.excerpt) textExcerpts.push(cached.excerpt);
      readTitles.push(m.title);
      continue;
    }

    if (m.provider === 'upload') {
      try {
        const resolved = await resolveUploadMaterial(m);
        setCacheEntry(cacheKey, resolved);
        if (resolved.attachment) attachments.push(resolved.attachment);
        if (resolved.excerpt) textExcerpts.push(resolved.excerpt);
        readTitles.push(m.title);
      } catch (err) {
        skipped.push({
          id: m.id,
          title: m.title,
          reason: err instanceof Error ? err.message : 'Indisponível localmente.',
        });
      }
      continue;
    }

    if (m.provider === 'gdrive') {
      if (!hasSilentDriveToken()) {
        needsDriveAuth = true;
        skipped.push({
          id: m.id,
          title: m.title,
          reason: 'Requer sessão Google Drive ativa para ler o conteúdo.',
        });
        continue;
      }
      try {
        const resolved = await resolveDriveMaterial(m, options?.signal);
        setCacheEntry(cacheKey, resolved);
        if (resolved.attachment) attachments.push(resolved.attachment);
        if (resolved.excerpt) textExcerpts.push(resolved.excerpt);
        readTitles.push(m.title);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Não foi possível ler do Google Drive.';
        if (msg.toLowerCase().includes('expirada') || msg.toLowerCase().includes('sessão')) {
          needsDriveAuth = true;
        }
        skipped.push({ id: m.id, title: m.title, reason: msg });
      }
      continue;
    }

    skipped.push({
      id: m.id,
      title: m.title,
      reason: 'Apenas referência externa (link).',
    });
  }

  return { attachments, textExcerpts, readTitles, skipped, needsDriveAuth };
}
