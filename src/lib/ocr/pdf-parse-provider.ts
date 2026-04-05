import type { OcrProvider, OcrResult } from "./types";

/**
 * Fournisseur OCR basé sur pdf-parse (extraction de texte intégrée).
 *
 * Avantages :
 *   - Gratuit, sans appel réseau
 *   - Fonctionne parfaitement pour les PDFs générés numériquement
 *
 * Limitations :
 *   - Ne peut pas extraire le texte des PDFs scannés (images)
 *   - Pour les scans, utiliser AzureFormRecognizerProvider (T004+)
 *
 * Runtime : Node.js uniquement (ne fonctionne pas en Edge runtime)
 */
export class PdfParseProvider implements OcrProvider {
  readonly name = "pdf-parse";

  async extractText(pdfBuffer: Buffer): Promise<OcrResult> {
    // pdfjs-dist >= 4.x utilise DOMMatrix, une API web absente de Node.js.
    // On injecte un polyfill minimal avant d'appeler pdf-parse.
    if (typeof globalThis.DOMMatrix === "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).DOMMatrix = class DOMMatrix {
        a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
        m11 = 1; m12 = 0; m13 = 0; m14 = 0;
        m21 = 0; m22 = 1; m23 = 0; m24 = 0;
        m31 = 0; m32 = 0; m33 = 1; m34 = 0;
        m41 = 0; m42 = 0; m43 = 0; m44 = 1;
        is2D = true; isIdentity = true;
        constructor(_init?: string | number[]) {}
        multiply(_other?: unknown) { return this; }
        translate(_tx = 0, _ty = 0, _tz = 0) { return this; }
        scale(_sx = 1, _sy = 1, _sz = 1) { return this; }
        rotate(_rx = 0, _ry = 0, _rz = 0) { return this; }
        inverse() { return this; }
        transformPoint(p?: { x?: number; y?: number }) {
          return { x: p?.x ?? 0, y: p?.y ?? 0, z: 0, w: 1 };
        }
        toFloat32Array() { return new Float32Array(16); }
        toFloat64Array() { return new Float64Array(16); }
        toString() { return "matrix(1, 0, 0, 1, 0, 0)"; }
        static fromMatrix(_init?: unknown) { return new (globalThis as any).DOMMatrix(); }
        static fromFloat32Array(_a: Float32Array) { return new (globalThis as any).DOMMatrix(); }
        static fromFloat64Array(_a: Float64Array) { return new (globalThis as any).DOMMatrix(); }
      };
    }

    // pdf-parse est un module CJS — utiliser require() est plus fiable que import()
    // car certains bundlers enveloppent le module.exports dans { default: ... }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (
      buf: Buffer,
      opts?: { max?: number }
    ) => Promise<{ text?: string }>;

    const data = await pdfParse(pdfBuffer, {
      // Désactive le chargement des tests internes de pdf-parse
      max: 0,
    });

    const text = (data.text ?? "").trim();

    return {
      text,
      provider: this.name,
      processedAt: new Date().toISOString(),
    };
  }
}
