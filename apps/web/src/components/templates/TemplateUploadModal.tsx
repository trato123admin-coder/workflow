'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { FormField } from '../ui/FormField';
import {
  lintTemplateWithEngine,
  uploadTemplateToEngine,
  type TemplateLintApiResponse,
} from '../../lib/engine-client';
import { TemplateLintFeedback } from './TemplateLintFeedback';
import { Loader2, Upload } from 'lucide-react';

interface DocumentTypeOption {
  id: string;
  name: string;
  code: string;
  category: string;
}

interface TemplateUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  documentTypes: DocumentTypeOption[];
}

export const TemplateUploadModal: React.FC<TemplateUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  documentTypes,
}) => {
  const todayIso = new Date().toISOString().substring(0, 10);

  const [documentTypeId, setDocumentTypeId] = useState(documentTypes[0]?.id || '');

  useEffect(() => {
    if (!documentTypeId && documentTypes.length > 0) {
      setDocumentTypeId(documentTypes[0].id);
    }
  }, [documentTypes, documentTypeId]);

  const [name, setName] = useState('');
  const [validFrom, setValidFrom] = useState(todayIso);
  const [validUntil, setValidUntil] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isLinting, setIsLinting] = useState(false);
  const [lintResult, setLintResult] = useState<TemplateLintApiResponse | null>(null);
  const [lintError, setLintError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    if (!name) {
      setName(file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
    }

    setIsLinting(true);
    setLintResult(null);
    setLintError(null);

    try {
      const res = await lintTemplateWithEngine(file);
      setLintResult(res);
    } catch (err: unknown) {
      setLintError((err as Error).message || 'Error al inspeccionar la plantilla en el motor');
    } finally {
      setIsLinting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetDocTypeId = documentTypeId || documentTypes[0]?.id || '';
    if (!targetDocTypeId) {
      setServerError('Debe seleccionar un tipo de documento asociado');
      return;
    }
    if (!name.trim()) {
      setServerError('Debe ingresar un nombre para la plantilla');
      return;
    }
    if (!selectedFile) {
      setServerError('Debe seleccionar un archivo .docx');
      return;
    }

    if (lintResult && !lintResult.lint.isValid) {
      setServerError('No se puede subir una plantilla con errores de estructura o macros');
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    try {
      await uploadTemplateToEngine({
        file: selectedFile,
        documentTypeId: targetDocTypeId,
        name: name.trim(),
        validFrom,
        validUntil: validUntil || null,
        estimatedManualMinutes: estimatedMinutes,
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setServerError((err as Error).message || 'Error al registrar y subir plantilla');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasBrokenOrMacro = Boolean(lintError) || Boolean(lintResult && !lintResult.lint.isValid);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Subir y Validar Plantilla DOCX"
      description="El motor inspeccionará automáticamente los marcadores XML y verificará que no contenga macros."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {serverError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs">
            {serverError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField id="doc_type" label="Tipo de Documento Asociado" required>
            <select
              id="doc_type"
              value={documentTypeId || documentTypes[0]?.id || ''}
              onChange={(e) => setDocumentTypeId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary"
            >
              {documentTypes.map((dt) => (
                <option key={dt.id} value={dt.id}>
                  {dt.name} ({dt.category})
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="tpl_name" label="Nombre de la Plantilla" required>
            <input
              id="tpl_name"
              type="text"
              required
              placeholder="Ej. Solicitud Sucesión Intestada Notarial"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField id="valid_from" label="Vigente Desde" required>
            <input
              id="valid_from"
              type="date"
              required
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary"
            />
          </FormField>

          <FormField id="valid_until" label="Vigente Hasta (Opcional)">
            <input
              id="valid_until"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary"
            />
          </FormField>

          <FormField id="est_minutes" label="Tiempo Manual Estimado (Minutos)">
            <input
              id="est_minutes"
              type="number"
              min={0}
              max={1000}
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary"
            />
          </FormField>
        </div>

        {/* Selector de Archivo DOCX */}
        <div className="p-4 border-2 border-dashed border-border rounded-xl text-center space-y-2 bg-muted/20">
          <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
          <div className="text-xs text-muted-foreground">
            <label
              htmlFor="tpl_file"
              className="font-bold text-primary hover:underline cursor-pointer"
            >
              Seleccionar archivo .docx
            </label>
            <input
              id="tpl_file"
              type="file"
              accept=".docx"
              onChange={handleFileChange}
              className="hidden"
            />
            <p className="text-[11px] mt-1">
              Archivos Word XML (.docx). Se rechazan archivos con macros (.docm).
            </p>
          </div>
          {selectedFile && (
            <p className="text-xs font-semibold text-foreground pt-1">
              Archivo: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        <TemplateLintFeedback
          isLinting={isLinting}
          lintError={lintError}
          lintResult={lintResult}
          hasBrokenOrMacro={hasBrokenOrMacro}
        />

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-input bg-background text-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !selectedFile || hasBrokenOrMacro || isLinting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Registrar y Subir Plantilla</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
