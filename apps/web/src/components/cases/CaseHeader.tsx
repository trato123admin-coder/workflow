'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from '../ui/StatusBadge';
import { ArrowLeft, Copy, Lock } from 'lucide-react';
import type { CaseItem } from '@workflow/shared';
import { DuplicateCaseDialog } from './DuplicateCaseDialog';

interface CaseHeaderProps {
  caseData: CaseItem | null;
  clientName: string;
  isUpdating: boolean;
  onCloseCase: () => void;
}

export const CaseHeader: React.FC<CaseHeaderProps> = ({
  caseData,
  clientName,
  isUpdating,
  onCloseCase,
}) => {
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);

  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {caseData?.case_number}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
              Vía: {caseData?.route}
            </span>
            {caseData?.is_confidential && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Lock className="w-3 h-3" />
                <span>Confidencial</span>
              </span>
            )}
            <StatusBadge
              category={caseData?.status === 'COMPLETED' ? 'success' : 'info'}
              label={caseData?.status || ''}
            />
          </div>
          <h1 className="text-xl font-bold text-foreground mt-2">{caseData?.title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Contratante: <strong className="text-foreground">{clientName}</strong> · Responsable:{' '}
            <strong className="text-foreground">
              {caseData?.responsible
                ? `${caseData.responsible.first_name || ''} ${caseData.responsible.last_name || ''}`.trim() ||
                  caseData.responsible.email
                : 'Sin asignar'}
            </strong>
          </p>
        </div>

        {/* Barra de Avance Ponderado en tiempo real */}
        <div className="w-full md:w-56 p-3 rounded-xl border border-border bg-muted/20 space-y-1.5 shrink-0">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-muted-foreground">Avance Ponderado</span>
            <span className="font-mono font-bold text-foreground text-sm">
              {Number(caseData?.current_progress || 0).toFixed(2)}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${Math.min(100, Math.max(0, caseData?.current_progress || 0))}%`,
              }}
            />
          </div>
          <div className="text-[10px] text-muted-foreground text-right">Fórmula por trigger</div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <Link
          href="/cases"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver al listado</span>
        </Link>
        <div className="flex items-center gap-2">
          {caseData && (
            <button
              type="button"
              onClick={() => setIsDuplicateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-muted text-foreground transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicar Caso</span>
            </button>
          )}
          {caseData?.status !== 'COMPLETED' && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={onCloseCase}
              className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-muted text-foreground"
            >
              Cerrar Caso
            </button>
          )}
        </div>
      </div>

      {caseData && (
        <DuplicateCaseDialog
          isOpen={isDuplicateOpen}
          onClose={() => setIsDuplicateOpen(false)}
          caseId={caseData.id}
          currentTitle={caseData.title}
        />
      )}
    </div>
  );
};
