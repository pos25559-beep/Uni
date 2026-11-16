import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  DEFAULT_KEY_CONTEXT_TOKEN_BUDGET,
  MAX_KEY_CONTEXT_TOKEN_BUDGET,
  MIN_KEY_CONTEXT_TOKEN_BUDGET,
  attachmentTokens,
  estimateBinaryTokens,
  estimateTextTokens,
  getAiMaterialLimit,
  getKeyContextTokenBudget,
  setKeyContextTokenBudget,
} from "../materialContent";

describe("orçamento de contexto com chave pessoal", () => {
  beforeAll(() => {
    if (typeof globalThis.localStorage === "undefined") {
      const store = new Map<string, string>();
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => void store.set(k, v),
          removeItem: (k: string) => void store.delete(k),
        },
      });
    }
  });

  afterEach(() => {
    setKeyContextTokenBudget(null);
  });

  it("mantém 3 ficheiros no modo gratuito e levanta o teto de ficheiros com chave", () => {
    expect(getAiMaterialLimit(false)).toBe(3);
    expect(getAiMaterialLimit(true)).toBeGreaterThan(12);
  });

  it("usa o orçamento por omissão e respeita os limites ao configurar", () => {
    expect(getKeyContextTokenBudget()).toBe(DEFAULT_KEY_CONTEXT_TOKEN_BUDGET);
    setKeyContextTokenBudget(5_000_000);
    expect(getKeyContextTokenBudget()).toBe(MAX_KEY_CONTEXT_TOKEN_BUDGET);
    setKeyContextTokenBudget(10);
    expect(getKeyContextTokenBudget()).toBe(MIN_KEY_CONTEXT_TOKEN_BUDGET);
  });

  it("prefere a contagem real e estima quando não existe", () => {
    const base = {
      id: "a",
      name: "A.pdf",
      mimeType: "application/pdf",
      dataBase64: "",
      sizeBytes: 600_000,
    };
    expect(attachmentTokens({ ...base, tokenCount: 1234 })).toBe(1234);
    expect(attachmentTokens(base)).toBe(estimateBinaryTokens(600_000));
    expect(estimateBinaryTokens(600_000)).toBe(10 * 258);
    expect(estimateTextTokens("x".repeat(400))).toBe(100);
  });
});
