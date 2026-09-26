'use client';

import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { createClient } from '../../lib/supabase/client';
import type { CaseDocumentStatus } from '@workflow/shared';

interface DocumentStatusModalProps {
  caseDocumentId: string | null;
  documentTitle: string;
  targetStatus: 'VALIDATED' | 'OBSERVED' | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const DocumentStatusModal: React.FC<DocumentStatusModalProps> = ({
  caseDocumentId,
  documentTitle,
  targetStatus,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!targetStatus) return null;

  const isValidating = targetStatus === 'VALIDATED';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseDocumentId) return;

    if (!isValidating && !notes.trim()) {
      setErrorMessage('Debe indicar el motivo de la observación para guiar al gestor.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('case_documents')
        .update({
          status: targetStatus,
          notes: notes.trim() || null,
        })
        .eq('id', caseDocumentId);

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al actualizar el estado del documento');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isValidating
          ? `Aprobar Documento: ${documentTitle}`
          : `Observar Documento: ${documentTitle}`
      }
      description={
        isValidating
          ? 'Al validar, el documento cumple los requisitos legales del trámite.'
          : 'Indique qué subsanación se requiere (ej. documento ilegible, caducado, etc.).'
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            {errorMessage}
          </div>
        )}

        <div>
          <label
            htmlFor="status-notes"
            className="block text-xs font-semibold text-foreground mb-1"
          >
            {isValidating ? 'Notas de aprobación (opcional)' : 'Motivo de la observación *'}
          </label>
          <textarea
            id="status-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              isValidating
                ? 'Ej. Verificado contra Reniec, datos conformes.'
                : 'Ej. La partida está borrosa en el nombre de la madre. Solicitar copia certificada.'
            }
            className="w-full p-2.5 text-xs rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-input text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-50 ${
              isValidating
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isValidating ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            <span>{isValidating ? 'Aprobar y Validar' : 'Registrar Observación'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
