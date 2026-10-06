/**
 * alert-engine-cases.ts — Case-level alert rules: stagnation, disputes, unassigned lawyer.
 *
 * Sprint 8 (S8-04, D8):
 * - Estancamiento computado en días hábiles (countBusinessDays + tabla holidays).
 * - Categorías semánticas de catálogo (ACTIVE para casos, WAITING para pausa de cómputo).
 * - Sin fallbacks inventados: si la consulta de catálogo o feriados falla o está vacía, lanza excepción.
 * - Textos sin PII (sin c.title ni nombres de personas).
 * - Metadatos estrictamente con IDs y severidades ('warning' | 'critical').
 * - Tolerancia a errores de destinatario: 42501/23503 cuenta en skipped y continúa;
 *   otros errores se acumulan y lanzan al finalizar.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyBaseLogger } from 'fastify';
import { countBusinessDays, isStatusStagnationPaused, toLimaDateString } from '@workflow/shared';
import type { ConsoleLikeLogger } from './jobs-worker.js';
import {
  NotificationRpcError,
  getTodayLima,
  getCaseAssignees,
  sendAlertNotification,
  buildDedupe,
} from './alert-engine-common.js';
import { getSystemSettingsConfig } from './settings-reader.js';
import type { AlertCountSummary } from './alert-engine-filings.js';

export async function getCaseStatusCategoryCodes(supabase: SupabaseClient): Promise<{
  activeCodes: string[];
  pausedCodes: string[];
}> {
  const { data, error } = await supabase
    .from('catalog_items')
    .select('code, metadata')
    .eq('catalog_code', 'case_statuses')
    .eq('is_active', true);

  if (error) {
    throw new Error(`Fallo al consultar estados de caso [${error.code ?? 'DB_ERROR'}]`);
  }

  if (!data || data.length === 0) {
    throw new Error('Catálogo case_statuses no encontrado o vacío en BD');
  }

  const activeCodes: string[] = [];
  const pausedCodes: string[] = [];

  for (const item of data) {
    const meta = item.metadata as { category?: string } | null;
    const cat = meta?.category?.toUpperCase();
    if (cat === 'ACTIVE') activeCodes.push(item.code as string);
    if (cat === 'PAUSED') pausedCodes.push(item.code as string);
  }

  if (activeCodes.length === 0) {
    throw new Error('No se encontraron estados con categoría ACTIVE en catálogo case_statuses');
  }

  return { activeCodes, pausedCodes };
}

export async function getHolidayDates(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from('holidays').select('date').eq('is_active', true);

  if (error) {
    throw new Error(`Fallo al consultar feriados [${error.code ?? 'DB_ERROR'}]`);
  }

  return (data ?? []).map((h) => String(h.date));
}

export async function checkStagnantCasesAlerts(
  supabase: SupabaseClient,
  logger: FastifyBaseLogger | ConsoleLikeLogger,
): Promise<AlertCountSummary> {
  const today = getTodayLima();
  const config = await getSystemSettingsConfig(supabase, logger);
  const holidays = await getHolidayDates(supabase);
  const { activeCodes, pausedCodes } = await getCaseStatusCategoryCodes(supabase);
  const pausedSet = new Set(pausedCodes);

  const { data: cases, error } = await supabase
    .from('cases')
    .select(
      `
      id, case_number, last_activity_at, status,
      case_processes (
        id, sla_days, is_applicable, updated_at,
        workflow_statuses (code, category)
      )
    `,
    )
    .in('status', activeCodes);

  if (error || !cases) {
    logger.error({ error }, 'Error al consultar casos para estancamiento');
    throw new Error(`Fallo al consultar casos para estancamiento [${error?.code ?? 'DB_ERROR'}]`);
  }

  let alertsCreated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const c of cases) {
    if (pausedSet.has(c.status as string)) continue;

    const processes = (c.case_processes ?? []) as unknown as Array<{
      id: string;
      sla_days: number | null;
      is_applicable: boolean;
      updated_at: string;
      workflow_statuses: { code: string; category: string } | null;
    }>;

    // Si algún proceso aplicable está en WAITING, se pausa el cómputo de estancamiento
    const isPaused = processes.some(
      (p) => p.is_applicable && isStatusStagnationPaused(p.workflow_statuses?.category ?? ''),
    );
    if (isPaused) continue;

    // Procesos activos aplicables (IN_PROGRESS o REWORK)
    const activeProcesses = processes.filter(
      (p) =>
        p.is_applicable &&
        ['IN_PROGRESS', 'REWORK'].includes((p.workflow_statuses?.category ?? '').toUpperCase()),
    );

    const activeSlas = activeProcesses
      .map((p) => p.sla_days)
      .filter((sla): sla is number => typeof sla === 'number' && sla > 0);

    const thresholdSla =
      activeSlas.length > 0 ? Math.min(...activeSlas) : config.alertsStagnationDefaultDays;

    const daysInactive = countBusinessDays(
      toLimaDateString(c.last_activity_at as string),
      today,
      holidays,
    );
    if (daysInactive < thresholdSla) continue;

    const assignees = await getCaseAssignees(supabase, c.id as string);
    const recipients = new Set<string>();
    if (assignees.responsibleUserId) recipients.add(assignees.responsibleUserId);
    if (assignees.lawyerUserId) recipients.add(assignees.lawyerUserId);

    const title = `Expediente estancado (${daysInactive} días hábiles sin actividad)`;
    const body = `El expediente ${c.case_number} no registra actividad hace ${daysInactive} días hábiles (umbral SLA: ${thresholdSla} días).`;

    for (const recipientId of recipients) {
      const dedupeKey = buildDedupe('stagnant_case', c.id as string, recipientId, today);
      try {
        const sent = await sendAlertNotification(
          supabase,
          {
            userId: recipientId,
            title,
            body,
            notificationType: 'CASE_STAGNANT',
            severity: 'warning',
            caseId: c.id as string,
            entityType: 'cases',
            entityId: c.id as string,
            actionUrl: `/cases/${c.id}`,
            dedupeKey,
            metadata: { case_id: c.id, days_inactive: daysInactive, threshold_days: thresholdSla },
          },
          logger,
        );
        if (sent) alertsCreated++;
      } catch (err: unknown) {
        if (err instanceof NotificationRpcError && (err.code === '42501' || err.code === '23503')) {
          logger.warn(
            { code: err.code, caseId: c.id },
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
      `Fallo en alertas de casos estancados: ${errors.length} error(es) [${[...new Set(errors)].join(',')}]`,
    );
  }

  return { checked: cases.length, alertsCreated, skipped };
}

export async function checkDisputeAlerts(
  supabase: SupabaseClient,
  logger: FastifyBaseLogger | ConsoleLikeLogger,
): Promise<AlertCountSummary> {
  const today = getTodayLima();
  const { activeCodes } = await getCaseStatusCategoryCodes(supabase);

  const { data: cases, error } = await supabase
    .from('cases')
    .select('id, case_number, has_dispute')
    .eq('has_dispute', true)
    .in('status', activeCodes);

  if (error || !cases) {
    logger.error({ error }, 'Error al consultar expedientes en controversia');
    throw new Error(
      `Fallo al consultar expedientes en controversia [${error?.code ?? 'DB_ERROR'}]`,
    );
  }

  let alertsCreated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const c of cases) {
    const assignees = await getCaseAssignees(supabase, c.id as string);
    if (!assignees.lawyerUserId) continue;

    const dedupeKey = buildDedupe('case_dispute', c.id as string, assignees.lawyerUserId, today);
    try {
      const sent = await sendAlertNotification(
        supabase,
        {
          userId: assignees.lawyerUserId,
          title: 'Controversia declarada en expediente',
          body: `El expediente ${c.case_number} ha sido marcado en controversia. Requiere evaluación legal urgente.`,
          notificationType: 'DISPUTE_DECLARED',
          severity: 'critical',
          caseId: c.id as string,
          entityType: 'cases',
          entityId: c.id as string,
          actionUrl: `/cases/${c.id}`,
          dedupeKey,
          metadata: { case_id: c.id },
        },
        logger,
      );
      if (sent) alertsCreated++;
    } catch (err: unknown) {
      if (err instanceof NotificationRpcError && (err.code === '42501' || err.code === '23503')) {
        logger.warn(
          { code: err.code, caseId: c.id },
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
      `Fallo en alertas de controversia: ${errors.length} error(es) [${[...new Set(errors)].join(',')}]`,
    );
  }

  return { checked: cases.length, alertsCreated, skipped };
}

export async function checkUnassignedLawyerAlerts(
  supabase: SupabaseClient,
  logger: FastifyBaseLogger | ConsoleLikeLogger,
): Promise<AlertCountSummary> {
  const today = getTodayLima();
  const { activeCodes } = await getCaseStatusCategoryCodes(supabase);

  const { data: cases, error } = await supabase
    .from('cases')
    .select(
      `
      id, case_number, status,
      case_assignments (assignment_type, ended_at)
    `,
    )
    .in('status', activeCodes);

  if (error || !cases) {
    logger.error({ error }, 'Error al consultar casos sin abogado');
    throw new Error(`Fallo al consultar casos sin abogado [${error?.code ?? 'DB_ERROR'}]`);
  }

  let alertsCreated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const c of cases) {
    const assignments = (c.case_assignments ?? []) as Array<{
      assignment_type: string;
      ended_at: string | null;
    }>;
    const hasLawyer = assignments.some(
      (a) => a.assignment_type === 'LAWYER' && a.ended_at === null,
    );
    if (hasLawyer) continue;

    const assignees = await getCaseAssignees(supabase, c.id as string);
    const recipientId = assignees.responsibleUserId;
    if (!recipientId) continue;

    const dedupeKey = buildDedupe('unassigned_lawyer', c.id as string, recipientId, today);
    try {
      const sent = await sendAlertNotification(
        supabase,
        {
          userId: recipientId,
          title: 'Expediente sin abogado asignado',
          body: `El expediente ${c.case_number} se encuentra en trámite activo pero no cuenta con un abogado asignado.`,
          notificationType: 'CASE_NO_LAWYER',
          severity: 'warning',
          caseId: c.id as string,
          entityType: 'cases',
          entityId: c.id as string,
          actionUrl: `/cases/${c.id}/team`,
          dedupeKey,
          metadata: { case_id: c.id },
        },
        logger,
      );
      if (sent) alertsCreated++;
    } catch (err: unknown) {
      if (err instanceof NotificationRpcError && (err.code === '42501' || err.code === '23503')) {
        logger.warn(
          { code: err.code, caseId: c.id },
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
      `Fallo en alertas de caso sin abogado: ${errors.length} error(es) [${[...new Set(errors)].join(',')}]`,
    );
  }

  return { checked: cases.length, alertsCreated, skipped };
}
