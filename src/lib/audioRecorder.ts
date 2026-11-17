export const MAX_NATIVE_AUDIO_BYTES = 4 * 1024 * 1024;
export const MAX_CUSTOM_AUDIO_BYTES = 15 * 1024 * 1024;

export interface RecordedAudioClip {
  base64: string;
  mimeType: string;
  sizeBytes: number;
  durationSec?: number;
  fileName?: string;
}

export interface ActiveAudioRecorder {
  mimeType: string;
  stop: () => Promise<RecordedAudioClip>;
  cancel: () => void;
}

const MIME_CANDIDATES = [
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
] as const;

export function pickSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return 'audio/webm';
  }
  for (const candidate of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return 'audio/webm';
}

export function isAudioRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read audio blob'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

function normalizeMimeType(raw: string, fallback = 'audio/webm'): string {
  const base = raw.split(';')[0]?.trim().toLowerCase();
  if (!base) return fallback;
  if (base === 'audio/x-m4a') return 'audio/mp4';
  return base;
}

export async function startAudioRecording(): Promise<ActiveAudioRecorder> {
  if (!isAudioRecordingSupported()) {
    throw new Error('AUDIO_RECORD_UNSUPPORTED');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const preferredMime = pickSupportedAudioMimeType();
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: preferredMime });
  } catch {
    recorder = new MediaRecorder(stream);
  }

  const chunks: BlobPart[] = [];
  const startedAt = Date.now();
  let cancelled = false;
  let stopped = false;

  const releaseTracks = () => {
    for (const track of stream.getTracks()) {
      try {
        track.stop();
      } catch {
        // ignore
      }
    }
  };

  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) {
      chunks.push(ev.data);
    }
  };

  recorder.start(250);

  return {
    mimeType: normalizeMimeType(recorder.mimeType || preferredMime),
    stop: () =>
      new Promise<RecordedAudioClip>((resolve, reject) => {
        if (stopped || cancelled) {
          releaseTracks();
          reject(new Error('AUDIO_RECORD_CANCELLED'));
          return;
        }
        stopped = true;
        recorder.onstop = async () => {
          releaseTracks();
          if (cancelled) {
            reject(new Error('AUDIO_RECORD_CANCELLED'));
            return;
          }
          try {
            const rawMime = recorder.mimeType || preferredMime;
            const blob = new Blob(chunks, { type: rawMime });
            const base64 = await blobToBase64(blob);
            resolve({
              base64,
              mimeType: normalizeMimeType(rawMime),
              sizeBytes: blob.size,
              durationSec: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
            });
          } catch (err) {
            reject(err);
          }
        };
        recorder.onerror = () => {
          releaseTracks();
          reject(new Error('AUDIO_RECORD_FAILED'));
        };
        try {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          } else {
            releaseTracks();
            reject(new Error('AUDIO_RECORD_EMPTY'));
          }
        } catch (err) {
          releaseTracks();
          reject(err);
        }
      }),
    cancel: () => {
      cancelled = true;
      try {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      } catch {
        // ignore
      }
      releaseTracks();
    },
  };
}

export async function audioFileToBase64(file: File): Promise<RecordedAudioClip> {
  const base64 = await blobToBase64(file);
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const fallbackMime =
    ext === 'mp3'
      ? 'audio/mpeg'
      : ext === 'wav'
        ? 'audio/wav'
        : ext === 'm4a' || ext === 'mp4'
          ? 'audio/mp4'
          : ext === 'ogg'
            ? 'audio/ogg'
            : 'audio/webm';
  return {
    base64,
    mimeType: normalizeMimeType(file.type || fallbackMime, fallbackMime),
    sizeBytes: file.size,
    fileName: file.name,
  };
}
