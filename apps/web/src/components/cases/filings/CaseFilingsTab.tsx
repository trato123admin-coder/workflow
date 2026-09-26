'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../lib/supabase/client';
import { FilingModal } from './FilingModal';
import { StatusBadge, type StatusCategory } from '../../ui/StatusBadge';
import { EmptyState } from '../../ui/EmptyState';
import { getFilingUrgency, getRemainingBusinessDays } from '@workflow/shared';
import {
  ExternalLink,
  Plus,
  Loader2,
  Calendar,
  Building2,
  Edit2,
  FileCheck,
} from 'lucide-react';
import type { CaseFiling } from '@workflow/shared';

interface CaseFilingsTabProps {
  caseId: string;
}

interface FilingWithRelations extends CaseFiling {
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

export const CaseFilingsTab: React.FC<CaseFilingsTabProps> = ({ caseId }) => {
  const [filings, setFilings] = useState<FilingWithRelations[]>([]);
  const [entities, setEntities] = useState<Array<{ id: string; name: string; entity_type: string }>>([]);
  const [processes, setProcesses] = useState<Array<{ id: string; name: string }>>([]);
  const [statuses, setStatuses] = useState<Array<{ code: string; label: string; metadata?: Record<string, unknown> }>>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [publicationDays, setPublicationDays] = useState<number>(15);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFiling, setEditingFiling] = useState<CaseFiling | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();

      const [filingsRes, entitiesRes, processesRes, statusesRes, holidaysRes, settingsRes] =
        await Promise.all([
          supabase
            .from('case_filings')
            .select(`
              *,
              external_entity:external_entities (id, name, entity_type, city),
              case_process:case_processes (id, workflow_status:workflow_statuses(name))
            `)
            .eq('case_id', caseId)
            .order('created_at', { ascending: false }),
          supabase
            .from('external_entities')
            .select('id, name, entity_type')
            .eq('is_active', true)
            .order('name', { ascending: true }),
          supabase
            .from('case_processes')
            .select('id, workflow_status:workflow_statuses(name)')
            .eq('case_id', caseId),
          supabase
            .from('catalog_items')
            .select('code, label, metadata')
            .eq('catalog_code', 'filing_statuses')
            .eq('is_active', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('holidays')
            .select('date')
            .eq('is_active', true),
          supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'filings.publication_wait_business_days')
            .maybeSingle(),
        ]);

      if (filingsRes.error) throw filingsRes.error;

      setFilings((filingsRes.data as unknown as FilingWithRelations[]) || []);
      setEntities(entitiesRes.data || []);

      const pList = (processesRes.data || []) as unknown as Array<{
        id: string;
        workflow_status?: { name?: string } | Array<{ name?: string }> | null;
      }>;
      setProcesses(
        pList.map((p) => {
          const ws = Array.isArray(p.workflow_status) ? p.workflow_status[0] : p.workflow_status;
          return {
            id: p.id,
            name: ws?.name || 'Proceso',
          };
        }),
      );

      setStatuses(statusesRes.data || []);
      setHolidays((holidaysRes.data || []).map((h: { date: string }) => h.date));
      if (settingsRes.data?.value && typeof settingsRes.data.value === 'number') {
        setPublicationDays(settingsRes.data.value);
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al cargar trámites externos');
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getStatusCategory = (statusCode: string): StatusCategory => {
    const item = statuses.find((s) => s.code === statusCode);
    const cat = item?.metadata?.category as string | undefined;
    if (cat === 'DONE') return 'success';
    if (cat === 'OBSERVED') return 'warning';
    if (cat === 'REJECTED') return 'danger';
    if (cat === 'SUBMITTED') return 'info';
    return 'neutral';
  };

  const getStatusLabel = (statusCode: string): string => {
    return statuses.find((s) => s.code === statusCode)?.label || statusCode;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-primary" />
            <span>Trámites Externos y Registro Notarial / SUNARP</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Gestión de kardex, oficios y publicaciones con plazos calculados en días hábiles.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingFiling(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nuevo Trámite</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs">
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div className="p-12 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-xs">Cargando trámites del expediente...</p>
        </div>
      ) : filings.length === 0 ? (
        <EmptyState
          icon={<ExternalLink className="w-8 h-8 text-muted-foreground" />}
          title="Sin trámites externos registrados"
          description="Este caso aún no cuenta con trámites ante notarías, registros públicos u otras entidades."
        />
      ) : (
        <div className="space-y-3">
          {filings.map((filing) => {
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

            return (
              <div
                key={filing.id}
                className="p-4 rounded-xl border border-border bg-card text-card-foreground shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
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
                    onClick={() => {
                      setEditingFiling(filing);
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
                    title="Editar trámite"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <FilingModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingFiling(null);
        }}
        onSuccess={loadData}
        caseId={caseId}
        filing={editingFiling}
        processes={processes}
        entities={entities}
        statuses={statuses}
        publicationWaitDays={publicationDays}
        holidays={holidays}
      />
    </div>
  );
};
