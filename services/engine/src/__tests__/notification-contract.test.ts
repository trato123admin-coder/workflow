import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendAlertNotification } from '../services/alert-engine-common.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getSqlMigrationParams(): string[] {
  const migrationsDir = path.resolve(__dirname, '../../../../supabase/migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // orden cronológico por timestamp de prefijo

  let latestFnMatch: RegExpMatchArray | null = null;

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const match = content.match(
      /create\s+or\s+replace\s+function\s+public\.create_notification\s*\(([\s\S]*?)\)\s*returns/i,
    );
    if (match && match[1]) {
      latestFnMatch = match;
    }
  }

  if (!latestFnMatch || !latestFnMatch[1]) {
    throw new Error(
      'No se encontró ninguna definición de create_notification en las migraciones SQL',
    );
  }

  // Extraer todos los identificadores que comiencen con p_ de la última definición
  const matches = [...latestFnMatch[1].matchAll(/\b(p_[a-zA-Z0-9_]+)\b/g)];
  const paramNames = Array.from(
    new Set(matches.map((m) => m[1]).filter((p): p is string => Boolean(p))),
  );
  return paramNames;
}

describe('Engine: Notification RPC Contract [unitaria] (S8-04, 20260929110000)', () => {
  it('[unitaria] sendAlertNotification envía exactamente las claves requeridas por la función create_notification SQL (extraídas dinámicamente con regex)', async () => {
    let capturedArgs: Record<string, unknown> | null = null;

    const mockSupabase = {
      rpc: vi.fn().mockImplementation(async (fnName: string, args: Record<string, unknown>) => {
        if (fnName === 'create_notification') {
          capturedArgs = args;
          return { data: { id: 'notif-uuid-1234' }, error: null };
        }
        return { data: null, error: null };
      }),
    } as unknown as SupabaseClient;

    const sent = await sendAlertNotification(mockSupabase, {
      userId: '11111111-1111-1111-1111-111111111111',
      notificationType: 'CASE_STAGNANT',
      title: 'Expediente estancado',
      body: 'El expediente EXP-001 requiere atención',
      caseId: '22222222-2222-2222-2222-222222222222',
      entityType: 'cases',
      entityId: '22222222-2222-2222-2222-222222222222',
      actionUrl: '/cases/22222222-2222-2222-2222-222222222222',
      severity: 'warning',
      dedupeKey:
        'stagnant:22222222-2222-2222-2222-222222222222:11111111-1111-1111-1111-111111111111:2026-10-03',
      metadata: { case_id: '22222222-2222-2222-2222-222222222222' },
    });

    expect(sent).toBe(true);
    expect(capturedArgs).not.toBeNull();

    // Validar que capturedArgs tiene exactamente las 12 claves del contrato SQL dinámico
    const expectedSqlParams = getSqlMigrationParams();
    expect(expectedSqlParams.length).toBeGreaterThan(0);

    const argKeys = Object.keys(capturedArgs!).sort();
    expect(argKeys).toEqual([...expectedSqlParams].sort());

    // Validar que la clave p_type no usa el nombre inválido p_notification_type
    expect(capturedArgs!).toHaveProperty('p_type', 'CASE_STAGNANT');
    expect(capturedArgs!).not.toHaveProperty('p_notification_type');

    // Validar que severity sea un valor compatible con el check constraint (info, warning, critical)
    expect(['info', 'warning', 'critical']).toContain(
      (capturedArgs as Record<string, unknown> | null)?.p_severity,
    );
  });

  it('[unitaria] confirma inserción solo cuando data?.id es válido; (a) null y (b) campos null retornan false, (c) fila con id retorna true', async () => {
    // (a) Mock retorna null
    const mockSupabaseNull = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as SupabaseClient;

    const resultA = await sendAlertNotification(mockSupabaseNull, {
      userId: '11111111-1111-1111-1111-111111111111',
      notificationType: 'FILING_DUE_SOON',
      title: 'Prueba null',
      body: 'Cuerpo',
    });
    expect(resultA).toBe(false);

    // (b) Mock retorna objeto con todos los campos null
    const mockSupabaseNullFields = {
      rpc: vi.fn().mockResolvedValue({ data: { id: null, title: null, body: null }, error: null }),
    } as unknown as SupabaseClient;

    const resultB = await sendAlertNotification(mockSupabaseNullFields, {
      userId: '11111111-1111-1111-1111-111111111111',
      notificationType: 'FILING_DUE_SOON',
      title: 'Prueba campos null',
      body: 'Cuerpo',
    });
    expect(resultB).toBe(false);

    // (c) Mock retorna fila con ID insertado
    const mockSupabaseSuccess = {
      rpc: vi.fn().mockResolvedValue({ data: { id: 'notif-inserted-uuid-123' }, error: null }),
    } as unknown as SupabaseClient;

    const resultC = await sendAlertNotification(mockSupabaseSuccess, {
      userId: '11111111-1111-1111-1111-111111111111',
      notificationType: 'FILING_DUE_SOON',
      title: 'Prueba inserción válida',
      body: 'Cuerpo',
    });
    expect(resultC).toBe(true);
  });

  it('[unitaria] sendAlertNotification arroja excepción si la RPC retorna error para permitir reintento del worker', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied for function create_notification' },
      }),
    } as unknown as SupabaseClient;

    await expect(
      sendAlertNotification(mockSupabase, {
        userId: '11111111-1111-1111-1111-111111111111',
        notificationType: 'CASE_STAGNANT',
        title: 'Prueba fallo',
        body: 'Cuerpo prueba fallo',
      }),
    ).rejects.toThrow('Fallo en notificación RPC [42501]');
  });
});
