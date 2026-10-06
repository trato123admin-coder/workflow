import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getSystemSettingsConfig,
  resetSettingsCache,
  DEFAULT_SETTINGS,
} from '../services/settings-reader.js';

describe('Engine: Settings Reader [mock] (S8-03, S8-04, S8-05)', () => {
  beforeEach(() => {
    resetSettingsCache();
    vi.clearAllMocks();
  });

  it('[mock] retorna valores por defecto cuando la tabla system_settings está vacía', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    } as unknown as SupabaseClient;

    const config = await getSystemSettingsConfig(mockSupabase);

    expect(config.alertsDueDays).toEqual(DEFAULT_SETTINGS['alerts.due_days']);
    expect(config.alertsStagnationDefaultDays).toBe(
      DEFAULT_SETTINGS['alerts.stagnation_default_days'],
    );
    expect(config.officeHoursStart).toBe('08:00');
    expect(config.officeHoursEnd).toBe('18:00');
    expect(config.officeHoursWorkingDays).toEqual(DEFAULT_SETTINGS['alerts.working_days']);
    expect(config.platformLockTimeoutMinutes).toBe(
      DEFAULT_SETTINGS['platform.lock_timeout_minutes'],
    );
    expect(config.alertsDocExpiryDays).toEqual(DEFAULT_SETTINGS['alerts.doc_expiry_days']);
    expect(config.retentionDoneJobsDays).toBe(DEFAULT_SETTINGS['retention.done_jobs_days']);
    expect(config.retentionNotificationsDays).toBe(
      DEFAULT_SETTINGS['retention.notifications_days'],
    );
  });

  it('[mock] parsea y valida configuraciones personalizadas válidas desde BD', async () => {
    const customRows = [
      { key: 'alerts.due_days', value: [5, 2, 0] },
      { key: 'alerts.stagnation_default_days', value: 10 },
      { key: 'alerts.working_hours', value: '09:00 - 17:00' },
      { key: 'alerts.working_days', value: [1, 2, 3, 4, 5, 6] },
      { key: 'platform.lock_timeout_minutes', value: 30 },
      { key: 'alerts.doc_expiry_days', value: [45, 20, 7] },
      { key: 'retention.done_jobs_days', value: 14 },
      { key: 'retention.notifications_days', value: 60 },
    ];

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: customRows, error: null }),
        }),
      }),
    } as unknown as SupabaseClient;

    const config = await getSystemSettingsConfig(mockSupabase);

    expect(config.alertsDueDays).toEqual([5, 2, 0]);
    expect(config.alertsStagnationDefaultDays).toBe(10);
    expect(config.officeHoursStart).toBe('09:00');
    expect(config.officeHoursEnd).toBe('17:00');
    expect(config.officeHoursWorkingDays).toEqual([1, 2, 3, 4, 5, 6]);
    expect(config.platformLockTimeoutMinutes).toBe(30);
    expect(config.alertsDocExpiryDays).toEqual([45, 20, 7]);
    expect(config.retentionDoneJobsDays).toBe(14);
    expect(config.retentionNotificationsDays).toBe(60);
  });

  it('[mock] aplica fallbacks seguros cuando un valor en BD viola el esquema Zod', async () => {
    const invalidRows = [
      { key: 'alerts.due_days', value: 'no-es-un-array' },
      { key: 'alerts.stagnation_default_days', value: -5 },
      { key: 'alerts.working_hours', value: 'formato-invalido' },
      { key: 'platform.lock_timeout_minutes', value: 9999 },
    ];

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: invalidRows, error: null }),
        }),
      }),
    } as unknown as SupabaseClient;

    const config = await getSystemSettingsConfig(mockSupabase);

    expect(config.alertsDueDays).toEqual(DEFAULT_SETTINGS['alerts.due_days']);
    expect(config.alertsStagnationDefaultDays).toBe(
      DEFAULT_SETTINGS['alerts.stagnation_default_days'],
    );
    expect(config.officeHoursStart).toBe('08:00');
    expect(config.officeHoursEnd).toBe('18:00');
    expect(config.platformLockTimeoutMinutes).toBe(
      DEFAULT_SETTINGS['platform.lock_timeout_minutes'],
    );
  });

  it('[mock] utiliza caché en memoria dentro del TTL sin volver a consultar la BD', async () => {
    const selectMock = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [{ key: 'alerts.stagnation_default_days', value: 7 }],
        error: null,
      }),
    });
    const mockSupabase = {
      from: vi.fn().mockReturnValue({ select: selectMock }),
    } as unknown as SupabaseClient;

    const config1 = await getSystemSettingsConfig(mockSupabase);
    const config2 = await getSystemSettingsConfig(mockSupabase);

    expect(config1.alertsStagnationDefaultDays).toBe(7);
    expect(config2.alertsStagnationDefaultDays).toBe(7);
    expect(selectMock).toHaveBeenCalledTimes(1);
  });
});
