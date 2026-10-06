'use client';

import React from 'react';
import type { EvaluatedCandidate } from './types';
import {
  Sparkles,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  XCircle,
  Scale,
  History,
  ClipboardList,
  ArrowRight,
  Info,
} from 'lucide-react';

interface RecommendationCardProps {
  topCandidate: EvaluatedCandidate;
  alternatives: EvaluatedCandidate[];
  onAccept: (candidate: EvaluatedCandidate) => void;
  onDismiss: (candidate: EvaluatedCandidate) => void;
  onSelectAlternative: (candidate: EvaluatedCandidate) => void;
  onBackToCase: () => void;
  isProcessingDecision?: boolean;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  topCandidate,
  alternatives,
  onAccept,
  onDismiss,
  onSelectAlternative,
  onBackToCase,
  isProcessingDecision = false,
}) => {
  const scorePercent = Math.round(topCandidate.score * 100);
  const completenessPercent = Math.round(topCandidate.completeness * 100);
  const historicalPercent = Math.round(topCandidate.historicalStats.rate * 100);

  return (
    <div className="space-y-6">
      {/* Mandatory Legal Badge Banner (A.7 #3 & Domain Rule) */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
        <Scale className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 dark:text-amber-200">
          <div className="font-semibold text-sm flex items-center gap-1.5 mb-1">
            <span>Sugerencia para revisión legal</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 font-mono font-medium">
              Modo: Solo Reglas
            </span>
          </div>
          <p>
            El sistema organiza y sugiere con base en reglas deterministas preconfiguradas; no
            decide derechos. Toda recomendación debe ser revisada y validada por el abogado o
            notario a cargo.
          </p>
        </div>
      </div>

      {/* Main Recommended Document Card */}
      <div className="p-6 rounded-2xl border border-primary/30 bg-card shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                  topCandidate.effect === 'REQUIRE'
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    : 'bg-primary/10 text-primary border border-primary/20'
                }`}
              >
                {topCandidate.effect === 'REQUIRE' ? 'Obligatorio por regla' : 'Recomendado'}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                {topCandidate.documentTypeCode}
              </span>
            </div>
            <h3 className="text-xl font-bold text-foreground">{topCandidate.documentTypeName}</h3>
          </div>

          {/* System Score Badge */}
          <div className="flex items-center gap-3 bg-muted/30 px-4 py-2.5 rounded-xl border border-border shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Puntuación
              </div>
              <div className="text-lg font-bold text-foreground">{scorePercent}%</div>
            </div>
          </div>
        </div>

        {/* Score Breakdown Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Scale className="w-3.5 h-3.5" />
              <span>Prioridad regla</span>
            </div>
            <div className="text-sm font-semibold text-foreground">
              Nivel #{topCandidate.priority}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <History className="w-3.5 h-3.5" />
              <span>Aceptación histórica</span>
            </div>
            <div className="text-sm font-semibold text-foreground">
              {historicalPercent}%{' '}
              <span className="text-xs font-normal text-muted-foreground">
                ({topCandidate.historicalStats.accepted}/{topCandidate.historicalStats.shown})
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Completitud de datos</span>
            </div>
            <div className="text-sm font-semibold text-foreground">{completenessPercent}%</div>
          </div>
        </div>

        {/* Why this document was suggested */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            ¿Por qué se sugiere este documento?
          </h4>
          <div className="space-y-1.5">
            {topCandidate.reasons.length > 0 ? (
              topCandidate.reasons.map((reason, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{reason}</span>
                </div>
              ))
            ) : (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>Cumple con las condiciones configuradas para este tipo de trámite.</span>
              </div>
            )}
          </div>
        </div>

        {/* Missing fields alert if completeness < 1.0 */}
        {topCandidate.missingFields.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Campos requeridos faltantes en el expediente ({topCandidate.missingFields.length}):
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {topCandidate.missingFields.map((field, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-background/80 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-[11px] font-medium"
                >
                  {field}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              Podrá ingresar o confirmar estos datos en el siguiente paso.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onBackToCase}
            disabled={isProcessingDecision}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Cambiar expediente
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDismiss(topCandidate)}
              disabled={isProcessingDecision}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Descartar sugerencia</span>
            </button>

            <button
              type="button"
              onClick={() => onAccept(topCandidate)}
              disabled={isProcessingDecision}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <span>Aceptar y preparar datos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Alternatives Section (if other documents matched rules) */}
      {alternatives.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Otras alternativas recomendadas por reglas ({alternatives.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alternatives.map((alt) => (
              <div
                key={alt.documentTypeId}
                className="p-4 rounded-xl border border-border bg-card/60 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <FileCheck className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground truncate">
                      {alt.documentTypeName}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span>Puntuación: {Math.round(alt.score * 100)}%</span>
                    <span>•</span>
                    <span>Prioridad #{alt.priority}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectAlternative(alt)}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted text-foreground transition-colors shrink-0"
                >
                  Elegir esta
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
