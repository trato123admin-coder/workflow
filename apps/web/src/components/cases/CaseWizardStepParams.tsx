'use client';

import React from 'react';
import { FormField } from '../ui/FormField';
import { CASE_ROUTES, CASE_PRIORITIES, type CaseRoute, type CasePriority } from '@workflow/shared';

interface CaseWizardStepParamsProps {
  models: { version_id: string; code: string; name: string; version: number }[];
  selectedModelVersionId: string;
  onModelVersionChange: (id: string) => void;
  title: string;
  onTitleChange: (title: string) => void;
  route: CaseRoute;
  onRouteChange: (route: CaseRoute) => void;
  priority: CasePriority;
  onPriorityChange: (priority: CasePriority) => void;
  isConfidential: boolean;
  onConfidentialChange: (confidential: boolean) => void;
  errors: Record<string, string>;
}

export const CaseWizardStepParams: React.FC<CaseWizardStepParamsProps> = ({
  models,
  selectedModelVersionId,
  onModelVersionChange,
  title,
  onTitleChange,
  route,
  onRouteChange,
  priority,
  onPriorityChange,
  isConfidential,
  onConfidentialChange,
  errors,
}) => {
  return (
    <div className="space-y-4">
      <FormField id="f-case-model" label="Modelo de Trámite" required error={errors.model}>
        <select
          id="f-case-model"
          value={selectedModelVersionId}
          onChange={(e) => onModelVersionChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
        >
          {models.map((m) => (
            <option key={m.version_id} value={m.version_id}>
              {m.name} (v{m.version} - Publicada)
            </option>
          ))}
        </select>
      </FormField>

      <FormField id="f-case-title" label="Título del Caso" required error={errors.title}>
        <input
          id="f-case-title"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField id="f-case-route" label="Vía Procesal">
          <select
            id="f-case-route"
            value={route}
            onChange={(e) => onRouteChange(e.target.value as CaseRoute)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
          >
            {CASE_ROUTES.map((r) => (
              <option key={r} value={r}>
                {r === 'POR_DEFINIR' ? 'Por definir (Inicial)' : r}
              </option>
            ))}
          </select>
        </FormField>

        <FormField id="f-case-priority" label="Prioridad">
          <select
            id="f-case-priority"
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value as CasePriority)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs"
          >
            {CASE_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer select-none p-3 rounded-lg border border-border bg-card">
        <input
          type="checkbox"
          checked={isConfidential}
          onChange={(e) => onConfidentialChange(e.target.checked)}
          className="rounded border-border text-primary"
        />
        <span>Caso confidencial (acceso restringido a asignados)</span>
      </label>
    </div>
  );
};
