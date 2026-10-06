import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  registerJobHandler,
  getJobHandler,
  clearJobHandlers,
  claimJobsBatch,
  completeJobExecution,
  failJobExecution,
  processSingleJob,
  type ClaimedJob,
} from '../services/jobs-worker.js';

describe('Engine: Jobs Worker Logic [mock] (S8-01, S8-02)', () => {
  beforeEach(() => {
    clearJobHandlers();
    vi.clearAllMocks();
  });

  it('[mock] registra y obtiene handlers de trabajo por tipo insensible a mayúsculas', () => {
    const handler = vi.fn();
    registerJobHandler('DUE_ALERTS', handler);

    expect(getJobHandler('due_alerts')).toBe(handler);
    expect(getJobHandler('DUE_ALERTS')).toBe(handler);
    expect(getJobHandler('inexistente')).toBeUndefined();
  });

  it('[mock] claimJobsBatch invoca public.claim_jobs con timeout configurado', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [{ id: 'job-1', job_type: 'due_alerts', payload: {}, attempts: 0, max_attempts: 3 }],
      error: null,
    });
    const mockSupabase = { rpc: mockRpc } as unknown as SupabaseClient;

    const result = await claimJobsBatch(mockSupabase, 'worker-1', 5, 20);

    expect(mockRpc).toHaveBeenCalledWith('claim_jobs', {
      p_worker_id: 'worker-1',
      p_batch_size: 5,
      p_lock_timeout_minutes: 20,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('job-1');
  });

  it('[mock] completeJobExecution invoca public.complete_job con resultado JSON', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockSupabase = { rpc: mockRpc } as unknown as SupabaseClient;

    await completeJobExecution(mockSupabase, 'job-1', { processedCount: 10 });

    expect(mockRpc).toHaveBeenCalledWith('complete_job', {
      p_job_id: 'job-1',
      p_result: { processedCount: 10 },
    });
  });

  it('[mock] failJobExecution invoca public.fail_job con mensaje de error', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockSupabase = { rpc: mockRpc } as unknown as SupabaseClient;

    await failJobExecution(mockSupabase, 'job-1', 'Timeout al conectar con servicio');

    expect(mockRpc).toHaveBeenCalledWith('fail_job', {
      p_job_id: 'job-1',
      p_error: 'Timeout al conectar con servicio',
    });
  });

  it('[mock] processSingleJob completa exitosamente cuando el handler resuelve sin error', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockSupabase = { rpc: mockRpc } as unknown as SupabaseClient;

    registerJobHandler('test_job', async () => ({ status: 'ok' }));

    const job: ClaimedJob = {
      id: 'job-ok',
      job_type: 'test_job',
      payload: {},
      attempts: 1,
      max_attempts: 3,
    };

    const success = await processSingleJob(mockSupabase, job, {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    });

    expect(success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('complete_job', {
      p_job_id: 'job-ok',
      p_result: { status: 'ok' },
    });
  });

  it('[mock] processSingleJob marca fallo cuando el handler arroja una excepción', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockSupabase = { rpc: mockRpc } as unknown as SupabaseClient;

    registerJobHandler('failing_job', async () => {
      throw new Error('Fallo simulado en handler');
    });

    const job: ClaimedJob = {
      id: 'job-err',
      job_type: 'failing_job',
      payload: {},
      attempts: 1,
      max_attempts: 3,
    };

    const success = await processSingleJob(mockSupabase, job, {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    });

    expect(success).toBe(false);
    expect(mockRpc).toHaveBeenCalledWith('fail_job', {
      p_job_id: 'job-err',
      p_error: 'Fallo simulado en handler',
    });
  });

  it('[mock] processSingleJob tolera error en fail_job sin propagar excepción al ciclo del worker', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Conexión a BD interrumpida' },
    });
    const mockSupabase = { rpc: mockRpc } as unknown as SupabaseClient;

    const job: ClaimedJob = {
      id: 'job-no-handler',
      job_type: 'unknown_type',
      payload: {},
      attempts: 1,
      max_attempts: 3,
    };

    const success = await processSingleJob(mockSupabase, job, {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    });

    expect(success).toBe(false);
  });
});
