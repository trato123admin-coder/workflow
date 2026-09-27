/**
 * generate-fixtures.ts — Generates sample DOCX template files for golden tests.
 *
 * Creates simple .docx files with {placeholder} markers using PizZip.
 * These are minimal valid DOCX files, not production-quality templates.
 *
 * Usage: npx tsx fixtures/templates/generate-fixtures.ts
 */

import PizZip from 'pizzip';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ */
/* Minimal DOCX builder (valid Office Open XML)                        */
/* ------------------------------------------------------------------ */

function buildMinimalDocx(bodyXml: string): Buffer {
  const zip = new PizZip();

  // [Content_Types].xml
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  // _rels/.rels
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  // word/document.xml
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
${bodyXml}
  </w:body>
</w:document>`);

  // word/_rels/document.xml.rels
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);

  return Buffer.from(zip.generate({ type: 'nodebuffer' }));
}

function paragraph(text: string): string {
  return `    <w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ */
/* Template definitions                                                */
/* ------------------------------------------------------------------ */

const templates: Array<{ filename: string; lines: string[] }> = [
  {
    filename: 'CONTRATO_SERVICIOS.docx',
    lines: [
      'CONTRATO DE PRESTACIÓN DE SERVICIOS LEGALES',
      '',
      'En la ciudad de {city}, a {current_date}',
      '',
      'PARTES:',
      'EL CLIENTE: {client_name}, identificado con {client_document_type} N.° {client_document_number}, domiciliado en {client_address}.',
      'EL ESTUDIO: {company_name}, con RUC {company_ruc}, representado por {lawyer_name}, abogado colegiado con matrícula {lawyer_colegiatura}, con domicilio procesal en {company_address}.',
      '',
      'OBJETO: {service_description}',
      'HONORARIOS: {service_fee}',
      'PLAZO: {service_duration}',
      '',
      'Expediente N.° {case_number}',
      '',
      'Firma del Cliente: ______________________',
      'Firma del Abogado: ______________________',
    ],
  },
  {
    filename: 'SOLICITUD_SUCESION_INTESTADA.docx',
    lines: [
      'SOLICITUD DE SUCESIÓN INTESTADA',
      '',
      '{city}, {current_date}',
      '',
      'Señor Notario: {notary_name}',
      '{notary_office}',
      '{notary_address}',
      '',
      'Expediente N.° {case_number}',
      '',
      'Yo, {applicant_name}, identificado con DNI N.° {applicant_document_number}, solicito se sirva tramitar la sucesión intestada del causante:',
      '',
      'CAUSANTE: {causante_name}',
      'DNI: {causante_document_number}',
      'Fecha de nacimiento: {causante_birth_date}',
      'Fecha de fallecimiento: {causante_death_date}',
      'Último domicilio: {causante_last_address}',
      'Estado civil: {causante_marital_status}',
      '',
      'CÓNYUGE SUPÉRSTITE: {spouse_name}, DNI {spouse_document_number}',
      '',
      'HEREDEROS:',
      '1. {heir_1_name}, DNI {heir_1_document_number} — {heir_1_relationship}',
      '2. {heir_2_name}, DNI {heir_2_document_number} — {heir_2_relationship}',
      '3. {heir_3_name}, DNI {heir_3_document_number} — {heir_3_relationship}',
      '',
      'BIENES: {property_description}',
      '',
      'Abogado patrocinante: {lawyer_name}, Colegiatura {lawyer_colegiatura}',
    ],
  },
  {
    filename: 'CARTA_NOTARIA.docx',
    lines: [
      'CARTA NOTARIAL',
      '',
      '{city}, {current_date}',
      '',
      'Expediente N.° {case_number}',
      '',
      'Señores: {recipient_name}',
      'Dirección: {recipient_address}',
      '',
      'De: {sender_name}',
      'DNI: {sender_document_number}',
      'Dirección: {sender_address}',
      '',
      'ASUNTO: {subject}',
      '',
      '{body}',
      '',
      'Atentamente,',
      '',
      '{sender_name}',
      'DNI N.° {sender_document_number}',
      '',
      'Abogado: {lawyer_name}, Colegiatura {lawyer_colegiatura}',
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Generate files                                                      */
/* ------------------------------------------------------------------ */

mkdirSync(__dirname, { recursive: true });

for (const tpl of templates) {
  const bodyXml = tpl.lines.map((line) => paragraph(line)).join('\n');
  const buffer = buildMinimalDocx(bodyXml);
  const outputPath = join(__dirname, tpl.filename);
  writeFileSync(outputPath, buffer);
  // eslint-disable-next-line no-console
  console.log(`✓ ${tpl.filename} (${buffer.length} bytes)`);
}

// eslint-disable-next-line no-console
console.log('\nPlantillas de ejemplo generadas exitosamente.');
