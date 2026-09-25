-- Script de Verificación: 20260925100000_cases_and_persons_schema.verify.sql
-- Ejecutar en el SQL Editor de Supabase Staging tras aplicar la migración 20260925100000_cases_and_persons_schema.sql
-- No modifica datos. Cada consulta incluye el resultado esperado en comentarios.

-- 1. Verificar que las 12 tablas nuevas existen en public y tienen RLS activa (rowsecurity = true)
-- Resultado esperado: count = 12, sin ninguna tabla con rowsecurity = false
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
   and tablename in (
     'persons', 'user_preferences', 'process_definitions', 'workflow_statuses',
     'case_models', 'case_model_versions', 'case_model_processes', 'case_model_process_deps',
     'cases', 'case_assignments', 'case_processes', 'case_events'
   )
 order by tablename;
-- Esperado: 12 filas, todas con rowsecurity = true

-- 2. Verificar que no exista ninguna tabla en public sin RLS
-- Resultado esperado: 0
select count(*) as public_tables_without_rls
  from pg_tables
 where schemaname = 'public'
   and rowsecurity = false;
-- Esperado: 0

-- 3. Verificar funciones críticas de seguridad y transacción
-- Resultado esperado: 6 filas, todas con prosecdef = true (SECURITY DEFINER)
select p.proname, n.nspname, p.prosecdef
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where (n.nspname = 'private' and p.proname in ('is_superuser', 'validate_ruc_mod11', 'can_access_case', 'can_write_case', 'can_access_person'))
    or (n.nspname = 'public' and p.proname in ('create_case_from_model', 'close_case'))
 order by n.nspname, p.proname;
-- Esperado: 7 filas con prosecdef = true

-- 4. Verificar existencia de claves foráneas compuestas a catálogos en persons y cases
-- Resultado esperado: 7 restricciones de FK compuestas
select conname, conrelid::regclass as table_name, pg_get_constraintdef(c.oid) as definition
  from pg_constraint c
 where conrelid in ('public.persons'::regclass, 'public.cases'::regclass, 'public.case_models'::regclass)
   and contype = 'f'
   and pg_get_constraintdef(c.oid) like '%catalog_items%'
 order by table_name, conname;
-- Esperado:
-- persons: foreign key (person_type_cat, person_type), (identity_doc_cat, identity_document_type), (marital_status_cat, marital_status), (nationality_cat, nationality)
-- cases: foreign key (route_cat, route), (priority_cat, priority), (status_cat, status)
-- case_models: foreign key (category_cat, category)

-- 5. Verificar disparadores de inmutabilidad y cálculo
-- Resultado esperado: 7 filas con los triggers correspondientes
select event_object_table, trigger_name, action_timing, event_manipulation
  from information_schema.triggers
 where trigger_schema = 'public'
   and event_object_table in ('case_model_versions', 'case_model_processes', 'case_model_process_deps', 'case_processes', 'case_events')
   and trigger_name in (
     'trg_guard_case_model_version_immutability',
     'trg_guard_case_model_processes_immutability',
     'trg_guard_case_model_process_deps_immutability',
     'trg_case_process_progress_before',
     'trg_case_process_progress_after',
     'trg_check_process_dependencies',
     'trg_case_events_immutable'
   )
 order by event_object_table, trigger_name;
-- Esperado: 7 triggers activos

-- 6. Verificar algoritmo RUC Módulo 11
-- Resultado esperado: true para RUCs válidos conocidos, false para inválidos
select
  private.validate_ruc_mod11('20100070970') as ruc_sunat_valido,    -- Esperado: true
  private.validate_ruc_mod11('20600000001') as ruc_falso_invalido,   -- Esperado: false
  private.validate_ruc_mod11('10456789018') as ruc_persona_valido;   -- Depende del check digit
