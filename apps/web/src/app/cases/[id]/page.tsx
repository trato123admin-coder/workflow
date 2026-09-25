'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '../../../components/layout/AppShell';
import { CaseProcessesTable } from '../../../components/cases/CaseProcessesTable';
import { CaseHeader } from '../../../components/cases/CaseHeader';
import { createClient } from '../../../lib/supabase/client';
import { Lock, Clock, XCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import type { CaseItem, CaseProcessItem } from '@workflow/shared';

export default function CaseDetailPage() {
  const params = useParams();
  const caseId = params.id as string;

  const [caseData, setCaseData] = useState<CaseItem | null>(null);
  const [processes, setProcesses] = useState<CaseProcessItem[]>([]);
  const [statuses, setStatuses] = useState<
    { id: string; code: string; name: string; category: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const loadCaseData = useCallback(async () => {
    if (!caseId) return;
    setIsLoading(true);
    setUnauthorized(false);
    try {
      const supabase = createClient();

      const { data: cData, error: cErr } = await supabase
        .from('cases')
        .select(
          `
          *,
          client_person:persons!cases_client_person_id_fkey (
            id,
            person_type,
            identity_document_type,
            identity_document_number,
            first_name,
            last_name,
            legal_name
          ),
          case_assignments (
            assignment_type,
            user_id,
            profiles (
              email,
              first_name,
              last_name
            )
          )
        `,
        )
        .eq('id', caseId)
        .single();

      if (cErr || !cData) {
        setUnauthorized(true);
        return;
      }

      const assignments = cData.case_assignments as unknown as {
        assignment_type: string;
        user_id: string;
        profiles?: { email: string; first_name: string | null; last_name: string | null };
      }[];
      const resp = assignments?.find((a) => a.assignment_type === 'RESPONSIBLE');
      setCaseData({
        ...cData,
        current_progress: Number(cData.current_progress || 0),
        responsible: resp?.profiles
          ? {
              id: resp.user_id,
              email: resp.profiles.email,
              first_name: resp.profiles.first_name,
              last_name: resp.profiles.last_name,
            }
          : undefined,
      });

      const { data: sData } = await supabase
        .from('workflow_statuses')
        .select('id, code, name, category, keeps_previous_progress')
        .order('sort_order');
      if (sData) setStatuses(sData);

      const { data: pData, error: pErr } = await supabase
        .from('case_processes')
        .select(
          `
          id,
          case_id,
          case_model_process_id,
          sequence,
          weight,
          status_id,
          progress,
          manual_progress,
          is_applicable,
          definition:process_definitions (
            code,
            name,
            description
          ),
          status:workflow_statuses (
            id,
            code,
            name,
            semantic_category:category,
            color
          )
        `,
        )
        .eq('case_id', caseId)
        .order('sequence');

      if (pErr) throw pErr;
      setProcesses((pData as unknown as CaseProcessItem[]) || []);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al cargar expediente');
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadCaseData();
  }, [loadCaseData]);

  const handleAdvanceProcess = async (
    processId: string,
    statusId: string,
    manualProgress?: number,
  ) => {
    setIsUpdating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const supabase = createClient();
      const updatePayload: { status_id: string; manual_progress?: number } = {
        status_id: statusId,
      };
      if (manualProgress !== undefined) {
        updatePayload.manual_progress = manualProgress;
      }

      const { error } = await supabase
        .from('case_processes')
        .update(updatePayload)
        .eq('id', processId);

      if (error) throw error;

      setSuccessMessage('Proceso actualizado exitosamente.');
      await loadCaseData();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al actualizar proceso');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCloseCase = async () => {
    setIsUpdating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('close_case', { _case_id: caseId });
      if (error) throw error;
      setSuccessMessage('Expediente cerrado con éxito.');
      await loadCaseData();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'No se pudo cerrar el caso');
    } finally {
      setIsUpdating(false);
    }
  };

  if (unauthorized) {
    return (
      <AppShell breadcrumbs={[{ label: 'Inicio', href: '/cases' }, { label: 'Acceso Denegado' }]}>
        <div className="p-12 text-center max-w-md mx-auto space-y-4">
          <div className="p-3 rounded-full bg-destructive/10 text-destructive w-12 h-12 mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">
            Caso No Encontrado o Acceso Denegado
          </h2>
          <p className="text-xs text-muted-foreground">
            No tiene permisos para visualizar este caso por política de seguridad a nivel de fila
            (RLS). Solo los gestores y participantes asignados pueden acceder al expediente.
          </p>
          <Link
            href="/cases"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Casos</span>
          </Link>
        </div>
      </AppShell>
    );
  }

  const client = caseData?.client_person;
  const clientName = client
    ? client.person_type === 'JURIDICA'
      ? client.legal_name || 'Razón Social'
      : `${client.first_name || ''} ${client.last_name || ''}`.trim()
    : 'Sin cliente asignado';

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Inicio', href: '/cases' },
        { label: 'Casos', href: '/cases' },
        { label: caseData?.case_number || 'Expediente' },
      ]}
    >
      <div className="space-y-6">
        <CaseHeader
          caseData={caseData}
          clientName={clientName}
          isUpdating={isUpdating}
          onCloseCase={handleCloseCase}
        />

        {errorMessage && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>Operación bloqueada por regla de negocio o compuerta</span>
            </div>
            <p className="pl-6">{errorMessage}</p>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Procesos del Expediente ({processes.length})
            </h2>
            <span className="text-xs text-muted-foreground">
              Compuertas y dependencias activas (M1)
            </span>
          </div>

          <CaseProcessesTable
            processes={processes}
            workflowStatuses={statuses}
            onAdvanceProcess={handleAdvanceProcess}
            isUpdating={isUpdating}
          />
        </div>
      </div>
    </AppShell>
  );
}
