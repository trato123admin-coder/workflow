/**
 * notifications.ts — Zod schemas, types and pure utilities for domain alerts and notifications.
 *
 * Sprint 8 (S8-03, S8-04, S8-05).
 */

import { z } from 'zod';

export const NotificationSeveritySchema = z.enum(['info', 'warning', 'critical']);
export type NotificationSeverity = z.infer<typeof NotificationSeveritySchema>;

export const NotificationChannelSchema = z.enum(['APP', 'TELEGRAM', 'EMAIL']);
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

export const NotificationTypeSchema = z.enum([
  'FILING_DUE_SOON',
  'FILING_OVERDUE',
  'DOCUMENT_EXPIRING',
  'DOCUMENT_EXPIRED',
  'CASE_STAGNANT',
  'HEIR_MISSING_DOCS',
  'DISPUTE_DECLARED',
  'CASE_NO_LAWYER',
  'DAILY_DIGEST',
  'APPROVAL_PENDING',
]);
export type KnownNotificationType = z.infer<typeof NotificationTypeSchema>;
export type NotificationType = KnownNotificationType | (string & {});

export const NotificationItemSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  type: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  entity_type: z.string().nullable().optional(),
  entity_id: z.string().uuid().nullable().optional(),
  case_id: z.string().uuid().nullable().optional(),
  action_url: z.string().nullable().optional(),
  severity: NotificationSeveritySchema.default('info'),
  channel: NotificationChannelSchema.default('APP'),
  is_read: z.boolean().default(false),
  read_at: z.string().nullable().optional(),
  dedupe_key: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
  created_at: z.string(),
});
export type NotificationItem = z.infer<typeof NotificationItemSchema>;

export const NotificationPreferenceSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  channel: NotificationChannelSchema.default('APP'),
  alert_type: z.string().min(1),
  is_enabled: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type NotificationPreference = z.infer<typeof NotificationPreferenceSchema>;

/**
 * Builds the canonical dedupe_key for domain notifications.
 * Format: `${type}:${entityId}:${userId}:${dateStr}`
 * Guarantee: The same alert is not emitted multiple times to the same user on the same day.
 */
export function buildNotificationDedupeKey(
  type: string,
  entityId: string,
  userId: string,
  dateStr: string,
): string {
  const sanitizedEntity = entityId.trim().toLowerCase();
  const sanitizedUser = userId.trim().toLowerCase();
  return `${type}:${sanitizedEntity}:${sanitizedUser}:${dateStr}`;
}

/**
 * Checks whether a case/process status category pauses the stagnation counter.
 * Rule c: The WAITING semantic category pauses the counter, never status name or code.
 */
export function isStatusStagnationPaused(statusCategory: string): boolean {
  return statusCategory.toUpperCase() === 'WAITING';
}

/**
 * Checks whether a given Date falls within working hours (America/Lima).
 * Default hours: 08:00 to 18:00, Monday to Friday (1 to 5).
 */
export function isWorkingHour(
  date: Date,
  startHour = '08:00',
  endHour = '18:00',
  workingDays: number[] = [1, 2, 3, 4, 5],
  timeZone = 'America/Lima',
): boolean {
  // Format date in target timezone to inspect day of week and hour:minute
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  let hour = '00';
  let minute = '00';
  let weekdayStr = 'Mon';

  for (const part of parts) {
    if (part.type === 'hour') hour = part.value;
    if (part.type === 'minute') minute = part.value;
    if (part.type === 'weekday') weekdayStr = part.value;
  }

  // Convert weekday to standard 1=Mon ... 7=Sun
  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  const dayOfWeek = weekdayMap[weekdayStr] ?? 1;

  if (!workingDays.includes(dayOfWeek)) {
    return false;
  }

  const currentMinutes = parseInt(hour, 10) * 60 + parseInt(minute, 10);

  const [startH, startM] = startHour.split(':').map((v) => parseInt(v, 10));
  const [endH, endM] = endHour.split(':').map((v) => parseInt(v, 10));

  const startMinutes = (startH ?? 8) * 60 + (startM ?? 0);
  const endMinutes = (endH ?? 18) * 60 + (endM ?? 0);

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}
