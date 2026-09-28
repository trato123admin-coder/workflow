'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { FormField } from '../ui/FormField';
import { AlertTriangle, UploadCloud, FileCheck } from 'lucide-react';
import { isSupportRequired, isApprovalRequired } from '@workflow/shared';
import type { CashAccountBalance } from '@workflow/shared';

export interface MovementFormData {
  cash_account_id: string;
  movement_type: 'INCOME' | 'EXPENSE' | 'ADJUSTMENT';
  direction: 'IN' | 'OUT';
  amount: number;
  category_code: string;
  description: string;
  reference?: string;
  movement_date: string;
  case_id?: string;
  file?: File;
}

interface MovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: CashAccountBalance[];
  categories: Array<{ code: string; label: string; type?: string }>;
  cases?: Array<{ id: string; case_number: string; title?: string }>;
  onSave: (data: MovementFormData) => Promise<void>;
}

export const MovementModal: React.FC<MovementModalProps> = ({
  isOpen, onClose, accounts, categories, cases = [], onSave,
}) => {
  const [accountId, setAccountId] = useState(accounts[0]?.cash_account_id || '');
  const [movementType, setMovementType] = useState<'INCOME' | 'EXPENSE' | 'ADJUSTMENT'>('EXPENSE');
  const [direction, setDirection] = useState<'IN' | 'OUT'>('OUT');
  const [amount, setAmount] = useState<string>('');
  const [categoryCode, setCategoryCode] = useState(categories[0]?.code || 'GASTOS_NOTARIALES');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [movementDate, setMovementDate] = useState(new Date().toISOString().split('T')[0]);
  const [caseId, setCaseId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numAmount = parseFloat(amount) || 0;
  const requiresSupport = movementType === 'EXPENSE' && isSupportRequired(numAmount);
  const requiresApproval = movementType === 'EXPENSE' && isApprovalRequired(numAmount);

  const handleTypeChange = (type: 'INCOME' | 'EXPENSE' | 'ADJUSTMENT') => {
    setMovementType(type);
    if (type === 'INCOME') setDirection('IN');
    else if (type === 'EXPENSE') setDirection('OUT');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) return setError('Seleccione una cuenta de caja');
    if (numAmount <= 0) return setError('El monto debe ser mayor a 0');
    if (!description.trim()) return setError('La descripción es requerida');

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({
        cash_account_id: accountId,
        movement_type: movementType,
        direction,
        amount: numAmount,
        category_code: categoryCode,
        description: description.trim(),
        reference: reference.trim() || undefined,
        movement_date: movementDate,
        case_id: caseId || undefined,
        file: selectedFile || undefined,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el movimiento';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Movimiento en Caja"
      description="Libro diario inmutable: un movimiento registrado solo podrá corregirse mediante reverso."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField id="cash-account-select" label="Cuenta de Fondos" required>
            <select
              id="cash-account-select"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              required
            >
              {accounts.map((a) => (
                <option key={a.cash_account_id} value={a.cash_account_id}>
                  {a.account_name} ({a.currency}) — Saldo: S/ {a.current_balance?.toFixed(2)}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="movement-type-select" label="Tipo de Operación" required>
            <div className="flex gap-2">
              {[
                { t: 'EXPENSE' as const, l: 'Egreso (Gasto)', a: 'bg-rose-500 text-white border-rose-600' },
                { t: 'INCOME' as const, l: 'Ingreso', a: 'bg-emerald-500 text-white border-emerald-600' },
                { t: 'ADJUSTMENT' as const, l: 'Ajuste', a: 'bg-primary text-white border-primary' },
              ].map(({ t, l, a }) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border ${
                    movementType === t ? a : 'bg-muted/50 border-border text-muted-foreground'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField id="amount-input" label="Monto" required>
            <input
              id="amount-input"
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

          <FormField id="category-select" label="Categoría Contable" required>
            <select
              id="category-select"
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

          <FormField id="movement-date-input" label="Fecha Operativa" required>
            <input
              id="movement-date-input"
              type="date"
              value={movementDate}
              onChange={(e) => setMovementDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              required
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField id="reference-input" label="N.º Comprobante / Boleta / Referencia">
            <input
              id="reference-input"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej. B001-002341 o OP-94812"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </FormField>

          <FormField id="case-select" label="Vincular a Expediente (Opcional - M9)">
            <select
              id="case-select"
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="">-- Sin vincular a caso --</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_number} {c.title ? `- ${c.title}` : ''}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField id="description-input" label="Descripción del Gasto / Concepto" required>
          <input
            id="description-input"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalle claro del motivo del desembolso o ingreso"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            required
          />
        </FormField>

        {/* Carga de Comprobante / Soporte */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <UploadCloud className="w-4 h-4 text-primary" />
            Comprobante de Sustento (PDF, JPG, PNG)
          </label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
          />
          {selectedFile && (
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <FileCheck className="w-3.5 h-3.5" /> Archivo listo: {selectedFile.name} (
              {(selectedFile.size / 1024).toFixed(1)} KB)
            </div>
          )}
        </div>

        {/* Advertencias de Reglas de Negocio */}
        {requiresSupport && !selectedFile && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Comprobante obligatorio por umbral:</span> Gastos superiores a S/ 50.00 deben adjuntar comprobante para arqueo conforme.
            </div>
          </div>
        )}

        {requiresApproval && (
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Aviso de umbral mayor:</span> Desembolsos mayores a S/ 300.00 requieren autorización administrativa previa.
            </div>
          </div>
        )}

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
            className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold shadow hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Guardando...' : 'Asentar en Libro'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
