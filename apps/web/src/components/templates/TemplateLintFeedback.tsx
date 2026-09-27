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
    return (
      <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>Errores detectados en la plantilla (Subida bloqueada)</span>
        </div>
        {lintError && <p className="pl-6">{lintError}</p>}
        {lintResult?.lint.errors.map((err, i) => (
          <p key={i} className="pl-6 font-mono text-[11px]">
            • {err}
          </p>
        ))}
        {lintResult?.lint.brokenMarkers && lintResult.lint.brokenMarkers.length > 0 && (
          <div className="pl-6 text-[11px]">
            Marcadores rotos detectados en el XML de Word:
            <ul className="list-disc pl-4 mt-1 font-mono">
              {lintResult.lint.brokenMarkers.map((bm, i) => (
                <li key={i}>{bm}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (lintResult && lintResult.lint.isValid) {
    return (
      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
        <div className="flex items-center gap-2 font-bold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Plantilla válida y sin macros</span>
        </div>
        <p className="pl-6 text-[11px]">
          Se detectaron {lintResult.lint.validFields.length} marcadores autorizados listos para
          sustitución.
        </p>
      </div>
    );
  }

  return null;
};
