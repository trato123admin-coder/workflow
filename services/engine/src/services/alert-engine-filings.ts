/**
 * alert-engine-filings.ts — Alert rules for external filings and document expiration.
 *
 * Sprint 8 (S8-04, D8):
 * - Trámites por vencer / vencidos computados en días útiles (D8: getRemainingBusinessDays + tabla holidays).
 * - Documentos por caducar / caducados computados en días útiles (D8: getRemainingBusinessDays + tabla holidays).
 * - Filtrado de trámites por categoría semántica de catálogo filing_statuses (no lista fija de códigos).
 * - Severidades estrictamente compatibles con la BD: 'info' | 'warning' | 'critical'.
 * - Tipos canónicos: FILING_DUE_SOON / FILING_OVERDUE, DOCUMENT_EXPIRING / DOCUMENT_EXPIRED.
 * - Sin PII (sin c.title ni datos de personas).
 * - Tolerancia a errores de destinatario: 42501/23503 cuenta en skipped y continúa; otros lanzan al finalizar.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyBaseLogger } from 'fastify';
import { getRemainingBusinessDays } from '@workflow/shared';
import type { ConsoleLikeLogger } from './jobs-worker.js';
import {
  NotificationRpcError,
  getTodayLima,
  getCaseAssignees,
  sendAlertNotification,
  buildDedupe,
} from './alert-engine-common.js';
import { getHolidayDates } from './alert-engine-cases.js';
import { getSystemSettingsConfig } from './settings-reader.js';

export interface AlertCountSummary {
  checked: number;
  alertsCreated: number;
  skipped: number;
}

export async function getActiveFilingStatusCategoryCodes(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('catalog_items')
    .select('code, metadata')
    .eq('catalog_code', 'filing_statuses')
    .eq('is_active', true);

  if (error) {
    throw new Error(`Fallo al consultar estados de trámites [${error.code ?? 'DB_ERROR'}]`);
  }

  if (!data || data.length === 0) {
    throw new Error('Catálogo filing_statuses no encontrado o vacío en BD');
  }

  const activeCodes: string[] = [];
  for (const item of data) {
    const meta = item.metadata as { category?: string } | null;
    const cat = meta?.category?.toUpperCase();
    if (cat && cat !== 'DONE' && cat !== 'REJECTED') {
      activeCodes.push(item.code as string);
    }
  }

  if (activeCodes.length === 0) {
    throw new Error('No se encontraron estados activos en catálogo filing_statuses');
  }

  return activeCodes;
}

function resolveFilingAlert(
  daysRemaining: number,
  thresholds: number[],
): {
  type: 'FILING_DUE_SOON' | 'FILING_OVERDUE';
  severity: 'info' | 'warning' | 'critical';
} | null {
  const [tPreventive = 3, tWarning = 1, tUrgent = 0] = thresholds;

  if (daysRemaining < 0) {
    return { type: 'FILING_OVERDUE', severity: 'critical' };
  }
  if (daysRemaining <= tUrgent) {
    return { type: 'FILING_DUE_SOON', severity: 'critical' };
  }
  if (daysRemaining <= tWarning) {
    return { type: 'FILING_DUE_SOON', severity: 'warning' };
  }
  if (daysRemaining <= tPreventive) {
    return { type: 'FILING_DUE_SOON', severity: 'info' };
  }
  return null;
}

export async function checkFilingDueAlerts(
  supabase: SupabaseClient,
  logger: FastifyBaseLogger | ConsoleLikeLogger,
): Promise<AlertCountSummary> {
  const today = getTodayLima();
  const config = await getSystemSettingsConfig(supabase, logger);
  const holidays = await getHolidayDates(supabase);
  const activeFilingCodes = await getActiveFilingStatusCategoryCodes(supabase);

  const { data: filings, error } = await supabase
    .from('case_filings')
    .select(
      `
      id, case_id, filing_kind, reference_number, response_due_date, status, responsible_user,
      cases!inner (id, case_number)
    `,
    )
    .not('response_due_date', 'is', null)
    .in('status', activeFilingCodes);

  if (error || !filings) {
    logger.error({ error }, 'Error al consultar trámites externos para alertas');
    throw new Error(`Fallo al consultar trámites externos [${error?.code ?? 'DB_ERROR'}]`);
  }

  let alertsCreated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const filing of filings) {
    const daysRemaining = getRemainingBusinessDays(
      filing.response_due_date as string,
      holidays,
      today,
    );
    const alertConfig = resolveFilingAlert(daysRemaining, config.alertsDueDays);
    if (!alertConfig) continue;

    const caseInfo = filing.cases as unknown as { case_number: string };
    const assignees = await getCaseAssignees(supabase, filing.case_id as string);
    const recipients = new Set<string>();

    if (filing.responsible_user) recipients.add(filing.responsible_user as string);
    if (assignees.responsibleUserId) recipients.add(assignees.responsibleUserId);
    if (assignees.lawyerUserId) recipients.add(assignees.lawyerUserId);

    const dueText =
      daysRemaining < 0
        ? `venció hace ${Math.abs(daysRemaining)} días útiles`
        : daysRemaining === 0
          ? 'vence hoy'
          : `vence en ${daysRemaining} días útiles`;

    const title = `Trámite ${filing.filing_kind} ${dueText}`;
    const body = `El trámite "${filing.filing_kind}" (${filing.reference_number ?? 'S/N'}) del expediente ${caseInfo.case_number} ${dueText}.`;

    for (const recipientId of recipients) {
      const dedupeKey = buildDedupe('filing_due', filing.id as string, recipientId, today);
      try {
        const sent = await sendAlertNotification(
          supabase,
          {
            userId: recipientId,
            title,
            body,
            notificationType: alertConfig.type,
            severity: alertConfig.severity,
            caseId: filing.case_id as string,
            entityType: 'case_filings',
            entityId: filing.id as string,
            actionUrl: `/cases/${filing.case_id}/filings`,
            dedupeKey,
            metadata: {
              filing_id: filing.id,
              case_id: filing.case_id,
              days_remaining: daysRemaining,
            },
          },
          logger,
        );
        if (sent) alertsCreated++;
      } catch (err: unknown) {
        if (err instanceof NotificationRpcError && (err.code === '42501' || err.code === '23503')) {
          logger.warn(
            { code: err.code, caseId: filing.case_id },
            'Alerta omitida: destinatario sin acceso o inexistente',
          );
          skipped++;
        } else {
          errors.push(err instanceof NotificationRpcError ? err.code : 'UNKNOWN');
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Fallo en alertas de trámites: ${errors.length} error(es) [${[...new Set(errors)].join(',')}]`,
    );
  }

  return { checked: filings.length, alertsCreated, skipped };
}

function resolveDocAlert(
  daysRemaining: number,
  thresholds: number[],
): {
  type: 'DOCUMENT_EXPIRING' | 'DOCUMENT_EXPIRED';
  severity: 'info' | 'warning' | 'critical';
} | null {
  const [tPreventive = 30, tWarning = 15, tUrgent = 5] = thresholds;

  if (daysRemaining <= 0) {
    return { type: 'DOCUMENT_EXPIRED', severity: 'critical' };
  }
  if (daysRemaining <= tUrgent) {
    return { type: 'DOCUMENT_EXPIRING', severity: 'critical' };
  }
  if (daysRemaining <= tWarning) {
    return { type: 'DOCUMENT_EXPIRING', severity: 'warning' };
  }
  if (daysRemaining <= tPreventive) {
    return { type: 'DOCUMENT_EXPIRING', severity: 'info' };
  }
  return null;
}

export async function checkDocumentExpiryAlerts(
  supabase: SupabaseClient,
  logger: FastifyBaseLogger | ConsoleLikeLogger,
): Promise<AlertCountSummary> {
  const today = getTodayLima();
  const config = await getSystemSettingsConfig(supabase, logger);
  const holidays = await getHolidayDates(supabase);

  const { data: docs, error } = await supabase
    .from('case_documents')
    .select(
      `
      id, case_id, valid_until, status,
      document_types (name),
      cases!inner (id, case_number)
    `,
    )
    .eq('is_active', true)
    .in('status', ['UPLOADED', 'VALIDATED'])
    .not('valid_until', 'is', null);

  if (error || !docs) {
    logger.error({ error }, 'Error al consultar documentos para alertas de caducidad');
    throw new Error(`Fallo al consultar documentos para alertas [${error?.code ?? 'DB_ERROR'}]`);
  }

  let alertsCreated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const doc of docs) {
    const days = getRemainingBusinessDays(doc.valid_until as string, holidays, today);
    const alertConfig = resolveDocAlert(days, config.alertsDocExpiryDays);
    if (!alertConfig) continue;

    const caseInfo = doc.cases as unknown as { case_number: string };
    const docType = doc.document_types as unknown as { name?: string } | null;
    const docName = docType?.name ?? 'Documento';

    const assignees = await getCaseAssignees(supabase, doc.case_id as string);
    const recipients = new Set<string>();
    if (assignees.responsibleUserId) recipients.add(assignees.responsibleUserId);
    if (assignees.lawyerUserId) recipients.add(assignees.lawyerUserId);

    const expiryText = days <= 0 ? 'se encuentra vencido' : `caduca en ${days} días hábiles`;

    const title = `Documento ${expiryText}: ${docName}`;
    const body = `El documento "${docName}" del expediente ${caseInfo.case_number} ${expiryText}.`;

    for (const recipientId of recipients) {
      const dedupeKey = buildDedupe('doc_expiry', doc.id as string, recipientId, today);
      try {
        const sent = await sendAlertNotification(
          supabase,
          {
            userId: recipientId,
            title,
            body,
            notificationType: alertConfig.type,
            severity: alertConfig.severity,
            caseId: doc.case_id as string,
            entityType: 'case_documents',
            entityId: doc.id as string,
            actionUrl: `/cases/${doc.case_id}/documents`,
            dedupeKey,
            metadata: {
              document_id: doc.id,
              case_id: doc.case_id,
              days_remaining: days,
            },
          },
          logger,
        );
        if (sent) alertsCreated++;
      } catch (err: unknown) {
        if (err instanceof NotificationRpcError && (err.code === '42501' || err.code === '23503')) {
          logger.warn(
            { code: err.code, caseId: doc.case_id },
            'Alerta omitida: destinatario sin acceso o inexistente',
          );
          skipped++;
        } else {
          errors.push(err instanceof NotificationRpcError ? err.code : 'UNKNOWN');
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Fallo en alertas de documentos: ${errors.length} error(es) [${[...new Set(errors)].join(',')}]`,
    );
  }

  return { checked: docs.length, alertsCreated, skipped };
}
