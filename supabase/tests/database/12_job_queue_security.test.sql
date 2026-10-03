-- pgTAP Tests: Sprint 8 — Seguridad y Privilegios en Motor de Trabajos (job_queue)
-- Archivo: supabase/tests/database/12_job_queue_security.test.sql

create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(18);

-- ============================================================================
-- 1. ESTRUCTURA Y RLS
-- ============================================================================
select has_table('public', 'job_queue', 'Existe tabla public.job_queue');

select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'job_queue'),
  'job_queue tiene RLS habilitada'
);

-- ============================================================================
-- 2. PRIVILEGIOS DML EN TABLA job_queue
-- authenticated solo tiene SELECT condicional, NUNCA INSERT/UPDATE/DELETE directo
-- ============================================================================
select ok(
  has_table_privilege('authenticated', 'public.job_queue', 'SELECT'),
  'authenticated tiene privilegio SELECT en job_queue (gobernado por RLS)'
);

select ok(
  not has_table_privilege('authenticated', 'public.job_queue', 'INSERT'),
  'authenticated NO tiene privilegio INSERT directo en job_queue'
);

select ok(
  not has_table_privilege('authenticated', 'public.job_queue', 'UPDATE'),
  'authenticated NO tiene privilegio UPDATE directo en job_queue'
);

select ok(
  not has_table_privilege('authenticated', 'public.job_queue', 'DELETE'),
  'authenticated NO tiene privilegio DELETE directo en job_queue'
);

-- ============================================================================
-- 3. VERIFICACIÓN DE CATÁLOGO: authenticated NO TIENE PRIVILEGIO EXECUTE
-- claim_jobs, complete_job, fail_job son EXCLUSIVAS para service_role (Engine)
-- ============================================================================
select ok(
  not has_function_privilege('authenticated', 'public.claim_jobs(text, integer, integer)', 'EXECUTE'),
  'Catálogo: authenticated NO tiene privilegio EXECUTE en claim_jobs'
);

select ok(
  not has_function_privilege('authenticated', 'public.complete_job(uuid, jsonb)', 'EXECUTE'),
  'Catálogo: authenticated NO tiene privilegio EXECUTE en complete_job'
);

select ok(
  not has_function_privilege('authenticated', 'public.fail_job(uuid, text)', 'EXECUTE'),
  'Catálogo: authenticated NO tiene privilegio EXECUTE en fail_job'
);

-- ============================================================================
-- 4. PRIVILEGIOS DE service_role EN LAS 4 FUNCIONES DEL MOTOR
-- ============================================================================
select ok(
  has_function_privilege('service_role', 'public.claim_jobs(text, integer, integer)', 'EXECUTE'),
  'service_role SI puede ejecutar public.claim_jobs'
);

select ok(
  has_function_privilege('service_role', 'public.complete_job(uuid, jsonb)', 'EXECUTE'),
  'service_role SI puede ejecutar public.complete_job'
);

select ok(
  has_function_privilege('service_role', 'public.fail_job(uuid, text)', 'EXECUTE'),
  'service_role SI puede ejecutar public.fail_job'
);

select ok(
  has_function_privilege('service_role', 'public.retry_job(uuid)', 'EXECUTE'),
  'service_role SI puede ejecutar public.retry_job'
);

-- ============================================================================
-- 5. retry_job: DISPONIBLE PARA authenticated PERO RESTRINGIDO A settings.manage
-- ============================================================================
select ok(
  has_function_privilege('authenticated', 'public.retry_job(uuid)', 'EXECUTE'),
  'Catálogo: authenticated tiene privilegio EXECUTE en retry_job (validación por settings.manage)'
);

-- ============================================================================
-- 6. PRUEBAS DE EJECUCIÓN REAL BAJO ROL authenticated (CAMBIO DE ROL)
-- Confirma que la ejecución falla de verdad con SQLSTATE 42501 (insufficient_privilege)
-- ============================================================================
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000099", "role": "authenticated", "email": "usuario_prueba@workflow.pe"}';

-- 6.1 Ejecución real de claim_jobs por authenticated DEBE FALLAR con 42501
select throws_ok(
  'select * from public.claim_jobs(''malicious-worker'', 1, 15)',
  '42501',
  'Ejecución real: authenticated recibe 42501 al intentar ejecutar claim_jobs'
);

-- 6.2 Ejecución real de complete_job por authenticated DEBE FALLAR con 42501
select throws_ok(
  format('select public.complete_job(%L::uuid, ''{}''::jsonb)', '00000000-0000-0000-0000-000000000001'),
  '42501',
  'Ejecución real: authenticated recibe 42501 al intentar ejecutar complete_job'
);

-- 6.3 Ejecución real de fail_job por authenticated DEBE FALLAR con 42501
select throws_ok(
  format('select public.fail_job(%L::uuid, ''error'')', '00000000-0000-0000-0000-000000000001'),
  '42501',
  'Ejecución real: authenticated recibe 42501 al intentar ejecutar fail_job'
);

-- 6.4 Ejecución real de retry_job por authenticated SIN settings.manage DEBE FALLAR con 42501
select throws_ok(
  format('select public.retry_job(%L::uuid)', '00000000-0000-0000-0000-000000000001'),
  '42501',
  'Ejecución real: retry_job rechaza con 42501 a usuario authenticated sin settings.manage'
);

select * from finish();
rollback;
