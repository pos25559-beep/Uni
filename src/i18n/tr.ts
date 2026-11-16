import i18n, { resources } from './index';

/**
 * Tradução para código fora de componentes (lib/). Usa a língua ativa da app;
 * sem i18n inicializado (testes, scripts) devolve o texto pt-PT dos ficheiros de tradução.
 * Formato da chave: "namespace:caminho.da.chave".
 */
export function tr(key: string, vars: Record<string, string | number> = {}): string {
  if (i18n.isInitialized) return i18n.t(key, vars);
  const [ns, path] = key.includes(':') ? key.split(':', 2) : ['common', key];
  let node: unknown = (resources['pt-PT'] as Record<string, unknown>)[ns];
  for (const part of path.split('.')) {
    node = node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined;
  }
  const text = typeof node === 'string' ? node : key;
  return text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(vars[name] ?? ''));
}
