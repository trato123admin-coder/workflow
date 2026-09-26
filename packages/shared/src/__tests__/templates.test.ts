import { describe, it, expect } from 'vitest';
import { lintDocxXml, isMacroEnabledDocx } from '../templates.js';

describe('Motor de Lint para Plantillas DOCX (templates)', () => {
  const whitelist = [
    'case.number',
    'case.title',
    'client.name',
    'client.doc_number',
    'causante.name',
    'causante.death_date',
    'estate.summary',
  ];

  describe('lintDocxXml', () => {
    it('valida exitosamente un XML con marcadores bien formados en un solo nodo <w:t>', () => {
      const xml = `
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p>
              <w:r><w:t>Señor Notario, el suscrito </w:t></w:r>
              <w:r><w:t>{{client.name}}</w:t></w:r>
              <w:r><w:t> identificado con DNI </w:t></w:r>
              <w:r><w:t>{{client.doc_number}}</w:t></w:r>
            </w:p>
          </w:body>
        </w:document>
      `;

      const result = lintDocxXml(xml, whitelist);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.placeholders).toEqual(['client.name', 'client.doc_number']);
      expect(result.unknownPlaceholders).toHaveLength(0);
      expect(result.brokenMarkers).toHaveLength(0);
    });

    it('detecta y rechaza marcadores partidos por Word a través de múltiples <w:r>', () => {
      // Simula el comportamiento clásico de Microsoft Word donde fragmenta {{causante.name}} en dos runs
      const xml = `
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p>
              <w:r><w:t>Fallecimiento de Don </w:t></w:r>
              <w:r><w:rPr><w:b/></w:rPr><w:t>{{causante.</w:t></w:r>
              <w:r><w:t>name}}</w:t></w:r>
            </w:p>
          </w:body>
        </w:document>
      `;

      const result = lintDocxXml(xml, whitelist);
      expect(result.isValid).toBe(false);
      expect(result.brokenMarkers.length).toBeGreaterThan(0);
      expect(result.brokenMarkers[0]).toContain("partido por Word");
      expect(result.errors).toContain(result.brokenMarkers[0]);
    });

    it('detecta marcadores con llaves desbalanceadas', () => {
      const xml = `
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p>
              <w:r><w:t>Expediente número {{case.number y fecha {{causante.death_date}}</w:t></w:r>
            </w:p>
          </w:body>
        </w:document>
      `;

      const result = lintDocxXml(xml, whitelist);
      expect(result.isValid).toBe(false);
      expect(result.brokenMarkers.some((m) => m.includes('desbalanceado'))).toBe(true);
    });

    it('rechaza y marca inválida la plantilla ante marcadores no registrados en el catálogo de campos', () => {
      const xml = `
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p>
              <w:r><w:t>{{client.name}}</w:t></w:r>
              <w:r><w:t>{{campo_inexistente_arbitrario}}</w:t></w:r>
            </w:p>
          </w:body>
        </w:document>
      `;

      const result = lintDocxXml(xml, whitelist);
      // Decisión de política: bloquea la subida (isValid = false)
      expect(result.isValid).toBe(false);
      expect(result.unknownPlaceholders).toContain('campo_inexistente_arbitrario');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('campo_inexistente_arbitrario'))).toBe(true);
    });

    it('falla limpiamente si el XML está vacío', () => {
      const result = lintDocxXml('', whitelist);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('El contenido XML del documento está vacío');
    });
  });

  describe('isMacroEnabledDocx', () => {
    it('detecta extensión .docm', () => {
      expect(isMacroEnabledDocx('plantilla_tramite.docm')).toBe(true);
      expect(isMacroEnabledDocx('plantilla_tramite.DOCM')).toBe(true);
    });

    it('detecta tipo MIME habilitado para macros', () => {
      expect(
        isMacroEnabledDocx(
          'archivo.docx',
          'application/vnd.ms-word.document.macroEnabled.12'
        )
      ).toBe(true);
    });

    it('detecta entrada vbaProject.bin dentro del zip', () => {
      expect(
        isMacroEnabledDocx('archivo.docx', 'application/vnd.openxmlformats', [
          'word/document.xml',
          'word/vbaProject.bin',
        ])
      ).toBe(true);
    });

    it('permite archivos DOCX estándar sin macros', () => {
      expect(
        isMacroEnabledDocx('solicitud.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', [
          'word/document.xml',
          'word/styles.xml',
        ])
      ).toBe(false);
    });
  });
});
