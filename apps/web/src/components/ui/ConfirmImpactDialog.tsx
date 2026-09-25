'use client';

import React from 'react';
import { AlertTriangle, AlertCircle, X } from 'lucide-react';
import type { UsageCountResult } from '@workflow/shared';

interface ConfirmImpactDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  itemName: string;
  itemCode: string;
  usage: UsageCountResult;
  isDeactivating?: boolean;
}

export const ConfirmImpactDialog: React.FC<ConfirmImpactDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  itemCode,
  usage,
  isDeactivating = true,
}) => {
  if (!isOpen) return null;

  const isBlocked = !usage.canSafelyDeactivate;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="impact-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="bg-card text-card-foreground border border-border w-full max-w-md rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2 text-warning font-semibold text-sm">
            {isBlocked ? (
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
            )}
            <span id="impact-dialog-title" className="text-foreground">
              {title}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md"
            aria-label="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-sm">
          <div>
            <p className="text-muted-foreground">
              Elemento:{' '}
              <strong className="text-foreground">
                {itemName} ({itemCode})
              </strong>
            </p>
          </div>

          {/* Usage Badge / Count */}
          <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-background">
            <span className="text-xs text-muted-foreground font-medium">Registros vinculados:</span>
            <span
              className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                usage.count > 0
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              En uso ({usage.count})
            </span>
          </div>

          {isBlocked ? (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
              <strong className="font-semibold block">Acción Bloqueada</strong>
              <p>{usage.blockingReason || 'No es posible desactivar este elemento del sistema.'}</p>
            </div>
          ) : (
            <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
              <p>
                {isDeactivating
                  ? 'Al desactivar este elemento, no aparecerá en formularios para nuevos expedientes o trámites.'
                  : 'Se modificará el estado del elemento.'}
              </p>
              {usage.count > 0 && (
                <p className="font-medium text-foreground">
                  Los {usage.count} registros existentes que actualmente lo utilizan conservarán su
                  valor histórico intacto (sin pérdida de datos).
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-input bg-background hover:bg-muted text-foreground transition-colors"
          >
            {isBlocked ? 'Entendido' : 'Cancelar'}
          </button>
          {!isBlocked && (
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm transition-colors"
            >
              Confirmar desactivación
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
