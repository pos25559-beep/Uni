import { tr } from '../i18n/tr';

export class ModelTimeoutError extends Error {
  constructor(model: string, timeoutMs: number) {
    super(
      tr('common:errors.geminiTimeoutShort', {
        seconds: Math.round(timeoutMs / 1000),
        model,
      }),
    );
    this.name = 'ModelTimeoutError';
  }
}

export class HttpStatusError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class CustomKeyError extends Error {
  kind: 'billing' | 'invalid' | 'quota' | 'other';
  constructor(kind: 'billing' | 'invalid' | 'quota' | 'other', message: string) {
    super(message);
    this.name = 'CustomKeyError';
    this.kind = kind;
  }
}

/** Traduz erros brutos da Google Gemini API quando o utilizador usa chave pessoal AI Studio. */
export function friendlyCustomKeyError(err: unknown): Error {
  if (err instanceof CustomKeyError) return err;
  if (err instanceof ModelTimeoutError) {
    return new CustomKeyError('other', tr('common:errors.geminiTimeout'));
  }
  const statusCode = err instanceof HttpStatusError ? err.statusCode : undefined;
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();
  if (
    lower.includes('prepayment credits') ||
    lower.includes('credits are depleted') ||
    lower.includes('billing#prepay') ||
    statusCode === 402
  ) {
    return new CustomKeyError('billing', tr('common:errors.geminiBilling'));
  }
  if (
    lower.includes('api key not valid') ||
    lower.includes('api_key_invalid') ||
    lower.includes('invalid api key') ||
    statusCode === 401
  ) {
    return new CustomKeyError('invalid', tr('common:errors.geminiInvalid'));
  }
  if (
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota exceeded') ||
    lower.includes('rate limit')
  ) {
    return new CustomKeyError('quota', tr('common:errors.geminiQuota'));
  }
  if (lower.includes('permission_denied') || statusCode === 403) {
    return new CustomKeyError('invalid', tr('common:errors.geminiDenied'));
  }
  return err instanceof Error ? err : new Error(raw || tr('common:errors.geminiGeneric'));
}
