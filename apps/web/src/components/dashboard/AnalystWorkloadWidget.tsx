'use client';

import React from 'react';
import { Users, AlertCircle, CheckCircle } from 'lucide-react';
import type { AnalystWorkload } from '@workflow/shared';

interface AnalystWorkloadWidgetProps {
  workloads: AnalystWorkload[];
}

export const AnalystWorkloadWidget: React.FC<AnalystWorkloadWidgetProps> = ({ workloads }) => {
  const maxActive = Math.max(1, ...workloads.map((w) => w.activeCases));

  return (
    <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold text-foreground">Carga y Productividad por Gestor</h3>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          {workloads.length} analistas
        </span>
      </div>

      {workloads.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No hay asignaciones registradas aún.
        </div>
      ) : (
        <div className="divide-y divide-border -mx-1">
          {workloads.map((w) => {
            const loadPercent = (w.activeCases / maxActive) * 100;
            return (
              <div key={w.userId} className="p-3 space-y-2 hover:bg-muted/30 rounded-xl transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-foreground">{w.name}</p>
                    <p className="text-[10px] text-muted-foreground">{w.email}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="text-foreground" title="Casos activos">
                      <strong>{w.activeCases}</strong> act.
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1" title="Finalizados">
                      <CheckCircle className="w-3 h-3" />
                      {w.completedCases}
                    </span>
                    {w.overdueCases > 0 && (
                      <span className="text-destructive font-bold flex items-center gap-1" title="Vencidos">
                        <AlertCircle className="w-3 h-3" />
                        {w.overdueCases}
                      </span>
                    )}
                  </div>
                </div>

                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      w.overdueCases > 0 ? 'bg-amber-500' : 'bg-primary'
                    }`}
                    style={{ width: `${Math.max(loadPercent > 0 ? 5 : 0, loadPercent)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
