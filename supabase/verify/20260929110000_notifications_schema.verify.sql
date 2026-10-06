-- ============================================================================
-- Verificación: 20260929110000_notifications_schema.verify.sql
-- ============================================================================

do $$
declare
  v_rls_notifications boolean;
  v_rls_preferences boolean;
  v_test_user_id uuid;
  v_notif1 record;
  v_notif2 record;
  v_count_after integer;
  v_pref_id uuid;
  v_disabled_notif record;
  v_unauthorized_caught boolean := false;
begin
  -- 1. Verificar existencia de tablas y RLS activa
  select rowsecurity into v_rls_notifications
    from pg_tables
   where schemaname = 'public' and tablename = 'notifications';

  assert v_rls_notifications = true,
    'VERIFY FAILED: public.notifications no existe o no tiene RLS habilitada';

  select rowsecurity into v_rls_preferences
    from pg_tables
   where schemaname = 'public' and tablename = 'notification_preferences';

  assert v_rls_preferences = true,
    'VERIFY FAILED: public.notification_preferences no existe o no tiene RLS habilitada';

  -- 2. Verificar índices críticos y dedupe_key unique
  assert exists (
    select 1 from pg_indexes where tablename = 'notifications' and indexname = 'idx_notifications_user_unread'
  ), 'VERIFY FAILED: Falta índice idx_notifications_user_unread';

  assert exists (
    select 1 from pg_indexes where tablename = 'notifications' and indexname = 'idx_notifications_dedupe'
  ), 'VERIFY FAILED: Falta índice idx_notifications_dedupe';

  -- 3. Verificar políticas RLS
  assert exists (
    select 1 from pg_policies where tablename = 'notifications' and policyname = 'notifications_select'
  ), 'VERIFY FAILED: Falta política notifications_select';

  assert exists (
    select 1 from pg_policies where tablename = 'notifications' and policyname = 'notifications_update'
  ), 'VERIFY FAILED: Falta política notifications_update';

  -- 4. Verificar privilegios: authenticated NO puede INSERT ni DELETE directo en notifications
  assert not has_table_privilege('authenticated', 'public.notifications', 'INSERT'),
    'VERIFY FAILED: authenticated NO debe tener privilegio INSERT directo en notifications';

  assert not has_table_privilege('authenticated', 'public.notifications', 'DELETE'),
    'VERIFY FAILED: authenticated NO debe tener privilegio DELETE directo en notifications';

  -- 5. Verificar funciones RPC y privilegio exclusivo de create_notification para service_role
  assert exists (
    select 1 from pg_proc where proname = 'create_notification'
  ), 'VERIFY FAILED: Función public.create_notification no existe';

  assert not has_function_privilege(
    'authenticated',
    'public.create_notification(uuid, text, text, text, text, uuid, uuid, text, text, text, text, jsonb)',
    'EXECUTE'
  ), 'VERIFY FAILED: authenticated NO debe tener permiso de ejecución en create_notification';

  assert has_function_privilege(
    'service_role',
    'public.create_notification(uuid, text, text, text, text, uuid, uuid, text, text, text, text, jsonb)',
    'EXECUTE'
  ), 'VERIFY FAILED: service_role debe tener permiso de ejecución en create_notification';

  assert exists (
    select 1 from pg_proc where proname = 'mark_notification_as_read'
  ), 'VERIFY FAILED: Función public.mark_notification_as_read no existe';

  assert exists (
    select 1 from pg_proc where proname = 'mark_all_notifications_as_read'
  ), 'VERIFY FAILED: Función public.mark_all_notifications_as_read no existe';

  -- 6. Prueba funcional de creación, privacidad y DEDUPLICACIÓN DIARIA:
  select id into v_test_user_id from public.profiles limit 1;

  if v_test_user_id is not null then
    -- 6.1 Emitir primera notificación
    select * into v_notif1 from public.create_notification(
      p_user_id   := v_test_user_id,
      p_type      := 'TEST_DEDUPE_ALERT',
      p_title     := 'Alerta de prueba 1',
      p_body      := 'Mensaje de verificación de deduplicación',
      p_severity  := 'warning',
      p_channel   := 'APP'
    );

    assert v_notif1.id is not null, 'VERIFY FAILED: create_notification no retornó la notificación creada';
    assert v_notif1.dedupe_key is not null, 'VERIFY FAILED: dedupe_key generado es nulo';

    -- 6.2 Emitir segunda notificación con los mismos parámetros el mismo día (debe deduplicar y retornar null)
    select * into v_notif2 from public.create_notification(
      p_user_id   := v_test_user_id,
      p_type      := 'TEST_DEDUPE_ALERT',
      p_title     := 'Alerta repetida en el mismo día',
      p_body      := 'Segundo intento de notificación idéntica',
      p_severity  := 'warning',
      p_channel   := 'APP'
    );

    assert v_notif2.id is null, 'VERIFY FAILED: create_notification debió deduplicar y retornar null en llamada repetida';

    select count(*) into v_count_after
      from public.notifications
     where dedupe_key = v_notif1.dedupe_key;

    assert v_count_after = 1, 'VERIFY FAILED: La alerta se duplicó en notifications';

    -- 6.3 Probar preferencias: si el usuario desactiva un tipo de alerta, no se emite
    insert into public.notification_preferences (user_id, channel, alert_type, is_enabled)
    values (v_test_user_id, 'APP', 'TEST_MUTED_ALERT', false)
    returning id into v_pref_id;

    select * into v_disabled_notif from public.create_notification(
      p_user_id   := v_test_user_id,
      p_type      := 'TEST_MUTED_ALERT',
      p_title     := 'Alerta silenciada',
      p_body      := 'No debería crearse',
      p_severity  := 'info',
      p_channel   := 'APP'
    );

    assert v_disabled_notif.id is null, 'VERIFY FAILED: create_notification emitió una alerta silenciada por preferencias';

    -- 6.4 Probar validación de privacidad de destinatario:
    -- Si se intenta alertar sobre un caso ficticio al que el usuario no tiene acceso, debe lanzar 42501
    begin
      perform public.create_notification(
        p_user_id := '00000000-0000-0000-0000-000000000099'::uuid,
        p_type    := 'TEST_CASE_ALERT',
        p_title   := 'Alerta expediente',
        p_body    := 'Detalle',
        p_case_id := '00000000-0000-0000-0000-000000000001'::uuid
      );
    exception
      when sqlstate '42501' then
        v_unauthorized_caught := true;
    end;

    assert v_unauthorized_caught = true,
      'VERIFY FAILED: create_notification debió rechazar con 42501 intento de alertar a un destinatario sin acceso al caso';

    -- Limpieza de datos de prueba
    delete from public.notifications where id = v_notif1.id;
    if v_pref_id is not null then
      delete from public.notification_preferences where id = v_pref_id;
    end if;
  end if;

  raise notice 'VERIFICACIÓN EXITOSA: notifications, notification_preferences, dedupe_key diario, RLS, create_notification (solo service_role) y privacidad de destinatario activos y blindados.';
end $$;
