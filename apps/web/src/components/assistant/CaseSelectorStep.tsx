'use client';

import React, { useState } from 'react';
import type { CaseOption } from './types';
import { Search, Briefcase, ChevronRight, AlertCircle } from 'lucide-react';

interface CaseSelectorStepProps {
  cases: CaseOption[];
  isLoading: boolean;
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  onContinue: () => void;
}

export const CaseSelectorStep: React.FC<CaseSelectorStepProps> = ({
  cases,
  isLoading,
  selectedCaseId,
  onSelectCase,
  onContinue,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCases = cases.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.case_number.toLowerCase().includes(term) ||
      c.title.toLowerCase().includes(term) ||
      (c.process_type && c.process_type.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Paso 1: Seleccionar expediente
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Elija el expediente sobre el cual se evaluarán las reglas documentales deterministas.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por número de caso, título o tipo de trámite..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
        />
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          Cargando expedientes disponibles...
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl flex flex-col items-center gap-2">
          <AlertCircle className="w-5 h-5 text-muted-foreground" />
          <span>No se encontraron expedientes con los criterios de búsqueda.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
          {filteredCases.map((c) => {
            const isSelected = c.id === selectedCaseId;
            return (
              <div
                key={c.id}
                onClick={() => onSelectCase(c.id)}
                className={`p-4 rounded-xl border text-left cursor-pointer transition-all flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border bg-card hover:bg-muted/40 hover:border-border/80'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Briefcase className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-mono text-xs font-semibold text-primary">
                      {c.case_number}
                    </span>
                    {c.process_type && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase font-medium">
                        {c.process_type}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium text-foreground truncate">
                    {c.title}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Creado:{' '}
                    {new Date(c.created_at).toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/30'
                  }`}
                >
                  {isSelected && <div className="w-2 h-2 rounded-full bg-background" />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end pt-4 border-t border-border">
        <button
          type="button"
          onClick={onContinue}
          disabled={!selectedCaseId || isLoading}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span>Evaluar recomendaciones</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
