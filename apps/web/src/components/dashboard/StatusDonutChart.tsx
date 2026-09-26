'use client';

import React from 'react';
import type { StatusDistribution, WorkflowStatusCategory } from '@workflow/shared';

interface StatusDonutChartProps {
  distribution: StatusDistribution;
}

const CATEGORY_COLORS: Record<
  WorkflowStatusCategory,
  { stroke: string; bg: string; text: string }
> = {
  NOT_STARTED: {
    stroke: '#94a3b8',
    bg: 'bg-slate-400 dark:bg-slate-500',
    text: 'text-slate-600 dark:text-slate-300',
  },
  IN_PROGRESS: {
    stroke: '#3b82f6',
    bg: 'bg-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
  },
  WAITING: {
    stroke: '#f59e0b',
    bg: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
  },
  REWORK: {
    stroke: '#f43f5e',
    bg: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
  },
  DONE: {
    stroke: '#10b981',
    bg: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
};

export const StatusDonutChart: React.FC<StatusDonutChartProps> = ({ distribution }) => {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  return (
    <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-foreground">Distribución de Estados</h3>
        <span className="text-[11px] font-mono text-muted-foreground">
          Total: {distribution.total} expedientes
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
        {/* Gráfico SVG de dona interactivo */}
        <div className="relative w-40 h-40 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Círculo base de fondo */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              className="stroke-muted"
              strokeWidth="12"
              fill="transparent"
            />
            {/* Segmentos por categoría */}
            {distribution.categories.map((cat) => {
              if (cat.count === 0 || distribution.total === 0) return null;
              const dashLength = (cat.count / distribution.total) * circumference;
              const currentOffset = accumulatedOffset;
              accumulatedOffset += dashLength;

              return (
                <circle
                  key={cat.category}
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke={CATEGORY_COLORS[cat.category]?.stroke || '#94a3b8'}
                  strokeWidth="12"
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={-currentOffset}
                  fill="transparent"
                  className="transition-all duration-500 hover:opacity-80"
                />
              );
            })}
          </svg>

          {/* Texto central con total */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold font-mono text-foreground">
              {distribution.total}
            </span>
            <span className="text-[10px] text-muted-foreground">Casos</span>
          </div>
        </div>

        {/* Leyenda con porcentaje y conteo exacto */}
        <div className="flex-1 w-full space-y-2">
          {distribution.categories.map((cat) => (
            <div key={cat.category} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    CATEGORY_COLORS[cat.category]?.bg || 'bg-muted'
                  }`}
                />
                <span className="text-muted-foreground">{cat.label}</span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span className="font-semibold text-foreground">{cat.count}</span>
                <span className="text-[11px] text-muted-foreground w-12 text-right">
                  ({cat.percentage}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
