-- Consultas de verificación para: 20260924100000_identity_and_roles.sql
-- Ejecutar en Supabase SQL Editor después de aplicar la migración en Staging.

-- 1. Verificar que NINGUNA tabla en public carezca de RLS
-- Resultado esperado: 0 filas
select tablename
  from pg_tables
 where schemaname = 'public'
   and rowsecurity = false;

-- 2. Verificar que las 5 tablas nuevas existan con RLS activa
-- Resultado esperado: 5 filas (permissions, profiles, role_permissions, roles, user_roles)
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
   and tablename in ('profiles', 'roles', 'permissions', 'role_permissions', 'user_roles')
 order by tablename;

-- 3. Verificar que la función private.has_permission exista y sea SECURITY DEFINER con search_path vacío
-- Resultado esperado: 1 fila, prosecdef = true, proconfig = {search_path=}
select proname, prosecdef, proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'private'
   and p.proname = 'has_permission';

-- 4. Verificar que anon NO tenga permisos de ejecución sobre private.has_permission
-- Resultado esperado: false
select has_function_privilege('anon', 'private.has_permission(text)', 'EXECUTE') as anon_can_execute;

-- 5. Verificar que authenticated SÍ tenga permiso de ejecución sobre private.has_permission
-- Resultado esperado: true
select has_function_privilege('authenticated', 'private.has_permission(text)', 'EXECUTE') as auth_can_execute;

-- 6. Verificar conteo de permisos sembrados
-- Resultado esperado: exactamente 40 permisos
select count(*)::int as total_permissions from public.permissions;

-- 7. Verificar los 5 roles sembrados y que ADMIN sea superusuario con MFA
-- Resultado esperado: 5 filas, ADMIN con is_superuser=true y requires_mfa=true
select code, name, is_system, is_superuser, requires_mfa, is_active
  from public.roles
 order by code;

-- 8. Verificar conteo de permisos asignados por defecto
-- Resultado esperado: ANALYST=20, LAWYER=14, CONSULT=7, CASHIER=5
select r.code, count(rp.permission_id)::int as permissions_count
  from public.roles r
  left join public.role_permissions rp on rp.role_id = r.id
 group by r.code
 order by r.code;
