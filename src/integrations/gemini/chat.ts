import type { GenerationConfig } from 'firebase/ai';
import { tr } from '../../i18n/tr';
import { readNormalizedScreenshot } from '../../lib/imageUpload';
import type { ChatAttachment } from './core';
import {
  buildContentsWithAttachments,
  callDirectRest,
  callDirectRestStream,
  getCustomGeminiKey,
  resolveGeminiConfig,
  runNativeGenerate,
  runNativeStream,
  withQuotaAndFallback,
} from './core';
import {
  CHAT_ATTACHMENT_FALLBACK_TIMEOUT_MS,
  CHAT_ATTACHMENT_PRIMARY_TIMEOUT_MS,
  FALLBACK_TIMEOUT_MS,
  PRIMARY_TIMEOUT_MS,
  resolveChatThinkingConfig,
} from './models';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  /** ISO datetime */
  at: string;
  sourceDocTitles?: string[];
  attachmentNames?: string[];
}

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export function hasCustomGeminiKey(): boolean {
  return Boolean(getCustomGeminiKey());
}

/** Converte uma imagem ou PDF anexado pelo utilizador em parte multimodal pronta e leve para o Gemini. */
export async function fileToChatAttachment(file: File): Promise<ChatAttachment> {
  const isImage =
    file.type.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|heic|heif|bmp)$/i.test(file.name);
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isImage && !isPdf) {
    throw new Error(tr('common:errors.attUnsupported', { name: file.name }));
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(tr('common:errors.attTooLarge', { name: file.name }));
  }

  if (isImage) {
    try {
      const normalized = await readNormalizedScreenshot(file);
      return {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        mimeType: normalized.mimeType,
        dataBase64: normalized.base64,
        sizeBytes: Math.round((normalized.base64.length * 3) / 4),
      };
    } catch {
      // fallback abaixo se descodificação canvas falhar
    }
  }

  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error(tr('common:errors.attReadFail', { name: file.name })));
    reader.readAsDataURL(file);
  });

  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    mimeType: isPdf ? 'application/pdf' : file.type || 'image/jpeg',
    dataBase64,
    sizeBytes: file.size,
  };
}

export async function askGemini(args: {
  messages: { role: 'user' | 'model'; text: string }[];
  system: string;
  attachments?: ChatAttachment[];
  signal?: AbortSignal;
}): Promise<string> {
  const { customKey, model } = resolveGeminiConfig();
  const contents = buildContentsWithAttachments(args.messages, args.attachments);
  const generationConfig: GenerationConfig = {
    temperature: 0.65,
    thinkingConfig: resolveChatThinkingConfig(model),
  };

  const text = await withQuotaAndFallback('chat', customKey, () =>
    customKey
      ? callDirectRest({
          key: customKey,
          model,
          contents,
          system: args.system,
          generationConfig,
          signal: args.signal,
        })
      : runNativeGenerate({
          model,
          contents,
          system: args.system,
          generationConfig,
          signal: args.signal,
        }),
  );

  if (!text) throw new Error(tr('common:errors.aiEmptyReply'));
  return text;
}

/** Resposta em tempo real (streaming palavra a palavra) para o Tutor com suporte multimodal. */
export async function streamGeminiChat(args: {
  messages: { role: 'user' | 'model'; text: string }[];
  system: string;
  attachments?: ChatAttachment[];
  signal?: AbortSignal;
  onToken: (accumulatedText: string) => void;
}): Promise<string> {
  const { customKey, model } = resolveGeminiConfig();
  const contents = buildContentsWithAttachments(args.messages, args.attachments);
  const generationConfig: GenerationConfig = {
    temperature: 0.65,
    thinkingConfig: resolveChatThinkingConfig(model),
  };
  const hasAttachments = Boolean(args.attachments && args.attachments.length > 0);
  const primaryTimeoutMs = hasAttachments
    ? CHAT_ATTACHMENT_PRIMARY_TIMEOUT_MS
    : PRIMARY_TIMEOUT_MS;
  const fallbackTimeoutMs = hasAttachments
    ? CHAT_ATTACHMENT_FALLBACK_TIMEOUT_MS
    : FALLBACK_TIMEOUT_MS;

  const text = await withQuotaAndFallback('chat', customKey, () =>
    customKey
      ? callDirectRestStream({
          key: customKey,
          model,
          contents,
          system: args.system,
          generationConfig,
          signal: args.signal,
          primaryTimeoutMs,
          fallbackTimeoutMs,
          overloadRetries: 1,
          onToken: args.onToken,
        })
      : runNativeStream({
          model,
          contents,
          system: args.system,
          generationConfig,
          signal: args.signal,
          primaryTimeoutMs,
          fallbackTimeoutMs,
          overloadRetries: 1,
          onToken: args.onToken,
        }),
  );

  if (!text) throw new Error(tr('common:errors.aiEmptyReply'));
  return text;
}
