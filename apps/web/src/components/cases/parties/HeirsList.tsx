'use client';

import React from 'react';
import { Users, Plus, Edit2, Trash2, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { CasePartyItem } from '@workflow/shared';
import { isMinor, calculateAge } from '@workflow/shared';

interface HeirsListProps {
  heirs: CasePartyItem[];
  totalConfirmedShare: number;
  onOpenCreate: () => void;
  onOpenEdit: (heir: CasePartyItem) => void;
  onDeactivate: (id: string) => void;
}

export const HeirsList: React.FC<HeirsListProps> = ({
  heirs,
  totalConfirmedShare,
  onOpenCreate,
  onOpenEdit,
  onDeactivate,
}) => {
  return (
    <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Herederos Declarados ({heirs.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            Cuotas confirmadas acumuladas:{' '}
            <strong className={totalConfirmedShare === 100 ? 'text-emerald-600' : 'text-amber-600'}>
              {totalConfirmedShare.toFixed(2)}% de 100.00%
            </strong>
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenCreate}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 flex items-center gap-1 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Agregar Heredero</span>
        </button>
      </div>

      {/* Barra de distribución de cuotas */}
      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            totalConfirmedShare === 100 ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
          style={{ width: `${Math.min(100, totalConfirmedShare)}%` }}
        />
      </div>

      {heirs.length === 0 ? (
        <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
          No hay herederos registrados en este expediente.
        </div>
      ) : (
        <div className="space-y-2">
          {heirs.map((h) => {
            const minor = isMinor(h.person?.birth_date);
            const age = h.person?.birth_date ? calculateAge(h.person.birth_date) : null;
            return (
              <div
                key={h.id}
                className="p-3.5 rounded-xl border border-border bg-card flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-xs text-foreground">
                      {h.person?.first_name} {h.person?.last_name}{' '}
                      {h.person?.second_last_name || ''}
                    </span>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {h.person?.identity_document_type}: {h.person?.identity_document_number}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {h.relationship_to_deceased || 'Parentesco s/d'}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                      {h.heir_status}
                    </span>
                    {minor && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        Menor ({age} años)
                      </span>
                    )}
                  </div>
                  {minor && (
                    <div className="text-xs pt-0.5">
                      {h.represented_by && h.representative ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Representado por:{' '}
                          <strong>
                            {h.representative.first_name} {h.representative.last_name}
                          </strong>
                        </span>
                      ) : (
                        <span className="text-destructive font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Sin representante legal asignado
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">Cuota Hereditaria</span>
                    <span className="font-mono font-bold text-sm text-foreground">
                      {h.share_percent !== null ? `${Number(h.share_percent).toFixed(2)}%` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenEdit(h)}
                      className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground"
                      title="Editar heredero"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeactivate(h.id)}
                      className="p-1.5 rounded-lg border border-border hover:bg-destructive/10 text-destructive"
                      title="Retirar heredero"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
