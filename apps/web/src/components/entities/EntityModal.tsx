'use client';

import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { Modal } from '../ui/Modal';
import { FormField } from '../ui/FormField';
import { createClient } from '../../lib/supabase/client';
import { Loader2, Plus, Trash2, AlertCircle } from 'lucide-react';
import type { ExternalEntity, ExternalEntityContact } from '@workflow/shared';

export const EntityFormSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(150),
  entity_type: z.string().min(1, 'Seleccione un tipo de entidad'),
  tax_id: z.string().max(20).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email('Email no válido').optional().nullable().or(z.literal('')),
  contacts: z.array(
    z.object({
      name: z.string().min(1, 'El nombre del contacto es requerido'),
      role: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      email: z.string().email('Email no válido').optional().nullable().or(z.literal('')),
    }),
  ),
  is_active: z.boolean(),
});

export type EntityFormData = z.infer<typeof EntityFormSchema>;

interface EntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entity?: ExternalEntity | null;
  entityTypes: Array<{ code: string; label: string }>;
}

export const EntityModal: React.FC<EntityModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  entity,
  entityTypes,
}) => {
  const [formData, setFormData] = useState<EntityFormData>({
    name: '',
    entity_type: entityTypes[0]?.code || '',
    tax_id: '',
    address: '',
    city: 'Lima',
    phone: '',
    email: '',
    contacts: [],
    is_active: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (entity) {
      setFormData({
        name: entity.name,
        entity_type: entity.entity_type,
        tax_id: entity.tax_id || '',
        address: entity.address || '',
        city: entity.city || 'Lima',
        phone: entity.phone || '',
        email: entity.email || '',
        contacts: Array.isArray(entity.contacts) ? entity.contacts : [],
        is_active: entity.is_active,
      });
    } else {
      setFormData({
        name: '',
        entity_type: entityTypes[0]?.code || '',
        tax_id: '',
        address: '',
        city: 'Lima',
        phone: '',
        email: '',
        contacts: [],
        is_active: true,
      });
    }
    setErrors({});
    setServerError(null);
  }, [entity, entityTypes, isOpen]);

  const addContact = () => {
    setFormData((prev) => ({
      ...prev,
      contacts: [...prev.contacts, { name: '', role: '', phone: '', email: '' }],
    }));
  };

  const removeContact = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== index),
    }));
  };

  const updateContact = (index: number, field: keyof ExternalEntityContact, value: string) => {
    setFormData((prev) => {
      const next = [...prev.contacts];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, contacts: next };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    const parseResult = EntityFormSchema.safeParse(formData);
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
        name: formData.name.trim(),
        entity_type: formData.entity_type,
        tax_id: formData.tax_id?.trim() || null,
        address: formData.address?.trim() || null,
        city: formData.city?.trim() || null,
        phone: formData.phone?.trim() || null,
        email: formData.email?.trim() || null,
        contacts: formData.contacts.filter((c) => c.name.trim().length > 0),
        is_active: formData.is_active,
      };

      if (entity?.id) {
        const { error } = await supabase
          .from('external_entities')
          .update(payload)
          .eq('id', entity.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('external_entities').insert([payload]);
        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setServerError((err as Error).message || 'Error al guardar entidad externa');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={entity ? 'Editar Entidad Externa' : 'Nueva Entidad Externa'}
      description="Directorio de notarías, registros públicos, estudios jurídicos y bancos."
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
          <FormField id="entity_type" label="Tipo de Entidad" required error={errors.entity_type}>
            <select
              id="entity_type"
              value={formData.entity_type}
              onChange={(e) => setFormData({ ...formData, entity_type: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
            >
              {entityTypes.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="name" label="Nombre / Razón Social" required error={errors.name}>
            <input
              id="name"
              type="text"
              placeholder="Ej. Notaría Gómez De La Torre"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField id="tax_id" label="N.º RUC / Documento" error={errors.tax_id}>
            <input
              id="tax_id"
              type="text"
              placeholder="Ej. 20100123456"
              value={formData.tax_id || ''}
              onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
            />
          </FormField>

          <FormField id="city" label="Ciudad" error={errors.city}>
            <input
              id="city"
              type="text"
              placeholder="Ej. Lima"
              value={formData.city || ''}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
            />
          </FormField>

          <FormField id="address" label="Dirección" error={errors.address}>
            <input
              id="address"
              type="text"
              placeholder="Ej. Av. Larco 123, Miraflores"
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
            />
          </FormField>
        </div>

        {/* Contactos dinámicos */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="text-xs font-bold text-foreground">Contactos Directos</h4>
              <p className="text-[11px] text-muted-foreground">
                Gestores, secretarios notariales o asesores de la entidad
              </p>
            </div>
            <button
              type="button"
              onClick={addContact}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir contacto</span>
            </button>
          </div>

          {formData.contacts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2 text-center border border-dashed border-border rounded-lg">
              Sin contactos registrados. Presione &quot;Añadir contacto&quot; para registrar uno.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {formData.contacts.map((contact, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg border border-border"
                >
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={contact.name}
                    onChange={(e) => updateContact(idx, 'name', e.target.value)}
                    className="flex-1 px-2 py-1 text-xs rounded border border-input bg-background text-foreground"
                  />
                  <input
                    type="text"
                    placeholder="Cargo / Rol"
                    value={contact.role || ''}
                    onChange={(e) => updateContact(idx, 'role', e.target.value)}
                    className="w-28 px-2 py-1 text-xs rounded border border-input bg-background text-foreground"
                  />
                  <input
                    type="text"
                    placeholder="Teléfono"
                    value={contact.phone || ''}
                    onChange={(e) => updateContact(idx, 'phone', e.target.value)}
                    className="w-28 px-2 py-1 text-xs rounded border border-input bg-background text-foreground"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={contact.email || ''}
                    onChange={(e) => updateContact(idx, 'email', e.target.value)}
                    className="w-36 px-2 py-1 text-xs rounded border border-input bg-background text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => removeContact(idx)}
                    className="p-1 text-muted-foreground hover:text-destructive rounded"
                    title="Eliminar contacto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Toggle Activo */}
        <div className="flex items-center gap-2 pt-2">
          <input
            id="is_active"
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
          />
          <label htmlFor="is_active" className="text-xs font-medium text-foreground cursor-pointer">
            Entidad operativa y activa para asignación de trámites
          </label>
        </div>

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
            <span>{entity ? 'Guardar Cambios' : 'Crear Entidad'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
