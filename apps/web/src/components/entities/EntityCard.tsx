'use client';

import React from 'react';
import { StatusBadge } from '../ui/StatusBadge';
import { MapPin, FileText, Phone, Mail, Edit2 } from 'lucide-react';
import type { ExternalEntity } from '@workflow/shared';

interface EntityCardProps {
  entity: ExternalEntity;
  typeLabel: string;
  onEdit: () => void;
  onToggleActive: (id: string, current: boolean) => void;
}

export const EntityCard: React.FC<EntityCardProps> = ({
  entity,
  typeLabel,
  onEdit,
  onToggleActive,
}) => {
  const contacts = Array.isArray(entity.contacts) ? entity.contacts : [];
  const entityId = entity.id || '';

  return (
    <div
      className={`p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col justify-between transition-all ${
        entity.is_active ? 'border-border' : 'border-border/50 opacity-60'
      }`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              {typeLabel}
            </span>
            <h3 className="text-sm font-bold text-foreground mt-1.5 line-clamp-1">{entity.name}</h3>
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
            title="Editar entidad"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          {entity.tax_id && (
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>RUC: {entity.tax_id}</span>
            </div>
          )}
          {(entity.city || entity.address) && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {[entity.address, entity.city].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* Contactos */}
        <div className="pt-2 border-t border-border">
          <p className="text-[11px] font-semibold text-foreground mb-1">
            Contactos ({contacts.length}):
          </p>
          {contacts.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Sin contactos registrados</p>
          ) : (
            <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
              {contacts.map((c, i) => (
                <div
                  key={i}
                  className="text-[11px] p-1.5 rounded bg-muted/50 border border-border/50"
                >
                  <div className="font-semibold text-foreground flex justify-between">
                    <span>{c.name}</span>
                    {c.role && <span className="text-muted-foreground font-normal">{c.role}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 text-muted-foreground mt-0.5">
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {c.phone}
                      </span>
                    )}
                    {c.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {c.email}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-border flex items-center justify-between">
        <StatusBadge
          category={entity.is_active ? 'success' : 'neutral'}
          label={entity.is_active ? 'Activa' : 'Inactiva'}
          size="sm"
        />
        {entityId && (
          <button
            type="button"
            onClick={() => onToggleActive(entityId, entity.is_active)}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            {entity.is_active ? 'Desactivar' : 'Activar'}
          </button>
        )}
      </div>
    </div>
  );
};
