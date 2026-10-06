/**
 * engine-jobs-client.ts — Web client for Engine approval and job queue endpoints.
 *
 * Sprint 8 (S8-01, S8-02, S8-06, S8-07).
 */

import { createClient } from './supabase/client';
import { getEngineUrl } from './engine-client';

async function getAuthToken(): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Debe iniciar sesión para realizar esta operación');
  }
  return session.access_token;
}

/**
 * Aprueba un documento generado legalmente (S7-06, S8-06).
 */
export async function approveGeneratedDocument(docId: string): Promise<void> {
  const token = await getAuthToken();
  const engineUrl = getEngineUrl();
  const res = await fetch(`${engineUrl}/v1/generated-documents/${docId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.message || 'Error al aprobar documento');
  }
}

/**
 * Rechaza un documento generado con motivo obligatorio (S7-06, S8-06).
 */
export async function rejectGeneratedDocument(docId: string, reason: string): Promise<void> {
  const token = await getAuthToken();
  const engineUrl = getEngineUrl();
  const res = await fetch(`${engineUrl}/v1/generated-documents/${docId}/reject`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.message || 'Error al rechazar documento');
  }
}

/**
 * Dispara un ciclo manual de tick en la cola de trabajos (S8-01, S8-07).
 */
export async function triggerJobsTick(source = 'manual_ui'): Promise<Record<string, unknown>> {
  const token = await getAuthToken();
  const engineUrl = getEngineUrl();
  const res = await fetch(`${engineUrl}/v1/jobs/tick`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Error al ejecutar tick');
  return json;
}

/**
 * Reintenta un trabajo en estado DEAD o FAILED vía RPC de Supabase directo con la sesión del usuario (D4).
 */
export async function retryJob(jobId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('retry_job', { p_job_id: jobId });
  if (error) {
    throw new Error(error.message || 'Error al reintentar trabajo');
  }
}
