import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateDailyDigests } from '../services/daily-digest.js';
import { runNightlyMaintenance } from '../services/nightly-maintenance.js';
import { initializeAlertEngine } from '../services/alert-engine.js';
import { getJobHandler, type ClaimedJob } from '../services/jobs-worker.js';

describe('Engine: Daily Digest & Nightly Maintenance [mock] (S8-05, ADR-006)', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const caseId = '22222222-2222-2222-2222-222222222222';

  let mockSupabase: SupabaseClient;
  let notificationsSent: Array<Record<string, unknown>> = [];
  let jobQueueFilters: { eq?: { col: string; val: unknown }; lt?: { col: string; val: unknown } } =
    {};
  let notificationsFilters: {
    eq?: { col: string; val: unknown };
    lt?: { col: string; val: unknown };
  } = {};

  const silentLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    notificationsSent = [];
    jobQueueFilters = {};
    notificationsFilters = {};

    mockSupabase = {
      rpc: vi.fn().mockImplementation(async (fnName: string, args: Record<string, unknown>) => {
        if (fnName === 'create_notification') {
          notificationsSent.push(args);
          return { data: { id: 'notif-1' }, error: null };
        }
        return { data: null, error: null };
      }),
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'system_settings') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'holidays') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'catalog_items') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [
                    { code: 'OPEN', metadata: { category: 'ACTIVE' } },
                    { code: 'IN_PROGRESS', metadata: { category: 'ACTIVE' } },
                    { code: 'ON_HOLD', metadata: { category: 'PAUSED' } },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'case_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [{ user_id: userId, case_id: caseId }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'cases') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: caseId, last_activity_at: new Date().toISOString() }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'case_filings') {
          const filingsBuilder: Record<string, unknown> = {};
          filingsBuilder.in = vi.fn().mockReturnValue(filingsBuilder);
          filingsBuilder.not = vi.fn().mockResolvedValue({
            data: [{ id: 'filing-1', response_due_date: '2026-10-01' }],
            error: null,
          });
          return {
            select: vi.fn().mockReturnValue(filingsBuilder),
          };
        }
        if (table === 'case_documents') {
          const docsBuilder: Record<string, unknown> = {};
          docsBuilder.in = vi.fn().mockReturnValue(docsBuilder);
          docsBuilder.eq = vi.fn().mockReturnValue(docsBuilder);
          docsBuilder.not = vi.fn().mockResolvedValue({
            data: [],
            error: null,
          });
          return {
            select: vi.fn().mockReturnValue(docsBuilder),
          };
        }
        if (table === 'job_queue') {
          const deleteBuilder = {
            eq: vi.fn().mockImplementation((col: string, val: unknown) => {
              jobQueueFilters.eq = { col, val };
              return deleteBuilder;
            }),
            lt: vi.fn().mockImplementation((col: string, val: unknown) => {
              jobQueueFilters.lt = { col, val };
              return deleteBuilder;
            }),
            select: vi.fn().mockResolvedValue({
              data: [{ id: 'job-old-1' }, { id: 'job-old-2' }],
              error: null,
            }),
          };
          return {
            delete: vi.fn().mockReturnValue(deleteBuilder),
          };
        }
        if (table === 'notifications') {
          const deleteBuilder = {
            eq: vi.fn().mockImplementation((col: string, val: unknown) => {
              notificationsFilters.eq = { col, val };
              return deleteBuilder;
            }),
            lt: vi.fn().mockImplementation((col: string, val: unknown) => {
              notificationsFilters.lt = { col, val };
              return deleteBuilder;
            }),
            select: vi.fn().mockResolvedValue({
              data: [{ id: 'notif-old-1' }],
              error: null,
            }),
          };
          return {
            delete: vi.fn().mockReturnValue(deleteBuilder),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) => resolve({ data: [], error: null }),
        };
      }),
    } as unknown as SupabaseClient;
  });

  describe('1. Daily Digest', () => {
    it('[mock] genera resumen matutino con severidad critical si hay trámites vencidos y actionUrl a /today', async () => {
      const summary = await generateDailyDigests(mockSupabase, silentLogger);

      expect(summary.usersEvaluated).toBe(1);
      expect(summary.digestsCreated).toBe(1);
      expect(notificationsSent).toHaveLength(1);

      const notif = notificationsSent[0];
      expect(notif?.p_type).toBe('DAILY_DIGEST');
      expect(notif?.p_severity).toBe('critical');
      expect(notif?.p_action_url).toBe('/today');
      expect(notif?.p_dedupe_key).toMatch(/^daily_digest:[a-f0-9-]+:[a-f0-9-]+:\d{4}-\d{2}-\d{2}$/);
      expect(notif?.p_body).toContain('1 trámite(s) vencido(s)');
    });

    it('[mock] handler daily_digest está registrado en alert-engine', async () => {
      initializeAlertEngine();
      const handler = getJobHandler('daily_digest');
      expect(handler).toBeDefined();

      const fakeJob: ClaimedJob = {
        id: 'job-digest',
        job_type: 'daily_digest',
        payload: {},
        attempts: 1,
        max_attempts: 3,
      };

      const result = await handler!(fakeJob, mockSupabase, silentLogger);
      expect(result).toHaveProperty('digestsCreated');
    });

    it('[mock] un error de BD en un usuario se acumula y falla al final sin abortar a los demás usuarios', async () => {
      const user1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const user2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      const case1 = '11111111-1111-1111-1111-111111111111';
      const case2 = '22222222-2222-2222-2222-222222222222';

      const multiUserSupabase = {
        ...mockSupabase,
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'case_assignments') {
            return {
              select: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({
                    data: [
                      { user_id: user1, case_id: case1 },
                      { user_id: user2, case_id: case2 },
                    ],
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'cases') {
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockImplementation((_col: string, ids: string[]) => {
                  return Promise.resolve({
                    data: ids.map((id) => ({ id, last_activity_at: new Date().toISOString() })),
                    error: null,
                  });
                }),
              }),
            };
          }
          return (mockSupabase as unknown as { from: (t: string) => unknown }).from(table);
        }),
        rpc: vi.fn().mockImplementation(async (fnName: string, args: Record<string, unknown>) => {
          if (fnName === 'create_notification') {
            if (args.p_user_id === user1) {
              return {
                data: null,
                error: { code: '57P01', message: 'Fallo transitorio de conexión' },
              };
            }
            notificationsSent.push(args);
            return { data: { id: 'notif-user-2' }, error: null };
          }
          return { data: null, error: null };
        }),
      } as unknown as SupabaseClient;

      await expect(generateDailyDigests(multiUserSupabase, silentLogger)).rejects.toThrow(
        /Fallo en daily_digest: 1 error\(es\) \[57P01\]/,
      );

      // Verificar que el usuario 2 sí recibió su digest a pesar del fallo en usuario 1
      expect(notificationsSent).toHaveLength(1);
      expect(notificationsSent[0]?.p_user_id).toBe(user2);
    });
  });

  describe('2. Nightly Maintenance & Decoupled Cash', () => {
    it('[mock] purga jobs y notificaciones antiguas usando filtros correctos según DDL (ADR-006)', async () => {
      const summary = await runNightlyMaintenance(mockSupabase, silentLogger);

      expect(summary.jobsPurged).toBe(2);
      expect(summary.notificationsPurged).toBe(1);
      expect(summary.completedAt).toBeDefined();

      // Verificar que los filtros de purga de job_queue coinciden con el DDL (solo DONE)
      expect(jobQueueFilters.eq).toEqual({
        col: 'status',
        val: 'DONE',
      });
      expect(jobQueueFilters.lt?.col).toBe('finished_at');
      expect(typeof jobQueueFilters.lt?.val).toBe('string');

      // Verificar que los filtros de purga de notifications coinciden con el DDL (is_read=true y read_at < corte)
      expect(notificationsFilters.eq).toEqual({
        col: 'is_read',
        val: true,
      });
      expect(notificationsFilters.lt?.col).toBe('read_at');
      expect(typeof notificationsFilters.lt?.val).toBe('string');

      // Verificar que NO se invocó RPC ni tablas de caja chica
      expect(mockSupabase.rpc).not.toHaveBeenCalledWith('verify_cash_integrity');
      expect(mockSupabase.from).not.toHaveBeenCalledWith('cash_accounts');
      expect(mockSupabase.from).not.toHaveBeenCalledWith('cash_movements');
    });

    it('[mock] lanza excepción y loguea el error code si purgeOldJobs falla', async () => {
      const failingSupabase = {
        ...mockSupabase,
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'system_settings') {
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            };
          }
          if (table === 'job_queue') {
            return {
              delete: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  lt: vi.fn().mockReturnValue({
                    select: vi.fn().mockResolvedValue({
                      data: null,
                      error: { code: 'P0400', message: 'error al purgar' },
                    }),
                  }),
                }),
              }),
            };
          }
          return (mockSupabase as unknown as { from: (t: string) => unknown }).from(table);
        }),
      } as unknown as SupabaseClient;

      await expect(runNightlyMaintenance(failingSupabase, silentLogger)).rejects.toThrow(
        'Error al purgar trabajos antiguos [P0400]',
      );
      expect(silentLogger.error).toHaveBeenCalledWith(
        { code: 'P0400' },
        'Error al purgar trabajos antiguos',
      );
    });

    it('[mock] lanza excepción y loguea el error code si purgeOldNotifications falla', async () => {
      const failingSupabase = {
        ...mockSupabase,
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'system_settings') {
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            };
          }
          if (table === 'job_queue') {
            return {
              delete: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  lt: vi.fn().mockReturnValue({
                    select: vi.fn().mockResolvedValue({
                      data: [{ id: 'job-1' }],
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'notifications') {
            return {
              delete: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  lt: vi.fn().mockReturnValue({
                    select: vi.fn().mockResolvedValue({
                      data: null,
                      error: { code: 'P0401', message: 'error al purgar notificaciones' },
                    }),
                  }),
                }),
              }),
            };
          }
          return (mockSupabase as unknown as { from: (t: string) => unknown }).from(table);
        }),
      } as unknown as SupabaseClient;

      await expect(runNightlyMaintenance(failingSupabase, silentLogger)).rejects.toThrow(
        'Error al purgar notificaciones antiguas [P0401]',
      );
      expect(silentLogger.error).toHaveBeenCalledWith(
        { code: 'P0401' },
        'Error al purgar notificaciones antiguas',
      );
    });

    it('[mock] handler nightly_maintenance está registrado en alert-engine', async () => {
      initializeAlertEngine();
      const handler = getJobHandler('nightly_maintenance');
      expect(handler).toBeDefined();

      const fakeJob: ClaimedJob = {
        id: 'job-maint',
        job_type: 'nightly_maintenance',
        payload: {},
        attempts: 1,
        max_attempts: 3,
      };

      const result = await handler!(fakeJob, mockSupabase, silentLogger);
      expect(result).toHaveProperty('jobsPurged');
      expect(result).toHaveProperty('notificationsPurged');
    });
  });
});
