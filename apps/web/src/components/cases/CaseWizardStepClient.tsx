'use client';

import React from 'react';
import type { PersonItem } from '@workflow/shared';
import { PersonPicker } from '../persons/PersonPicker';

interface CaseWizardStepClientProps {
  selectedClient: PersonItem | null;
  onSelectClient: (person: PersonItem) => void;
  error?: string;
}

export const CaseWizardStepClient: React.FC<CaseWizardStepClientProps> = ({
  selectedClient,
  onSelectClient,
  error,
}) => {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-bold text-foreground mb-1">Paso 1: Contratante del Servicio</h4>
        <p className="text-xs text-muted-foreground">
          Seleccione el cliente que solicita el servicio sucesorio.
        </p>
      </div>
      {error && <div className="text-xs text-destructive">{error}</div>}
      <PersonPicker selectedPersonId={selectedClient?.id || null} onSelectPerson={onSelectClient} />
    </div>
  );
};
