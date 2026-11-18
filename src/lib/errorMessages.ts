import { tr } from '../i18n/tr';

const TECHNICAL_PREFIX_RE =
  /^(?:TypeError|RangeError|SyntaxError|ReferenceError|DOMException|FirebaseError|Error)\s*:/i;
const TECHNICAL_ERROR_NAMES = new Set([
  'TypeError',
  'RangeError',
  'SyntaxError',
  'ReferenceError',
  'URIError',
  'EvalError',
  'DOMException',
]);
const RAW_JS_RUNTIME_RE =
  /Cannot read propert|Cannot set propert|undefined is not|is not a function|is not defined|unexpected token|null is not an object/i;

const QUOTA_RE = /QuotaExceededError|NS_ERROR_DOM_QUOTA_REACHED|storage quota|exceeded the quota/i;
const NETWORK_RE =
  /Failed to fetch|NetworkError|Load failed|ERR_INTERNET_DISCONNECTED|net::ERR_|network request failed|offline/i;
const TIMEOUT_RE = /AbortError|TimeoutError|timed out|timeout/i;
const PERMISSION_RE =
  /NotAllowedError|PermissionDeniedError|permission denied|insufficient authentication scopes|unauthorized|\b401\b|\b403\b/i;
const NOT_FOUND_RE = /NotFoundError|file not found|not_found|\b404\b/i;

/**
 * Converte erros técnicos de browser, IndexedDB, rede ou OAuth em mensagens amigáveis e acionáveis.
 */
export function toFriendlyError(err: unknown, fallback?: string): string {
  const defaultFallback = fallback || tr('common:errors.unexpected');

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return tr('common:errors.networkOffline');
  }

  const name =
    typeof err === 'object' && err !== null && 'name' in err
      ? String((err as { name: unknown }).name)
      : '';
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  const rawMessage =
    err instanceof Error
      ? err.message.trim()
      : typeof err === 'string'
        ? err.trim()
        : '';

  const combined = `${name} ${code} ${rawMessage}`.trim();
  if (!combined) return defaultFallback;

  if (QUOTA_RE.test(combined)) {
    return tr('common:errors.storageQuota');
  }
  if (PERMISSION_RE.test(combined)) {
    return tr('common:errors.permissionDenied');
  }
  if (NETWORK_RE.test(combined)) {
    return tr('common:errors.networkOffline');
  }
  if (TIMEOUT_RE.test(combined)) {
    return tr('common:errors.timeout');
  }
  if (NOT_FOUND_RE.test(combined) && rawMessage.length > 0 && /indexeddb|blob|file/i.test(combined)) {
    return tr('common:errors.fileNotFound');
  }

  if (
    rawMessage &&
    !TECHNICAL_ERROR_NAMES.has(name) &&
    !TECHNICAL_PREFIX_RE.test(rawMessage) &&
    !RAW_JS_RUNTIME_RE.test(rawMessage) &&
    !/\{.*\}|stack|indexeddb|firebase:|auth\//i.test(rawMessage)
  ) {
    return rawMessage;
  }

  return defaultFallback;
}
