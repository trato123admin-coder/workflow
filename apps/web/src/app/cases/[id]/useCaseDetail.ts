import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../lib/supabase/client';
import type { CaseItem, CaseProcessItem } from '@workflow/shared';

export interface WorkflowStatusOption {
  id: string;
  code: string;
  name: string;
  category: string;
  keeps_previous_progress?: boolean;
}

export function useCaseDetail(caseId: string) {
  const [caseData, setCaseData] = useState<CaseItem | null>(null);
  const [processes, setProcesses] = useState<CaseProcessItem[]>([]);
  const [statuses, setStatuses] = useState<WorkflowStatusOption[]>([]);
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
        .select(`
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
        `)
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
        .select(`
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
        `)
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

  return {
    caseData,
    processes,
    statuses,
    isLoading,
    isUpdating,
    errorMessage,
    successMessage,
    unauthorized,
    handleAdvanceProcess,
    handleCloseCase,
  };
}
