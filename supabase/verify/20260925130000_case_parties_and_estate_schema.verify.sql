-- Script de Verificación: 20260925130000_case_parties_and_estate_schema.verify.sql
-- Ejecutar en el SQL Editor de Supabase Staging tras aplicar la migración 20260925130000_case_parties_and_estate_schema.sql
-- No modifica datos. Cada consulta incluye el resultado esperado en comentarios.

-- 1. Verificar que las 3 tablas nuevas existen en public y tienen RLS activa (rowsecurity = true)
-- Resultado esperado: 3 filas con rowsecurity = true
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
   and tablename in ('case_parties', 'case_assets', 'case_liabilities')
 order by tablename;
-- Esperado:
-- case_assets      | true
-- case_liabilities   | true
-- case_parties      | true

-- 2. Verificar que no exista ninguna tabla en public sin RLS
-- Resultado esperado: 0
select count(*) as public_tables_without_rls
  from pg_tables
 where schemaname = 'public'
   and rowsecurity = false;
-- Esperado: 0

-- 3. Verificar el índice único parcial de un solo causante activo por expediente
-- Resultado esperado: 1 fila con one_causante_per_case y predicado party_role = 'CAUSANTE'
select indexname, indexdef
  from pg_indexes
 where schemaname = 'public'
   and tablename = 'case_parties'
   and indexname = 'one_causante_per_case';
-- Esperado:
-- one_causante_per_case | CREATE UNIQUE INDEX one_causante_per_case ON public.case_parties USING btree (case_id) WHERE ((party_role = 'CAUSANTE'::text) AND (is_active = true))

-- 4. Verificar la restricción de cuentas bancarias (solo últimos 4 dígitos)
-- Resultado esperado: 1 fila con la definición del CHECK
select conname, pg_get_constraintdef(c.oid) as definition
  from pg_constraint c
 where conrelid = 'public.case_assets'::regclass
   and conname = 'chk_case_assets_bank_account_digits';
-- Esperado:
-- chk_case_assets_bank_account_digits | CHECK (((asset_type <> 'CUENTA_BANCARIA'::text) OR (registry_ref IS NULL) OR (registry_ref ~ '^[0-9]{4}$'::text)))

-- 5. Verificar funciones de seguridad, transacción y semáforo (SECURITY DEFINER)
-- Resultado esperado: 4 filas con prosecdef = true
select p.proname, n.nspname, p.prosecdef
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where (n.nspname = 'private' and p.proname in ('can_access_person', 'tg_audit_log'))
    or (n.nspname = 'public' and p.proname in ('create_case_from_model', 'get_case_semaphore_warnings'))
 order by n.nspname, p.proname;
-- Esperado:
-- can_access_person            | private | true
-- tg_audit_log                 | private | true
-- create_case_from_model       | public  | true
-- get_case_semaphore_warnings  | public  | true

-- 6. Verificar las 12 políticas RLS creadas (4 por tabla)
-- Resultado esperado: 12 filas (select, insert, update, delete para case_parties, case_assets y case_liabilities)
select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename in ('case_parties', 'case_assets', 'case_liabilities')
 order by tablename, cmd;
-- Esperado: 12 filas, todas referenciando permisos y private.can_access_case / private.can_write_case

-- 7. Verificar claves foráneas compuestas a catálogos en las nuevas tablas
-- Resultado esperado: 9 restricciones de catálogo
select conname, conrelid::regclass as table_name, pg_get_constraintdef(c.oid) as definition
  from pg_constraint c
 where conrelid in ('public.case_parties'::regclass, 'public.case_assets'::regclass, 'public.case_liabilities'::regclass)
   and contype = 'f'
   and pg_get_constraintdef(c.oid) like '%catalog_items%'
 order by table_name, conname;
-- Esperado:
-- case_parties: party_roles, relationship_types, heir_statuses
-- case_assets: asset_types, currencies, asset_statuses
-- case_liabilities: liability_types, currencies, liability_statuses

-- 8. Verificar que public.get_case_semaphore_warnings contiene la validación can_access_case
-- Resultado esperado: has_can_access_case_validation = true
select p.proname,
       n.nspname,
       (pg_get_functiondef(p.oid) ~ 'private\.can_access_case\(_case_id\)') as has_can_access_case_validation
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'get_case_semaphore_warnings';
-- Esperado:
-- get_case_semaphore_warnings | public | true

-- 9. Verificar que public.create_case_from_model incluye los parámetros _causante_person_id e _initial_parties
-- Resultado esperado: has_causante_param = true, has_initial_parties_param = true
select p.proname,
       (pg_get_function_arguments(p.oid) like '%_causante_person_id uuid%') as has_causante_param,
       (pg_get_function_arguments(p.oid) like '%_initial_parties jsonb%') as has_initial_parties_param,
       pg_get_function_arguments(p.oid) as full_signature
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'create_case_from_model';
-- Esperado:
-- create_case_from_model | true | true | _model_version_id uuid, _client_person_id uuid, _title text, _description text, _route text, _has_dispute boolean, _priority text, _is_confidential boolean, _ai_allowed boolean, _responsible_id uuid, _lawyer_id uuid, _collaborator_ids uuid[], _causante_person_id uuid, _initial_parties jsonb

-- 10. Verificar que private.can_access_person contiene las 4 condiciones (incluyendo case_parties)
-- Resultado esperado: las 4 columnas en true
select p.proname,
       n.nspname,
       (pg_get_functiondef(p.oid) ~ 'cases\.read\.all') as cond_1_cases_read_all,
       (pg_get_functiondef(p.oid) ~ 'not exists \(.*public\.cases.*client_person_id.*not exists \(.*public\.case_parties') as cond_2_prospect_no_case_no_parties,
       (pg_get_functiondef(p.oid) ~ 'exists \(.*public\.cases.*client_person_id.*can_access_case') as cond_3_client_in_accessible_case,
       (pg_get_functiondef(p.oid) ~ 'exists \(.*public\.case_parties.*join public\.cases.*can_access_case') as cond_4_party_in_accessible_case
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'private' and p.proname = 'can_access_person';
-- Esperado:
-- can_access_person | private | true | true | true | true

