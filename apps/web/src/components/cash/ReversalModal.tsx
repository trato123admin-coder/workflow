'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { FormField } from '../ui/FormField';
import { AlertCircle, RotateCcw } from 'lucide-react';
import type { CashMovement } from '@workflow/shared';

interface ReversalModalProps {
  isOpen: boolean;
  onClose: () => void;
  movement: CashMovement | null;
  onConfirm: (movementId: string, reason: string) => Promise<void>;
}

export const ReversalModal: React.FC<ReversalModalProps> = ({
  isOpen,
  onClose,
  movement,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!movement) return null;

  const reverseDir = movement.direction === 'OUT' ? 'Ingreso (IN)' : 'Egreso (OUT)';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      return setError('Debe ingresar un motivo detallado del reverso (mínimo 5 caracteres)');
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(movement.id!, reason.trim());
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar el reverso';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reversar Movimiento Contable"
      description="Libro inmutable: los errores se corrigen con un contra-asiento de reverso."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Movimiento original:</span>
            <span className="font-mono font-bold text-foreground">
              {movement.movement_number || movement.id}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Descripción:</span>
            <span className="font-semibold text-foreground truncate max-w-[220px]">
              {movement.description}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Monto original:</span>
            <span className="font-bold text-foreground">
              {movement.direction === 'OUT' ? '-' : '+'} S/ {movement.amount.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between pt-1 border-t border-border/60">
            <span className="text-muted-foreground">Efecto del reverso:</span>
            <span className="font-bold text-primary flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5" /> Generará {reverseDir} por S/{' '}
              {movement.amount.toFixed(2)}
            </span>
          </div>
        </div>

        <FormField id="reversal-reason" label="Motivo de la Corrección o Anulación" required>
          <textarea
            id="reversal-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Explique el error en el registro o comprobante que motiva este reverso..."
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            required
          />
        </FormField>

        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Esta acción es irreversible y quedará registrada en el libro con fecha de hoy y su
            usuario en auditoría.
          </span>
        </div>

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
            className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold shadow hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {isSubmitting ? 'Registrando...' : 'Confirmar Reverso'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
