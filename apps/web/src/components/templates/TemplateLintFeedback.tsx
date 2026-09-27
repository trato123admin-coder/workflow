'use client';

import React from 'react';
import { Loader2, XCircle, CheckCircle2 } from 'lucide-react';
import type { TemplateLintApiResponse } from '../../lib/engine-client';

interface TemplateLintFeedbackProps {
  isLinting: boolean;
  lintError: string | null;
  lintResult: TemplateLintApiResponse | null;
  hasBrokenOrMacro: boolean;
}

export const TemplateLintFeedback: React.FC<TemplateLintFeedbackProps> = ({
  isLinting,
  lintError,
  lintResult,
  hasBrokenOrMacro,
}) => {
  if (isLinting) {
    return (
      <div className="p-3 bg-muted rounded-xl flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span>Analizando estructura interna del archivo Word...</span>
      </div>
    );
  }

  if (hasBrokenOrMacro) {
    const errors = lintResult?.lint?.errors ?? [];
    const brokenMarkers = lintResult?.lint?.brokenMarkers ?? [];
    const unknownPlaceholders = lintResult?.lint?.unknownPlaceholders ?? [];

    return (
      <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>Errores detectados en la plantilla (Subida bloqueada)</span>
        </div>
        {lintError && <p className="pl-6">{lintError}</p>}
        {errors.map((err, i) => (
          <p key={i} className="pl-6 font-mono text-[11px]">
            • {err}
          </p>
        ))}
        {brokenMarkers.length > 0 && (
          <div className="pl-6 text-[11px]">
            Marcadores rotos detectados en el XML de Word:
            <ul className="list-disc pl-4 mt-1 font-mono">
              {brokenMarkers.map((bm, i) => (
                <li key={i}>{bm}</li>
              ))}
            </ul>
          </div>
        )}
        {unknownPlaceholders.length > 0 && (
          <div className="pl-6 text-[11px]">
            Marcadores desconocidos no autorizados:
            <ul className="list-disc pl-4 mt-1 font-mono">
              {unknownPlaceholders.map((up, i) => (
                <li key={i}>{up}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (lintResult && lintResult.lint?.isValid) {
    const validCount = lintResult.lint.placeholders?.length ?? 0;
    return (
      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
        <div className="flex items-center gap-2 font-bold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Plantilla válida y sin macros</span>
        </div>
        <p className="pl-6 text-[11px]">
          Se detectaron {validCount} marcadores autorizados listos para sustitución
          {validCount > 0 && `: ${lintResult.lint.placeholders.join(', ')}`}.
        </p>
      </div>
    );
  }

  return null;
};
