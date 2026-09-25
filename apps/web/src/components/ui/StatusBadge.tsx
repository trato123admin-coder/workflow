import React from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle2, AlertTriangle, XCircle, Info, Clock, CircleDot } from 'lucide-react';

export type StatusCategory = 'success' | 'warning' | 'danger' | 'info' | 'waiting' | 'neutral';

interface StatusBadgeProps {
  category: StatusCategory;
  label: string;
  icon?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

const CATEGORY_STYLES: Record<
  StatusCategory,
  { bg: string; text: string; border: string; defaultIcon: React.ReactNode }
> = {
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    defaultIcon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    defaultIcon: <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  },
  danger: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
    defaultIcon: <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    defaultIcon: <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  },
  waiting: {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    defaultIcon: <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  },
  neutral: {
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
    defaultIcon: <CircleDot className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  category,
  label,
  icon,
  className,
  size = 'md',
}) => {
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.neutral;
  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs gap-1' : 'px-2.5 py-1 text-xs font-medium gap-1.5';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border leading-none transition-colors',
        sizeClasses,
        style.bg,
        style.text,
        style.border,
        className,
      )}
    >
      {icon ?? style.defaultIcon}
      <span>{label}</span>
    </span>
  );
};
