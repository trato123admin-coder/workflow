/**
 * daily-digest.ts — Morning digest generation for active case assignees (S8-05, D8).
 *
 * Runs scheduled at 07:30 Lima (lun-vie) via pg_cron (12:30 UTC):
 * - Aggregates active cases, urgent filings, expiring docs, and stagnant cases per analyst/lawyer.
 * - Emits a single consolidated DAILY_DIGEST in-app notification per active user.
 * - Severidades unificadas estrictamente con la BD: 'info' | 'warning' | 'critical'.
 * - Enforces daily deduplication key: daily_digest:userId:todayLima.
 * - Días útiles en conteos y comprobación estricta de errores en toda consulta a BD.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyBaseLogger } from 'fastify';
import {
  countBusinessDays,
  getRemainingBusinessDays,
  isStatusStagnationPaused,
  toLimaDateString,
} from '@workflow/shared';
import type { ConsoleLikeLogger } from './jobs-worker.js';
import {
  NotificationRpcError,
  getTodayLima,
  sendAlertNotification,
  buildDedupe,
} from './alert-engine-common.js';
import { getCaseStatusCategoryCodes, getHolidayDates } from './alert-engine-cases.js';
import { getActiveFilingStatusCategoryCodes } from './alert-engine-filings.js';
import { getSystemSettingsConfig } from './settings-reader.js';

export interface DailyDigestSummary {
  usersEvaluated: number;
  digestsCreated: number;
  skipped: number;
}

interface UserMetrics {
  caseCount: number;
  urgentFilings: number;
  expiringDocs: number;
  stagnantCases: number;
}

async function getActiveUsersWithCases(
  supabase: SupabaseClient,
  activeCaseCodes: string[],
): Promise<Map<string, string[]>> {
  const { data, error } = await supabase
    .from('case_assignments')
    .select(
      `
      user_id, case_id,
      cases!inner (status)
    `,
    )
    .is('ended_at', null)
    .in('cases.status', activeCaseCodes);

  if (error) {
    throw new Error(
      `Fallo al consultar asignaciones activas para digest [${error.code ?? 'DB_ERROR'}]`,
    );
  }

  const userCaseMap = new Map<string, string[]>();
  for (const row of data ?? []) {
    const userId = row.user_id as string;
    const caseId = row.case_id as string;
    const existing = userCaseMap.get(userId) ?? [];
    if (!existing.includes(caseId)) existing.push(caseId);
    userCaseMap.set(userId, existing);
  }

  return userCaseMap;
}

async function computeUserMetrics(
  supabase: SupabaseClient,
  caseIds: string[],
  today: string,
  stagnationDefaultDays: number,
  expiryThresholdDays: number,
  holidays: string[],
  activeFilingCodes: string[],
): Promise<UserMetrics> {
  const [filingsRes, docsRes, casesRes] = await Promise.all([
    supabase
      .from('case_filings')
      .select('id, response_due_date')
      .in('case_id', caseIds)
      .in('status', activeFilingCodes)
      .not('response_due_date', 'is', null),

    supabase
      .from('case_documents')
      .select('id, valid_until')
      .in('case_id', caseIds)
      .eq('is_active', true)
      .in('status', ['UPLOADED', 'VALIDATED'])
      .not('valid_until', 'is', null),

    supabase
      .from('cases')
      .select(
        `
        id, last_activity_at,
        case_processes (
          id, sla_days, is_applicable,
          workflow_statuses (category)
        )
      `,
      )
      .in('id', caseIds),
  ]);

  if (filingsRes.error) {
    throw new Error(
      `Fallo al consultar trámites para métricas de digest [${filingsRes.error.code ?? 'DB_ERROR'}]`,
    );
  }
  if (docsRes.error) {
    throw new Error(
      `Fallo al consultar documentos para métricas de digest [${docsRes.error.code ?? 'DB_ERROR'}]`,
    );
  }
  if (casesRes.error) {
    throw new Error(
      `Fallo al consultar casos para métricas de digest [${casesRes.error.code ?? 'DB_ERROR'}]`,
    );
  }

  // Trámites vencidos o por vencer hoy (días hábiles restantes <= 0)
  let urgentFilings = 0;
  for (const f of filingsRes.data ?? []) {
    const rem = getRemainingBusinessDays(f.response_due_date as string, holidays, today);
    if (rem <= 0) urgentFilings++;
  }

  // Documentos por caducar: próximos a vencer en días útiles (no los ya caducados)
  let expiringDocs = 0;
  for (const d of docsRes.data ?? []) {
    const rem = getRemainingBusinessDays(d.valid_until as string, holidays, today);
    if (rem > 0 && rem <= expiryThresholdDays) expiringDocs++;
  }

  // Casos estancados: calculados con la misma lógica de umbral por proceso
  let stagnantCases = 0;
  for (const c of casesRes.data ?? []) {
    const processes = (c.case_processes ?? []) as unknown as Array<{
      id: string;
      sla_days: number | null;
      is_applicable: boolean;
      workflow_statuses: { category: string } | null;
    }>;

    const isPaused = processes.some(
      (p) => p.is_applicable && isStatusStagnationPaused(p.workflow_statuses?.category ?? ''),
    );
    if (isPaused) continue;

    const activeProcesses = processes.filter(
      (p) =>
        p.is_applicable &&
        ['IN_PROGRESS', 'REWORK'].includes((p.workflow_statuses?.category ?? '').toUpperCase()),
    );
    const activeSlas = activeProcesses
      .map((p) => p.sla_days)
      .filter((sla): sla is number => typeof sla === 'number' && sla > 0);

    const thresholdSla = activeSlas.length > 0 ? Math.min(...activeSlas) : stagnationDefaultDays;
    const daysInactive = countBusinessDays(
      toLimaDateString(c.last_activity_at as string),
      today,
      holidays,
    );

    if (daysInactive >= thresholdSla) stagnantCases++;
  }

  return {
    caseCount: caseIds.length,
    urgentFilings,
    expiringDocs,
    stagnantCases,
  };
}

function buildDigestMessage(metrics: UserMetrics): {
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
} {
  const title = `Resumen matutino: ${metrics.caseCount} caso(s) a tu cargo`;
  const urgentParts: string[] = [];

  if (metrics.urgentFilings > 0) {
    urgentParts.push(`${metrics.urgentFilings} trámite(s) vencido(s) o por vencer hoy`);
  }
  if (metrics.expiringDocs > 0) {
    urgentParts.push(`${metrics.expiringDocs} documento(s) por caducar`);
  }
  if (metrics.stagnantCases > 0) {
    urgentParts.push(`${metrics.stagnantCases} caso(s) sin actividad reciente`);
  }

  const body =
    urgentParts.length > 0
      ? `Atención requerida hoy: ${urgentParts.join(', ')}. Revisa tu bandeja para priorizar acciones.`
      : `Tienes ${metrics.caseCount} caso(s) activo(s) y sin alertas críticas pendientes. ¡Buen día de trabajo!`;

  const severity =
    metrics.urgentFilings > 0
      ? 'critical'
      : metrics.expiringDocs > 0 || metrics.stagnantCases > 0
        ? 'warning'
        : 'info';

  return { title, body, severity };
}

export async function generateDailyDigests(
  supabase: SupabaseClient,
  logger: FastifyBaseLogger | ConsoleLikeLogger,
): Promise<DailyDigestSummary> {
  const today = getTodayLima();
  const config = await getSystemSettingsConfig(supabase, logger);
  const holidays = await getHolidayDates(supabase);
  const { activeCodes } = await getCaseStatusCategoryCodes(supabase);
  const activeFilingCodes = await getActiveFilingStatusCategoryCodes(supabase);

  const userCaseMap = await getActiveUsersWithCases(supabase, activeCodes);
  let digestsCreated = 0;
  let skipped = 0;
  const errors: string[] = [];

  const maxDocExpiryDays = config.alertsDocExpiryDays[0] ?? 30;

  for (const [userId, caseIds] of userCaseMap.entries()) {
    if (!caseIds.length) continue;

    try {
      const metrics = await computeUserMetrics(
        supabase,
        caseIds,
        today,
        config.alertsStagnationDefaultDays,
        maxDocExpiryDays,
        holidays,
        activeFilingCodes,
      );
      const { title, body, severity } = buildDigestMessage(metrics);
      const dedupeKey = buildDedupe('daily_digest', userId, userId, today);

      const sent = await sendAlertNotification(
        supabase,
        {
          userId,
          title,
          body,
          notificationType: 'DAILY_DIGEST',
          severity,
          actionUrl: '/today',
          dedupeKey,
          metadata: { metrics, date: today },
        },
        logger,
      );

      if (sent) digestsCreated++;
    } catch (err: unknown) {
      if (err instanceof NotificationRpcError && (err.code === '42501' || err.code === '23503')) {
        logger.warn({ code: err.code, userId }, 'Digest omitido: usuario sin acceso o inexistente');
        skipped++;
      } else {
        const errCode =
          err instanceof NotificationRpcError
            ? err.code
            : err instanceof Error
              ? (err.message.match(/\[([A-Z0-9_]+)\]/)?.[1] ?? 'DB_ERROR')
              : 'UNKNOWN';
        logger.error({ code: errCode, userId }, 'Error al procesar digest de usuario');
        errors.push(errCode);
      }
    }
  }

  logger.info(
    { usersEvaluated: userCaseMap.size, digestsCreated, skipped },
    'Generación de resumen matutino finalizada',
  );

  if (errors.length > 0) {
    throw new Error(
      `Fallo en daily_digest: ${errors.length} error(es) [${[...new Set(errors)].join(',')}]`,
    );
  }

  return { usersEvaluated: userCaseMap.size, digestsCreated, skipped };
}
