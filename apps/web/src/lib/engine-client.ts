import { createClient } from './supabase/client';
import type { UploadVersionResponse, DownloadUrlResponse } from '@workflow/shared';

export function getEngineUrl(): string {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_ENGINE_URL) {
    return process.env.NEXT_PUBLIC_ENGINE_URL;
  }
  return 'http://localhost:3001';
}

export interface UploadDocumentParams {
  caseDocumentId: string;
  file: File;
  changeSummary?: string;
  onColdStartNotice?: (isWakingUp: boolean) => void;
}

/**
 * Realiza la subida de un documento al Engine validando JWT y gestionando Cold-start de Render.
 */
export async function uploadDocumentToEngine(
  params: UploadDocumentParams
): Promise<UploadVersionResponse> {
  const supabase = createClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error('Debe iniciar sesión para subir documentos');
  }

  const formData = new FormData();
  formData.append('file', params.file);
  if (params.changeSummary) {
    formData.append('change_summary', params.changeSummary);
  }

  const engineUrl = getEngineUrl();
  const url = `${engineUrl}/v1/documents/case-documents/${params.caseDocumentId}/versions`;

  // Temporizador para avisar si el engine gratuito de Render está en cold-start (>3.5s)
  let coldStartTimer: NodeJS.Timeout | null = null;
  if (params.onColdStartNotice) {
    coldStartTimer = setTimeout(() => {
      params.onColdStartNotice?.(true);
    }, 3500);
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    if (coldStartTimer) {
      clearTimeout(coldStartTimer);
      params.onColdStartNotice?.(false);
    }

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.message || `Error en la subida (${response.status})`);
    }

    return json.data as UploadVersionResponse;
  } catch (err: unknown) {
    if (coldStartTimer) {
      clearTimeout(coldStartTimer);
      params.onColdStartNotice?.(false);
    }
    throw err;
  }
}

/**
 * Solicita una URL firmada de 60 segundos al Engine, auditando la descarga.
 */
export async function requestDocumentDownloadUrl(
  versionId: string,
  onColdStartNotice?: (isWakingUp: boolean) => void
): Promise<DownloadUrlResponse> {
  const supabase = createClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error('Debe iniciar sesión para descargar documentos');
  }

  const engineUrl = getEngineUrl();
  const url = `${engineUrl}/v1/downloads/${versionId}`;

  let coldStartTimer: NodeJS.Timeout | null = null;
  if (onColdStartNotice) {
    coldStartTimer = setTimeout(() => {
      onColdStartNotice(true);
    }, 3500);
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (coldStartTimer) {
      clearTimeout(coldStartTimer);
      onColdStartNotice?.(false);
    }

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.message || `Error al obtener enlace de descarga (${response.status})`);
    }

    return json.data as DownloadUrlResponse;
  } catch (err: unknown) {
    if (coldStartTimer) {
      clearTimeout(coldStartTimer);
      onColdStartNotice?.(false);
    }
    throw err;
  }
}
