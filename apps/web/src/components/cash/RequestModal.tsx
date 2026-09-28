'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { FormField } from '../ui/FormField';
import { Send } from 'lucide-react';

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Array<{ code: string; label: string }>;
  cases?: Array<{ id: string; case_number: string; title?: string }>;
  initialCaseId?: string;
  onSave: (data: {
    amount: number;
    currency: string;
    category_code: string;
    reason: string;
    case_id?: string;
  }) => Promise<void>;
}

export const RequestModal: React.FC<RequestModalProps> = ({
  isOpen,
  onClose,
  categories,
  cases = [],
  initialCaseId,
  onSave,
}) => {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('PEN');
  const [categoryCode, setCategoryCode] = useState(categories[0]?.code || 'GASTOS_NOTARIALES');
  const [reason, setReason] = useState('');
  const [caseId, setCaseId] = useState(initialCaseId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return setError('Ingrese un monto mayor a 0');
    if (!reason.trim()) return setError('El motivo es obligatorio');

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({
        amount: numAmount,
        currency,
        category_code: categoryCode,
        reason: reason.trim(),
        case_id: caseId || undefined,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al enviar la solicitud';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Solicitar Fondos de Caja Chica"
      description="El administrador evaluará la solicitud antes de que caja pueda proceder al desembolso."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField id="request-amount" label="Monto Requerido" required>
            <input
              id="request-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-semibold"
              required
            />
          </FormField>

          <FormField id="request-currency" label="Moneda" required>
            <select
              id="request-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="PEN">Soles (PEN)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField id="request-category" label="Rubro / Categoría" required>
            <select
              id="request-category"
              value={categoryCode}
              onChange={(e) => setCategoryCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              required
            >
              {categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="request-case" label="Expediente Asociado (M9)">
            <select
              id="request-case"
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="">-- Sin expediente --</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_number} {c.title ? `- ${c.title}` : ''}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField id="request-reason" label="Motivo y Detalle del Gasto" required>
          <textarea
            id="request-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Indique trámite, notaría u oficina registral donde se aplicarán los fondos..."
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            required
          />
        </FormField>

        <div className="flex justify-end gap-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold shadow hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
