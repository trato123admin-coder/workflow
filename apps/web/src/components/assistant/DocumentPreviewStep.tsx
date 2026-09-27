'use client';

import React from 'react';
import type { EvaluatedCandidate } from './types';
import { ArrowLeft, ArrowRight, FileText, Clock, CheckCircle2, ShieldAlert } from 'lucide-react';

interface DocumentPreviewStepProps {
  candidate: EvaluatedCandidate;
  fieldValues: Record<string, string>;
  caseNumber: string;
  onBack: () => void;
  onContinue: () => void;
}

export const DocumentPreviewStep: React.FC<DocumentPreviewStepProps> = ({
  candidate,
  fieldValues,
  caseNumber,
  onBack,
  onContinue,
}) => {
  const template = candidate.template;

  // Merge values: from extracted DB or user input
  const allFields = (candidate.fields || []).map((f) => {
    const val = fieldValues[f.code] ?? (f.current_value !== undefined ? String(f.current_value) : '');
    return {
      code: f.code,
      label: f.label,
      value: val,
      source: f.is_missing ? 'Ingresado por usuario' : 'Expediente / Base de datos',
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Paso 4: Vista previa del documento
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Verifique la plantilla y los datos consolidados antes de registrar la generación definitiva.
        </p>
      </div>

      {/* Template Metadata Box */}
      <div className="p-4 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {template?.name || candidate.documentTypeName}
            </h3>
            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
              <span>Versión {template?.version ?? 1}</span>
              <span>•</span>
              <span className="font-mono">{candidate.documentTypeCode}</span>
              <span>•</span>
              <span>Caso: {caseNumber}</span>
            </div>
          </div>
        </div>

        {template?.estimated_manual_minutes ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border shrink-0">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>Ahorro estimado: ~{template.estimated_manual_minutes} min</span>
          </div>
        ) : null}
      </div>

      {/* Document Preview Box with BORRADOR Watermark (A.7 #3) */}
      <div className="relative p-8 rounded-2xl border-2 border-dashed border-border bg-background/50 overflow-hidden min-h-[300px]">
        {/* Prominent Diagonal Watermark */}
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.06] -rotate-12"
        >
          <span className="text-7xl sm:text-8xl font-black tracking-widest text-foreground">
            BORRADOR
          </span>
        </div>

        {/* Warning Banner inside preview */}
        <div className="mb-6 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            Documento preliminar en estado <strong>BORRADOR</strong>. Sujeto a revisión y firma
            por el abogado responsable.
          </span>
        </div>

        {/* Compiled Fields Table */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Variables y valores consolidados ({allFields.length})
          </h4>

          {allFields.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Esta plantilla no tiene variables de reemplazo dinámicas asociadas.
            </p>
          ) : (
            <div className="divide-y divide-border border border-border rounded-xl bg-card overflow-hidden">
              {allFields.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/20 transition-colors"
                >
                  <div className="min-w-0 sm:w-1/3">
                    <span className="font-semibold text-foreground">{item.label}</span>
                    <span className="block font-mono text-[10px] text-muted-foreground">
                      {item.code}
                    </span>
                  </div>
                  <div className="sm:w-1/2 font-mono text-sm text-foreground truncate">
                    {item.value || <span className="text-muted-foreground italic">&lt;vacío&gt;</span>}
                  </div>
                  <div className="sm:w-1/4 text-right">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                      {item.source}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver a datos</span>
        </button>

        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <span>Continuar a confirmación</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
