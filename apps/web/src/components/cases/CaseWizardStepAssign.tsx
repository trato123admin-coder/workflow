'use client';

import React from 'react';
import { FormField } from '../ui/FormField';
import { FileCheck2 } from 'lucide-react';
import type { PersonItem } from '@workflow/shared';

interface UserOption {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface CaseWizardStepAssignProps {
  users: UserOption[];
  responsibleId: string;
  onResponsibleChange: (id: string) => void;
  lawyerId: string;
  onLawyerChange: (id: string) => void;
  selectedPerson: PersonItem | null;
  title: string;
  errors: Record<string, string>;
}

export const CaseWizardStepAssign: React.FC<CaseWizardStepAssignProps> = ({
  users,
  responsibleId,
  onResponsibleChange,
  lawyerId,
  onLawyerChange,
  selectedPerson,
  title,
  errors,
}) => {
  return (
    <div className="space-y-4">
      <FormField id="f-resp-user" label="Gestor Responsable" required error={errors.responsible}>
        <select
          id="f-resp-user"
          value={responsibleId}
          onChange={(e) => onResponsibleChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
        >
          <option value="">Seleccione un gestor...</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.role})
            </option>
          ))}
        </select>
      </FormField>

      <FormField id="f-lawyer-user" label="Abogado Asignado (Opcional)">
        <select
          id="f-lawyer-user"
          value={lawyerId}
          onChange={(e) => onLawyerChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
        >
          <option value="">Sin abogado asignado inicialmente</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.role})
            </option>
          ))}
        </select>
      </FormField>

      <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-1 text-xs text-foreground">
        <div className="font-bold flex items-center gap-1.5 text-primary">
          <FileCheck2 className="w-4 h-4" />
          Resumen de Creación
        </div>
        <div>
          Cliente:{' '}
          <strong>
            {selectedPerson?.person_type === 'JURIDICA'
              ? selectedPerson.legal_name
              : `${selectedPerson?.first_name || ''} ${selectedPerson?.last_name || ''}`}
          </strong>
        </div>
        <div>
          Trámite: <strong>{title}</strong>
        </div>
      </div>
    </div>
  );
};
