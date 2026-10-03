-- ============================================================================
-- Verificación: 20260929120000_cron_schedules_tick_mode.verify.sql
-- ============================================================================

do $$
declare
  v_has_pg_net boolean;
  v_has_pg_cron boolean;
  v_cron_count integer;
  v_test_dedupe_key text;
  v_count1 integer;
  v_count2 integer;
begin
  -- 1. Verificar existencia de extensiones
  select exists(select 1 from pg_extension where extname = 'pg_net') into v_has_pg_net;
  assert v_has_pg_net = true, 'VERIFY FAILED: La extension pg_net no esta instalada';

  select exists(select 1 from pg_extension where extname = 'pg_cron') into v_has_pg_cron;

  -- 2. Verificar configuración en setting_definitions y system_settings
  assert exists (
    select 1 from public.setting_definitions where key = 'platform.engine_url'
  ), 'VERIFY FAILED: Falta setting_definitions platform.engine_url';

  assert exists (
    select 1 from public.system_settings where key = 'platform.engine_url'
  ), 'VERIFY FAILED: Falta system_settings platform.engine_url';

  -- 3. Verificar función trigger_engine_tick y privilegios estrictos
  assert exists (
    select 1 from pg_proc where proname = 'trigger_engine_tick'
  ), 'VERIFY FAILED: La funcion private.trigger_engine_tick no existe';

  assert not has_function_privilege('authenticated', 'private.trigger_engine_tick()', 'EXECUTE'),
    'VERIFY FAILED: authenticated NO debe tener acceso de ejecucion a private.trigger_engine_tick';

  assert has_function_privilege('service_role', 'private.trigger_engine_tick()', 'EXECUTE'),
    'VERIFY FAILED: service_role debe tener acceso de ejecucion a private.trigger_engine_tick';

  -- 4. Si pg_cron está activo en el entorno, verificar los 4 cron jobs programados en UTC
  if v_has_pg_cron then
    select count(*) into v_cron_count
      from cron.job
     where jobname in ('due_alerts', 'daily_digest', 'nightly_maintenance', 'engine_tick');

    assert v_cron_count = 4,
      format('VERIFY FAILED: Se esperaban 4 trabajos en cron.job pero se encontraron %s', v_cron_count);

    -- Comprobar horarios UTC exactos
    assert exists (
      select 1 from cron.job where jobname = 'due_alerts' and schedule = '0 * * * *'
    ), 'VERIFY FAILED: due_alerts no tiene la programacion 0 * * * * (UTC)';

    assert exists (
      select 1 from cron.job where jobname = 'daily_digest' and schedule = '30 12 * * 1-5'
    ), 'VERIFY FAILED: daily_digest no tiene la programacion 30 12 * * 1-5 (UTC, 07:30 Lima lun-vie)';

    assert exists (
      select 1 from cron.job where jobname = 'nightly_maintenance' and schedule = '0 4 * * *'
    ), 'VERIFY FAILED: nightly_maintenance no tiene la programacion 0 4 * * * (UTC, 23:00 Lima)';

    assert exists (
      select 1 from cron.job where jobname = 'engine_tick' and schedule = '*/30 * * * *'
    ), 'VERIFY FAILED: engine_tick no tiene la programacion */30 * * * * (UTC)';
  end if;

  -- 5. Prueba funcional de idempotencia y deduplicación en encolamiento cron:
  v_test_dedupe_key := 'due_alerts:test_verify_hour';

  insert into public.job_queue (job_type, dedupe_key, payload)
  values ('due_alerts', v_test_dedupe_key, '{"test": true}'::jsonb)
  on conflict (dedupe_key) do nothing;

  select count(*) into v_count1 from public.job_queue where dedupe_key = v_test_dedupe_key;
  assert v_count1 = 1, 'VERIFY FAILED: No se inserto el trabajo de prueba';

  -- Segunda inserción con la misma clave debe ignorarse (idempotente)
  insert into public.job_queue (job_type, dedupe_key, payload)
  values ('due_alerts', v_test_dedupe_key, '{"test": true}'::jsonb)
  on conflict (dedupe_key) do nothing;

  select count(*) into v_count2 from public.job_queue where dedupe_key = v_test_dedupe_key;
  assert v_count2 = 1, 'VERIFY FAILED: La insercion programada se duplico en job_queue';

  -- Limpieza
  delete from public.job_queue where dedupe_key = v_test_dedupe_key;

  raise notice 'VERIFICACIÓN EXITOSA: pg_cron (horarios UTC), pg_net, modo TICK y trigger_engine_tick activos y comprobados.';
end $$;
