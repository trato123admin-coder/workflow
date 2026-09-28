'use client';

import React, { useState } from 'react';
import { StatusBadge } from '../ui/StatusBadge';
import { Check, X, HandCoins, Plus, Clock } from 'lucide-react';
import type { CashRequest, CashAccountBalance } from '@workflow/shared';

interface CashRequestsTableProps {
  requests: CashRequest[];
  accounts: CashAccountBalance[];
  canApprove?: boolean;
  canDisburse?: boolean;
  onOpenCreate: () => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  onDisburse: (requestId: string, accountId: string) => Promise<void>;
}

export const CashRequestsTable: React.FC<CashRequestsTableProps> = ({
  requests,
  accounts,
  canApprove = false,
  canDisburse = false,
  onOpenCreate,
  onApprove,
  onReject,
  onDisburse,
}) => {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [disbursingId, setDisbursingId] = useState<string | null>(null);
  const [disburseAccountId, setDisburseAccountId] = useState(accounts[0]?.cash_account_id || '');
  const [isProcessing, setIsProcessing] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <StatusBadge category="waiting" label="Pendiente" />;
      case 'APPROVED':
        return <StatusBadge category="info" label="Aprobada" />;
      case 'DISBURSED':
        return <StatusBadge category="success" label="Desembolsada" />;
      case 'REJECTED':
        return <StatusBadge category="danger" label="Rechazada" />;
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

  const handleConfirmDisburse = async () => {
    if (!disbursingId || !disburseAccountId) return;
    try {
      setIsProcessing(true);
      await onDisburse(disbursingId, disburseAccountId);
      setDisbursingId(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Solicitudes de Fondos</h3>
          <p className="text-xs text-muted-foreground">Flujo: Gestor solicita → Administrador aprueba → Caja desembolsa</p>
        </div>
        <button
          type="button"
          onClick={onOpenCreate}
          className="px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold shadow hover:bg-primary/90 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Nueva Solicitud
        </button>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
              <tr>
                <th className="py-3 px-4">N.º Solicitud</th>
                <th className="py-3 px-4">Rubro</th>
                <th className="py-3 px-4">Motivo</th>
                <th className="py-3 px-4">Monto</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No hay solicitudes de fondos registradas
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      {r.request_number || 'SOL-PND'}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {r.category_code?.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-muted-foreground" title={r.reason}>
                      {r.reason}
                    </td>
                    <td className="py-3 px-4 font-bold text-foreground">
                      {r.currency} {r.amount?.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(r.status)}</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString('es-PE') : '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {r.status === 'PENDING' && canApprove && (
                          <>
                            <button
                              type="button"
                              onClick={() => onApprove(r.id!)}
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                              title="Aprobar Solicitud"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectingId(r.id!)}
                              className="p-1.5 rounded-lg bg-rose-500/10 text-rose-700 hover:bg-rose-500/20"
                              title="Rechazar Solicitud"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {r.status === 'APPROVED' && canDisburse && (
                          <button
                            type="button"
                            onClick={() => setDisbursingId(r.id!)}
                            className="px-2.5 py-1 rounded-lg bg-primary text-white font-semibold text-[11px] shadow hover:bg-primary/90 flex items-center gap-1"
                          >
                            <HandCoins className="w-3 h-3" /> Desembolsar
                          </button>
                        )}

                        {r.status === 'DISBURSED' && (
                          <span className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Liquidada
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diálogo de Rechazo con motivo */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-card p-5 rounded-xl border border-border shadow-xl max-w-sm w-full space-y-4">
            <h4 className="text-sm font-bold text-foreground">Rechazar Solicitud de Fondos</h4>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Indique el motivo del rechazo..."
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

      {/* Diálogo de Desembolso */}
      {disbursingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-card p-5 rounded-xl border border-border shadow-xl max-w-sm w-full space-y-4">
            <h4 className="text-sm font-bold text-foreground">Desembolsar Fondos</h4>
            <p className="text-xs text-muted-foreground">
              Seleccione la cuenta desde la cual se emitirá el egreso correspondiente.
            </p>
            <select
              value={disburseAccountId}
              onChange={(e) => setDisburseAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs"
            >
              {accounts.map((a) => (
                <option key={a.cash_account_id} value={a.cash_account_id}>
                  {a.account_name} — Saldo: S/ {a.current_balance?.toFixed(2)}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDisbursingId(null)}
                className="px-3 py-1.5 text-xs rounded-lg border border-border"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDisburse}
                disabled={isProcessing}
                className="px-3 py-1.5 text-xs rounded-lg bg-primary text-white font-semibold"
              >
                Confirmar Desembolso
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
