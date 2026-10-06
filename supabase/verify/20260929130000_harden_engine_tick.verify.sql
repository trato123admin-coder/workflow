-- ============================================================================
-- Verificación: 20260929130000_harden_engine_tick.verify.sql
-- ============================================================================

do $$
begin
  -- 1. Verificar eliminación en setting_definitions y system_settings
  if exists (select 1 from public.setting_definitions where key = 'platform.engine_tick_secret') then
    raise exception 'Fallo: platform.engine_tick_secret aun existe en setting_definitions';
  end if;
  if exists (select 1 from public.system_settings where key = 'platform.engine_tick_secret') then
    raise exception 'Fallo: platform.engine_tick_secret aun existe en system_settings';
  end if;

  -- 2. Verificar existencia de función y permisos
  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and p.proname = 'trigger_engine_tick'
  ) then
    raise exception 'Fallo: private.trigger_engine_tick no existe';
  end if;

  if has_function_privilege('authenticated', 'private.trigger_engine_tick()', 'execute') then
    raise exception 'Fallo: authenticated conserva permiso EXECUTE en private.trigger_engine_tick()';
  end if;

  if has_function_privilege('anon', 'private.trigger_engine_tick()', 'execute') then
    raise exception 'Fallo: anon conserva permiso EXECUTE en private.trigger_engine_tick()';
  end if;
end;
$$;
