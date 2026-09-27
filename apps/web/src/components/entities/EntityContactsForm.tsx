'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
export interface ContactFormItem {
  name: string;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface EntityContactsFormProps {
  contacts: ContactFormItem[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: keyof ContactFormItem, value: string) => void;
}

export const EntityContactsForm: React.FC<EntityContactsFormProps> = ({
  contacts,
  onAdd,
  onRemove,
  onUpdate,
}) => {
  return (
    <div className="pt-2 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-xs font-bold text-foreground">Contactos Directos</h4>
          <p className="text-[11px] text-muted-foreground">
            Gestores, secretarios notariales o asesores de la entidad
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Añadir contacto</span>
        </button>
      </div>

      {contacts.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2 text-center border border-dashed border-border rounded-lg">
          Sin contactos registrados. Presione &quot;Añadir contacto&quot; para registrar uno.
        </p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {contacts.map((contact, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg border border-border"
            >
              <input
                type="text"
                placeholder="Nombre completo"
                value={contact.name}
                onChange={(e) => onUpdate(idx, 'name', e.target.value)}
                className="flex-1 px-2 py-1 text-xs rounded border border-input bg-background text-foreground"
              />
              <input
                type="text"
                placeholder="Cargo / Rol"
                value={contact.role || ''}
                onChange={(e) => onUpdate(idx, 'role', e.target.value)}
                className="w-28 px-2 py-1 text-xs rounded border border-input bg-background text-foreground"
              />
              <input
                type="text"
                placeholder="Teléfono"
                value={contact.phone || ''}
                onChange={(e) => onUpdate(idx, 'phone', e.target.value)}
                className="w-28 px-2 py-1 text-xs rounded border border-input bg-background text-foreground"
              />
              <input
                type="email"
                placeholder="Email"
                value={contact.email || ''}
                onChange={(e) => onUpdate(idx, 'email', e.target.value)}
                className="w-36 px-2 py-1 text-xs rounded border border-input bg-background text-foreground"
              />
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="p-1 text-muted-foreground hover:text-destructive rounded"
                title="Eliminar contacto"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
