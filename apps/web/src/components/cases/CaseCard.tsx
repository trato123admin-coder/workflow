'use client';

import React from 'react';
import Link from 'next/link';
import { StatusBadge } from '../ui/StatusBadge';
import { Lock, ArrowRight, User } from 'lucide-react';
import type { CaseItem } from '@workflow/shared';

interface CaseCardProps {
  caseItem: CaseItem;
}

export const CaseCard: React.FC<CaseCardProps> = ({ caseItem }) => {
  const clientName = caseItem.client_person
    ? caseItem.client_person.person_type === 'JURIDICA'
      ? caseItem.client_person.legal_name || 'Empresa'
      : `${caseItem.client_person.first_name || ''} ${caseItem.client_person.last_name || ''}`.trim()
    : 'Sin cliente asignado';

  const progress = Number(caseItem.current_progress || 0);

  const priorityColors: Record<string, string> = {
    URGENT: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
    HIGH: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    NORMAL: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    LOW: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <div className="p-4 rounded-xl border border-border bg-card hover:shadow-md transition-all space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {caseItem.case_number}
          </span>
          {caseItem.is_confidential && (
            <span className="p-0.5 rounded bg-destructive/10 text-destructive text-[10px] font-semibold flex items-center gap-0.5" title="Expediente Confidencial">
              <Lock className="w-3 h-3" />
            </span>
          )}
        </div>
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
            priorityColors[caseItem.priority] || priorityColors.NORMAL
          }`}
        >
          {caseItem.priority}
        </span>
      </div>

      <div>
        <Link
          href={`/cases/${caseItem.id}`}
          className="font-bold text-xs text-foreground hover:text-primary transition-colors line-clamp-1"
        >
          {caseItem.title}
        </Link>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
          <User className="w-3 h-3 shrink-0" />
          <span className="truncate">{clientName}</span>
        </p>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between items-center text-[10px] text-muted-foreground">
          <span>Avance</span>
          <span className="font-mono font-bold text-foreground">{progress.toFixed(1)}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border text-[11px]">
        <StatusBadge
          category={caseItem.status === 'COMPLETED' ? 'success' : 'info'}
          label={caseItem.status}
        />
        <Link
          href={`/cases/${caseItem.id}`}
          className="inline-flex items-center gap-1 text-primary font-semibold hover:underline"
        >
          <span>Ver ficha</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
};
