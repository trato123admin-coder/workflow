/**
 * jobs-worker.ts — Queue worker service for background jobs in TICK and CONTINUOUS mode.
 *
 * Implements S8-01:
 * - Claim jobs using SKIP LOCKED via public.claim_jobs() RPC
 * - Dispatch to registered job handlers
 * - Mark as DONE via public.complete_job() RPC
 * - Mark as FAILED/DEAD via public.fail_job() RPC with exponential backoff
 */

import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyBaseLogger } from 'fastify';
import { getSupabaseServiceClient } from '../storage/index.js';
import { getSystemSettingsConfig } from './settings-reader.js';

export interface ConsoleLikeLogger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
  debug?: (obj: unknown, msg?: string) => void;
}

export interface ClaimedJob {
  id: string;
  job_type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  status?: string;
  dedupe_key?: string | null;
  run_at?: string;
  created_at?: string;
}

export type JobHandler = (
  job: ClaimedJob,
  supabase: SupabaseClient,
  logger: FastifyBaseLogger | ConsoleLikeLogger,
) => Promise<Record<string, unknown> | void>;

export interface TickOptions {
  workerId?: string;
  batchSize?: number;
  maxBatches?: number;
  logger?: FastifyBaseLogger | ConsoleLikeLogger;
}

export interface TickResult {
  processed: number;
  succeeded: number;
  failed: number;
  batchesExecuted: number;
  durationMs: number;
}

const jobHandlers = new Map<string, JobHandler>();

export function registerJobHandler(jobType: string, handler: JobHandler): void {
  jobHandlers.set(jobType.toLowerCase(), handler);
}

export function getJobHandler(jobType: string): JobHandler | undefined {
  return jobHandlers.get(jobType.toLowerCase());
}

export function clearJobHandlers(): void {
  jobHandlers.clear();
}

export function getRegisteredJobTypes(): string[] {
  return Array.from(jobHandlers.keys());
}

export async function claimJobsBatch(
  supabase: SupabaseClient,
  workerId: string,
  batchSize: number,
  lockTimeoutMinutes = 15,
): Promise<ClaimedJob[]> {
  const { data, error } = await supabase.rpc('claim_jobs', {
    p_worker_id: workerId,
    p_batch_size: batchSize,
    p_lock_timeout_minutes: lockTimeoutMinutes,
  });

  if (error) {
    throw new Error(`Error al reclamar trabajos en cola: ${error.message}`);
  }

  return (data ?? []) as ClaimedJob[];
}

export async function completeJobExecution(
  supabase: SupabaseClient,
  jobId: string,
  result: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.rpc('complete_job', {
    p_job_id: jobId,
    p_result: result,
  });

  if (error) {
    throw new Error(`Error al completar trabajo ${jobId}: ${error.message}`);
  }
}

export async function failJobExecution(
  supabase: SupabaseClient,
  jobId: string,
  errorMessage: string,
): Promise<void> {
  const { error } = await supabase.rpc('fail_job', {
    p_job_id: jobId,
    p_error: errorMessage,
  });

  if (error) {
    throw new Error(`Error al marcar fallo del trabajo ${jobId}: ${error.message}`);
  }
}

export async function processSingleJob(
  supabase: SupabaseClient,
  job: ClaimedJob,
  logger: FastifyBaseLogger | ConsoleLikeLogger,
): Promise<boolean> {
  const handler = getJobHandler(job.job_type);

  if (!handler) {
    const errorMsg = `No existe handler registrado para el tipo de trabajo: ${job.job_type}`;
    logger.warn({ jobId: job.id, jobType: job.job_type }, errorMsg);
    try {
      await failJobExecution(supabase, job.id, errorMsg);
    } catch (failErr: unknown) {
      logger.error(
        { jobId: job.id, err: String(failErr) },
        'Error al registrar fail_job por handler faltante',
      );
    }
    return false;
  }

  try {
    const result = await handler(job, supabase, logger);
    await completeJobExecution(supabase, job.id, (result as Record<string, unknown>) ?? {});
    logger.info({ jobId: job.id, jobType: job.job_type }, 'Trabajo procesado exitosamente');
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ jobId: job.id, jobType: job.job_type, error: message }, 'Fallo en trabajo');
    try {
      await failJobExecution(supabase, job.id, message);
    } catch (failErr: unknown) {
      logger.error(
        { jobId: job.id, err: String(failErr) },
        'Error al reportar fail_job a la base de datos',
      );
    }
    return false;
  }
}

const defaultLogger: ConsoleLikeLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

export async function executeJobsTick(options: TickOptions = {}): Promise<TickResult> {
  const startTime = Date.now();
  const supabase = getSupabaseServiceClient();
  const logger = options.logger ?? defaultLogger;
  const workerId = options.workerId ?? `worker-${randomUUID().slice(0, 8)}`;
  const batchSize = Math.min(Math.max(options.batchSize ?? 5, 1), 20);
  const maxBatches = Math.min(Math.max(options.maxBatches ?? 3, 1), 10);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let batchesExecuted = 0;

  const config = await getSystemSettingsConfig(supabase, logger);

  for (let cycle = 0; cycle < maxBatches; cycle++) {
    const jobs = await claimJobsBatch(
      supabase,
      workerId,
      batchSize,
      config.platformLockTimeoutMinutes,
    );
    if (!jobs.length) break;

    batchesExecuted++;
    for (const job of jobs) {
      processed++;
      const ok = await processSingleJob(supabase, job, logger);
      if (ok) succeeded++;
      else failed++;
    }

    if (jobs.length < batchSize) break;
  }

  return {
    processed,
    succeeded,
    failed,
    batchesExecuted,
    durationMs: Date.now() - startTime,
  };
}
