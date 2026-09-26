'use client';

import React from 'react';

export interface BackendInfo {
  code: string;
  kind: string;
  is_primary: boolean;
  is_backup: boolean;
  is_active: boolean;
  config: Record<string, unknown>;
}

interface StorageBackendCardsProps {
  backends: BackendInfo[];
}

export const StorageBackendCards: React.FC<StorageBackendCardsProps> = ({ backends }) => {
  return (
    <div className="space-y-3">
      <h4 className="font-bold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
        Proveedores de Almacenamiento (storage_backends)
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {backends.map((b) => (
          <div
            key={b.code}
            className={`p-4 rounded-xl border transition-all ${
              b.is_primary
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-foreground capitalize">{b.code}</span>
              {b.is_primary && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                  PRIMARIO
                </span>
              )}
              {b.is_backup && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                  RESPALDO
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tipo: <strong className="text-foreground">{b.kind}</strong>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Estado:{' '}
              <span className={b.is_active ? 'text-emerald-600 font-semibold' : 'text-rose-600'}>
                {b.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
