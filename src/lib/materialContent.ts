import { tr } from '../i18n/tr';
import { getCachedGoogleAccessToken } from './firebase';
import { getFileBlob } from './fileStorage';
import { getCustomGeminiKey, type ChatAttachment } from '../integrations/gemini';
import { getGoogleToken, hasValidGisToken } from '../integrations/googleAuth';
import type { Material } from '../types';

export const MAX_FREE_AI_MATERIAL_FILES = 3;
/**
 * Com chave pessoal o limite real é o orçamento de tokens (ver `getKeyContextTokenBudget`).
 * Este teto só protege a interface e o número de uploads em paralelo.
 */
export const MAX_KEY_AI_MATERIAL_FILES = 100;
export const MAX_AI_MATERIAL_FILES = MAX_FREE_AI_MATERIAL_FILES;

/**
 * Orçamento de contexto por pergunta com chave pessoal. 240k fica abaixo do limite de
 * tokens/minuto que alguns projetos do escalão gratuito têm; quem tem faturação ativa
 * pode subir até ~900k (janela de 1M) com `setKeyContextTokenBudget`.
 */
export const DEFAULT_KEY_CONTEXT_TOKEN_BUDGET = 240_000;
export const MIN_KEY_CONTEXT_TOKEN_BUDGET = 20_000;
export const MAX_KEY_CONTEXT_TOKEN_BUDGET = 900_000;
const CONTEXT_BUDGET_STORAGE_KEY = 'uni-gemini-context-budget-v1';
const TOKEN_COUNT_MODEL = 'gemini-4-hydrogen';
/** Estimativa quando o countTokens falha: ~258 tokens por página, ~60 KB por página de PDF. */
const ESTIMATED_TOKENS_PER_PAGE = 258;
const ESTIMATED_BYTES_PER_PAGE = 60_000;

const MAX_FREE_AI_MATERIAL_BYTES = 7.5 * 1024 * 1024;
const MAX_KEY_AI_MATERIAL_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_INLINE_BYTES = 14 * 1024 * 1024;
const MAX_EXCERPT_CHARS = 12_000;
const MAX_CACHE_ENTRIES = 36;
const FILE_URI_CACHE_KEY = 'uni-gemini-fileuri-cache-v1';
const FILE_URI_TTL_MS = 47 * 60 * 60 * 1000; // 47h (margem segura antes das 48h do Files API)
const MAX_STORED_FILE_URIS = 40;

/** Limite de materiais lidos simultaneamente consoante o utilizador use chave pessoal Gemini. */
export function getAiMaterialLimit(hasPersonalKey = Boolean(getCustomGeminiKey())): number {
  return hasPersonalKey ? MAX_KEY_AI_MATERIAL_FILES : MAX_FREE_AI_MATERIAL_FILES;
}

function clampBudget(value: number): number {
  return Math.round(
    Math.max(MIN_KEY_CONTEXT_TOKEN_BUDGET, Math.min(MAX_KEY_CONTEXT_TOKEN_BUDGET, value)),
  );
}

/** Orçamento de tokens de materiais no modo partilhado (ADR-001: 60k tokens). */
export const SHARED_CONTEXT_TOKEN_BUDGET = 60_000;

let memoryContextBudget: number | null = null;

/** Orçamento de tokens de materiais por pergunta quando há chave pessoal. */
export function getKeyContextTokenBudget(): number {
  if (memoryContextBudget !== null) return memoryContextBudget;
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    const raw = storage && typeof storage.getItem === 'function' ? storage.getItem(CONTEXT_BUDGET_STORAGE_KEY) : null;
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? clampBudget(parsed) : DEFAULT_KEY_CONTEXT_TOKEN_BUDGET;
  } catch {
    return DEFAULT_KEY_CONTEXT_TOKEN_BUDGET;
  }
}

export function setKeyContextTokenBudget(tokens: number | null): void {
  memoryContextBudget = tokens === null ? null : clampBudget(tokens);
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    if (!storage || typeof storage.setItem !== 'function') return;
    if (tokens === null) storage.removeItem(CONTEXT_BUDGET_STORAGE_KEY);
    else storage.setItem(CONTEXT_BUDGET_STORAGE_KEY, String(memoryContextBudget));
  } catch {
    // armazenamento indisponível: fica o valor em memória / por omissão
  }
}

/** Estimativa conservadora quando não há contagem real (PDF/imagem). */
export function estimateBinaryTokens(sizeBytes: number): number {
  const pages = Math.max(1, Math.ceil(sizeBytes / ESTIMATED_BYTES_PER_PAGE));
  return pages * ESTIMATED_TOKENS_PER_PAGE;
}

/** ~4 caracteres por token para texto. */
export function estimateTextTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function attachmentTokens(attachment: ChatAttachment): number {
  return attachment.tokenCount ?? estimateBinaryTokens(attachment.sizeBytes);
}

async function countFileTokens(
  fileUri: string,
  mimeType: string,
  customKey: string,
  signal?: AbortSignal,
): Promise<number | undefined> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${TOKEN_COUNT_MODEL}:countTokens`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': customKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ fileData: { fileUri, mimeType } }] }] }),
        signal,
      },
    );
    if (!res.ok) return undefined;
    const json = (await res.json()) as { totalTokens?: number };
    return typeof json.totalTokens === 'number' && json.totalTokens > 0 ? json.totalTokens : undefined;
  } catch {
    return undefined;
  }
}

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
  /** Tokens de materiais incluídos (medidos ou estimados). */
  contextTokens: number;
  /** Orçamento aplicado; `null` no modo gratuito (limite por ficheiros). */
  contextTokenBudget: number | null;
}

interface CachedMaterialResolution {
  attachment?: ChatAttachment;
  excerpt?: ResolvedMaterialExcerpt;
  expiresAt?: number;
}

function fingerprintCustomKey(customKey: string): string {
  if (!customKey) return 'free';
  let hash = 2166136261;
  for (let i = 0; i < customKey.length; i++) {
    hash ^= customKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `k_${(hash >>> 0).toString(36)}`;
}

export interface StoredGeminiFileUriEntry {
  fileUri: string;
  mimeType: string;
  sizeBytes: number;
  expiresAt: number;
  tokenCount?: number;
}

const contentCache = new Map<string, CachedMaterialResolution>();

export function clearMaterialContentCache(): void {
  contentCache.clear();
}

export function isFileUriCacheValid(
  entry: StoredGeminiFileUriEntry | undefined | null,
  expectedSizeBytes?: number,
  nowMs = Date.now(),
): entry is StoredGeminiFileUriEntry {
  if (!entry || !entry.fileUri || entry.expiresAt <= nowMs) return false;
  if (typeof expectedSizeBytes === 'number' && expectedSizeBytes > 0 && entry.sizeBytes !== expectedSizeBytes) {
    return false;
  }
  return true;
}

function readStoredFileUriMap(): Record<string, StoredGeminiFileUriEntry> {
  try {
    const raw = localStorage.getItem(FILE_URI_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, StoredGeminiFileUriEntry>)
      : {};
  } catch {
    return {};
  }
}

function writeStoredFileUriMap(entries: Record<string, StoredGeminiFileUriEntry>): void {
  try {
    const now = Date.now();
    const valid = Object.entries(entries)
      .filter(([, v]) => isFileUriCacheValid(v, undefined, now))
      .slice(-MAX_STORED_FILE_URIS);
    localStorage.setItem(FILE_URI_CACHE_KEY, JSON.stringify(Object.fromEntries(valid)));
  } catch {
    // ignore storage quota errors
  }
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
    reader.onerror = () => reject(new Error(tr('common:errors.matBase64Fail')));
    reader.readAsDataURL(blob);
  });
}

function hasSilentDriveToken(): boolean {
  return Boolean(getCachedGoogleAccessToken() || hasValidGisToken());
}

/**
 * Envia o ficheiro uma única vez para a Gemini Files API (apenas com chave pessoal),
 * permitindo usar muitos PDFs em simultâneo via `fileData.fileUri` (validade 47h), limitados pelo orçamento de tokens.
 */
async function uploadBlobToGeminiFilesApi(
  blob: Blob,
  mimeType: string,
  displayName: string,
  customKey: string,
  cacheKey: string,
  signal?: AbortSignal,
): Promise<StoredGeminiFileUriEntry> {
  const existingMap = readStoredFileUriMap();
  const hit = existingMap[cacheKey];
  if (isFileUriCacheValid(hit, blob.size)) {
    return hit;
  }

  const boundary = `uni_files_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const metadataPart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ file: { display_name: displayName.slice(0, 120) } }) +
    `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const closingPart = `\r\n--${boundary}--\r\n`;
  const bodyBlob = new Blob([metadataPart, blob, closingPart], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const res = await fetch(
    'https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': customKey,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: bodyBlob,
      signal,
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini Files API HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    file?: { uri?: string; name?: string; mimeType?: string; state?: string };
  };
  let fileState = json.file?.state;
  const fileUri = json.file?.uri;
  const fileName = json.file?.name;
  if (!fileUri) {
    throw new Error(tr('common:errors.matFilesNoUri'));
  }

  // Alguns PDFs maiores ficam brevemente em PROCESSING antes de ficarem ACTIVE.
  if (fileState === 'PROCESSING' && fileName) {
    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise((r) => setTimeout(r, 600));
      if (signal?.aborted) break;
      const poll = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${fileName}`,
        { headers: { 'x-goog-api-key': customKey }, signal },
      );
      if (poll.ok) {
        const meta = (await poll.json()) as { state?: string };
        fileState = meta.state;
        if (fileState === 'ACTIVE') break;
        if (fileState === 'FAILED') {
          throw new Error(tr('common:errors.matFilesProcessFail'));
        }
      }
    }
  }

  const finalMime = json.file?.mimeType || mimeType;
  const tokenCount = await countFileTokens(fileUri, finalMime, customKey, signal);
  const entry: StoredGeminiFileUriEntry = {
    fileUri,
    mimeType: finalMime,
    sizeBytes: blob.size,
    expiresAt: Date.now() + FILE_URI_TTL_MS,
    tokenCount,
  };
  existingMap[cacheKey] = entry;
  writeStoredFileUriMap(existingMap);
  return entry;
}

async function resolveBinaryBlobToAttachment(
  m: Material,
  blob: Blob,
  binaryMime: string,
  customKey: string,
  keyTag: string,
  preferFilesApi: boolean,
  remainingInlineBytes: number,
  signal?: AbortSignal,
): Promise<ChatAttachment> {
  const fileCacheKey = `${keyTag}:${m.id}:${m.modifiedAt ?? ''}:${blob.size}`;
  if (customKey && preferFilesApi) {
    try {
      const uploaded = await uploadBlobToGeminiFilesApi(
        blob,
        binaryMime,
        m.title,
        customKey,
        fileCacheKey,
        signal,
      );
      return {
        id: `mat-${m.id}`,
        name: m.title,
        mimeType: uploaded.mimeType,
        dataBase64: '',
        fileUri: uploaded.fileUri,
        sizeBytes: blob.size,
        tokenCount: uploaded.tokenCount,
      };
    } catch {
      // Fallback silencioso para inlineData se o tamanho couber no orçamento
    }
  }

  if (blob.size > remainingInlineBytes) {
    throw new Error(tr('common:errors.matDirectBudget'));
  }

  const dataBase64 = await blobToBase64(blob);
  return {
    id: `mat-${m.id}`,
    name: m.title,
    mimeType: binaryMime,
    dataBase64,
    sizeBytes: blob.size,
  };
}

async function resolveUploadMaterial(
  m: Material,
  customKey: string,
  keyTag: string,
  preferFilesApi: boolean,
  remainingInlineBytes: number,
  signal?: AbortSignal,
): Promise<CachedMaterialResolution> {
  const blob = await getFileBlob(m.id);
  if (!blob) {
    throw new Error(tr('common:errors.matLocalNotFound'));
  }
  const mime = m.mimeType || blob.type;
  const filename = m.fileName || m.title;

  if (isTextLike(mime, filename)) {
    const text = (await blob.text()).trim().slice(0, MAX_EXCERPT_CHARS);
    if (!text) throw new Error(tr('common:errors.matTextEmpty'));
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
    throw new Error(tr('common:errors.matUnsupported'));
  }
  const maxAllowed = customKey ? MAX_KEY_AI_MATERIAL_BYTES : MAX_FREE_AI_MATERIAL_BYTES;
  if (blob.size > maxAllowed) {
    throw new Error(
      customKey
        ? tr('common:errors.matMax25')
        : tr('common:errors.matMax75'),
    );
  }

  const attachment = await resolveBinaryBlobToAttachment(
    m,
    blob,
    binaryMime,
    customKey,
    keyTag,
    preferFilesApi,
    remainingInlineBytes,
    signal,
  );
  return {
    attachment,
    ...(attachment.fileUri ? { expiresAt: Date.now() + FILE_URI_TTL_MS } : {}),
  };
}

async function resolveDriveMaterial(
  m: Material,
  customKey: string,
  keyTag: string,
  preferFilesApi: boolean,
  remainingInlineBytes: number,
  signal?: AbortSignal,
): Promise<CachedMaterialResolution> {
  const fileId = extractGoogleDriveFileId(m.url, m.id);
  if (!fileId) {
    throw new Error(tr('common:errors.matDriveBadId'));
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
      throw new Error(res.status === 401 ? tr('common:errors.matDriveExpired') : tr('common:errors.matDocExportFail'));
    }
    const text = (await res.text()).trim().slice(0, MAX_EXCERPT_CHARS);
    if (!text) throw new Error(tr('common:errors.matDocNoText'));
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
    throw new Error(tr('common:errors.matDriveUnsupported'));
  }

  const mediaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? tr('common:errors.matDriveExpired') : tr('common:errors.matDriveHttp', { status: res.status }));
  }

  const maxAllowed = customKey ? MAX_KEY_AI_MATERIAL_BYTES : MAX_FREE_AI_MATERIAL_BYTES;
  const contentLen = Number(res.headers.get('content-length') ?? '0');
  if (contentLen > maxAllowed) {
    throw new Error(customKey ? tr('common:errors.matFileOver25') : tr('common:errors.matFileOver75'));
  }

  const blob = await res.blob();
  if (blob.size > maxAllowed) {
    throw new Error(customKey ? tr('common:errors.matFileOver25') : tr('common:errors.matFileOver75'));
  }

  if (textLike) {
    const text = (await blob.text()).trim().slice(0, MAX_EXCERPT_CHARS);
    if (!text) throw new Error(tr('common:errors.matTextEmpty'));
    return {
      excerpt: {
        id: m.id,
        title: m.title,
        provider: 'gdrive',
        content: text,
      },
    };
  }

  const attachment = await resolveBinaryBlobToAttachment(
    m,
    blob,
    binaryMime || blob.type || 'application/pdf',
    customKey,
    keyTag,
    preferFilesApi,
    remainingInlineBytes,
    signal,
  );
  return {
    attachment,
    ...(attachment.fileUri ? { expiresAt: Date.now() + FILE_URI_TTL_MS } : {}),
  };
}

/**
 * Resolve conteúdo real (PDF via Gemini Files API / anexo multimodal ou texto extraído)
 * para até `maxFiles` materiais (3 no modo gratuito; com chave pessoal, os que couberem em `getKeyContextTokenBudget()`).
 */
export async function resolveMaterialsForAI(
  materials: Material[],
  options?: { maxFiles?: number; signal?: AbortSignal },
): Promise<ResolvedMaterialsBundle> {
  const customKey = getCustomGeminiKey();
  const keyTag = fingerprintCustomKey(customKey);
  const hardCap = getAiMaterialLimit(Boolean(customKey));
  const maxFiles = Math.max(1, Math.min(hardCap, options?.maxFiles ?? hardCap));
  const candidates = materials.slice(0, maxFiles);
  const overflow = materials.slice(maxFiles);

  // Com chave pessoal, usa Gemini Files API (`fileUri` em cache 47h) para poupar o teto inline.
  const preferFilesApi = Boolean(customKey);

  const attachments: ChatAttachment[] = [];
  const textExcerpts: ResolvedMaterialExcerpt[] = [];
  const readTitles: string[] = [];
  const skipped: SkippedMaterialInfo[] = overflow.map((m) => ({
    id: m.id,
    title: m.title,
    reason: tr('common:errors.matLimitDocs', { max: maxFiles }),
  }));
  let needsDriveAuth = false;
  let inlineBytesUsed = 0;
  const tokenBudget = customKey ? getKeyContextTokenBudget() : SHARED_CONTEXT_TOKEN_BUDGET;
  let tokensUsed = 0;

  /** Valida teto inline e orçamento de tokens antes de contabilizar o material no contexto. */
  const tryIncludeResolved = (m: Material, resolved: CachedMaterialResolution): boolean => {
    const att = resolved.attachment;
    const isInline = Boolean(att && !att.fileUri);
    if (att && isInline && inlineBytesUsed + att.sizeBytes > MAX_TOTAL_INLINE_BYTES) {
      skipped.push({
        id: m.id,
        title: m.title,
        reason: tr('common:errors.matDirectSizeLimit'),
      });
      return false;
    }

    const cost =
      (att ? attachmentTokens(att) : 0) +
      (resolved.excerpt ? estimateTextTokens(resolved.excerpt.content) : 0);
    if (tokenBudget !== null && tokensUsed > 0 && tokensUsed + cost > tokenBudget) {
      skipped.push({
        id: m.id,
        title: m.title,
        reason: tr('common:errors.matTokenBudget', { k: Math.round(tokenBudget / 1000) }),
      });
      return false;
    }

    tokensUsed += cost;
    if (att) {
      if (isInline) inlineBytesUsed += att.sizeBytes;
      attachments.push(att);
    }
    if (resolved.excerpt) textExcerpts.push(resolved.excerpt);
    readTitles.push(m.title);
    return true;
  };

  for (const m of candidates) {
    if (options?.signal?.aborted) break;

    const cacheKey = `${keyTag}:${m.id}:${m.modifiedAt ?? ''}`;
    const cached = contentCache.get(cacheKey);
    if (cached && (!cached.expiresAt || cached.expiresAt > Date.now())) {
      tryIncludeResolved(m, cached);
      continue;
    }
    if (cached) contentCache.delete(cacheKey);

    const remainingInline = Math.max(0, MAX_TOTAL_INLINE_BYTES - inlineBytesUsed);

    if (m.provider === 'upload') {
      try {
        const resolved = await resolveUploadMaterial(
          m,
          customKey,
          keyTag,
          preferFilesApi,
          remainingInline,
          options?.signal,
        );
        setCacheEntry(cacheKey, resolved);
        tryIncludeResolved(m, resolved);
      } catch (err) {
        skipped.push({
          id: m.id,
          title: m.title,
          reason: err instanceof Error ? err.message : tr('common:errors.matLocalUnavailable'),
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
          reason: tr('common:errors.matDriveNeedsAuth'),
        });
        continue;
      }
      try {
        const resolved = await resolveDriveMaterial(
          m,
          customKey,
          keyTag,
          preferFilesApi,
          remainingInline,
          options?.signal,
        );
        setCacheEntry(cacheKey, resolved);
        tryIncludeResolved(m, resolved);
      } catch (err) {
        const msg = err instanceof Error ? err.message : tr('common:errors.matDriveFail');
        if (/(expir|caducad|sess[aã]o|session|sesi[oó]n)/i.test(msg)) {
          needsDriveAuth = true;
        }
        skipped.push({ id: m.id, title: m.title, reason: msg });
      }
      continue;
    }

    skipped.push({
      id: m.id,
      title: m.title,
      reason: tr('common:errors.matExternalLink'),
    });
  }

  return {
    attachments,
    textExcerpts,
    readTitles,
    skipped,
    needsDriveAuth,
    contextTokens: tokensUsed,
    contextTokenBudget: tokenBudget,
  };
}
