'use client';

import React, { useState } from 'react';
import { z } from 'zod';
import { createClient } from '../../lib/supabase/client';
import { Modal } from '../ui/Modal';
import { Loader2, AlertCircle, PlusCircle } from 'lucide-react';

export const DocumentTypeFormSchema = z
  .object({
    code: z
      .string()
      .min(3, 'El código debe tener al menos 3 caracteres')
      .max(50, 'El código no puede exceder 50 caracteres')
      .regex(/^[A-Z0-9_]+$/, 'El código debe contener solo mayúsculas, números y guiones bajos'),
    name: z
      .string()
      .min(3, 'El nombre debe tener al menos 3 caracteres')
      .max(100, 'El nombre no puede exceder 100 caracteres'),
    category: z.string().min(2, 'La categoría es requerida'),
    nature: z.enum(['GENERATED', 'UPLOADED', 'EXTERNAL']),
    scope: z.enum(['CASO', 'PERSONA', 'BIEN']),
    party_role: z.string().optional().nullable(),
    asset_type: z.string().optional().nullable(),
    validity_days: z.number().int().positive().nullable().optional(),
    requires_template: z.boolean(),
    description: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.scope === 'PERSONA' && !data.party_role) {
        return false;
      }
      return true;
    },
    {
      message: 'Debe especificar el rol del interviniente para el ámbito Persona',
      path: ['party_role'],
    },
  )
  .refine(
    (data) => {
      if (data.scope === 'BIEN' && !data.asset_type) {
        return false;
      }
      return true;
    },
    {
      message: 'Debe especificar el tipo de bien para el ámbito Bien',
      path: ['asset_type'],
    },
  );

type DocumentTypeFormData = z.infer<typeof DocumentTypeFormSchema>;

interface CreateDocumentTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateDocumentTypeModal: React.FC<CreateDocumentTypeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<DocumentTypeFormData>({
    code: '',
    name: '',
    category: 'IDENTIDAD',
    nature: 'UPLOADED',
    scope: 'CASO',
    party_role: null,
    asset_type: null,
    validity_days: null,
    requires_template: false,
    description: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleChange = (field: keyof DocumentTypeFormData, value: unknown) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'scope') {
        if (value !== 'PERSONA') updated.party_role = null;
        if (value !== 'BIEN') updated.asset_type = null;
      }
      if (field === 'nature' && value === 'GENERATED') {
        updated.requires_template = true;
      } else if (field === 'nature') {
        updated.requires_template = false;
      }
      return updated;
    });

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const validation = DocumentTypeFormSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const pathKey = issue.path[0]?.toString() || 'form';
        fieldErrors[pathKey] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const payload = {
        code: validation.data.code.trim().toUpperCase(),
        name: validation.data.name.trim(),
        category: validation.data.category.trim(),
        nature: validation.data.nature,
        scope: validation.data.scope,
        party_role: validation.data.party_role || null,
        asset_type: validation.data.asset_type || null,
        validity_days: validation.data.validity_days || null,
        requires_template: validation.data.requires_template,
        description: validation.data.description?.trim() || null,
        is_active: true,
      };

      const { error } = await supabase.from('document_types').insert(payload);
      if (error) {
        if (error.code === '23505') {
          throw new Error(`El código "${payload.code}" ya está registrado en el catálogo.`);
        }
        throw error;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setServerError((err as Error).message || 'Error al crear el tipo de documento');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nuevo Tipo de Documento"
      description="Registra un nuevo tipo documental en el catálogo maestro para su uso en modelos y expedientes."
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-input text-foreground hover:bg-muted font-medium text-xs transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <PlusCircle className="w-3.5 h-3.5" />
            )}
            <span>Registrar Tipo</span>
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {serverError && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="doc-code" className="block font-semibold text-foreground mb-1">
              Código *
            </label>
            <input
              id="doc-code"
              type="text"
              placeholder="EJ: CERT_DOMICILIARIO"
              value={formData.code}
              onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
              className={`w-full px-3 py-2 rounded-xl border bg-surface text-foreground uppercase placeholder:normal-case ${
                errors.code ? 'border-destructive' : 'border-input'
              }`}
            />
            {errors.code && <p className="text-[11px] text-destructive mt-0.5">{errors.code}</p>}
          </div>

          <div>
            <label htmlFor="doc-name" className="block font-semibold text-foreground mb-1">
              Nombre descriptivo *
            </label>
            <input
              id="doc-name"
              type="text"
              placeholder="EJ: Certificado Domiciliario Notarial"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border bg-surface text-foreground ${
                errors.name ? 'border-destructive' : 'border-input'
              }`}
            />
            {errors.name && <p className="text-[11px] text-destructive mt-0.5">{errors.name}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="doc-category" className="block font-semibold text-foreground mb-1">
              Categoría *
            </label>
            <select
              id="doc-category"
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-input bg-surface text-foreground"
            >
              <option value="IDENTIDAD">Identidad</option>
              <option value="NOTARIAL">Notarial</option>
              <option value="REGISTRAL">Registral</option>
              <option value="PATRIMONIO">Patrimonio</option>
              <option value="PROCESAL">Procesal</option>
              <option value="LEGAL">Legal</option>
            </select>
          </div>

          <div>
            <label htmlFor="doc-nature" className="block font-semibold text-foreground mb-1">
              Naturaleza *
            </label>
            <select
              id="doc-nature"
              value={formData.nature}
              onChange={(e) =>
                handleChange('nature', e.target.value as DocumentTypeFormData['nature'])
              }
              className="w-full px-3 py-2 rounded-xl border border-input bg-surface text-foreground"
            >
              <option value="UPLOADED">Subido (Uploaded)</option>
              <option value="GENERATED">Plantilla (Generado)</option>
              <option value="EXTERNAL">Externo (Oficial)</option>
            </select>
          </div>

          <div>
            <label htmlFor="doc-scope" className="block font-semibold text-foreground mb-1">
              Ámbito de Aplicación *
            </label>
            <select
              id="doc-scope"
              value={formData.scope}
              onChange={(e) =>
                handleChange('scope', e.target.value as DocumentTypeFormData['scope'])
              }
              className="w-full px-3 py-2 rounded-xl border border-input bg-surface text-foreground"
            >
              <option value="CASO">Caso General</option>
              <option value="PERSONA">Por Persona</option>
              <option value="BIEN">Por Bien</option>
            </select>
          </div>
        </div>

        {formData.scope === 'PERSONA' && (
          <div>
            <label htmlFor="doc-party-role" className="block font-semibold text-foreground mb-1">
              Rol de Parte Aplicable *
            </label>
            <select
              id="doc-party-role"
              value={formData.party_role || ''}
              onChange={(e) => handleChange('party_role', e.target.value || null)}
              className={`w-full px-3 py-2 rounded-xl border bg-surface text-foreground ${
                errors.party_role ? 'border-destructive' : 'border-input'
              }`}
            >
              <option value="">Seleccionar rol…</option>
              <option value="CAUSANTE">Causante</option>
              <option value="HEREDERO">Heredero</option>
              <option value="CONYUGE">Cónyuge Supérstite</option>
              <option value="REPRESENTANTE">Representante Legal</option>
              <option value="ACREEDOR">Acreedor</option>
            </select>
            {errors.party_role && (
              <p className="text-[11px] text-destructive mt-0.5">{errors.party_role}</p>
            )}
          </div>
        )}

        {formData.scope === 'BIEN' && (
          <div>
            <label htmlFor="doc-asset-type" className="block font-semibold text-foreground mb-1">
              Tipo de Bien Aplicable *
            </label>
            <select
              id="doc-asset-type"
              value={formData.asset_type || ''}
              onChange={(e) => handleChange('asset_type', e.target.value || null)}
              className={`w-full px-3 py-2 rounded-xl border bg-surface text-foreground ${
                errors.asset_type ? 'border-destructive' : 'border-input'
              }`}
            >
              <option value="">Seleccionar tipo de bien…</option>
              <option value="INMUEBLE">Inmueble</option>
              <option value="VEHICULO">Vehículo</option>
              <option value="CUENTA_BANCARIA">Cuenta Bancaria</option>
              <option value="VALOR_MOBILIARIO">Valor Mobiliario</option>
              <option value="OTRO">Otro Bien</option>
            </select>
            {errors.asset_type && (
              <p className="text-[11px] text-destructive mt-0.5">{errors.asset_type}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <div>
            <label htmlFor="doc-validity" className="block font-semibold text-foreground mb-1">
              Vigencia en Días (Opcional)
            </label>
            <input
              id="doc-validity"
              type="number"
              min={1}
              placeholder="Vacío para Permanente"
              value={formData.validity_days || ''}
              onChange={(e) =>
                handleChange('validity_days', e.target.value ? Number(e.target.value) : null)
              }
              className="w-full px-3 py-2 rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground"
            />
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Ej. 30 días para copias literales o certificados.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-4">
            <input
              id="requires-template"
              type="checkbox"
              checked={formData.requires_template}
              onChange={(e) => handleChange('requires_template', e.target.checked)}
              className="w-4 h-4 rounded text-primary border-input focus:ring-primary"
            />
            <label htmlFor="requires-template" className="font-semibold text-foreground">
              Requiere plantilla DOCX asociada
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="doc-desc" className="block font-semibold text-foreground mb-1">
            Descripción / Instrucciones de Obtención
          </label>
          <textarea
            id="doc-desc"
            rows={2}
            placeholder="Instrucciones para los operadores sobre cómo obtener o validar este documento…"
            value={formData.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </form>
    </Modal>
  );
};
