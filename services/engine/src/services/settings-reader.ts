/**
 * settings-reader.ts — Centralized system_settings reader with Zod validation and memory caching.
 *
 * Sprint 8 (S8-03, S8-04, S8-05).
 *
 * Technical Debt / Architectural Decisions:
 * 1. D3 is not fulfilled until Migration C is applied in Phase 3 (when doc_expiry and retention keys are seeded).
 * 2. Positional threshold mapping: alerts.due_days array is mapped positionally:
 *    index 0 = T-3 (preventive), index 1 = T-1 (warning), index 2 = T-0 (urgent/critical).
 * 3. Working days: alerts.working_days in system_settings is validated via Zod (1-7)
 *    and defaults to Monday through Friday [1, 2, 3, 4, 5].
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import type { ConsoleLikeLogger } from './jobs-worker.js';

export const EXISTING_SETTING_KEYS = [
  'alerts.due_days',
  'alerts.stagnation_default_days',
  'alerts.working_hours',
  'platform.lock_timeout_minutes',
] as const;

export const PHASE3_SETTING_KEYS = [
  'alerts.doc_expiry_days',
  'alerts.working_days',
  'retention.done_jobs_days',
  'retention.notifications_days',
] as const;

export const MONITORED_SETTING_KEYS = [...EXISTING_SETTING_KEYS, ...PHASE3_SETTING_KEYS] as const;

const dueDaysListSchema = z.array(z.number().int().min(0)).nonempty();
const stagnationDaysSchema = z.number().int().min(1).max(90);
const workingHoursStrSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d\s*-\s*([01]\d|2[0-3]):[0-5]\d$/);
const workingDaysListSchema = z.array(z.number().int().min(1).max(7)).nonempty();
const lockTimeoutSchema = z.number().int().min(1).max(120);
const docExpiryListSchema = z.array(z.number().int().min(0)).nonempty();
const retentionDaysSchema = z.number().int().min(1).max(3650);

export const DEFAULT_SETTINGS = {
  'alerts.due_days': [3, 1, 0],
  'alerts.stagnation_default_days': 5,
  'alerts.working_hours': '08:00 - 18:00',
  'alerts.working_days': [1, 2, 3, 4, 5],
  'platform.lock_timeout_minutes': 15,
  'alerts.doc_expiry_days': [30, 15, 5],
  'retention.done_jobs_days': 7,
  'retention.notifications_days': 30,
} as const;

export interface SystemSettingsConfig {
  alertsDueDays: number[];
  alertsStagnationDefaultDays: number;
  officeHoursStart: string;
  officeHoursEnd: string;
  officeHoursWorkingDays: number[];
  platformLockTimeoutMinutes: number;
  alertsDocExpiryDays: number[];
  retentionDoneJobsDays: number;
  retentionNotificationsDays: number;
}

let cachedSettings: SystemSettingsConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

export function resetSettingsCache(): void {
  cachedSettings = null;
  cacheTimestamp = 0;
}

export async function getSystemSettingsConfig(
  supabase: SupabaseClient,
  logger?: FastifyBaseLogger | ConsoleLikeLogger,
): Promise<SystemSettingsConfig> {
  const now = Date.now();
  if (cachedSettings && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSettings;
  }

  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [...MONITORED_SETTING_KEYS]);

  if (error) {
    logger?.warn(
      { err: error.message },
      'No se pudo consultar system_settings; aplicando defaults',
    );
  }

  const dbMap = new Map<string, unknown>();
  for (const row of data ?? []) {
    dbMap.set(row.key, row.value);
  }

  function resolveValue<T>(
    key: keyof typeof DEFAULT_SETTINGS,
    schema: z.ZodType<T>,
    fallback: T,
  ): T {
    const raw = dbMap.get(key);
    if (raw === undefined || raw === null) return fallback;
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    logger?.warn({ key }, 'Configuración inválida en BD; aplicando valor por defecto');
    return fallback;
  }

  const workingHoursRaw = resolveValue(
    'alerts.working_hours',
    workingHoursStrSchema,
    DEFAULT_SETTINGS['alerts.working_hours'],
  );
  const [startPart = '08:00', endPart = '18:00'] = workingHoursRaw.split('-').map((s) => s.trim());

  cachedSettings = {
    alertsDueDays: resolveValue('alerts.due_days', dueDaysListSchema, [
      ...DEFAULT_SETTINGS['alerts.due_days'],
    ]),
    alertsStagnationDefaultDays: resolveValue(
      'alerts.stagnation_default_days',
      stagnationDaysSchema,
      DEFAULT_SETTINGS['alerts.stagnation_default_days'],
    ),
    officeHoursStart: startPart,
    officeHoursEnd: endPart,
    officeHoursWorkingDays: resolveValue('alerts.working_days', workingDaysListSchema, [
      ...DEFAULT_SETTINGS['alerts.working_days'],
    ]),
    platformLockTimeoutMinutes: resolveValue(
      'platform.lock_timeout_minutes',
      lockTimeoutSchema,
      DEFAULT_SETTINGS['platform.lock_timeout_minutes'],
    ),
    alertsDocExpiryDays: resolveValue('alerts.doc_expiry_days', docExpiryListSchema, [
      ...DEFAULT_SETTINGS['alerts.doc_expiry_days'],
    ]),
    retentionDoneJobsDays: resolveValue(
      'retention.done_jobs_days',
      retentionDaysSchema,
      DEFAULT_SETTINGS['retention.done_jobs_days'],
    ),
    retentionNotificationsDays: resolveValue(
      'retention.notifications_days',
      retentionDaysSchema,
      DEFAULT_SETTINGS['retention.notifications_days'],
    ),
  };
  cacheTimestamp = now;

  return cachedSettings;
}
