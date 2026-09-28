/**
 * golden-templates.test.ts — Integration tests for golden DOCX templates.
 *
 * Verifies that each fixture template can be rendered with its golden data
 * and produces a valid DOCX without unresolved placeholders.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDocx } from '../services/docx-renderer.js';
import PizZip from 'pizzip';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '../../fixtures/templates');

interface GoldenCase {
  name: string;
  templateFile: string;
  dataFile: string;
}

const goldenCases: GoldenCase[] = [
  {
    name: 'CONTRATO_SERVICIOS',
    templateFile: 'CONTRATO_SERVICIOS.docx',
    dataFile: 'golden-data-contrato-servicios.json',
  },
  {
    name: 'SOLICITUD_SUCESION_INTESTADA',
    templateFile: 'SOLICITUD_SUCESION_INTESTADA.docx',
    dataFile: 'golden-data-solicitud-intestada.json',
  },
  {
    name: 'CARTA_NOTARIA',
    templateFile: 'CARTA_NOTARIA.docx',
    dataFile: 'golden-data-carta-notaria.json',
  },
];

function extractTextContent(docxBuffer: Buffer): string {
  const zip = new PizZip(docxBuffer);
  const doc = zip.file('word/document.xml');
  if (!doc) return '';
  return doc.asText();
}

describe('Golden Template Tests', () => {
  for (const golden of goldenCases) {
    describe(golden.name, () => {
      const templatePath = join(fixturesDir, golden.templateFile);
      const dataPath = join(fixturesDir, golden.dataFile);

      it('fixture files exist', () => {
        expect(existsSync(templatePath)).toBe(true);
        expect(existsSync(dataPath)).toBe(true);
      });

      it('renders without errors', async () => {
        const templateBuffer = readFileSync(templatePath);
        const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

        const result = await renderDocx({ templateBuffer, data });

        expect(result.buffer).toBeInstanceOf(Buffer);
        expect(result.buffer.length).toBeGreaterThan(0);
      });

      it('output has no unresolved {{placeholder}} markers', async () => {
        const templateBuffer = readFileSync(templatePath);
        const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

        const result = await renderDocx({ templateBuffer, data });

        const textContent = extractTextContent(result.buffer);
        const unresolvedPattern = /\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/g;
        const unresolved = textContent.match(unresolvedPattern) ?? [];

        expect(unresolved).toEqual([]);
      });

      it('output contains expected data values', async () => {
        const templateBuffer = readFileSync(templatePath);
        const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

        const result = await renderDocx({ templateBuffer, data });

        const textContent = extractTextContent(result.buffer);

        // At least the first string field value should appear in the output
        const firstStringValue = Object.values(data).find(
          (v): v is string => typeof v === 'string' && v.length > 3,
        );
        if (firstStringValue) {
          expect(textContent).toContain(firstStringValue);
        }
      });
    });
  }
});
