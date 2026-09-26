'use client';

import React from 'react';
import { StatusBadge } from '../ui/StatusBadge';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Check,
  Pause,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import type { CaseProcessItem } from '@workflow/shared';

interface CaseKanbanBoardProps {
  processes: CaseProcessItem[];
  workflowStatuses: { id: string; code: string; name: string; category: string }[];
  onAdvanceProcess: (processId: string, statusId: string, progress?: number) => Promise<void>;
  isUpdating: boolean;
}

interface ColumnConfig {
  category: string;
  title: string;
  badgeCategory: 'neutral' | 'info' | 'waiting' | 'success';
}

const COLUMNS: ColumnConfig[] = [
  { category: 'NOT_STARTED', title: 'Por Iniciar', badgeCategory: 'neutral' },
  { category: 'IN_PROGRESS', title: 'En Trámite', badgeCategory: 'info' },
  { category: 'WAITING', title: 'En Espera', badgeCategory: 'waiting' },
  { category: 'DONE', title: 'Concluido', badgeCategory: 'success' },
];

export const CaseKanbanBoard: React.FC<CaseKanbanBoardProps> = ({
  processes,
  workflowStatuses,
  onAdvanceProcess,
  isUpdating,
}) => {
  const getStatusByCategory = (category: string) => {
    return workflowStatuses.find((s) => s.category === category);
  };

  const getProcessesByColumn = (category: string) => {
    return processes.filter((p) => {
      const cat = p.status?.semantic_category || 'NOT_STARTED';
      return cat === category;
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
      {COLUMNS.map((col) => {
        const colProcesses = getProcessesByColumn(col.category);
        return (
          <div
            key={col.category}
            className="p-3 rounded-2xl border border-border bg-muted/20 space-y-3 min-h-[360px] flex flex-col"
          >
            {/* Header de columna */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-foreground">{col.title}</span>
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground">
                  {colProcesses.length}
                </span>
              </div>
            </div>

            {/* Lista de tarjetas en columna */}
            <div className="space-y-2.5 flex-1">
              {colProcesses.length === 0 ? (
                <div className="h-32 rounded-xl border border-dashed border-border/60 flex items-center justify-center text-center p-3 text-[11px] text-muted-foreground">
                  Sin procesos en esta etapa
                </div>
              ) : (
                colProcesses.map((proc) => {
                  const hasUnsatisfiedDeps =
                    proc.dependencies?.some((d) => !d.is_satisfied) || false;

                  return (
                    <div
                      key={proc.id}
                      className="p-3 rounded-xl border border-border bg-card shadow-sm hover:shadow transition-all space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-muted-foreground">
                          Sec. {proc.sequence}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          Peso: {Number(proc.weight).toFixed(1)}%
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-xs text-foreground line-clamp-1">
                          {proc.definition?.name}
                        </h4>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {proc.definition?.code}
                        </span>
                      </div>

                      {/* Progreso del proceso */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                          <span>Progreso</span>
                          <span className="font-mono font-bold text-foreground">
                            {Number(proc.progress).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(0, proc.progress))}%` }}
                          />
                        </div>
                      </div>

                      {/* Dependencias y Compuertas */}
                      {proc.dependencies && proc.dependencies.length > 0 && (
                        <div className="pt-1.5 border-t border-border/60 text-[10px]">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            {hasUnsatisfiedDeps ? (
                              <span className="text-amber-600 flex items-center gap-1 font-semibold">
                                <ShieldAlert className="w-3 h-3" />
                                Compuerta M1: Requiere Sec.{' '}
                                {proc.dependencies
                                  .filter((d) => !d.is_satisfied)
                                  .map((d) => d.depends_on_sequence)
                                  .join(', ')}
                              </span>
                            ) : (
                              <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                                <CheckCircle2 className="w-3 h-3" /> Dependencias cumplidas
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Botones de Transición Rápida con Compuertas */}
                      <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-border/60">
                        {col.category !== 'IN_PROGRESS' && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => {
                              const s = getStatusByCategory('IN_PROGRESS');
                              if (s) onAdvanceProcess(proc.id, s.id);
                            }}
                            className="p-1.5 rounded border border-border hover:bg-muted text-[10px] font-semibold text-foreground flex items-center gap-1"
                            title="Mover a En Trámite"
                          >
                            <Play className="w-3 h-3 text-primary" />
                            <span>Iniciar</span>
                          </button>
                        )}

                        {col.category !== 'WAITING' && col.category !== 'DONE' && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => {
                              const s = getStatusByCategory('WAITING');
                              if (s) onAdvanceProcess(proc.id, s.id);
                            }}
                            className="p-1.5 rounded border border-border hover:bg-muted text-[10px] font-semibold text-muted-foreground flex items-center gap-1"
                            title="Pausar en Espera"
                          >
                            <Pause className="w-3 h-3" />
                          </button>
                        )}

                        {col.category !== 'DONE' && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => {
                              const s = getStatusByCategory('DONE');
                              if (s) onAdvanceProcess(proc.id, s.id, 100);
                            }}
                            className="p-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 text-[10px] font-semibold flex items-center gap-1"
                            title="Concluir Proceso"
                          >
                            <Check className="w-3 h-3" />
                            <span>Completar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
