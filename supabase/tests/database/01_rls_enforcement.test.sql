-- pgTAP Tests: Sprint 0 — Fundaciones
-- 1. All public tables have RLS enabled (CI fails if any table lacks RLS)
-- 2. anon and authenticated have no privileges on audit_logs, job_queue, case_counters
-- 3. private schema is not exposed to anon/authenticated
-- 4. audit_logs is append-only (immutable trigger raises exception on UPDATE/DELETE)
-- 5. private.next_case_number() returns valid AAAA-NNNNNN format

begin;
select plan(12);

-- Test 1: Critical RLS Check - ALL public tables must have rowsecurity = true
select is(
  (select count(*)::integer from pg_tables where schemaname = 'public' and rowsecurity = false),
  0,
  'CRITICAL: All public tables must have Row Level Security (RLS) enabled'
);

-- Test 2: Verify private schema usage is revoked from anon and authenticated
select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'anon must not have USAGE on schema private'
);

select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated must not have USAGE on schema private'
);

-- Test 3: Verify anon has no privileges on base tables
select ok(
  not has_table_privilege('anon', 'public.audit_logs', 'SELECT, INSERT, UPDATE, DELETE'),
  'anon must not have table privileges on public.audit_logs'
);

select ok(
  not has_table_privilege('anon', 'public.job_queue', 'SELECT, INSERT, UPDATE, DELETE'),
  'anon must not have table privileges on public.job_queue'
);

select ok(
  not has_table_privilege('anon', 'public.case_counters', 'SELECT, INSERT, UPDATE, DELETE'),
  'anon must not have table privileges on public.case_counters'
);

-- Test 4: Verify authenticated has no privileges on base tables in Sprint 0
select ok(
  not has_table_privilege('authenticated', 'public.audit_logs', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated must not have table privileges on public.audit_logs'
);

select ok(
  not has_table_privilege('authenticated', 'public.job_queue', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated must not have table privileges on public.job_queue'
);

select ok(
  not has_table_privilege('authenticated', 'public.case_counters', 'SELECT, INSERT, UPDATE, DELETE'),
  'authenticated must not have table privileges on public.case_counters'
);

-- Test 5: Verify audit_logs immutability
insert into public.audit_logs (action, module) values ('TEST_ACTION', 'TEST_MODULE');

select throws_ok(
  $$ update public.audit_logs set action = 'MODIFIED' where action = 'TEST_ACTION' $$,
  'Registro inmutable: no se permite modificacion ni eliminacion',
  'audit_logs must reject UPDATE operations'
);

select throws_ok(
  $$ delete from public.audit_logs where action = 'TEST_ACTION' $$,
  'Registro inmutable: no se permite modificacion ni eliminacion',
  'audit_logs must reject DELETE operations'
);

-- Test 6: Verify next_case_number format
select matches(
  private.next_case_number(),
  '^\d{4}-\d{6}$',
  'private.next_case_number() must return format YYYY-NNNNNN'
);

select * from finish();
rollback;
