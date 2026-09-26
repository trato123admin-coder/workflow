-- Script de Verificación: 20260925140000_case_comments_and_search_schema.verify.sql
-- Ejecutar en el SQL Editor de Supabase Staging tras aplicar la migración 20260925140000_case_comments_and_search_schema.sql
-- No modifica datos. Cada consulta incluye el resultado esperado en comentarios.

-- 1. Verificar que case_comments existe en public y tiene RLS activa (rowsecurity = true)
-- Resultado esperado: 1 fila con rowsecurity = true
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
   and tablename = 'case_comments';
-- Esperado:
-- case_comments | true

-- 2. Verificar que no exista ninguna tabla en public sin RLS
-- Resultado esperado: 0
select count(*) as public_tables_without_rls
  from pg_tables
 where schemaname = 'public'
   and rowsecurity = false;
-- Esperado: 0

-- 3. Verificar los índices de rendimiento y claves foráneas en case_comments
-- Resultado esperado: 2 filas para los índices creados
select indexname, tablename
  from pg_indexes
 where schemaname = 'public'
   and tablename = 'case_comments'
   and indexname in ('idx_case_comments_case_date', 'idx_case_comments_user')
 order by indexname;
-- Esperado:
-- idx_case_comments_case_date | case_comments
-- idx_case_comments_user      | case_comments

-- 4. Verificar que las nuevas funciones de Sprint 4b son SECURITY DEFINER (prosecdef = true)
-- Resultado esperado: 3 filas con prosecdef = true
select p.proname, n.nspname, p.prosecdef
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where (n.nspname = 'private' and p.proname = 'tg_case_comments_audit')
    or (n.nspname = 'public' and p.proname in ('duplicate_case', 'global_search'))
 order by n.nspname, p.proname;
-- Esperado:
-- tg_case_comments_audit | private | true
-- duplicate_case         | public  | true
-- global_search          | public  | true

-- 5. Verificar las 4 políticas RLS creadas sobre case_comments
-- Resultado esperado: 4 filas (select, insert, update, delete)
select policyname, cmd, permissive
  from pg_policies
 where schemaname = 'public'
   and tablename = 'case_comments'
 order by cmd;
-- Esperado:
-- case_comments_delete | DELETE | PERMISSIVE
-- case_comments_insert | INSERT | PERMISSIVE
-- case_comments_select | SELECT | PERMISSIVE
-- case_comments_update | UPDATE | PERMISSIVE

-- 6. Verificar que los triggers automáticos están activos en case_comments
-- Resultado esperado: 2 filas
select tgname
  from pg_trigger
 where tgrelid = 'public.case_comments'::regclass
   and tgname in ('set_case_comments_updated_at', 'trg_case_comments_audit')
 order by tgname;
-- Esperado:
-- set_case_comments_updated_at
-- trg_case_comments_audit
