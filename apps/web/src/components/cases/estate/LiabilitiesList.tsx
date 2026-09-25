'use client';

import React from 'react';
import { CreditCard, Plus, Edit2, Trash2 } from 'lucide-react';
import type { CaseLiabilityItem } from '@workflow/shared';

interface LiabilitiesListProps {
  liabilities: CaseLiabilityItem[];
  onOpenCreate: () => void;
  onOpenEdit: (liab: CaseLiabilityItem) => void;
  onDeactivate: (id: string) => void;
}

export const LiabilitiesList: React.FC<LiabilitiesListProps> = ({
  liabilities,
  onOpenCreate,
  onOpenEdit,
  onDeactivate,
}) => {
  return (
    <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-destructive" />
          Deudas y Pasivos ({liabilities.length})
        </h3>
        <button
          type="button"
          onClick={onOpenCreate}
          className="px-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Agregar Deuda</span>
        </button>
      </div>

      {liabilities.length === 0 ? (
        <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
          No se han registrado deudas para este expediente.
        </div>
      ) : (
        <div className="space-y-2">
          {liabilities.map((l) => (
            <div
              key={l.id}
              className="p-3.5 rounded-xl border border-border bg-card flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-xs text-foreground">{l.creditor_name}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {l.liability_type}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                    {l.status}
                  </span>
                  {l.due_date && (
                    <span className="text-[11px] text-muted-foreground">Vence: {l.due_date}</span>
                  )}
                </div>
                {l.notes && <p className="text-xs text-muted-foreground">{l.notes}</p>}
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">Monto Adeudado</span>
                  <span className="font-mono font-bold text-sm text-destructive">
                    {l.currency === 'USD' ? '$' : 'S/'}{' '}
                    {Number(l.amount || 0).toLocaleString('es-PE', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onOpenEdit(l)}
                    className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground"
                    title="Editar deuda"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeactivate(l.id)}
                    className="p-1.5 rounded-lg border border-border hover:bg-destructive/10 text-destructive"
                    title="Desactivar deuda"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
