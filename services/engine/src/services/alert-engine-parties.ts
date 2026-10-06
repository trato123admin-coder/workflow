/**
 * alert-engine-parties.ts — Alert rules for case parties: missing heir docs.
 *
 * Sprint 8 (S8-04):
 * - Herederos sin documentos obligatorios (DNI, partida, etc.).
 * - Sin PII en títulos o cuerpos de alertas (sin person.full_name).
 * - Metadatos limitados estrictamente a IDs.
 * - Severidad: 'warning', notificationType: 'HEIR_MISSING_DOCS'.
 * - Filtra casos activos por categorías semánticas de case_statuses (ACTIVE).
 * - Documentos filtrados con is_active = true, is_required = true y status = 'PENDING'.
 * - Deuda técnica documentada: el catálogo party_roles en 20260924130000_settings_seeds.sql
 *   no define categorías semánticas en su metadata; se filtra explícitamente por el código 'HEREDERO'.
 * - Tolerancia a errores de destinatario: 42501/23503 cuenta en skipped y continúa; otros lanzan al finalizar.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyBaseLogger } from 'fastify';
import type { ConsoleLikeLogger } from './jobs-worker.js';
import {
  NotificationRpcError,
  getTodayLima,
  getCaseAssignees,
  sendAlertNotification,
  buildDedupe,
} from './alert-engine-common.js';
import { getCaseStatusCategoryCodes } from './alert-engine-cases.js';
import type { AlertCountSummary } from './alert-engine-filings.js';

export async function checkMissingHeirDocsAlerts(
  supabase: SupabaseClient,
  logger: FastifyBaseLogger | ConsoleLikeLogger,
): Promise<AlertCountSummary> {
  const today = getTodayLima();
  const { activeCodes } = await getCaseStatusCategoryCodes(supabase);

  const { data: parties, error } = await supabase
    .from('case_parties')
    .select(
      `
      id, case_id, person_id,
      cases!inner (id, case_number, status)
    `,
    )
    .eq('is_active', true)
    .eq('party_role', 'HEREDERO')
    .in('cases.status', activeCodes);

  if (error || !parties) {
    logger.error({ error }, 'Error al consultar herederos para verificación de documentos');
    throw new Error(`Fallo al consultar herederos [${error?.code ?? 'DB_ERROR'}]`);
  }

  let alertsCreated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const party of parties) {
    const { count, error: docErr } = await supabase
      .from('case_documents')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', party.case_id)
      .eq('person_id', party.person_id)
      .eq('is_required', true)
      .eq('is_active', true)
      .eq('status', 'PENDING');

    if (docErr) {
      throw new Error(
        `Fallo al consultar documentos pendientes de heredero [${docErr.code ?? 'DB_ERROR'}]`,
      );
    }

    if (!count || count <= 0) continue;

    const caseInfo = party.cases as unknown as { case_number: string };
    const assignees = await getCaseAssignees(supabase, party.case_id as string);
    const recipientId = assignees.responsibleUserId ?? assignees.lawyerUserId;
    if (!recipientId) continue;

    const dedupeKey = buildDedupe('missing_heir_docs', party.id as string, recipientId, today);
    try {
      const sent = await sendAlertNotification(
        supabase,
        {
          userId: recipientId,
          title: 'Heredero con documentos obligatorios pendientes',
          body: `Un heredero del expediente ${caseInfo.case_number} tiene ${count} documento(s) obligatorio(s) pendiente(s) de carga.`,
          notificationType: 'HEIR_MISSING_DOCS',
          severity: 'warning',
          caseId: party.case_id as string,
          entityType: 'case_parties',
          entityId: party.id as string,
          actionUrl: `/cases/${party.case_id}/parties`,
          dedupeKey,
          metadata: {
            case_id: party.case_id,
            party_id: party.id,
            person_id: party.person_id,
            pending_docs_count: count,
          },
        },
        logger,
      );
      if (sent) alertsCreated++;
    } catch (err: unknown) {
      if (err instanceof NotificationRpcError && (err.code === '42501' || err.code === '23503')) {
        logger.warn(
          { code: err.code, caseId: party.case_id },
          'Alerta omitida: destinatario sin acceso o inexistente',
        );
        skipped++;
      } else {
        errors.push(err instanceof NotificationRpcError ? err.code : 'UNKNOWN');
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Fallo en alertas de documentos de heredero: ${errors.length} error(es) [${[...new Set(errors)].join(',')}]`,
    );
  }

  return { checked: parties.length, alertsCreated, skipped };
}
