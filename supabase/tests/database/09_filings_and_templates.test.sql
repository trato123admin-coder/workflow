-- pgTAP Tests: Sprint 6 — Trámites externos y plantillas
-- Archivo: supabase/tests/database/09_filings_and_templates.test.sql

create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(16);

-- ============================================================================
-- 1. ESTRUCTURA Y RLS
-- ============================================================================
select has_table('public', 'external_entities', 'Existe tabla external_entities');
select has_table('public', 'case_filings', 'Existe tabla case_filings');
select has_table('public', 'document_fields', 'Existe tabla document_fields');
select has_table('public', 'templates', 'Existe tabla templates');
select has_table('public', 'template_fields', 'Existe tabla template_fields');

select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'external_entities'),
  'external_entities tiene RLS habilitada'
);
select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'case_filings'),
  'case_filings tiene RLS habilitada'
);
select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'document_fields'),
  'document_fields tiene RLS habilitada'
);
select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'templates'),
  'templates tiene RLS habilitada'
);
select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'template_fields'),
  'template_fields tiene RLS habilitada'
);

-- ============================================================================
-- 2. RESTRICCIÓN EXCLUDE EN TEMPLATES
-- ============================================================================
select ok(
  exists (
    select 1 from pg_constraint
     where conname = 'no_overlapping_template_validity'
       and contype = 'x'
  ),
  'Existe restricción EXCLUDE no_overlapping_template_validity en tabla templates'
);

-- ============================================================================
-- 3. BUCKET PRIVADO TEMPLATES
-- ============================================================================
select ok(
  exists (
    select 1 from storage.buckets
     where id = 'templates'
       and public = false
  ),
  'Existe bucket privado templates en storage.buckets'
);

-- ============================================================================
-- 4. FUNCIÓN ADD_BUSINESS_DAYS
-- ============================================================================
select is(
  public.add_business_days('2026-10-05'::date, 5),
  '2026-10-12'::date,
  'add_business_days suma 5 días hábiles a un lunes retornando el siguiente lunes'
);

-- ============================================================================
-- 5. PARÁMETRO EN SETTING_DEFINITIONS Y SYSTEM_SETTINGS
-- ============================================================================
select ok(
  exists (
    select 1 from public.setting_definitions
     where key = 'filings.publication_wait_business_days'
  ),
  'Existe definición filings.publication_wait_business_days en setting_definitions'
);

select ok(
  exists (
    select 1 from public.system_settings
     where key = 'filings.publication_wait_business_days'
  ),
  'Existe parámetro filings.publication_wait_business_days en system_settings'
);

-- ============================================================================
-- 6. DISPARADOR DE AUDITORÍA EN CASE_FILINGS
-- ============================================================================
select ok(
  exists (
    select 1 from information_schema.triggers
     where event_object_table = 'case_filings'
       and trigger_name = 'trg_audit_case_filings'
  ),
  'Existe trigger trg_audit_case_filings en case_filings'
);

select * from finish();
rollback;
