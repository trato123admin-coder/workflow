/**
 * jobs.ts — Zod schemas, types and pure utilities for background job queue.
 *
 * Sprint 8 (S8-01, S8-02, S8-07).
 */

import { z } from 'zod';

export const JobStatusSchema = z.enum([
  'QUEUED',
  'RUNNING',
  'DONE',
  'FAILED',
  'DEAD',
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobsModeSchema = z.enum(['TICK', 'CONTINUOUS']);
export type JobsMode = z.infer<typeof JobsModeSchema>;

export const JobTypeSchema = z.enum([
  'health_checks',
  'due_alerts',
  'daily_digest',
  'nightly_maintenance',
  'document_generation',
  'recurrence_create',
]);
export type KnownJobType = z.infer<typeof JobTypeSchema>;
export type JobType = KnownJobType | (string & {});

export const JobQueueItemSchema = z.object({
  id: z.string().uuid(),
  job_type: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  status: JobStatusSchema,
  run_at: z.string(),
  attempts: z.number().int().min(0),
  max_attempts: z.number().int().min(1),
  locked_at: z.string().nullable().optional(),
  locked_by: z.string().nullable().optional(),
  last_error: z.string().nullable().optional(),
  dedupe_key: z.string().nullable().optional(),
  created_at: z.string(),
  finished_at: z.string().nullable().optional(),
});
export type JobQueueItem = z.infer<typeof JobQueueItemSchema>;

export const ClaimJobsParamsSchema = z.object({
  worker_id: z.string().min(1),
  batch_size: z.number().int().min(1).max(50).default(5),
  lock_timeout_minutes: z.number().int().min(1).max(120).default(15),
});
export type ClaimJobsParams = z.infer<typeof ClaimJobsParamsSchema>;

/**
 * Calculates exponential backoff in seconds for retrying failed jobs:
 * backoff = min(baseSeconds * (2 ^ (attempts - 1)), maxSeconds)
 */
export function calculateExponentialBackoff(
  attempts: number,
  baseSeconds = 30,
  maxSeconds = 3600
): number {
  if (attempts <= 0) return 0;
  const backoff = baseSeconds * Math.pow(2, attempts - 1);
  return Math.min(backoff, maxSeconds);
}

/**
 * Builds standard dedupe_key for scheduled jobs.
 * Format: `${jobType}:${scopeOrDate}`
 */
export function buildJobDedupeKey(jobType: string, dateOrScope: string): string {
  return `${jobType}:${dateOrScope}`;
}
