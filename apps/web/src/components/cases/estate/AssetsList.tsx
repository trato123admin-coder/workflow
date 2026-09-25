'use client';

import React from 'react';
import { Building, Plus, Edit2, Trash2 } from 'lucide-react';
import type { CaseAssetItem } from '@workflow/shared';

interface AssetsListProps {
  assets: CaseAssetItem[];
  onOpenCreate: () => void;
  onOpenEdit: (asset: CaseAssetItem) => void;
  onDeactivate: (id: string) => void;
}

export const AssetsList: React.FC<AssetsListProps> = ({
  assets,
  onOpenCreate,
  onOpenEdit,
  onDeactivate,
}) => {
  return (
    <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Building className="w-4 h-4 text-primary" />
          Bienes y Activos ({assets.length})
        </h3>
        <button
          type="button"
          onClick={onOpenCreate}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Agregar Bien</span>
        </button>
      </div>

      {assets.length === 0 ? (
        <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
          No se han inventariado bienes en este expediente.
        </div>
      ) : (
        <div className="space-y-2">
          {assets.map((a) => (
            <div
              key={a.id}
              className="p-3.5 rounded-xl border border-border bg-card flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-xs text-foreground">{a.description}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                    {a.asset_type}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {a.status}
                  </span>
                  {a.ownership_percent < 100 && (
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-foreground">
                      {a.ownership_percent}% propiedad
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-3 pt-0.5">
                  {a.registry_office && <span>Sede: {a.registry_office}</span>}
                  {a.registry_ref && (
                    <span>
                      {a.asset_type === 'CUENTA_BANCARIA' ? 'Últimos 4 dígitos: ' : 'Ref: '}
                      <strong className="font-mono text-foreground">{a.registry_ref}</strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">Valor Estimado</span>
                  <span className="font-mono font-bold text-sm text-foreground">
                    {a.currency === 'USD' ? '$' : 'S/'}{' '}
                    {Number(a.estimated_value || 0).toLocaleString('es-PE', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onOpenEdit(a)}
                    className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground"
                    title="Editar bien"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeactivate(a.id)}
                    className="p-1.5 rounded-lg border border-border hover:bg-destructive/10 text-destructive"
                    title="Desactivar bien"
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
