import React from 'react';
import { cn } from '../../lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: {
    value: string | number;
    trend: 'up' | 'down' | 'neutral';
    label?: string;
  };
  description?: string;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  icon,
  change,
  description,
  className,
}) => {
  return (
    <div
      className={cn(
        'bg-card text-card-foreground rounded-xl border border-border p-5 shadow-sm transition-all hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>

        {change && (
          <span
            className={cn(
              'inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded',
              change.trend === 'up' &&
                'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400',
              change.trend === 'down' &&
                'text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400',
              change.trend === 'neutral' &&
                'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400',
            )}
          >
            {change.trend === 'up' && <TrendingUp className="w-3 h-3 mr-0.5" />}
            {change.trend === 'down' && <TrendingDown className="w-3 h-3 mr-0.5" />}
            {change.trend === 'neutral' && <Minus className="w-3 h-3 mr-0.5" />}
            {change.value}
          </span>
        )}
      </div>

      {(change?.label || description) && (
        <p className="mt-1 text-xs text-muted-foreground">
          {change?.label ? `${change.label}` : description}
        </p>
      )}
    </div>
  );
};
