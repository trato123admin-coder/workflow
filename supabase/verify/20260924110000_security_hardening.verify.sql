-- ============================================================================
-- Consultas de verificación para: 20260924110000_security_hardening.sql
-- Ejecutar en Supabase SQL Editor después de aplicar la migración en Staging.
-- ============================================================================

-- (a) Verificar que la nueva definición de private.has_permission incluye verificación de profiles.is_active y nivel aal2
-- Resultado esperado:
--  proname        | checks_user_active | checks_aal2 | prosecdef
-- ----------------+--------------------+-------------+-----------
--  has_permission | t                  | t           | t
select p.proname,
       p.prosrc like '%p_user.is_active%' as checks_user_active,
       p.prosrc like '%aal2%' as checks_aal2,
       p.prosecdef
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'private'
   and p.proname = 'has_permission';

-- (b) Verificar que existen los 3 triggers anti-escalada sobre user_roles, role_permissions y roles
-- Resultado esperado: 3 filas, todas con estado 'ACTIVO'
--  trigger_name                            | target_table     | status
-- -----------------------------------------+------------------+--------
--  guard_roles_anti_escalation             | roles            | ACTIVO
--  guard_role_permissions_anti_escalation  | role_permissions | ACTIVO
--  guard_user_roles_anti_escalation        | user_roles       | ACTIVO
select t.tgname as trigger_name,
       c.relname as target_table,
       case t.tgenabled
         when 'O' then 'ACTIVO'
         when 'D' then 'DESACTIVADO'
         else t.tgenabled::text
       end as status
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
 where t.tgname in (
   'guard_roles_anti_escalation',
   'guard_role_permissions_anti_escalation',
   'guard_user_roles_anti_escalation'
 )
 order by c.relname;

-- (c) Verificar que existen los 3 triggers de auditoría automática sobre profiles, user_roles y role_permissions
-- Resultado esperado: 3 filas, todas con estado 'ACTIVO'
--  trigger_name                    | target_table     | status
-- ---------------------------------+------------------+--------
--  audit_profiles_trigger          | profiles         | ACTIVO
--  audit_role_permissions_trigger  | role_permissions | ACTIVO
--  audit_user_roles_trigger        | user_roles       | ACTIVO
select t.tgname as trigger_name,
       c.relname as target_table,
       case t.tgenabled
         when 'O' then 'ACTIVO'
         when 'D' then 'DESACTIVADO'
         else t.tgenabled::text
       end as status
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
 where t.tgname in (
   'audit_profiles_trigger',
   'audit_role_permissions_trigger',
   'audit_user_roles_trigger'
 )
 order by c.relname;

-- (d) Verificar que la función de inserción de auditoría private.log_audit_event existe y es SECURITY DEFINER
-- Resultado esperado: 1 fila, prosecdef = true, proconfig = {search_path=}
select proname, prosecdef, proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'private'
   and p.proname = 'log_audit_event';
