/**
 * alert-engine.ts — Orchestrator and handler registration for all domain alert checks.
 *
 * Sprint 8 (S8-04, D7):
 * - Aggregates checks for filings, documents, stagnation, disputes, unassigned lawyer,
 *   and missing heir docs.
 * - Cada familia se ejecuta en try/catch independiente: un fallo en una familia no impide
 *   la ejecución de las demás. Si alguna falla, completa todas y falla al final con códigos/conteos.
 * - El error final no contiene UUID ni texto libre de Postgres.
 * - Enforces working hours gate (D7) for due_alerts via isWorkingHour.
 * - Registers handlers with the jobs-worker for execution on tick or scheduled jobs.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyBaseLogger } from 'fastify';
import { isWorkingHour } from '@workflow/shared';
import { registerJobHandler, type ConsoleLikeLogger } from './jobs-worker.js';
import {
  checkFilingDueAlerts,
  checkDocumentExpiryAlerts,
  type AlertCountSummary,
} from './alert-engine-filings.js';
import {
  checkStagnantCasesAlerts,
  checkDisputeAlerts,
  checkUnassignedLawyerAlerts,
} from './alert-engine-cases.js';
import { checkMissingHeirDocsAlerts } from './alert-engine-parties.js';
import { generateDailyDigests } from './daily-digest.js';
import { runNightlyMaintenance } from './nightly-maintenance.js';
import { getSystemSettingsConfig } from './settings-reader.js';

export interface DomainAlertsRunSummary {
  filingsDue: AlertCountSummary;
  docExpiry: AlertCountSummary;
  stagnantCases: AlertCountSummary;
  disputes: AlertCountSummary;
  unassignedLawyers: AlertCountSummary;
  missingHeirDocs: AlertCountSummary;
  totalAlertsCreated: number;
  totalSkipped: number;
}

const emptySummary: AlertCountSummary = { checked: 0, alertsCreated: 0, skipped: 0 };

export async function runAllDomainAlertChecks(
  supabase: SupabaseClient,
  logger: FastifyBaseLogger | ConsoleLikeLogger,
): Promise<DomainAlertsRunSummary> {
  const familyFailures: string[] = [];

  let filingsDue = emptySummary;
  let docExpiry = emptySummary;
  let stagnantCases = emptySummary;
  let disputes = emptySummary;
  let unassignedLawyers = emptySummary;
  let missingHeirDocs = emptySummary;

  // 1. Trámites externos
  try {
    filingsDue = await checkFilingDueAlerts(supabase, logger);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ family: 'filingsDue', err: msg }, 'Fallo en familia filingsDue');
    familyFailures.push(`filingsDue: ${msg}`);
  }

  // 2. Vencimiento de documentos
  try {
    docExpiry = await checkDocumentExpiryAlerts(supabase, logger);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ family: 'docExpiry', err: msg }, 'Fallo en familia docExpiry');
    familyFailures.push(`docExpiry: ${msg}`);
  }

  // 3. Casos estancados
  try {
    stagnantCases = await checkStagnantCasesAlerts(supabase, logger);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ family: 'stagnantCases', err: msg }, 'Fallo en familia stagnantCases');
    familyFailures.push(`stagnantCases: ${msg}`);
  }

  // 4. Controversias
  try {
    disputes = await checkDisputeAlerts(supabase, logger);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ family: 'disputes', err: msg }, 'Fallo en familia disputes');
    familyFailures.push(`disputes: ${msg}`);
  }

  // 5. Abogado sin asignar
  try {
    unassignedLawyers = await checkUnassignedLawyerAlerts(supabase, logger);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ family: 'unassignedLawyers', err: msg }, 'Fallo en familia unassignedLawyers');
    familyFailures.push(`unassignedLawyers: ${msg}`);
  }

  // 6. Documentos de herederos
  try {
    missingHeirDocs = await checkMissingHeirDocsAlerts(supabase, logger);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ family: 'missingHeirDocs', err: msg }, 'Fallo en familia missingHeirDocs');
    familyFailures.push(`missingHeirDocs: ${msg}`);
  }

  const totalAlertsCreated =
    filingsDue.alertsCreated +
    docExpiry.alertsCreated +
    stagnantCases.alertsCreated +
    disputes.alertsCreated +
    unassignedLawyers.alertsCreated +
    missingHeirDocs.alertsCreated;

  const totalSkipped =
    filingsDue.skipped +
    docExpiry.skipped +
    stagnantCases.skipped +
    disputes.skipped +
    unassignedLawyers.skipped +
    missingHeirDocs.skipped;

  logger.info(
    { totalAlertsCreated, totalSkipped },
    'Verificación de alertas de dominio finalizada',
  );

  if (familyFailures.length > 0) {
    throw new Error(`Verificación de alertas completada con fallos: ${familyFailures.join('; ')}`);
  }

  return {
    filingsDue,
    docExpiry,
    stagnantCases,
    disputes,
    unassignedLawyers,
    missingHeirDocs,
    totalAlertsCreated,
    totalSkipped,
  };
}

let initialized = false;

export function initializeAlertEngine(): void {
  if (initialized) return;
  initialized = true;

  registerJobHandler('due_alerts', async (_job, supabase, logger) => {
    const config = await getSystemSettingsConfig(supabase, logger);
    const inWorkingHours = isWorkingHour(
      new Date(),
      config.officeHoursStart,
      config.officeHoursEnd,
      config.officeHoursWorkingDays,
      'America/Lima',
    );

    if (!inWorkingHours) {
      logger.info('due_alerts omitido: fuera de horario laboral de oficina');
      return { skipped: true, reason: 'outside_office_hours' };
    }

    const summary = await runAllDomainAlertChecks(supabase, logger);
    return summary as unknown as Record<string, unknown>;
  });

  registerJobHandler('alert_filings_due', async (_job, supabase, logger) => {
    return (await checkFilingDueAlerts(supabase, logger)) as unknown as Record<string, unknown>;
  });

  registerJobHandler('alert_doc_expiry', async (_job, supabase, logger) => {
    return (await checkDocumentExpiryAlerts(supabase, logger)) as unknown as Record<
      string,
      unknown
    >;
  });

  registerJobHandler('alert_stagnant_cases', async (_job, supabase, logger) => {
    return (await checkStagnantCasesAlerts(supabase, logger)) as unknown as Record<string, unknown>;
  });

  registerJobHandler('alert_dispute', async (_job, supabase, logger) => {
    return (await checkDisputeAlerts(supabase, logger)) as unknown as Record<string, unknown>;
  });

  registerJobHandler('alert_unassigned_lawyer', async (_job, supabase, logger) => {
    return (await checkUnassignedLawyerAlerts(supabase, logger)) as unknown as Record<
      string,
      unknown
    >;
  });

  registerJobHandler('alert_missing_heir_docs', async (_job, supabase, logger) => {
    return (await checkMissingHeirDocsAlerts(supabase, logger)) as unknown as Record<
      string,
      unknown
    >;
  });

  registerJobHandler('daily_digest', async (_job, supabase, logger) => {
    return (await generateDailyDigests(supabase, logger)) as unknown as Record<string, unknown>;
  });

  registerJobHandler('nightly_maintenance', async (_job, supabase, logger) => {
    return (await runNightlyMaintenance(supabase, logger)) as unknown as Record<string, unknown>;
  });
}
