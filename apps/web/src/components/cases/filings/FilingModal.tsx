'use client';

import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { Modal } from '../../ui/Modal';
import { FormField } from '../../ui/FormField';
import { createClient } from '../../../lib/supabase/client';
import { FilingDeadlineSection } from './FilingDeadlineSection';
import { addBusinessDays, toIsoDateString } from '@workflow/shared';
import { Loader2, AlertCircle } from 'lucide-react';
import type { CaseFiling } from '@workflow/shared';

export const FilingFormSchema = z.object({
  entity_id: z.string().uuid('Seleccione una entidad externa válida'),
  case_process_id: z.string().uuid().nullable().optional(),
  filing_kind: z.string().min(2, 'Especifique el tipo o acto del trámite'),
  reference_number: z.string().max(100).optional().nullable(),
  status: z.string().min(1, 'Seleccione un estado'),
  filed_at: z.string().optional().nullable(),
  response_due_date: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export type FilingFormData = z.infer<typeof FilingFormSchema>;

interface FilingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  caseId: string;
  filing?: CaseFiling | null;
  processes: Array<{ id: string; name: string }>;
  entities: Array<{ id: string; name: string; entity_type: string }>;
  statuses: Array<{ code: string; label: string; metadata?: Record<string, unknown> }>;
  publicationWaitDays: number;
  holidays: string[];
}

export const FilingModal: React.FC<FilingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  caseId,
  filing,
  processes,
  entities,
  statuses,
  publicationWaitDays,
  holidays,
}) => {
  const todayIso = toIsoDateString(new Date());

  const [formData, setFormData] = useState<FilingFormData>({
    entity_id: '',
    case_process_id: null,
    filing_kind: 'Publicación de Edictos',
    reference_number: '',
    status: 'PENDIENTE',
    filed_at: todayIso,
    response_due_date: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (filing) {
      setFormData({
        entity_id: filing.entity_id || '',
        case_process_id: filing.case_process_id || null,
        filing_kind: filing.filing_kind,
        reference_number: filing.reference_number || '',
        status: filing.status,
        filed_at: filing.filed_at ? filing.filed_at.substring(0, 10) : todayIso,
        response_due_date: filing.response_due_date
          ? filing.response_due_date.substring(0, 10)
          : '',
        notes: filing.notes || '',
      });
    } else {
      const defaultEntity = entities[0]?.id || '';
      setFormData({
        entity_id: defaultEntity,
        case_process_id: processes[0]?.id || null,
        filing_kind: 'Publicación de Edictos',
        reference_number: '',
        status: 'PENDIENTE',
        filed_at: todayIso,
        response_due_date: '',
        notes: '',
      });
    }
    setErrors({});
    setServerError(null);
  }, [filing, entities, processes, isOpen, todayIso]);

  const handleComputeDeadline = (businessDays: number) => {
    const baseDate = formData.filed_at || todayIso;
    const computed = addBusinessDays(baseDate, businessDays, holidays);
    setFormData((prev) => ({
      ...prev,
      response_due_date: toIsoDateString(computed),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    const parseResult = FilingFormSchema.safeParse(formData);
    if (!parseResult.success) {
      const errMap: Record<string, string> = {};
      parseResult.error.errors.forEach((err) => {
        errMap[err.path.join('.')] = err.message;
      });
      setErrors(errMap);
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const payload = {
        case_id: caseId,
        case_process_id: formData.case_process_id || null,
        entity_id: formData.entity_id,
        filing_kind: formData.filing_kind.trim(),
        reference_number: formData.reference_number?.trim() || null,
        status: formData.status,
        status_cat: 'filing_statuses',
        filed_at: formData.filed_at || null,
        response_due_date: formData.response_due_date || null,
        notes: formData.notes?.trim() || null,
      };

      if (filing?.id) {
        const { error } = await supabase.from('case_filings').update(payload).eq('id', filing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('case_filings').insert([payload]);
        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setServerError((err as Error).message || 'Error al guardar trámite externo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={filing ? 'Editar Trámite Externo' : 'Nuevo Trámite Externo'}
      description="Seguimiento de kardex, títulos registrales y publicaciones ante terceros."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {serverError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            id="entity_id"
            label="Entidad Externa"
            required
            error={errors.entity_id}
          >
            <select
              id="entity_id"
              value={formData.entity_id}
              onChange={(e) => setFormData({ ...formData, entity_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
            >
              {entities.length === 0 ? (
                <option value="">Sin entidades registradas</option>
              ) : (
                entities.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.name} ({ent.entity_type})
                  </option>
                ))
              )}
            </select>
          </FormField>

          <FormField id="case_process_id" label="Proceso Vinculado (Opcional)">
            <select
              id="case_process_id"
              value={formData.case_process_id || ''}
              onChange={(e) =>
                setFormData({ ...formData, case_process_id: e.target.value || null })
              }
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
            >
              <option value="">Ninguno (Trámite general del caso)</option>
              {processes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField id="filing_kind" label="Tipo de Acto / Trámite" required error={errors.filing_kind}>
            <input
              id="filing_kind"
              type="text"
              placeholder="Ej. Publicación Notarial"
              value={formData.filing_kind}
              onChange={(e) => setFormData({ ...formData, filing_kind: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
            />
          </FormField>

          <FormField
            id="reference_number"
            label="N.º Título / Kardex / Oficio"
            error={errors.reference_number}
          >
            <input
              id="reference_number"
              type="text"
              placeholder="Ej. Kardex 2026-1049"
              value={formData.reference_number || ''}
              onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
            />
          </FormField>

          <FormField id="status" label="Estado del Trámite" required error={errors.status}>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
            >
              {statuses.map((st) => (
                <option key={st.code} value={st.code}>
                  {st.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {/* Fechas y calculadora de días útiles */}
        <FilingDeadlineSection
          filedAt={formData.filed_at || ''}
          responseDueDate={formData.response_due_date || ''}
          onFiledAtChange={(val) => setFormData({ ...formData, filed_at: val })}
          onDueDateChange={(val) => setFormData({ ...formData, response_due_date: val })}
          onComputeDeadline={handleComputeDeadline}
          publicationWaitDays={publicationWaitDays}
        />

        <FormField id="notes" label="Notas y Observaciones" error={errors.notes}>
          <textarea
            id="notes"
            rows={3}
            placeholder="Anotaciones sobre requerimientos de la notaría, liquidación de derechos o esquela..."
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
          />
        </FormField>

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
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{filing ? 'Guardar Cambios' : 'Registrar Trámite'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
