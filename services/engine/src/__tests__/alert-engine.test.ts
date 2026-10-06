import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  checkFilingDueAlerts,
  checkDocumentExpiryAlerts,
} from '../services/alert-engine-filings.js';
import {
  checkStagnantCasesAlerts,
  checkDisputeAlerts,
  checkUnassignedLawyerAlerts,
} from '../services/alert-engine-cases.js';
import { checkMissingHeirDocsAlerts } from '../services/alert-engine-parties.js';
import { runAllDomainAlertChecks, initializeAlertEngine } from '../services/alert-engine.js';
import { getJobHandler, type ClaimedJob } from '../services/jobs-worker.js';

describe('Engine: Domain Alert Engines [mock] (S8-04, D7)', () => {
  const caseId = '11111111-1111-1111-1111-111111111111';
  const lawyerId = '22222222-2222-2222-2222-222222222222';
  const responsibleId = '33333333-3333-3333-3333-333333333333';
  const filingId = '44444444-4444-4444-4444-444444444444';
  const docId = '55555555-5555-5555-5555-555555555555';
  const partyId = '66666666-6666-6666-6666-666666666666';
  const personId = '77777777-7777-7777-7777-777777777777';

  let mockSupabase: SupabaseClient;
  let notificationsSent: Array<Record<string, unknown>> = [];
  let selectedColumnsByTable: Record<string, string[]> = {};

  const silentLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    notificationsSent = [];
    selectedColumnsByTable = {};

    mockSupabase = {
      rpc: vi.fn().mockImplementation(async (fnName: string, args: Record<string, unknown>) => {
        if (fnName === 'create_notification') {
          notificationsSent.push(args);
          return { data: { id: 'notif-1' }, error: null };
        }
        return { data: null, error: null };
      }),
      from: vi.fn().mockImplementation((table: string) => {
        const recordCols = (cols?: unknown) => {
          if (typeof cols === 'string') {
            if (!selectedColumnsByTable[table]) selectedColumnsByTable[table] = [];
            selectedColumnsByTable[table].push(cols);
          }
        };

        if (table === 'system_settings') {
          return {
            select: vi.fn().mockImplementation((cols?: unknown) => {
              recordCols(cols);
              return {
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
            }),
          };
        }
        if (table === 'holidays') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ date: '2026-12-25' }], error: null }),
            }),
          };
        }
        if (table === 'catalog_items') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_col: string, val: unknown) => {
                const isCase = val === 'case_statuses';
                return {
                  eq: vi.fn().mockResolvedValue({
                    data: isCase
                      ? [
                          { code: 'OPEN', metadata: { category: 'ACTIVE' } },
                          { code: 'IN_PROGRESS', metadata: { category: 'ACTIVE' } },
                          { code: 'ON_HOLD', metadata: { category: 'PAUSED' } },
                        ]
                      : [
                          { code: 'SUBMITTED', metadata: { category: 'IN_PROGRESS' } },
                          { code: 'IN_REVIEW', metadata: { category: 'IN_PROGRESS' } },
                          { code: 'APPROVED', metadata: { category: 'DONE' } },
                        ],
                    error: null,
                  }),
                };
              }),
            }),
          };
        }
        if (table === 'case_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [
                    { user_id: responsibleId, assignment_type: 'RESPONSIBLE', is_primary: true },
                    { user_id: lawyerId, assignment_type: 'LAWYER', is_primary: false },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) => resolve({ data: [], error: null }),
        };
      }),
    } as unknown as SupabaseClient;
  });

  describe('1. Filings Due Alerts', () => {
    it('[mock] emite FILING_OVERDUE con severidad critical para trámite vencido sin PII en body', async () => {
      const todayLima = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
      const parts = todayLima.split('-').map(Number);
      const overdueDate = new Date(
        Date.UTC(parts[0] ?? 2026, (parts[1] ?? 10) - 1, (parts[2] ?? 1) - 5),
      )
        .toISOString()
        .split('T')[0];

      const baseFrom = mockSupabase.from;
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'case_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [{ user_id: lawyerId, assignment_type: 'LAWYER', is_primary: false }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'case_filings') {
          return {
            select: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: filingId,
                      case_id: caseId,
                      filing_kind: 'APELACION',
                      reference_number: 'EXP-1234',
                      response_due_date: overdueDate,
                      status: 'SUBMITTED',
                      responsible_user: responsibleId,
                      cases: { case_number: 'EXP-2026-001' },
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return baseFrom(table);
      });

      const summary = await checkFilingDueAlerts(mockSupabase, silentLogger);

      expect(summary.checked).toBe(1);
      expect(summary.alertsCreated).toBe(2); // responsable + abogado
      expect(notificationsSent[0]?.p_type).toBe('FILING_OVERDUE');
      expect(notificationsSent[0]?.p_severity).toBe('critical');
      expect(notificationsSent[0]?.p_case_id).toBe(caseId);
      expect(notificationsSent[0]?.p_body).toContain('EXP-2026-001');
    });
  });

  describe('2. Document Expiry Alerts', () => {
    it('[mock] emite DOCUMENT_EXPIRING con severidad acorde al umbral', async () => {
      const todayLima = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
      const parts = todayLima.split('-').map(Number);
      const expiringDate = new Date(
        Date.UTC(parts[0] ?? 2026, (parts[1] ?? 10) - 1, (parts[2] ?? 1) + 2),
      )
        .toISOString()
        .split('T')[0];

      const baseFrom = mockSupabase.from;
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'case_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [{ user_id: lawyerId, assignment_type: 'LAWYER', is_primary: false }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'case_documents') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  not: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: docId,
                        case_id: caseId,
                        valid_until: expiringDate,
                        status: 'VALIDATED',
                        document_types: { name: 'Partida de Defunción' },
                        cases: { case_number: 'EXP-2026-001' },
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return baseFrom(table);
      });

      const summary = await checkDocumentExpiryAlerts(mockSupabase, silentLogger);

      expect(summary.checked).toBe(1);
      expect(summary.alertsCreated).toBe(1);
      expect(notificationsSent[0]?.p_type).toBe('DOCUMENT_EXPIRING');
      expect(notificationsSent[0]?.p_severity).toBe('critical'); // <= 5 días es critical
      expect(notificationsSent[0]?.p_case_id).toBe(caseId);
      expect(notificationsSent[0]?.p_body).toContain('días hábiles');
    });
  });

  describe('3. Case Stagnation Alerts', () => {
    it('[mock] omite caso estancado si un proceso aplicable está en categoría WAITING', async () => {
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'catalog_items') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ code: 'IN_PROGRESS', metadata: { category: 'ACTIVE' } }],
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
                data: [
                  {
                    id: caseId,
                    case_number: 'EXP-WAITING',
                    last_activity_at: '2026-01-01T00:00:00Z',
                    status: 'IN_PROGRESS',
                    case_processes: [
                      {
                        id: 'proc-1',
                        sla_days: 10,
                        is_applicable: true,
                        workflow_statuses: { code: 'PENDING_REG', category: 'WAITING' },
                      },
                    ],
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const summary = await checkStagnantCasesAlerts(mockSupabase, silentLogger);

      expect(summary.alertsCreated).toBe(0);
      expect(notificationsSent).toHaveLength(0);
    });

    it('[mock] emite CASE_STAGNANT con severidad warning cuando excede SLA en días hábiles', async () => {
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'catalog_items') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ code: 'IN_PROGRESS', metadata: { category: 'ACTIVE' } }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'case_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [{ user_id: lawyerId, assignment_type: 'LAWYER', is_primary: false }],
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
                data: [
                  {
                    id: caseId,
                    case_number: 'EXP-STAGNANT',
                    last_activity_at: '2026-01-01T00:00:00Z',
                    status: 'IN_PROGRESS',
                    case_processes: [
                      {
                        id: 'proc-1',
                        sla_days: 5,
                        is_applicable: true,
                        workflow_statuses: { code: 'EN_TRAMITE', category: 'IN_PROGRESS' },
                      },
                    ],
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const summary = await checkStagnantCasesAlerts(mockSupabase, silentLogger);

      expect(summary.alertsCreated).toBe(1);
      expect(notificationsSent[0]?.p_type).toBe('CASE_STAGNANT');
      expect(notificationsSent[0]?.p_severity).toBe('warning');
      expect(notificationsSent[0]?.p_case_id).toBe(caseId);
    });

    it('[mock] respeta días hábiles: no emite alerta si los días útiles transcurridos son menores al SLA', async () => {
      // Última actividad reciente (hoy en Lima) -> 0 días hábiles
      const todayLima = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'catalog_items') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ code: 'IN_PROGRESS', metadata: { category: 'ACTIVE' } }],
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
                data: [
                  {
                    id: caseId,
                    case_number: 'EXP-RECENT',
                    last_activity_at: `${todayLima}T10:00:00-05:00`,
                    status: 'IN_PROGRESS',
                    case_processes: [
                      {
                        id: 'proc-1',
                        sla_days: 5,
                        is_applicable: true,
                        workflow_statuses: { code: 'EN_TRAMITE', category: 'IN_PROGRESS' },
                      },
                    ],
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      });

      const summary = await checkStagnantCasesAlerts(mockSupabase, silentLogger);

      expect(summary.alertsCreated).toBe(0);
      expect(notificationsSent).toHaveLength(0);
    });
  });

  describe('4. Dispute and Lawyer Alerts', () => {
    it('[mock] checkDisputeAlerts emite DISPUTE_DECLARED con severidad critical sin c.title en el cuerpo', async () => {
      const baseFrom = mockSupabase.from;
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'case_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [{ user_id: lawyerId, assignment_type: 'LAWYER', is_primary: false }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'cases') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: caseId,
                      case_number: 'EXP-2026-DISPUTE',
                      has_dispute: true,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return baseFrom(table);
      });

      const summary = await checkDisputeAlerts(mockSupabase, silentLogger);

      expect(summary.alertsCreated).toBe(1);
      expect(notificationsSent[0]?.p_type).toBe('DISPUTE_DECLARED');
      expect(notificationsSent[0]?.p_severity).toBe('critical');
      expect(notificationsSent[0]?.p_case_id).toBe(caseId);
      expect(notificationsSent[0]?.p_body).toContain('EXP-2026-DISPUTE');
      expect(notificationsSent[0]?.p_metadata).toEqual({ case_id: caseId });
    });

    it('[mock] checkUnassignedLawyerAlerts emite CASE_NO_LAWYER con severidad warning', async () => {
      const baseFrom = mockSupabase.from;
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'case_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [
                    { user_id: responsibleId, assignment_type: 'RESPONSIBLE', is_primary: true },
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
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: caseId,
                    case_number: 'EXP-NO-LAWYER',
                    status: 'IN_PROGRESS',
                    case_assignments: [{ assignment_type: 'RESPONSIBLE', ended_at: null }],
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        return baseFrom(table);
      });

      const summary = await checkUnassignedLawyerAlerts(mockSupabase, silentLogger);

      expect(summary.alertsCreated).toBe(1);
      expect(notificationsSent[0]?.p_type).toBe('CASE_NO_LAWYER');
      expect(notificationsSent[0]?.p_severity).toBe('warning');
      expect(notificationsSent[0]?.p_case_id).toBe(caseId);
    });
  });

  describe('5. Missing Heir Docs Alerts', () => {
    it('[mock] checkMissingHeirDocsAlerts emite HEIR_MISSING_DOCS sin nombre de persona en el texto', async () => {
      const baseFrom = mockSupabase.from;
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'case_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: [{ user_id: lawyerId, assignment_type: 'LAWYER', is_primary: false }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'case_parties') {
          return {
            select: vi.fn().mockImplementation((cols?: unknown) => {
              if (typeof cols === 'string') {
                if (!selectedColumnsByTable['case_parties'])
                  selectedColumnsByTable['case_parties'] = [];
                selectedColumnsByTable['case_parties'].push(cols);
              }
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    in: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: partyId,
                          case_id: caseId,
                          person_id: personId,
                          cases: { case_number: 'EXP-2026-HEIR' },
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              };
            }),
          };
        }
        if (table === 'case_documents') {
          const docBuilder: Record<string, unknown> = {};
          docBuilder.eq = vi.fn().mockReturnValue(docBuilder);
          docBuilder.then = (resolve: (v: unknown) => void) => resolve({ count: 2, error: null });
          return {
            select: vi.fn().mockReturnValue(docBuilder),
          };
        }
        return baseFrom(table);
      });

      const summary = await checkMissingHeirDocsAlerts(mockSupabase, silentLogger);

      expect(summary.alertsCreated).toBe(1);
      expect(notificationsSent[0]?.p_type).toBe('HEIR_MISSING_DOCS');
      expect(notificationsSent[0]?.p_severity).toBe('warning');
      expect(notificationsSent[0]?.p_case_id).toBe(caseId);

      // Asserts de PII sobre las columnas de .select (sin full_name de personas ni title de casos)
      const partySelectCols = selectedColumnsByTable['case_parties']?.join(' ') ?? '';
      expect(partySelectCols).not.toContain('full_name');
      expect(partySelectCols).not.toContain('title');

      expect(notificationsSent[0]?.p_metadata).toEqual({
        case_id: caseId,
        party_id: partyId,
        person_id: personId,
        pending_docs_count: 2,
      });
    });
  });

  describe('Consolidated alerts summary & Error Resilience', () => {
    it('[mock] runAllDomainAlertChecks consolida el resumen de todas las alertas', async () => {
      const summary = await runAllDomainAlertChecks(mockSupabase, silentLogger);
      expect(summary).toHaveProperty('totalAlertsCreated');
      expect(summary).toHaveProperty('filingsDue');
      expect(summary).toHaveProperty('docExpiry');
      expect(summary).toHaveProperty('stagnantCases');
    });

    it('[mock] error 42501 en create_notification cuenta en skipped y permite continuar a las siguientes alertas', async () => {
      let callCount = 0;
      const baseFrom = mockSupabase.from;
      const failingSupabase = {
        ...mockSupabase,
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'cases') {
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: caseId,
                      case_number: 'EXP-STAGNANT-ERR',
                      last_activity_at: '2026-01-01T00:00:00Z',
                      status: 'IN_PROGRESS',
                      case_processes: [
                        {
                          id: 'proc-1',
                          sla_days: 5,
                          is_applicable: true,
                          workflow_statuses: { code: 'EN_TRAMITE', category: 'IN_PROGRESS' },
                        },
                      ],
                    },
                  ],
                  error: null,
                }),
              }),
            };
          }
          return baseFrom(table);
        }),
        rpc: vi.fn().mockImplementation(async (fnName: string, args: Record<string, unknown>) => {
          if (fnName === 'create_notification') {
            callCount++;
            if (callCount === 1) {
              // El primer destinatario no tiene acceso al caso (42501)
              return { data: null, error: { code: '42501', message: 'Privacidad violada' } };
            }
            notificationsSent.push(args);
            return { data: { id: 'notif-success-2' }, error: null };
          }
          return { data: null, error: null };
        }),
      } as unknown as SupabaseClient;

      // checkStagnantCasesAlerts envía a responsable y abogado (2 destinatarios)
      // Con callCount=1 fallando con 42501, skipped debe ser 1 y alertsCreated debe ser 1
      const summary = await checkStagnantCasesAlerts(failingSupabase, silentLogger);
      expect(summary.skipped).toBe(1);
      expect(summary.alertsCreated).toBe(1);
      expect(silentLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ code: '42501', caseId }),
        'Alerta omitida: destinatario sin acceso o inexistente',
      );
    });

    it('[mock] un error transitorio de BD se acumula y hace fallar la familia al final sin exponer UUIDs', async () => {
      const baseFrom = mockSupabase.from;
      const failingSupabase = {
        ...mockSupabase,
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'cases') {
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: caseId,
                      case_number: 'EXP-STAGNANT-TRANSIENT',
                      last_activity_at: '2026-01-01T00:00:00Z',
                      status: 'IN_PROGRESS',
                      case_processes: [
                        {
                          id: 'proc-1',
                          sla_days: 5,
                          is_applicable: true,
                          workflow_statuses: { code: 'EN_TRAMITE', category: 'IN_PROGRESS' },
                        },
                      ],
                    },
                  ],
                  error: null,
                }),
              }),
            };
          }
          return baseFrom(table);
        }),
        rpc: vi.fn().mockImplementation(async (fnName: string) => {
          if (fnName === 'create_notification') {
            return {
              data: null,
              error: {
                code: '57P01',
                message: 'terminating connection due to administrator command',
              },
            };
          }
          return { data: null, error: null };
        }),
      } as unknown as SupabaseClient;

      await expect(checkStagnantCasesAlerts(failingSupabase, silentLogger)).rejects.toThrow(
        /Fallo en alertas de casos estancados: \d+ error\(es\) \[57P01\]/,
      );
    });
  });

  describe('6. Working Hours Gate in due_alerts (D7)', () => {
    it('[mock] due_alerts se omite si la hora actual está fuera del horario laboral (domingo 10:00 AM Lima probado con fake timers)', async () => {
      initializeAlertEngine();
      const handler = getJobHandler('due_alerts');
      expect(handler).toBeDefined();

      vi.useFakeTimers();
      // Domingo 2026-10-04 a las 10:00 AM Lima (15:00 UTC) -> Fuera de horario laboral (domingo no laborable)
      vi.setSystemTime(new Date('2026-10-04T15:00:00Z'));

      const fakeJob: ClaimedJob = {
        id: 'job-due-alerts',
        job_type: 'due_alerts',
        payload: {},
        attempts: 1,
        max_attempts: 3,
      };

      const result = await handler!(fakeJob, mockSupabase, silentLogger);

      expect(result).toEqual({ skipped: true, reason: 'outside_office_hours' });
      expect(silentLogger.info).toHaveBeenCalledWith(
        'due_alerts omitido: fuera de horario laboral de oficina',
      );

      vi.useRealTimers();
    });

    it('[mock] due_alerts se ejecuta si la hora actual está dentro del horario laboral (miércoles 10:00 AM Lima probado con fake timers)', async () => {
      initializeAlertEngine();
      const handler = getJobHandler('due_alerts');
      expect(handler).toBeDefined();

      vi.useFakeTimers();
      // Miércoles 2026-10-07 a las 10:00 AM Lima (15:00 UTC) -> Dentro de horario laboral (miércoles entre 08:00 y 18:00)
      vi.setSystemTime(new Date('2026-10-07T15:00:00Z'));

      const fakeJob: ClaimedJob = {
        id: 'job-due-alerts-worktime',
        job_type: 'due_alerts',
        payload: {},
        attempts: 1,
        max_attempts: 3,
      };

      const result = await handler!(fakeJob, mockSupabase, silentLogger);

      expect(result).toHaveProperty('totalAlertsCreated');
      expect(result).not.toEqual({ skipped: true, reason: 'outside_office_hours' });

      vi.useRealTimers();
    });
  });
});
