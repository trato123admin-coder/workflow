/**
 * docx-renderer.ts — Render DOCX templates using docx-templates (MIT).
 *
 * Takes a DOCX template buffer and a flat data map,
 * returns the rendered DOCX as a Buffer.
 */

import { createReport } from 'docx-templates';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface RenderDocxParams {
  /** Raw DOCX template file content */
  templateBuffer: Buffer;
  /** Flat map of placeholder → value */
  data: Record<string, unknown>;
  /** Delimiter pair, default ['{', '}'] */
  cmdDelimiter?: [string, string];
}

export interface RenderDocxResult {
  /** Rendered DOCX file content */
  buffer: Buffer;
  /** Number of fields substituted */
  fieldsSubstituted: number;
}

/* ------------------------------------------------------------------ */
/* Main function                                                       */
/* ------------------------------------------------------------------ */

/**
 * Renders a DOCX template by substituting placeholders with data.
 *
 * Uses `docx-templates` which handles:
 * - Simple field substitution: {field_name}
 * - Loops: {#items}...{/items}
 * - Conditionals: {#if condition}...{/if}
 *
 * @throws Error if the template cannot be parsed or rendered.
 */
export async function renderDocx(params: RenderDocxParams): Promise<RenderDocxResult> {
  const { templateBuffer, data, cmdDelimiter } = params;

  const result = await createReport({
    template: templateBuffer,
    data,
    cmdDelimiter: cmdDelimiter ?? ['{', '}'],
    failFast: true,
    rejectNullish: false,
  });

  const outputBuffer = Buffer.from(result);

  return {
    buffer: outputBuffer,
    fieldsSubstituted: Object.keys(data).length,
  };
}

/**
 * Extracts placeholder names from a DOCX template buffer.
 * Useful for validation and lint checks.
 *
 * Note: This is a simplified extraction that looks for {placeholder}
 * patterns in the XML content. For full lint, use the engine's
 * template lint endpoint.
 */
export async function extractPlaceholders(
  templateBuffer: Buffer,
  cmdDelimiter: [string, string] = ['{', '}'],
): Promise<string[]> {
  const [open, close] = cmdDelimiter;
  const escapedOpen = open.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedClose = close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `${escapedOpen}\\s*([a-zA-Z_][a-zA-Z0-9_.]*?)\\s*${escapedClose}`,
    'g',
  );

  // docx-templates can list commands; for simple extraction, parse the XML
  const PizZip = (await import('pizzip')).default;
  const zip = new PizZip(templateBuffer);

  const placeholders = new Set<string>();
  const xmlFiles = ['word/document.xml', 'word/header1.xml', 'word/footer1.xml'];

  for (const xmlPath of xmlFiles) {
    const file = zip.file(xmlPath);
    if (!file) continue;
    const content = file.asText();
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) placeholders.add(match[1]);
    }
  }

  return Array.from(placeholders);
}
