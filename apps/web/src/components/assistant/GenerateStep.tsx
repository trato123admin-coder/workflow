'use client';

import React, { useState } from 'react';
import type { EvaluatedCandidate } from './types';
import Link from 'next/link';
import {
  CheckCircle2,
  FileCheck,
  ArrowLeft,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

interface GenerateStepProps {
  candidate: EvaluatedCandidate;
  caseId: string;
  caseNumber: string;
  onConfirmGenerate: () => Promise<void>;
  onReset: () => void;
  onBack: () => void;
}

export const GenerateStep: React.FC<GenerateStepProps> = ({
  candidate,
  caseId,
  caseNumber,
  onConfirmGenerate,
  onReset,
  onBack,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [legalConfirmed, setLegalConfirmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onConfirmGenerate();
      setIsSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar la generación';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="p-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">
            Documento preparado y sugerencia aprobada
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            La recomendación para el documento{' '}
            <strong className="text-foreground">{candidate.documentTypeName}</strong> ha sido
            aprobada y registrada exitosamente para el caso{' '}
            <strong className="text-foreground">{caseNumber}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href={`/cases/${caseId}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <span>Ver expediente {caseNumber}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Preparar otro documento</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Paso 5: Confirmación y aprobación</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Confirme la aprobación de la recomendación basada en reglas para registrar la decisión en
          la estadística histórica y proceder con el documento.
        </p>
      </div>

      {/* Summary Card */}
      <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Resumen de la operación
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-muted-foreground block">Expediente:</span>
            <span className="font-semibold text-foreground">{caseNumber}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Tipo de documento:</span>
            <span className="font-semibold text-foreground">{candidate.documentTypeName}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Plantilla:</span>
            <span className="font-semibold text-foreground">
              {candidate.template?.name || 'Plantilla estándar'} (v
              {candidate.template?.version ?? 1})
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Motor evaluador:</span>
            <span className="font-semibold text-foreground">Reglas deterministas (RULES_ONLY)</span>
          </div>
        </div>

        {/* Legal Confirmation Checkbox */}
        <div className="pt-4 border-t border-border">
          <label className="flex items-start gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5 cursor-pointer">
            <input
              type="checkbox"
              checked={legalConfirmed}
              onChange={(e) => setLegalConfirmed(e.target.checked)}
              className="mt-0.5 rounded border-border text-primary focus:ring-primary"
            />
            <div className="text-xs space-y-1">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span>Confirmación de revisión legal</span>
              </span>
              <p className="text-muted-foreground">
                Confirmo que los requisitos legales han sido verificados conforme a la normativa
                vigente y que el contenido del documento cumple con los estándares del despacho.
              </p>
            </div>
          </label>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 text-xs rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver a vista previa</span>
        </button>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={!legalConfirmed || isSubmitting}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <FileCheck className="w-4 h-4" />
          <span>{isSubmitting ? 'Procesando...' : 'Confirmar y generar documento'}</span>
        </button>
      </div>
    </div>
  );
};
