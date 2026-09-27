'use client';

import React from 'react';
import { FormField } from '../../ui/FormField';
import { Calendar, Calculator } from 'lucide-react';

interface FilingDeadlineSectionProps {
  filedAt: string;
  responseDueDate: string;
  onFiledAtChange: (val: string) => void;
  onDueDateChange: (val: string) => void;
  onComputeDeadline: (businessDays: number) => void;
  publicationWaitDays: number;
}

export const FilingDeadlineSection: React.FC<FilingDeadlineSectionProps> = ({
  filedAt,
  responseDueDate,
  onFiledAtChange,
  onDueDateChange,
  onComputeDeadline,
  publicationWaitDays,
}) => {
  return (
    <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField id="filed_at" label="Fecha de Presentación">
          <input
            id="filed_at"
            type="date"
            value={filedAt}
            onChange={(e) => onFiledAtChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
          />
        </FormField>

        <FormField id="response_due_date" label="Fecha Límite / Vencimiento">
          <div className="relative">
            <input
              id="response_due_date"
              type="date"
              value={responseDueDate}
              onChange={(e) => onDueDateChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
            />
          </div>
        </FormField>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground border-t border-border/50">
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          Calcula días hábiles descontando fines de semana y feriados activos.
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onComputeDeadline(publicationWaitDays)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-secondary text-secondary-foreground font-semibold hover:bg-secondary/80"
          >
            <Calculator className="w-3 h-3" />
            <span>Sumar {publicationWaitDays} d. útiles (Edictos)</span>
          </button>
          <button
            type="button"
            onClick={() => onComputeDeadline(7)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-foreground hover:bg-muted/80"
          >
            +7 d. útiles
          </button>
          <button
            type="button"
            onClick={() => onComputeDeadline(30)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-foreground hover:bg-muted/80"
          >
            +30 d. útiles
          </button>
        </div>
      </div>
    </div>
  );
};
