-- Consultas de verificación para: 20260924000000_initial_schema.sql
-- Ejecutar en Supabase SQL Editor de Staging.

-- 1. Verificar que NINGUNA tabla en public carezca de RLS
-- Resultado esperado: 0 filas
select tablename
  from pg_tables
 where schemaname = 'public'
   and rowsecurity = false;

-- 2. Verificar que las tablas base del Sprint 0 existan con RLS activa
-- Resultado esperado: 3 filas (audit_logs, case_counters, job_queue)
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
   and tablename in ('audit_logs', 'case_counters', 'job_queue')
 order by tablename;

-- 3. Verificar que el esquema private exista
-- Resultado esperado: 1 fila
select nspname from pg_namespace where nspname = 'private';

-- 4. Verificar que anon NO tenga permisos sobre audit_logs
-- Resultado esperado: false
select has_table_privilege('anon', 'public.audit_logs', 'SELECT, INSERT, UPDATE, DELETE') as anon_has_privilege;
