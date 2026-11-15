import { friendlyCustomKeyError } from './gemini';

const MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=50';
const MODEL_GEN_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GeminiKeyTestResult {
  available: boolean;
  suggestions: string[];
  total: number;
}

/** Valida uma chave pessoal Gemini diretamente contra a Google Generative Language API (lista + teste real de geração). */
export async function verifyGeminiApiKey(
  rawKey: string,
  wantedModel = 'gemini-3.8-flash',
): Promise<GeminiKeyTestResult> {
  const key = rawKey.trim();
  if (!key) {
    throw new Error('Cola primeiro a tua chave começada por «AIza…» vinda do Google AI Studio.');
  }
  // A chave segue sempre no cabeçalho, nunca no URL.
  const res = await fetch(MODELS_URL, { headers: { 'x-goog-api-key': key } });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw friendlyCustomKeyError(
      new Error(body?.error?.message ?? `Erro ${res.status} ao contactar a API Gemini.`),
    );
  }
  const data = (await res.json()) as { models?: { name?: string }[] };
  const names = (data.models ?? [])
    .map((m) => (m.name ?? '').replace(/^models\//, ''))
    .filter(Boolean);

  // Testa também uma chamada mínima real para detetar créditos pré-pagos esgotados (402) ou quota a zero.
  const probeModel = names.includes(wantedModel)
    ? wantedModel
    : names.find((n) => n.includes('flash') && !n.includes('image') && !n.includes('tts')) ||
      wantedModel;
  const probeRes = await fetch(
    `${MODEL_GEN_BASE}/${encodeURIComponent(probeModel)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'OK' }] }],
        generationConfig: { maxOutputTokens: 2 },
      }),
    },
  );
  if (!probeRes.ok) {
    const probeBody = (await probeRes.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw friendlyCustomKeyError(
      new Error(probeBody?.error?.message ?? `Erro ${probeRes.status} ao validar envio na API Gemini.`),
    );
  }

  return {
    available: names.includes(wantedModel),
    suggestions: names.filter((n) => n.includes('gemini')).slice(0, 8),
    total: names.length,
  };
}
