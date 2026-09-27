-- pgTAP Tests: Sprint 7b — Generación de documentos y aprobación
-- Archivo: supabase/tests/database/10_generation_jobs.test.sql

create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(20);

-- ============================================================================
-- 1. ESTRUCTURA: Tablas existen
-- ============================================================================
select has_table('public', 'generation_jobs', 'Existe tabla generation_jobs');
select has_table('public', 'generated_documents', 'Existe tabla generated_documents');

-- ============================================================================
-- 2. RLS habilitada en ambas tablas
-- ============================================================================
select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'generation_jobs'),
  'generation_jobs tiene RLS habilitada'
);
select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'generated_documents'),
  'generated_documents tiene RLS habilitada'
);

-- ============================================================================
-- 3. COLUMNAS: generation_jobs tiene las columnas esperadas
-- ============================================================================
select has_column('public', 'generation_jobs', 'id', 'generation_jobs tiene columna id');
select has_column('public', 'generation_jobs', 'case_id', 'generation_jobs tiene columna case_id');
select has_column('public', 'generation_jobs', 'template_id', 'generation_jobs tiene columna template_id');
select has_column('public', 'generation_jobs', 'input_data', 'generation_jobs tiene columna input_data');
select has_column('public', 'generation_jobs', 'idempotency_key', 'generation_jobs tiene columna idempotency_key');
select has_column('public', 'generation_jobs', 'status', 'generation_jobs tiene columna status');
select has_column('public', 'generation_jobs', 'requested_by', 'generation_jobs tiene columna requested_by');

-- ============================================================================
-- 4. COLUMNAS: generated_documents tiene las columnas esperadas
-- ============================================================================
select has_column('public', 'generated_documents', 'id', 'generated_documents tiene columna id');
select has_column('public', 'generated_documents', 'generation_job_id', 'generated_documents tiene columna generation_job_id');
select has_column('public', 'generated_documents', 'sha256', 'generated_documents tiene columna sha256');
select has_column('public', 'generated_documents', 'format', 'generated_documents tiene columna format');
select has_column('public', 'generated_documents', 'approval_status', 'generated_documents tiene columna approval_status');
select has_column('public', 'generated_documents', 'approved_by', 'generated_documents tiene columna approved_by');

-- ============================================================================
-- 5. CONSTRAINTS: idempotency_key es UNIQUE
-- ============================================================================
select ok(
  exists(
    select 1 from information_schema.table_constraints
     where table_schema = 'public'
       and table_name = 'generation_jobs'
       and constraint_type = 'UNIQUE'
       and constraint_name like '%idempotency_key%'
  ),
  'generation_jobs tiene constraint UNIQUE en idempotency_key'
);

-- ============================================================================
-- 6. ENUM gen_status existe con los valores correctos
-- ============================================================================
select ok(
  exists(
    select 1 from pg_type
     where typname = 'gen_status'
       and typnamespace = (select oid from pg_namespace where nspname = 'public')
  ),
  'Enum gen_status existe en esquema public'
);

-- ============================================================================
-- 7. RPC create_generation_job existe
-- ============================================================================
select ok(
  exists(
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_generation_job'
  ),
  'Función RPC create_generation_job existe'
);

select * from finish();
rollback;
