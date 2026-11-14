/** Utilitários partilhados para leitura e normalização de prints/imagens antes do OCR com IA. */

const MAX_RAW_IMAGE_BYTES = 15 * 1024 * 1024;
const OPTIMIZE_THRESHOLD_BYTES = 1_400_000;
const MAX_NORMALIZED_DIMENSION = 1800;

export function inferImageMimeType(file: File): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  return 'image/jpeg';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timer = window.setTimeout(() => {
      try {
        reader.abort();
      } catch {
        // Ignora erro de abort em browsers antigos
      }
      reject(new Error(`A leitura do ficheiro "${file.name}" demorou demasiado tempo.`));
    }, 12_000);

    reader.onload = () => {
      window.clearTimeout(timer);
      resolve(String(reader.result ?? ''));
    };
    reader.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error(`Não foi possível ler "${file.name}".`));
    };
    reader.onabort = () => {
      window.clearTimeout(timer);
      reject(new Error(`Leitura de "${file.name}" interrompida.`));
    };
    reader.readAsDataURL(file);
  });
}

function transcodeViaCanvas(
  dataUrl: string,
): Promise<{ base64: string; mimeType: string } | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      resolve(null);
      return;
    }

    const img = new Image();
    let settled = false;
    const finish = (value: { base64: string; mimeType: string } | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };

    const timer = window.setTimeout(() => finish(null), 8_000);

    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          finish(null);
          return;
        }
        const scale = Math.min(1, MAX_NORMALIZED_DIMENSION / Math.max(w, h));
        const targetW = Math.max(1, Math.round(w * scale));
        const targetH = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish(null);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const jpegUrl = canvas.toDataURL('image/jpeg', 0.88);
        finish(jpegUrl.startsWith('data:image/jpeg') ? { base64: jpegUrl, mimeType: 'image/jpeg' } : null);
      } catch {
        finish(null);
      }
    };
    img.onerror = () => finish(null);
    img.src = dataUrl;
  });
}

/**
 * Lê uma imagem selecionada e otimiza capturas pesadas ou HEIC (comum em Safari/iOS)
 * mantendo texto nítido para leitura OCR sem exceder o tempo de envio.
 */
export async function readNormalizedScreenshot(
  file: File,
): Promise<{ base64: string; mimeType: string }> {
  if (file.size > MAX_RAW_IMAGE_BYTES) {
    throw new Error(`A imagem "${file.name}" excede 15 MB. Tenta uma versão mais leve.`);
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const rawMime = inferImageMimeType(file).toLowerCase();
  const isHeic = rawMime.includes('heic') || rawMime.includes('heif');
  const needsOptimization = isHeic || file.size > OPTIMIZE_THRESHOLD_BYTES;

  if (needsOptimization) {
    const converted = await transcodeViaCanvas(rawDataUrl);
    if (converted) return converted;
  }

  return { base64: rawDataUrl, mimeType: rawMime };
}
