'use client';

import React, { useState } from 'react';
import type { EvaluatedCandidate } from './types';
import { CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, Database, Edit3 } from 'lucide-react';

interface MissingFieldsFormProps {
  candidate: EvaluatedCandidate;
  fieldValues: Record<string, string>;
  onFieldValuesChange: (values: Record<string, string>) => void;
  onBack: () => void;
  onContinue: () => void;
}

export const MissingFieldsForm: React.FC<MissingFieldsFormProps> = ({
  candidate,
  fieldValues,
  onFieldValuesChange,
  onBack,
  onContinue,
}) => {
  const [localValues, setLocalValues] = useState<Record<string, string>>(fieldValues);

  const handleInputChange = (fieldCode: string, value: string) => {
    const updated = { ...localValues, [fieldCode]: value };
    setLocalValues(updated);
    onFieldValuesChange(updated);
  };

  const templateFields = candidate.fields || [];
  const prefilledFields = templateFields.filter(
    (f) => !f.is_missing && f.current_value !== undefined && f.current_value !== null
  );
  const editableFields = templateFields.filter(
    (f) => f.is_missing || f.current_value === undefined || f.current_value === null
  );

  const missingRequired = editableFields.filter(
    (f) => f.is_required && !localValues[f.code]?.trim()
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Paso 3: Datos de la plantilla
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Revise los datos extraídos automáticamente del expediente y complete los campos
          necesarios para la plantilla {candidate.template ? `"${candidate.template.name}"` : ''}.
        </p>
      </div>

      {/* Prefilled Fields from Case */}
      {prefilledFields.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-500" />
            <span>Datos prellenados desde el expediente ({prefilledFields.length})</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {prefilledFields.map((field) => (
              <div
                key={field.id}
                className="p-3 rounded-xl border border-border bg-muted/20 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground truncate">
                    {field.label}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium shrink-0 flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>BD</span>
                  </span>
                </div>
                <div className="text-sm font-semibold text-foreground truncate">
                  {String(field.current_value)}
                </div>
                {field.source_path && (
                  <div className="text-[10px] font-mono text-muted-foreground truncate">
                    {field.source_path}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editable / Missing Fields */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Edit3 className="w-3.5 h-3.5 text-primary" />
          <span>Campos adicionales a completar ({editableFields.length})</span>
        </h3>

        {editableFields.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
            Todos los datos requeridos por la plantilla fueron completados desde el expediente.
          </div>
        ) : (
          <div className="space-y-3">
            {editableFields.map((field) => {
              const val = localValues[field.code] ?? '';
              const isRequired = field.is_required;
              const hasError = isRequired && !val.trim();

              return (
                <div
                  key={field.id}
                  className="p-3.5 rounded-xl border border-border bg-card space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1">
                      <span>{field.label}</span>
                      {isRequired && <span className="text-destructive">*</span>}
                    </label>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {field.code}
                    </span>
                  </div>

                  <input
                    type="text"
                    value={val}
                    onChange={(e) => handleInputChange(field.code, e.target.value)}
                    placeholder={`Ingrese ${field.label.toLowerCase()}...`}
                    className={`w-full px-3 py-2 text-sm rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 transition-colors ${
                      hasError
                        ? 'border-destructive/50 focus:ring-destructive/20 focus:border-destructive'
                        : 'border-border focus:ring-primary/20 focus:border-primary'
                    }`}
                  />
                  {hasError && (
                    <p className="text-[11px] text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>Este campo es obligatorio para la generación del documento.</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver a sugerencia</span>
        </button>

        <button
          type="button"
          onClick={onContinue}
          disabled={missingRequired.length > 0}
          className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span>Continuar a vista previa</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
