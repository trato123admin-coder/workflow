import { describe, it, expect } from 'vitest';
import {
  JobStatusSchema,
  JobsModeSchema,
  JobQueueItemSchema,
  calculateExponentialBackoff,
  buildJobDedupeKey,
} from '../jobs.js';
import {
  NotificationSeveritySchema,
  NotificationChannelSchema,
  NotificationItemSchema,
  buildNotificationDedupeKey,
  isStatusStagnationPaused,
  isWorkingHour,
} from '../notifications.js';

describe('Job Queue Schemas & Backoff', () => {
  it('validates job statuses and modes', () => {
    expect(JobStatusSchema.safeParse('QUEUED').success).toBe(true);
    expect(JobStatusSchema.safeParse('RUNNING').success).toBe(true);
    expect(JobStatusSchema.safeParse('DONE').success).toBe(true);
    expect(JobStatusSchema.safeParse('FAILED').success).toBe(true);
    expect(JobStatusSchema.safeParse('DEAD').success).toBe(true);
    expect(JobStatusSchema.safeParse('INVALID').success).toBe(false);

    expect(JobsModeSchema.safeParse('TICK').success).toBe(true);
    expect(JobsModeSchema.safeParse('CONTINUOUS').success).toBe(true);
    expect(JobsModeSchema.safeParse('OTHER').success).toBe(false);
  });

  it('calculates exponential backoff properly with limits', () => {
    expect(calculateExponentialBackoff(0)).toBe(0);
    expect(calculateExponentialBackoff(1, 30)).toBe(30); // 30 * 2^0
    expect(calculateExponentialBackoff(2, 30)).toBe(60); // 30 * 2^1
    expect(calculateExponentialBackoff(3, 30)).toBe(120); // 30 * 2^2
    expect(calculateExponentialBackoff(4, 30)).toBe(240); // 30 * 2^3
    // Capped by maxSeconds
    expect(calculateExponentialBackoff(10, 30, 300)).toBe(300);
  });

  it('builds standard job dedupe keys', () => {
    expect(buildJobDedupeKey('nightly_maintenance', '2026-09-30')).toBe(
      'nightly_maintenance:2026-09-30',
    );
  });

  it('validates JobQueueItemSchema format', () => {
    const valid = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      job_type: 'due_alerts',
      payload: {},
      status: 'QUEUED',
      run_at: new Date().toISOString(),
      attempts: 0,
      max_attempts: 5,
      created_at: new Date().toISOString(),
    };
    expect(JobQueueItemSchema.safeParse(valid).success).toBe(true);
  });
});

describe('Notifications & Alert Rules', () => {
  it('validates severities and channels', () => {
    expect(NotificationSeveritySchema.safeParse('info').success).toBe(true);
    expect(NotificationSeveritySchema.safeParse('warning').success).toBe(true);
    expect(NotificationSeveritySchema.safeParse('critical').success).toBe(true);
    expect(NotificationSeveritySchema.safeParse('urgent').success).toBe(false);

    expect(NotificationChannelSchema.safeParse('APP').success).toBe(true);
    expect(NotificationChannelSchema.safeParse('TELEGRAM').success).toBe(true);
    expect(NotificationChannelSchema.safeParse('EMAIL').success).toBe(true);
    expect(NotificationChannelSchema.safeParse('SMS').success).toBe(false);
  });

  it('builds canonical notification dedupe_key correctly', () => {
    const type = 'FILING_DUE_SOON';
    const entityId = '11111111-2222-3333-4444-555555555555';
    const userId = 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE';
    const dateStr = '2026-09-30';

    const key = buildNotificationDedupeKey(type, entityId, userId, dateStr);
    expect(key).toBe(
      'FILING_DUE_SOON:11111111-2222-3333-4444-555555555555:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:2026-09-30',
    );

    // Exact duplicate check
    const sameKey = buildNotificationDedupeKey(type, entityId, userId, dateStr);
    expect(key).toBe(sameKey);
  });

  it('correctly pauses stagnation counter when category is WAITING (Rule c)', () => {
    expect(isStatusStagnationPaused('WAITING')).toBe(true);
    expect(isStatusStagnationPaused('waiting')).toBe(true);
    expect(isStatusStagnationPaused('IN_PROGRESS')).toBe(false);
    expect(isStatusStagnationPaused('NOT_STARTED')).toBe(false);
    expect(isStatusStagnationPaused('REWORK')).toBe(false);
    expect(isStatusStagnationPaused('DONE')).toBe(false);
  });

  it('[unitaria] checks working hours in Lima timezone with exact boundary conditions', () => {
    // 2026-09-30 is Wednesday (day 3)
    // 12:59 UTC = 07:59 Lima -> falso (antes de 08:00)
    const beforeStart = new Date('2026-09-30T12:59:00Z');
    expect(isWorkingHour(beforeStart, '08:00', '18:00')).toBe(false);

    // 13:00 UTC = 08:00 Lima -> verdadero (inicio exacto)
    const exactStart = new Date('2026-09-30T13:00:00Z');
    expect(isWorkingHour(exactStart, '08:00', '18:00')).toBe(true);

    // 22:59 UTC = 17:59 Lima -> verdadero (último minuto laboral)
    const lastMinute = new Date('2026-09-30T22:59:00Z');
    expect(isWorkingHour(lastMinute, '08:00', '18:00')).toBe(true);

    // 23:00 UTC = 18:00 Lima -> falso (cierre de oficina)
    const exactEnd = new Date('2026-09-30T23:00:00Z');
    expect(isWorkingHour(exactEnd, '08:00', '18:00')).toBe(false);

    // 2026-10-03 is Saturday -> falso (fin de semana en Lima)
    const saturdayLima = new Date('2026-10-03T15:00:00Z');
    expect(isWorkingHour(saturdayLima, '08:00', '18:00')).toBe(false);
  });

  it('[unitaria] detects midnight correctly without "24" using 00:00-06:00 window at 05:00Z', () => {
    // 2026-10-01T05:00:00Z es exactamente 00:00 Lima (jueves, día 4)
    // En ventana 00:00 a 06:00, si la hora fuera "24:00" fallaría (> 06:00). Al ser "00:00", es true.
    const midnightUtc = new Date('2026-10-01T05:00:00Z');
    expect(isWorkingHour(midnightUtc, '00:00', '06:00')).toBe(true);
  });

  it('validates complete NotificationItemSchema', () => {
    const valid = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      user_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
      type: 'FILING_DUE_SOON',
      title: 'Trámite próximo a vencer',
      body: 'El trámite notarial vence en 2 días hábiles',
      severity: 'warning',
      channel: 'APP',
      is_read: false,
      dedupe_key: 'FILING_DUE_SOON:ent1:usr1:2026-09-30',
      created_at: new Date().toISOString(),
    };
    expect(NotificationItemSchema.safeParse(valid).success).toBe(true);
  });
});
