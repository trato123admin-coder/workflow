'use client';

import React from 'react';
import { StatusBadge, type StatusCategory } from '../../ui/StatusBadge';
import { getFilingUrgency, getRemainingBusinessDays } from '@workflow/shared';
import { Building2, Calendar, Edit2, FileCheck } from 'lucide-react';
import type { CaseFiling } from '@workflow/shared';

export interface FilingWithRelations extends CaseFiling {
  external_entity?: {
    id: string;
    name: string;
    entity_type: string;
    city?: string;
  } | null;
  case_process?: {
    id: string;
    workflow_status?: {
      name: string;
    } | null;
  } | null;
}

interface FilingCardProps {
  filing: FilingWithRelations;
  statuses: Array<{ code: string; label: string; metadata?: Record<string, unknown> }>;
  holidays: string[];
  onEdit: () => void;
}

export const FilingCard: React.FC<FilingCardProps> = ({
  filing,
  statuses,
  holidays,
  onEdit,
}) => {
  const itemStatus = statuses.find((s) => s.code === filing.status);
  const statusCat = (itemStatus?.metadata?.category as string) || undefined;
  const urgency = getFilingUrgency(
    {
      statusCategory: statusCat,
      response_due_date: filing.response_due_date,
    },
    holidays,
  );

  let remainingDays: number | null = null;
  if (filing.response_due_date && urgency !== 'DONE') {
    remainingDays = getRemainingBusinessDays(filing.response_due_date, holidays);
  }

  const getStatusCategory = (code: string): StatusCategory => {
    const item = statuses.find((s) => s.code === code);
    const cat = item?.metadata?.category as string;
    if (cat === 'DONE') return 'success';
    if (cat === 'REJECTED') return 'danger';
    if (cat === 'IN_PROGRESS') return 'info';
    return 'neutral';
  };

  const getStatusLabel = (code: string) => {
    return statuses.find((s) => s.code === code)?.label || code;
  };

  return (
    <div className="p-4 rounded-xl border border-border bg-card text-card-foreground shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="space-y-2 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-sm text-foreground">
            {filing.reference_number || 'Trámite Sin N.º'}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
            {filing.filing_kind}
          </span>
          <StatusBadge
            category={getStatusCategory(filing.status)}
            label={getStatusLabel(filing.status)}
            size="sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{filing.external_entity?.name || 'Entidad no especificada'}</span>
            {filing.external_entity?.city && (
              <span className="text-[10px]">({filing.external_entity.city})</span>
            )}
          </div>
          {filing.case_process?.workflow_status?.name && (
            <div className="flex items-center gap-1">
              <FileCheck className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Proceso: {filing.case_process.workflow_status.name}</span>
            </div>
          )}
          {filing.filed_at && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Presentado: {filing.filed_at.substring(0, 10)}</span>
            </div>
          )}
        </div>

        {filing.notes && (
          <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/40">
            {filing.notes}
          </p>
        )}
      </div>

      {/* Plazos y Urgencia */}
      <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-border pt-3 md:pt-0 md:pl-4 shrink-0">
        <div className="text-right">
          <div className="text-[11px] text-muted-foreground">Vencimiento</div>
          <div className="text-xs font-bold text-foreground">
            {filing.response_due_date ? filing.response_due_date.substring(0, 10) : 'Sin plazo'}
          </div>
          <div className="mt-1">
            {urgency === 'EXPIRED' && (
              <StatusBadge
                category="danger"
                label={`Vencido (${Math.abs(remainingDays ?? 0)} d. útiles)`}
                size="sm"
              />
            )}
            {urgency === 'EXPIRING_SOON' && (
              <StatusBadge
                category="warning"
                label={`Por vencer (${remainingDays} d. útiles)`}
                size="sm"
              />
            )}
            {urgency === 'ON_TRACK' && (
              <StatusBadge
                category="info"
                label={remainingDays !== null ? `En plazo (${remainingDays} d. útiles)` : 'En plazo'}
                size="sm"
              />
            )}
            {urgency === 'DONE' && (
              <StatusBadge category="neutral" label="Concluido" size="sm" />
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
          title="Editar trámite"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
