import i18n, { resources } from './index';

type LangCode = keyof typeof resources;

function resolveLangKey(lang?: string): LangCode {
  if (!lang) return 'pt-PT';
  const l = lang.toLowerCase();
  if (l.startsWith('pt-br') || l.includes('brazil') || l.includes('brasil')) return 'pt-BR';
  if (l.startsWith('pt')) return 'pt-PT';
  if (l.startsWith('es')) return 'es';
  if (l.startsWith('en')) return 'en';
  return 'pt-PT';
}

function lookupInResources(
  langKey: LangCode,
  key: string,
  vars: Record<string, string | number>,
): string {
  const [ns, path] = key.includes(':') ? key.split(':', 2) : ['common', key];
  const nsObj = (resources[langKey] as Record<string, unknown>)?.[ns];
  const getPath = (p: string): unknown => {
    let node: unknown = nsObj;
    for (const part of p.split('.')) {
      node = node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined;
    }
    return node;
  };

  let node = getPath(path);
  if (typeof node !== 'string' && typeof vars.count === 'number') {
    const preferred = vars.count === 1 ? `${path}_one` : `${path}_other`;
    const fallback = vars.count === 1 ? `${path}_other` : `${path}_one`;
    node = getPath(preferred);
    if (typeof node !== 'string') node = getPath(fallback);
  }

  const text = typeof node === 'string' ? node : key;
  return text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(vars[name] ?? ''));
}

/**
 * Tradução para código fora de componentes (lib/). Usa a língua ativa da app;
 * sem i18n inicializado (testes, scripts) devolve o texto nos ficheiros de tradução.
 * Formato da chave: "namespace:caminho.da.chave".
 */
export function tr(
  key: string,
  vars: Record<string, string | number> = {},
  langOverride?: string,
): string {
  if (langOverride) {
    const lng = resolveLangKey(langOverride);
    if (i18n.isInitialized) return i18n.t(key, { ...vars, lng });
    return lookupInResources(lng, key, vars);
  }
  if (i18n.isInitialized) return i18n.t(key, vars);
  return lookupInResources('pt-PT', key, vars);
}
