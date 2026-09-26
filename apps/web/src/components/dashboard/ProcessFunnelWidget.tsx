'use client';

import React from 'react';
import { Layers } from 'lucide-react';

export interface FunnelStage {
  sequence: number;
  code: string;
  name: string;
  count: number;
}

interface ProcessFunnelWidgetProps {
  stages: FunnelStage[];
  totalActiveCases: number;
}

export const ProcessFunnelWidget: React.FC<ProcessFunnelWidgetProps> = ({
  stages,
  totalActiveCases,
}) => {
  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold text-foreground">Embudo de Procesos Sucesorios</h3>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          {totalActiveCases} en curso
        </span>
      </div>

      <div className="space-y-2.5">
        {stages.map((stage) => {
          const widthPercent = (stage.count / maxCount) * 100;
          return (
            <div key={stage.code} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate pr-2 font-medium">
                  {stage.sequence}. {stage.name}
                </span>
                <span className="font-mono font-bold text-foreground shrink-0">
                  {stage.count}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full bg-primary/80 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(widthPercent > 0 ? 4 : 0, widthPercent)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
