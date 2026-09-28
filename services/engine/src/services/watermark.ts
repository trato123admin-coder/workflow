/**
 * watermark.ts — Adds a diagonal "BORRADOR" watermark to PDF pages.
 *
 * Uses pdf-lib (MIT, pure JS, no native dependencies).
 */

import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface AddWatermarkParams {
  /** Raw PDF file content */
  pdfBuffer: Buffer;
  /** Watermark text (default: "BORRADOR") */
  text?: string;
  /** Font size (default: 60) */
  fontSize?: number;
  /** Opacity 0–1 (default: 0.3) */
  opacity?: number;
}

/**
 * Overlays a diagonal semi-transparent watermark on every page of the PDF.
 *
 * @returns Modified PDF as Buffer with the watermark applied.
 */
export async function addWatermark(params: AddWatermarkParams): Promise<Buffer> {
  const { pdfBuffer, text = 'BORRADOR', fontSize = 60, opacity = 0.3 } = params;

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    page.drawText(text, {
      x: (width - textWidth * 0.7) / 2,
      y: height / 2 - fontSize / 2,
      size: fontSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity,
      rotate: degrees(45),
    });
  }

  const outputBytes = await pdfDoc.save();
  return Buffer.from(outputBytes);
}
