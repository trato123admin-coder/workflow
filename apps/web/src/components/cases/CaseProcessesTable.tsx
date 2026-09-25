'use client';

import React from 'react';
import { StatusBadge } from '../ui/StatusBadge';
import { CheckCircle2, Clock, AlertTriangle, Play, Check, ShieldAlert } from 'lucide-react';
import type { CaseProcessItem } from '@workflow/shared';

interface CaseProcessesTableProps {
  processes: CaseProcessItem[];
  workflowStatuses: { id: string; code: string; name: string; category: string }[];
  onAdvanceProcess: (processId: string, statusId: string, progress?: number) => Promise<void>;
  isUpdating: boolean;
}

export const CaseProcessesTable: React.FC<CaseProcessesTableProps> = ({
  processes,
  workflowStatuses,
  onAdvanceProcess,
  isUpdating,
}) => {
  const doneStatus =
    workflowStatuses.find((s) => s.category === 'DONE') ||
    workflowStatuses.find((s) => s.code === 'FINALIZADO');
  const inProgressStatus =
    workflowStatuses.find((s) => s.category === 'IN_PROGRESS') ||
    workflowStatuses.find((s) => s.code === 'EN_PROCESO');

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
          <tr>
            <th className="py-2.5 px-3 w-12 text-center">Sec.</th>
            <th className="py-2.5 px-3">Proceso</th>
            <th className="py-2.5 px-3 w-20 text-right">Peso</th>
            <th className="py-2.5 px-3 w-32">Estado</th>
            <th className="py-2.5 px-3 w-24 text-right">Progreso</th>
            <th className="py-2.5 px-3">Dependencias</th>
            <th className="py-2.5 px-3 w-40 text-center">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {processes.map((proc) => {
            const isCompleted = proc.status?.semantic_category === 'DONE' || proc.progress >= 100;
            return (
              <tr key={proc.id} className="hover:bg-muted/30 transition-colors">
                <td className="py-2 px-3 text-center font-mono font-bold text-muted-foreground">
                  {proc.sequence}
                </td>
                <td className="py-2 px-3">
                  <div className="font-semibold text-foreground">{proc.definition?.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {proc.definition?.code}
                  </div>
                </td>
                <td className="py-2 px-3 text-right font-mono font-semibold text-foreground">
                  {Number(proc.weight).toFixed(2)}%
                </td>
                <td className="py-2 px-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                      proc.status?.semantic_category === 'DONE'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : proc.status?.semantic_category === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {proc.status?.name || 'Pendiente'}
                  </span>
                </td>
                <td className="py-2 px-3 text-right font-mono font-semibold text-foreground">
                  {Number(proc.progress).toFixed(2)}%
                </td>
                <td className="py-2 px-3 text-[11px] text-muted-foreground">
                  {proc.dependencies && proc.dependencies.length > 0 ? (
                    <div className="space-y-0.5">
                      {proc.dependencies.map((d, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              d.is_satisfied ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          <span>Sec. {d.depends_on_sequence}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span>—</span>
                  )}
                </td>
                <td className="py-2 px-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    {!isCompleted ? (
                      <>
                        {inProgressStatus && proc.status?.semantic_category === 'PENDING' && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => onAdvanceProcess(proc.id, inProgressStatus.id)}
                            className="px-2 py-1 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[11px] font-medium hover:bg-blue-500/20 disabled:opacity-50 flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" />
                            <span>Iniciar</span>
                          </button>
                        )}
                        {doneStatus && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => onAdvanceProcess(proc.id, doneStatus.id, 100)}
                            className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[11px] font-medium hover:bg-emerald-500/20 disabled:opacity-50 flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Completar</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-emerald-600 font-semibold text-[11px] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Concluido</span>
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
