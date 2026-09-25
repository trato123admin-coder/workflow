'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '../../../lib/supabase/client';
import {
  type CaseLiabilityItem,
  type LiabilityType,
  type EstateCurrency,
  type LiabilityStatus,
  CreateCaseLiabilitySchema,
  LIABILITY_TYPES,
  LIABILITY_STATUSES,
  ESTATE_CURRENCIES,
} from '@workflow/shared';
import { Modal } from '../../ui/Modal';
import { FormField } from '../../ui/FormField';

interface LiabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  editingLiab: CaseLiabilityItem | null;
  onSaved: () => Promise<void>;
}

export const LiabilityModal: React.FC<LiabilityModalProps> = ({
  isOpen,
  onClose,
  caseId,
  editingLiab,
  onSaved,
}) => {
  const [liabType, setLiabType] = useState<LiabilityType>('TRIBUTARIA');
  const [creditorName, setCreditorName] = useState('');
  const [liabAmount, setLiabAmount] = useState('');
  const [liabCurrency, setLiabCurrency] = useState<EstateCurrency>('PEN');
  const [liabStatus, setLiabStatus] = useState<LiabilityStatus>('IDENTIFICADA');
  const [dueDate, setDueDate] = useState('');
  const [liabNotes, setLiabNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingLiab) {
      setLiabType(editingLiab.liability_type);
      setCreditorName(editingLiab.creditor_name);
      setLiabAmount(editingLiab.amount !== null ? String(editingLiab.amount) : '');
      setLiabCurrency(editingLiab.currency);
      setLiabStatus(editingLiab.status);
      setDueDate(editingLiab.due_date || '');
      setLiabNotes(editingLiab.notes || '');
    } else {
      setLiabType('TRIBUTARIA');
      setCreditorName('');
      setLiabAmount('');
      setLiabCurrency('PEN');
      setLiabStatus('IDENTIFICADA');
      setDueDate('');
      setLiabNotes('');
    }
    setFormError(null);
  }, [editingLiab, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      case_id: caseId,
      liability_type: liabType,
      creditor_name: creditorName.trim(),
      amount: liabAmount ? Number(liabAmount) : null,
      currency: liabCurrency,
      status: liabStatus,
      due_date: dueDate || null,
      notes: liabNotes.trim() || null,
    };

    const parsed = CreateCaseLiabilitySchema.safeParse(payload);
    if (!parsed.success) {
      setFormError(parsed.error.errors[0]?.message || 'Datos de pasivo inválidos');
      setIsSubmitting(false);
      return;
    }

    try {
      const supabase = createClient();
      if (editingLiab) {
        const { error } = await supabase.from('case_liabilities').update(payload).eq('id', editingLiab.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('case_liabilities').insert(payload);
        if (error) throw error;
      }
      onClose();
      await onSaved();
    } catch (err: unknown) {
      setFormError((err as Error).message || 'Error al guardar deuda');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingLiab ? 'Editar Deuda' : 'Registrar Deuda / Obligación'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="f-liab-type" label="Tipo de Deuda" required>
            <select
              id="f-liab-type"
              value={liabType}
              onChange={(e) => setLiabType(e.target.value as LiabilityType)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
            >
              {LIABILITY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </FormField>

          <FormField id="f-liab-status" label="Estado">
            <select
              id="f-liab-status"
              value={liabStatus}
              onChange={(e) => setLiabStatus(e.target.value as LiabilityStatus)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
            >
              {LIABILITY_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField id="f-creditor" label="Nombre del Acreedor / Entidad" required>
          <input
            id="f-creditor"
            type="text"
            placeholder="Ej. SUNAT o Banco de Crédito"
            value={creditorName}
            onChange={(e) => setCreditorName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField id="f-liab-amount" label="Monto">
            <input
              id="f-liab-amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={liabAmount}
              onChange={(e) => setLiabAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-mono"
            />
          </FormField>

          <FormField id="f-liab-curr" label="Moneda">
            <select
              id="f-liab-curr"
              value={liabCurrency}
              onChange={(e) => setLiabCurrency(e.target.value as EstateCurrency)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
            >
              {ESTATE_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </FormField>

          <FormField id="f-due-date" label="Fecha Vencimiento">
            <input
              id="f-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
            />
          </FormField>
        </div>

        <FormField id="f-liab-notes" label="Notas adicionales">
          <textarea
            id="f-liab-notes"
            rows={2}
            placeholder="Detalles sobre verificación o cuotas..."
            value={liabNotes}
            onChange={(e) => setLiabNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-muted-foreground"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
