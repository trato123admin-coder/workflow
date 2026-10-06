import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NAV_ITEMS } from '../components/layout/Sidebar';
import {
  triggerJobsTick,
  retryJob,
  approveGeneratedDocument,
  rejectGeneratedDocument,
} from '../lib/engine-jobs-client';
import { extractNotifiedFilingIds, fetchTodayItems, TodaySupabaseClient } from '../lib/today';

const mockRpc = vi.fn();

vi.mock('../lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-jwt-token-123' } },
        error: null,
      }),
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

describe('Sprint 8 UI: Automations, Notifications & Approvals (S8-03, S8-06, S8-07)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockRpc.mockReset();
  });

  describe('Sidebar Navigation items (S8-03, S8-06, S8-07)', () => {
    it('includes "Qué Hago Hoy" linked to /today in NAV_ITEMS', () => {
      const todayItem = NAV_ITEMS.find((item) => item.href === '/today');
      expect(todayItem).toBeDefined();
      expect(todayItem?.label).toBe('Qué Hago Hoy');
    });

    it('includes "Aprobaciones" linked to /approvals requiring documents.approve', () => {
      const approvalsItem = NAV_ITEMS.find((item) => item.href === '/approvals');
      expect(approvalsItem).toBeDefined();
      expect(approvalsItem?.label).toBe('Aprobaciones');
      expect(approvalsItem?.permission).toContain('documents.approve');
    });

    it('includes "Cola de trabajos" linked to /monitoring/jobs with module.monitoring flag', () => {
      const jobsItem = NAV_ITEMS.find((item) => item.href === '/monitoring/jobs');
      expect(jobsItem).toBeDefined();
      expect(jobsItem?.label).toBe('Cola de trabajos');
      expect(jobsItem?.permission).toContain('monitoring.read');
      expect(jobsItem?.permission).toContain('settings.manage');
      expect(jobsItem?.featureFlag).toBe('module.monitoring');
    });
  });

  describe('Engine Jobs & Approval Client (engine-jobs-client)', () => {
    it('triggerJobsTick calls engine endpoint /v1/jobs/tick with session JWT', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, processed: 2, succeeded: 2, failed: 0 }),
      });

      const result = await triggerJobsTick('test_source');
      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/jobs/tick'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ source: 'test_source' }),
        }),
      );
    });

    it('retryJob invoca directamente la RPC retry_job de Supabase con sesión de usuario (D4)', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const jobId = '11111111-1111-1111-1111-111111111111';
      await retryJob(jobId);

      expect(mockRpc).toHaveBeenCalledWith('retry_job', { p_job_id: jobId });
    });

    it('approveGeneratedDocument calls /v1/generated-documents/:id/approve', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const docId = '22222222-2222-2222-2222-222222222222';
      await approveGeneratedDocument(docId);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/v1/generated-documents/${docId}/approve`),
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('rejectGeneratedDocument calls /v1/generated-documents/:id/reject with reason in body', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const docId = '33333333-3333-3333-3333-333333333333';
      await rejectGeneratedDocument(docId, 'Falta firma del notario');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/v1/generated-documents/${docId}/reject`),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ reason: 'Falta firma del notario' }),
        }),
      );
    });
  });

  describe('Qué Hago Hoy (/today) Deduplicación y Filtrado por Asignación (S8-03)', () => {
    it('extrae y deduplica IDs de trámites cuando entity_type es "case_filings" (emitido por el engine)', () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          entity_type: 'case_filings',
          entity_id: 'filing-uuid-1111',
          title: 'Trámite por vencer',
        },
        {
          id: 'notif-2',
          entity_type: 'case_filings',
          entity_id: 'filing-uuid-2222',
          title: 'Trámite vencido',
        },
        {
          id: 'notif-3',
          entity_type: 'cases',
          entity_id: 'case-uuid-3333',
          title: 'Caso estancado',
        },
        {
          id: 'notif-4',
          entity_type: 'case_filings',
          entity_id: null,
          title: 'Trámite sin id de entidad',
        },
      ];

      const notifiedIds = extractNotifiedFilingIds(mockNotifications);

      expect(notifiedIds.has('filing-uuid-1111')).toBe(true);
      expect(notifiedIds.has('filing-uuid-2222')).toBe(true);
      expect(notifiedIds.has('case-uuid-3333')).toBe(false);
      expect(notifiedIds.size).toBe(2);
    });

    it('también es compatible si entity_type viene como FILING legado', () => {
      const mockNotifications = [
        {
          id: 'notif-legacy',
          entity_type: 'FILING',
          entity_id: 'filing-uuid-legacy',
          title: 'Trámite legado',
        },
      ];

      const notifiedIds = extractNotifiedFilingIds(mockNotifications);
      expect(notifiedIds.has('filing-uuid-legacy')).toBe(true);
    });

    it('cuando el usuario no tiene casos asignados (case_assignments vacío), retorna únicamente sus notificaciones personales', async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-sin-asignaciones' } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === 'notifications') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'notif-personal-1',
                    severity: 'critical',
                    title: 'Alerta Directa',
                    body: 'Mensaje urgente',
                    is_read: false,
                    case_id: null,
                    actionUrl: '/dashboard',
                  },
                ],
                error: null,
              }),
            };
          }
          if (table === 'case_assignments') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockResolvedValue({
                data: [], // Sin asignaciones
                error: null,
              }),
            };
          }
          throw new Error(`Unexpected table called: ${table}`);
        }),
      };

      const result = await fetchTodayItems(mockClient as unknown as TodaySupabaseClient);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('notif-notif-personal-1');
      expect(result[0].category).toBe('ALERT');
      expect(result[0].severity).toBe('critical');
      // No debió consultar ni trámites ni documentos
      expect(mockClient.from).not.toHaveBeenCalledWith('case_filings');
      expect(mockClient.from).not.toHaveBeenCalledWith('case_documents');
    });

    it('cuando el catálogo filing_statuses viene vacío o con error, lanza excepción para activar banner de error', async () => {
      const mockClientEmptyCatalog = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-con-asignacion' } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === 'notifications') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (table === 'case_assignments') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockResolvedValue({
                data: [{ case_id: 'case-assigned-1' }],
                error: null,
              }),
            };
          }
          if (table === 'catalog_items') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              // Simular catálogo vacío
              then: (resolve: (val: unknown) => void) => resolve({ data: [], error: null }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }),
      };

      await expect(
        fetchTodayItems(mockClientEmptyCatalog as unknown as TodaySupabaseClient),
      ).rejects.toThrow('No se encontraron estados activos en catálogo filing_statuses');

      const mockClientCatalogError = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-con-asignacion' } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === 'notifications') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (table === 'case_assignments') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockResolvedValue({
                data: [{ case_id: 'case-assigned-1' }],
                error: null,
              }),
            };
          }
          if (table === 'catalog_items') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              then: (resolve: (val: unknown) => void) =>
                resolve({ data: null, error: { message: 'DB connection error' } }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
          };
        }),
      };

      await expect(
        fetchTodayItems(mockClientCatalogError as unknown as TodaySupabaseClient),
      ).rejects.toThrow('Error al consultar catálogo de trámites: DB connection error');
    });
  });
});
