'use client';

import React from 'react';
import { PersonPicker } from '../persons/PersonPicker';
import { FormField } from '../ui/FormField';
import type { PersonItem } from '@workflow/shared';
import { User, AlertCircle, Calendar } from 'lucide-react';

interface CaseWizardStepCausanteProps {
  selectedCausante: PersonItem | null;
  onSelectCausante: (p: PersonItem) => void;
  deathDate: string;
  onDeathDateChange: (d: string) => void;
  error?: string;
}

export const CaseWizardStepCausante: React.FC<CaseWizardStepCausanteProps> = ({
  selectedCausante,
  onSelectCausante,
  deathDate,
  onDeathDateChange,
  error,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-1">
          <User className="w-4 h-4 text-primary" />
          Identificación del Causante (Fallecido)
        </h4>
        <p className="text-xs text-muted-foreground">
          Seleccione la persona fallecida o regístrela como nuevo contacto en el sistema.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <PersonPicker
        selectedPersonId={selectedCausante?.id || null}
        onSelectPerson={onSelectCausante}
      />

      {selectedCausante && (
        <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3">
          <div className="text-xs">
            <span className="text-muted-foreground">Causante seleccionado:</span>{' '}
            <strong className="text-foreground">
              {selectedCausante.first_name} {selectedCausante.last_name}{' '}
              {selectedCausante.second_last_name || ''}
            </strong>{' '}
            <span className="font-mono text-[11px] text-muted-foreground">
              ({selectedCausante.identity_document_type}: {selectedCausante.identity_document_number})
            </span>
          </div>

          <FormField id="f-causante-death-date" label="Fecha de Defunción del Causante" required>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                id="f-causante-death-date"
                type="date"
                value={deathDate || selectedCausante.death_date || ''}
                onChange={(e) => onDeathDateChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-mono"
              />
            </div>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              La fecha de defunción es fundamental para el cómputo de plazos y documentos.
            </span>
          </FormField>
        </div>
      )}
    </div>
  );
};
