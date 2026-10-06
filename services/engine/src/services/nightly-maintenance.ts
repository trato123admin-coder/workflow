/**
 * nightly-maintenance.ts — Nightly maintenance and retention cleanup (S8-05).
 *
 * Runs scheduled at 23:00 Lima via pg_cron (04:00 UTC next day):
 * - Purges completed (DONE) jobs older than config.retentionDoneJobsDays (default 7 days).
 * - Purges read notifications older than config.retentionNotificationsDays (default 30 days).
 * - Cash integrity checks are decoupled and isolated per ADR-006 (Sprint 11 scope).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyBaseLogger } from 'fastify';
import type { ConsoleLikeLogger } from './jobs-worker.js';
import { getSystemSettingsConfig } from './settings-reader.js';

export interface NightlyMaintenanceSummary {
  jobsPurged: number;
  notificationsPurged: number;
  completedAt: string;
}

async function purgeOldJobs(
  supabase: SupabaseClient,
  retentionDays: number,
  logger: FastifyBaseLogger | ConsoleLikeLogger,
): Promise<number> {
  const cutoffDate = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('job_queue')
    .delete()
    .eq('status', 'DONE')
    .lt('finished_at', cutoffDate)
    .select('id');

  if (error) {
    logger.error({ code: error.code }, 'Error al purgar trabajos antiguos');
    throw new Error(`Error al purgar trabajos antiguos [${error.code ?? 'DB_ERROR'}]`);
  }
  return data?.length ?? 0;
}

async function purgeOldNotifications(
  supabase: SupabaseClient,
  retentionDays: number,
  logger: FastifyBaseLogger | ConsoleLikeLogger,
): Promise<number> {
  const cutoffDate = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('notifications')
    .delete()
    .eq('is_read', true)
    .lt('read_at', cutoffDate)
    .select('id');

  if (error) {
    logger.error({ code: error.code }, 'Error al purgar notificaciones antiguas');
    throw new Error(`Error al purgar notificaciones antiguas [${error.code ?? 'DB_ERROR'}]`);
  }
  return data?.length ?? 0;
}

export async function runNightlyMaintenance(
  supabase: SupabaseClient,
  logger: FastifyBaseLogger | ConsoleLikeLogger,
): Promise<NightlyMaintenanceSummary> {
  const config = await getSystemSettingsConfig(supabase, logger);

  const jobsPurged = await purgeOldJobs(supabase, config.retentionDoneJobsDays, logger);
  const notificationsPurged = await purgeOldNotifications(
    supabase,
    config.retentionNotificationsDays,
    logger,
  );

  logger.info(
    { jobsPurged, notificationsPurged },
    'Mantenimiento nocturno finalizado exitosamente',
  );

  return {
    jobsPurged,
    notificationsPurged,
    completedAt: new Date().toISOString(),
  };
}
