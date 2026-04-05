import { describe, it, expect } from "vitest";
import { MockOcrProvider } from "./mock-provider";

describe("MockOcrProvider", () => {
  it("retourne un OcrResult avec les champs requis", async () => {
    const provider = new MockOcrProvider();
    const buf = Buffer.from("dummy");
    const result = await provider.extractText(buf);

    expect(result).toMatchObject({
      text: expect.any(String),
      provider: "mock",
      processedAt: expect.any(String),
    });
  });

  it("retourne le texte par défaut (contient des champs de facture)", async () => {
    const provider = new MockOcrProvider();
    const result = await provider.extractText(Buffer.from(""));
    expect(result.text).toContain("FACTURE");
    expect(result.text).toContain("TVA");
  });

  it("retourne le texte personnalisé passé en option", async () => {
    const provider = new MockOcrProvider({ text: "Texte custom" });
    const result = await provider.extractText(Buffer.from(""));
    expect(result.text).toBe("Texte custom");
  });

  it("processedAt est un ISO 8601 valide", async () => {
    const provider = new MockOcrProvider();
    const result = await provider.extractText(Buffer.from(""));
    expect(() => new Date(result.processedAt)).not.toThrow();
    expect(new Date(result.processedAt).toISOString()).toBe(result.processedAt);
  });

  it("lève une erreur quand shouldFail = true", async () => {
    const provider = new MockOcrProvider({ shouldFail: true });
    await expect(provider.extractText(Buffer.from(""))).rejects.toThrow(
      "Mock OCR failure"
    );
  });

  it("lève une erreur avec le message personnalisé", async () => {
    const provider = new MockOcrProvider({
      shouldFail: true,
      errorMessage: "Provider unavailable",
    });
    await expect(provider.extractText(Buffer.from(""))).rejects.toThrow(
      "Provider unavailable"
    );
  });

  it("le nom du fournisseur est 'mock'", () => {
    expect(new MockOcrProvider().name).toBe("mock");
  });
});
