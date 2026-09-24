-- Consultas de verificación para: 20260924110000_security_hardening.sql
-- Ejecutar en Supabase SQL Editor después de aplicar la migración en Staging.

-- 1. Verificar que private.log_audit_event existe y es SECURITY DEFINER
-- Resultado esperado: 1 fila, prosecdef = true, proconfig = {search_path=}
select proname, prosecdef, proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'private'
   and p.proname = 'log_audit_event';

-- 2. Verificar que private.has_permission incluye verificación de p_user.is_active y aal2
-- Resultado esperado: 1 fila conteniendo 'p_user.is_active' y 'aal2'
select proname, prosrc like '%p_user.is_active%' as checks_user_active, prosrc like '%aal2%' as checks_aal2
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'private'
   and p.proname = 'has_permission';

-- 3. Verificar que los 3 disparadores anti-escalada existen y están activos
-- Resultado esperado: 3 filas (guard_user_roles_anti_escalation, guard_role_permissions_anti_escalation, guard_roles_anti_escalation)
select tgname, relname, tgenabled
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
 where tgname in (
   'guard_user_roles_anti_escalation',
   'guard_role_permissions_anti_escalation',
   'guard_roles_anti_escalation'
 )
 order by tgname;

-- 4. Verificar que los 3 disparadores de auditoría automática existen y están activos
-- Resultado esperado: 3 filas (audit_user_roles_trigger, audit_profiles_trigger, audit_role_permissions_trigger)
select tgname, relname, tgenabled
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
 where tgname in (
   'audit_user_roles_trigger',
   'audit_profiles_trigger',
   'audit_role_permissions_trigger'
 )
 order by tgname;

-- 5. Verificar que audit_logs tiene política RLS para select con audit.read
-- Resultado esperado: 1 fila, policyname = 'audit_logs_select'
select policyname, cmd, qual
  from pg_policies
 where tablename = 'audit_logs'
   and policyname = 'audit_logs_select';
