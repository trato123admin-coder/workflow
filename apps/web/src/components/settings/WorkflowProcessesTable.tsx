'use client';

import React from 'react';
import { Lock } from 'lucide-react';

export interface ModelVersionProcess {
  id: string;
  sequence: number;
  weight: number;
  sla_days: number;
  definition: {
    code: string;
    name: string;
    description: string | null;
  };
  deps: {
    depends_on_sequence: number;
  }[];
}

interface WorkflowProcessesTableProps {
  processes: ModelVersionProcess[];
  onAttemptEdit: () => void;
}

export const WorkflowProcessesTable: React.FC<WorkflowProcessesTableProps> = ({
  processes,
  onAttemptEdit,
}) => {
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
          <tr>
            <th className="py-2.5 px-3 w-12 text-center">Sec.</th>
            <th className="py-2.5 px-3">Proceso</th>
            <th className="py-2.5 px-3 w-20 text-right">Peso (%)</th>
            <th className="py-2.5 px-3 w-20 text-center">SLA</th>
            <th className="py-2.5 px-3 w-24 text-center">Inmutabilidad</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {processes.map((proc) => (
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
                {proc.weight.toFixed(2)}%
              </td>
              <td className="py-2 px-3 text-center text-muted-foreground">{proc.sla_days} d</td>
              <td className="py-2 px-3 text-center">
                <button
                  type="button"
                  onClick={onAttemptEdit}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border hover:bg-muted/80 cursor-not-allowed"
                >
                  <Lock className="w-3 h-3" />
                  <span>Bloqueado</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
