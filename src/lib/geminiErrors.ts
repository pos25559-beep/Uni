export class ModelTimeoutError extends Error {
  constructor(model: string, timeoutMs: number) {
    super(`Timeout após ${Math.round(timeoutMs / 1000)}s ao aguardar ${model}.`);
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
    return new CustomKeyError(
      'other',
      'O modelo demorou demasiado tempo a responder com a tua chave pessoal. Tenta novamente.',
    );
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
    return new CustomKeyError(
      'billing',
      'A tua chave Gemini está num projeto do Google AI Studio com créditos pré-pagos esgotados (sem faturação ativa). Cria uma nova chave num projeto gratuito (Free tier) em ai.studio/projects ou muda temporariamente para o Uni Nativo.',
    );
  }
  if (
    lower.includes('api key not valid') ||
    lower.includes('api_key_invalid') ||
    lower.includes('invalid api key') ||
    statusCode === 401
  ) {
    return new CustomKeyError(
      'invalid',
      'A tua chave Gemini pessoal parece inválida. Verifica em «Gerir chave» se copiaste tudo começando por AIza…',
    );
  }
  if (
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota exceeded') ||
    lower.includes('rate limit')
  ) {
    return new CustomKeyError(
      'quota',
      'A tua chave Gemini atingiu o limite por minuto ou diário do Google AI Studio. Aguarda instantes ou usa o Uni Nativo.',
    );
  }
  if (lower.includes('permission_denied') || statusCode === 403) {
    return new CustomKeyError(
      'invalid',
      'Esta chave Gemini não tem permissão para usar a Gemini API no projeto escolhido em ai.studio/projects.',
    );
  }
  return err instanceof Error ? err : new Error(raw || 'Erro ao contactar a Gemini API.');
}
