-- Consultas de verificación para: 20260924120000_settings_and_catalogs.sql
-- Ejecutar en Supabase SQL Editor después de aplicar la migración en Staging.

-- 1. Verificar que NINGUNA tabla en public carezca de RLS
-- Resultado esperado: 0 filas
select tablename
  from pg_tables
 where schemaname = 'public'
   and rowsecurity = false;

-- 2. Verificar que las 8 tablas nuevas existan con RLS activa
-- Resultado esperado: 8 filas con rowsecurity = true
-- (catalog_items, catalogs, custom_field_definitions, feature_flags, holidays, setting_definitions, settings_history, system_settings)
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
   and tablename in (
     'catalogs',
     'catalog_items',
     'feature_flags',
     'setting_definitions',
     'system_settings',
     'settings_history',
     'custom_field_definitions',
     'holidays'
   )
 order by tablename;

-- 3. Verificar que private.feature_enabled exista, sea SECURITY DEFINER y tenga search_path vacío
-- Resultado esperado: 1 fila, prosecdef = true, proconfig = {search_path=}
select proname, prosecdef, proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'private'
   and p.proname = 'feature_enabled';

-- 4. Verificar privilegios de ejecución sobre private.feature_enabled
-- Resultado esperado: anon = false, authenticated = true, service_role = true
select
  has_function_privilege('anon', 'private.feature_enabled(text)', 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', 'private.feature_enabled(text)', 'EXECUTE') as auth_can_execute;

-- 5. Verificar que la función de validación de datos custom exista y sea SECURITY DEFINER
-- Resultado esperado: 1 fila, prosecdef = true, proconfig = {search_path=}
select proname, prosecdef, proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'private'
   and p.proname = 'validate_custom_data';

-- 6. Verificar que la tabla settings_history tenga revocado UPDATE y DELETE para authenticated
-- Resultado esperado: has_table_privilege('authenticated', 'public.settings_history', 'UPDATE') = false, DELETE = false
select
  has_table_privilege('authenticated', 'public.settings_history', 'UPDATE') as auth_can_update_history,
  has_table_privilege('authenticated', 'public.settings_history', 'DELETE') as auth_can_delete_history,
  has_table_privilege('authenticated', 'public.settings_history', 'SELECT') as auth_can_select_history,
  has_table_privilege('authenticated', 'public.settings_history', 'INSERT') as auth_can_insert_history;

-- 7. Verificar que el trigger inmutable de settings_history esté activo
-- Resultado esperado: 1 fila con tgname = 'settings_history_immutable'
select tgname, tgenabled
  from pg_trigger
 where tgrelid = 'public.settings_history'::regclass
   and tgname = 'settings_history_immutable';

-- 8. Verificar que el bucket público 'logos' exista en storage.buckets
-- Resultado esperado: 1 fila con id = 'logos', public = true
select id, name, public
  from storage.buckets
 where id = 'logos';

-- 9. Verificar que la tabla holidays exista y esté vacía
-- Resultado esperado: count = 0
select count(*)::int as total_holidays from public.holidays;
