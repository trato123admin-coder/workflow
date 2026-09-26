'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../lib/supabase/client';
import { FilingModal } from './FilingModal';
import { FilingCard, type FilingWithRelations } from './FilingCard';
import { EmptyState } from '../../ui/EmptyState';
import {
  ExternalLink,
  Plus,
  Loader2,
} from 'lucide-react';
import type { CaseFiling } from '@workflow/shared';

interface CaseFilingsTabProps {
  caseId: string;
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
          {filings.map((filing) => (
            <FilingCard
              key={filing.id}
              filing={filing}
              statuses={statuses}
              holidays={holidays}
              onEdit={() => {
                setEditingFiling(filing);
                setIsModalOpen(true);
              }}
            />
          ))}
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
