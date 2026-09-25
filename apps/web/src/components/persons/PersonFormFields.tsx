'use client';

import React from 'react';
import { FormField } from '../ui/FormField';
import type { PersonTypeCode } from '@workflow/shared';

interface PersonFormFieldsProps {
  personType: PersonTypeCode;
  firstName: string;
  setFirstName: (val: string) => void;
  lastName: string;
  setLastName: (val: string) => void;
  secondLastName: string;
  setSecondLastName: (val: string) => void;
  legalName: string;
  setLegalName: (val: string) => void;
  tradeName: string;
  setTradeName: (val: string) => void;
  errors: Record<string, string>;
}

export const PersonFormFields: React.FC<PersonFormFieldsProps> = ({
  personType,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  secondLastName,
  setSecondLastName,
  legalName,
  setLegalName,
  tradeName,
  setTradeName,
  errors,
}) => {
  if (personType === 'NATURAL') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField id="f-first-name" label="Nombres" required error={errors.first_name}>
            <input
              id="f-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ej. Juan Carlos"
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
            />
          </FormField>
          <FormField id="f-last-name" label="Apellido Paterno" required error={errors.last_name}>
            <input
              id="f-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Ej. Pérez"
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
            />
          </FormField>
        </div>
        <FormField id="f-second-last-name" label="Apellido Materno" error={errors.second_last_name}>
          <input
            id="f-second-last-name"
            type="text"
            value={secondLastName}
            onChange={(e) => setSecondLastName(e.target.value)}
            placeholder="Ej. Quispe"
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
          />
        </FormField>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <FormField id="f-legal-name" label="Razón Social" required error={errors.legal_name}>
        <input
          id="f-legal-name"
          type="text"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          placeholder="Ej. Inversiones San Martín S.A.C."
          className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
        />
      </FormField>
      <FormField id="f-trade-name" label="Nombre Comercial" error={errors.trade_name}>
        <input
          id="f-trade-name"
          type="text"
          value={tradeName}
          onChange={(e) => setTradeName(e.target.value)}
          placeholder="Ej. San Martín Inmobiliaria"
          className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
        />
      </FormField>
    </div>
  );
};
