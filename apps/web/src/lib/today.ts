/**
 * apps/web/src/lib/today.ts — Helper utilities & data fetcher for Qué Hago Hoy (/today)
 *
 * Sprint 8 (S8-03).
 */

export interface TodayItem {
  id: string;
  category: 'FILING' | 'ALERT' | 'STAGNANT' | 'OBSERVED_DOC';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  caseId?: string;
  caseNumber?: string;
  actionUrl: string;
  createdAt?: string;
}

export function extractNotifiedFilingIds(
  notifs: Array<{ entity_type?: string | null; entity_id?: string | null }>,
): Set<string> {
  const ids = new Set<string>();
  for (const n of notifs) {
    if ((n.entity_type === 'case_filings' || n.entity_type === 'FILING') && n.entity_id) {
      ids.add(n.entity_id);
    }
  }
  return ids;
}

import type { SupabaseClient } from '@supabase/supabase-js';

export type TodaySupabaseClient = SupabaseClient;

export async function fetchTodayItems(supabase: TodaySupabaseClient): Promise<TodayItem[]> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const collected: TodayItem[] = [];

  // 1. Obtener usuario autenticado
  const { data: userRes, error: userError } = await supabase.auth.getUser();
  if (userError || !userRes?.user) {
    throw new Error('No se pudo identificar al usuario autenticado');
  }
  const currentUserId = userRes.user.id;

  // 2. Notificaciones no leídas activas del usuario
  const { data: notifs, error: notifsError } = await supabase
    .from('notifications')
    .select('*')
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(25);

  if (notifsError) {
    throw new Error(`Error al consultar notificaciones: ${notifsError.message}`);
  }

  // Rastrear IDs de trámites que ya cuentan con una notificación activa para deduplicar
  const notifiedFilingIds = extractNotifiedFilingIds(notifs ?? []);

  for (const n of notifs ?? []) {
    const sev =
      n.severity === 'critical' ? 'critical' : n.severity === 'warning' ? 'warning' : 'info';
    collected.push({
      id: `notif-${n.id}`,
      category: 'ALERT',
      severity: sev,
      title: n.title,
      description: n.body,
      caseId: n.case_id,
      actionUrl: n.action_url || (n.case_id ? `/cases/${n.case_id}` : '/dashboard'),
      createdAt: n.created_at,
    });
  }

  // 3. Casos asignados activos al usuario (ended_at is null)
  const { data: assignments, error: assignError } = await supabase
    .from('case_assignments')
    .select('case_id')
    .eq('user_id', currentUserId)
    .is('ended_at', null);

  if (assignError) {
    throw new Error(`Error al consultar asignaciones del usuario: ${assignError.message}`);
  }

  const assignedCaseIds = Array.from(
    new Set((assignments ?? []).map((a: { case_id: string }) => a.case_id).filter(Boolean)),
  );

  // Si el usuario no tiene casos asignados, solo ve sus notificaciones personales
  if (assignedCaseIds.length > 0) {
    // 4. Trámites externos con vencimiento próximo o vencido de sus casos asignados
    const { data: catItems, error: catError } = await supabase
      .from('catalog_items')
      .select('code, metadata')
      .eq('catalog_code', 'filing_statuses')
      .eq('is_active', true);

    if (catError) {
      throw new Error(`Error al consultar catálogo de trámites: ${catError.message}`);
    }

    const activeFilingCodes = (catItems ?? [])
      .filter((item: { metadata?: { category?: string } | null }) => {
        const meta = item.metadata;
        const cat = meta?.category?.toUpperCase();
        return cat && cat !== 'DONE' && cat !== 'REJECTED';
      })
      .map((item: { code: string }) => item.code);

    if (activeFilingCodes.length === 0) {
      throw new Error('No se encontraron estados activos en catálogo filing_statuses');
    }

    const { data: filings, error: filingsError } = await supabase
      .from('case_filings')
      .select(
        `
        id, case_id, filing_kind, reference_number, response_due_date, status,
        cases!inner (id, case_number, title)
      `,
      )
      .in('case_id', assignedCaseIds)
      .in('status', activeFilingCodes)
      .lte('response_due_date', today)
      .limit(20);

    if (filingsError) {
      throw new Error(`Error al consultar trámites pendientes: ${filingsError.message}`);
    }

    for (const f of filings ?? []) {
      if (notifiedFilingIds.has(f.id)) continue;

      const caseInfo = f.cases as unknown as { case_number: string };
      collected.push({
        id: `filing-${f.id}`,
        category: 'FILING',
        severity: 'critical',
        title: `Trámite ${f.filing_kind} (${f.reference_number ?? 'S/N'})`,
        description: `Plazo de respuesta vencido o vence hoy (Exp. ${caseInfo.case_number}).`,
        caseId: f.case_id,
        caseNumber: caseInfo.case_number,
        actionUrl: `/cases/${f.case_id}/filings`,
      });
    }

    // 5. Documentos observados pendientes de corrección de sus casos asignados
    const { data: observedDocs, error: docsError } = await supabase
      .from('case_documents')
      .select(
        `
        id, case_id, notes,
        document_types (name),
        cases!inner (id, case_number)
      `,
      )
      .in('case_id', assignedCaseIds)
      .eq('status', 'OBSERVED')
      .eq('is_active', true)
      .limit(15);

    if (docsError) {
      throw new Error(`Error al consultar documentos observados: ${docsError.message}`);
    }

    for (const d of observedDocs ?? []) {
      const docType = d.document_types as unknown as { name?: string } | null;
      const caseInfo = d.cases as unknown as { case_number: string };
      collected.push({
        id: `doc-${d.id}`,
        category: 'OBSERVED_DOC',
        severity: 'warning',
        title: `Documento observado: ${docType?.name ?? 'Documento'}`,
        description: d.notes
          ? `Observación: ${d.notes}`
          : `Requiere subsanación en el exp. ${caseInfo.case_number}.`,
        caseId: d.case_id,
        caseNumber: caseInfo.case_number,
        actionUrl: `/cases/${d.case_id}/documents`,
      });
    }
  }

  // Ordenar por severidad: critical -> warning -> info
  const orderMap = { critical: 0, warning: 1, info: 2 };
  collected.sort((a, b) => orderMap[a.severity] - orderMap[b.severity]);
  return collected;
}
