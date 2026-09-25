'use client';

import React from 'react';
import { User, Plus, Edit2, AlertTriangle } from 'lucide-react';
import type { CasePartyItem } from '@workflow/shared';

interface CausanteCardProps {
  causante?: CasePartyItem;
  onOpenCreate: () => void;
  onOpenEdit: (causante: CasePartyItem) => void;
}

export const CausanteCard: React.FC<CausanteCardProps> = ({
  causante,
  onOpenCreate,
  onOpenEdit,
}) => {
  return (
    <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          Causante del Proceso Sucesorio
        </h3>
        {!causante && (
          <button
            type="button"
            onClick={onOpenCreate}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Causante</span>
          </button>
        )}
      </div>

      {causante ? (
        <div className="flex items-start justify-between p-3.5 rounded-xl border border-border bg-muted/20">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">
                {causante.person?.first_name} {causante.person?.last_name}{' '}
                {causante.person?.second_last_name || ''}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                {causante.person?.identity_document_type}:{' '}
                {causante.person?.identity_document_number}
              </span>
            </div>
            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-4 pt-1">
              <span>
                Fecha defunción:{' '}
                {causante.person?.death_date ? (
                  <strong className="text-foreground">{causante.person.death_date}</strong>
                ) : (
                  <span className="text-amber-600 font-semibold flex items-center gap-1 inline-flex">
                    <AlertTriangle className="w-3 h-3" /> No registrada
                  </span>
                )}
              </span>
              {causante.person?.birth_date && <span>Nacimiento: {causante.person.birth_date}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenEdit(causante)}
              className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground"
              title="Editar Causante"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
          No se ha asignado causante para este caso. La sucesión requiere un causante activo.
        </div>
      )}
    </div>
  );
};
