'use client';

import React from 'react';
import { StatusBadge } from '../ui/StatusBadge';
import { Check, X, Plus, AlertCircle, Lock } from 'lucide-react';
import type { CashReconciliation } from '@workflow/shared';

interface CashReconciliationsTableProps {
  reconciliations: CashReconciliation[];
  currentUserId?: string;
  canApprove?: boolean;
  onOpenCreate: () => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
}

export const CashReconciliationsTable: React.FC<CashReconciliationsTableProps> = ({
  reconciliations,
  currentUserId,
  canApprove = false,
  onOpenCreate,
  onApprove,
  onReject,
}) => {
  const [rejectingId, setRejectingId] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <StatusBadge category="neutral" label="Borrador" />;
      case 'SUBMITTED':
        return <StatusBadge category="waiting" label="Por Aprobar" />;
      case 'APPROVED':
        return <StatusBadge category="success" label="Cerrado / Aprobado" />;
      case 'REJECTED':
        return <StatusBadge category="danger" label="Rechazado" />;
      default:
        return <StatusBadge category="neutral" label={status} />;
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingId || !rejectReason.trim()) return;
    try {
      setIsProcessing(true);
      await onReject(rejectingId, rejectReason.trim());
      setRejectingId(null);
      setRejectReason('');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Arqueos y Cierre de Período</h3>
          <p className="text-xs text-muted-foreground">
            Control dual: la aprobación de un arqueo sella el período contable e impide movimientos
            retroactivos.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenCreate}
          className="px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold shadow hover:bg-primary/90 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Nuevo Arqueo
        </button>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
              <tr>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Período Auditado</th>
                <th className="py-3 px-4 text-right">Saldo Sistema</th>
                <th className="py-3 px-4 text-right">Conteo Físico</th>
                <th className="py-3 px-4 text-right">Diferencia</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reconciliations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No se registran arqueos en el sistema
                  </td>
                </tr>
              ) : (
                reconciliations.map((r) => {
                  const diff = Number(
                    (r.difference ?? r.counted_balance - r.system_balance).toFixed(2),
                  );
                  const isOpenedByMe = Boolean(currentUserId && r.opened_by === currentUserId);

                  return (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-foreground">
                        {r.reconciliation_date}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {r.period_start} al {r.period_end}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">
                        S/ {r.system_balance?.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                        S/ {r.counted_balance?.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] ${
                            Math.abs(diff) < 0.001
                              ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40'
                              : 'text-rose-700 bg-rose-50 dark:bg-rose-950/40'
                          }`}
                        >
                          {diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(r.status)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === 'SUBMITTED' && canApprove && (
                            <>
                              {isOpenedByMe ? (
                                <span
                                  className="text-[11px] text-amber-600 flex items-center gap-1 italic"
                                  title="Control dual: no puede auto-aprobarse un arqueo propio"
                                >
                                  <AlertCircle className="w-3.5 h-3.5" /> Requiere otro revisor
                                </span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => onApprove(r.id!)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold text-[11px] shadow hover:bg-emerald-700 flex items-center gap-1"
                                    title="Aprobar Arqueo y Cerrar Período"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Aprobar y Cerrar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRejectingId(r.id!)}
                                    className="p-1 rounded-lg bg-rose-500/10 text-rose-700 hover:bg-rose-500/20"
                                    title="Rechazar Arqueo"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </>
                          )}

                          {r.status === 'APPROVED' && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Lock className="w-3 h-3 text-emerald-600" /> Período Sellado
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diálogo de Rechazo de Arqueo */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-card p-5 rounded-xl border border-border shadow-xl max-w-sm w-full space-y-4">
            <h4 className="text-sm font-bold text-foreground">Rechazar Arqueo de Caja</h4>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Indique las observaciones para rehacer el conteo..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs"
              required
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingId(null)}
                className="px-3 py-1.5 text-xs rounded-lg border border-border"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isProcessing || !rejectReason.trim()}
                className="px-3 py-1.5 text-xs rounded-lg bg-rose-600 text-white font-semibold"
              >
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
