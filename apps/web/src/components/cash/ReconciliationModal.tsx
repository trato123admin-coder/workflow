'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { FormField } from '../ui/FormField';
import { AlertTriangle, CheckCircle2, Scale } from 'lucide-react';
import type { CashAccountBalance, CashPeriod } from '@workflow/shared';

interface ReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: CashAccountBalance[];
  openPeriods: CashPeriod[];
  onSave: (data: {
    cash_account_id: string;
    cash_period_id?: string;
    reconciliation_date: string;
    period_start: string;
    period_end: string;
    system_balance: number;
    counted_balance: number;
    observations?: string;
  }) => Promise<void>;
}

export const ReconciliationModal: React.FC<ReconciliationModalProps> = ({
  isOpen,
  onClose,
  accounts,
  openPeriods,
  onSave,
}) => {
  const [accountId, setAccountId] = useState(accounts[0]?.cash_account_id || '');
  const [countedBalance, setCountedBalance] = useState('');
  const [observations, setObservations] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAccount = accounts.find((a) => a.cash_account_id === accountId);
  const activePeriod = openPeriods.find((p) => p.cash_account_id === accountId && p.status === 'OPEN');
  const systemBalance = selectedAccount?.current_balance ?? 0;
  const numCounted = parseFloat(countedBalance) || 0;
  const difference = Number((numCounted - systemBalance).toFixed(2));
  const hasDiscrepancy = Math.abs(difference) > 0.001;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) return setError('Seleccione una cuenta');
    if (isNaN(numCounted) || numCounted < 0) return setError('Ingrese un saldo contado válido');
    if (hasDiscrepancy && (!observations.trim() || observations.trim().length < 4)) {
      return setError('Al haber diferencia entre el sistema y el conteo físico, las observaciones son obligatorias');
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({
        cash_account_id: accountId,
        cash_period_id: activePeriod?.id,
        reconciliation_date: new Date().toISOString().split('T')[0],
        period_start: activePeriod?.period_start || new Date().toISOString().split('T')[0],
        period_end: activePeriod?.period_end || new Date().toISOString().split('T')[0],
        system_balance: systemBalance,
        counted_balance: numCounted,
        observations: observations.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar el arqueo';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Apertura de Arqueo y Conciliación"
      description="Control dual: el arqueo registrado deberá ser aprobado por otro usuario autorizado para sellar el período."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        <FormField id="reconciliation-account-select" label="Cuenta de Caja" required>
          <select
            id="reconciliation-account-select"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            required
          >
            {accounts.map((a) => (
              <option key={a.cash_account_id} value={a.cash_account_id}>
                {a.account_name} — Saldo Sistema: S/ {a.current_balance?.toFixed(2)}
              </option>
            ))}
          </select>
        </FormField>

        {activePeriod ? (
          <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-xs flex justify-between">
            <span className="text-muted-foreground">Período abierto asociado:</span>
            <span className="font-semibold text-foreground">
              {activePeriod.period_start} al {activePeriod.period_end}
            </span>
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
            No se detectó un período con estado OPEN para esta cuenta.
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-1">
          <div className="p-3 rounded-xl bg-card border border-border space-y-1">
            <span className="text-[11px] text-muted-foreground">Saldo según Sistema</span>
            <div className="text-lg font-bold text-foreground">
              S/ {systemBalance.toFixed(2)}
            </div>
          </div>

          <FormField id="counted-balance-input" label="Saldo Contado Físico" required>
            <input
              id="counted-balance-input"
              type="number"
              step="0.01"
              min="0"
              value={countedBalance}
              onChange={(e) => setCountedBalance(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-bold"
              required
            />
          </FormField>
        </div>

        {/* Indicador de Diferencia */}
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            hasDiscrepancy
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {hasDiscrepancy ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span className="font-semibold">
              {hasDiscrepancy ? 'Diferencia en Caja:' : 'Arqueo Cuadrado Conforme'}
            </span>
          </div>
          <span className="text-sm font-bold font-mono">
            {difference > 0 ? `+ S/ ${difference.toFixed(2)} (Sobrante)` : difference < 0 ? `- S/ ${Math.abs(difference).toFixed(2)} (Faltante)` : 'S/ 0.00'}
          </span>
        </div>

        <FormField
          id="reconciliation-observations"
          label="Observaciones y Justificación de Diferencia"
          required={hasDiscrepancy}
        >
          <textarea
            id="reconciliation-observations"
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={3}
            placeholder={
              hasDiscrepancy
                ? 'Explique la causa del faltante o sobrante...'
                : 'Observaciones del arqueo físico...'
            }
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            required={hasDiscrepancy}
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
            <Scale className="w-3.5 h-3.5" />
            {isSubmitting ? 'Registrando...' : 'Presentar Arqueo'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
