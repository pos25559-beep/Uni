// Armazenamento local de ficheiros (PDFs, Slides, Sebentas) usando IndexedDB.
// Permite guardar ficheiros pesados sem limitações de quota do localStorage.

const DB_NAME = 'uni_erp_files_db';
const DB_VERSION = 1;
const STORE_NAME = 'files';

interface StoredFileRecord {
  id: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  updatedAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Guarda um ficheiro binário (PDF, PPTX, etc.) no IndexedDB.
 */
export async function saveFile(id: string, file: File): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record: StoredFileRecord = {
      id,
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      blob: file,
      updatedAt: new Date().toISOString(),
    };
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Obtém um ficheiro do IndexedDB como URL utilizável (blob URL) para abrir ou descarregar.
 */
export async function getFileUrl(id: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const record = req.result as StoredFileRecord | undefined;
      if (!record || !record.blob) {
        resolve(null);
        return;
      }
      resolve(URL.createObjectURL(record.blob));
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Obtém o ficheiro Blob.
 */
export async function getFileBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const record = req.result as StoredFileRecord | undefined;
      resolve(record?.blob ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Remove um ficheiro do IndexedDB.
 */
export async function deleteFile(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Formata tamanho em KB ou MB.
 */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
