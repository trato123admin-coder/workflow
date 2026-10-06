-- ============================================================================
-- Verificación: 20260929140000_secure_notifications.verify.sql
-- ============================================================================

do $$
begin
  -- 1. Helper existe y tiene permisos correctos
  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and p.proname = 'user_can_access_case'
  ) then
    raise exception 'Fallo: private.user_can_access_case no existe';
  end if;

  if has_function_privilege('authenticated', 'private.user_can_access_case(uuid, uuid)', 'execute') then
    raise exception 'Fallo: authenticated conserva permiso EXECUTE en private.user_can_access_case';
  end if;

  -- 2. Privilegios directos sobre notifications
  if has_table_privilege('authenticated', 'public.notifications', 'update') then
    raise exception 'Fallo: authenticated conserva permiso UPDATE directo en notifications';
  end if;
  if has_table_privilege('authenticated', 'public.notifications', 'truncate') then
    raise exception 'Fallo: authenticated conserva permiso TRUNCATE directo en notifications';
  end if;
  if has_table_privilege('anon', 'public.notifications', 'select') then
    raise exception 'Fallo: anon conserva permiso SELECT en notifications';
  end if;

  -- 3. Funciones RPC mark_* siguen operables por authenticated
  if not has_function_privilege('authenticated', 'public.mark_notification_as_read(uuid)', 'execute') then
    raise exception 'Fallo: authenticated perdio permiso EXECUTE en mark_notification_as_read';
  end if;
  if not has_function_privilege('authenticated', 'public.mark_all_notifications_as_read()', 'execute') then
    raise exception 'Fallo: authenticated perdio permiso EXECUTE en mark_all_notifications_as_read';
  end if;
end;
$$;
