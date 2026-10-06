-- Migración: 20260929130000_harden_engine_tick.sql
-- Sprint 8: Endurecimiento de trigger_engine_tick, Vault exclusivo, timeout 90s, códigos P0500/P0501 y DELETE de secreto en settings

begin;

-- 1. Eliminar definición y valor de platform.engine_tick_secret (cascada segura a system_settings)
delete from public.setting_definitions
 where key = 'platform.engine_tick_secret';

-- 2. Redefinición blindada de private.trigger_engine_tick()
create or replace function private.trigger_engine_tick()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jobs_mode text;
  v_engine_url text;
  v_secret text;
  v_request_id bigint;
begin
  -- 2.1 Verificar modo de ejecución de jobs
  select (value #>> '{}') into v_jobs_mode
    from public.system_settings
   where key = 'platform.jobs_mode';

  -- Si está en CONTINUOUS (worker persistente de pago), se conserva el retorno nulo
  if coalesce(v_jobs_mode, 'TICK') = 'CONTINUOUS' then
    return null;
  end if;

  -- 2.2 Obtener URL del engine y validar esquema HTTPS por regex
  select (value #>> '{}') into v_engine_url
    from public.system_settings
   where key = 'platform.engine_url';

  if v_engine_url is null or trim(v_engine_url) = '' or v_engine_url !~* '^https://[a-zA-Z0-9.-]+(:[0-9]+)?(/.*)?$' then
    raise exception 'platform.engine_url debe estar configurada y utilizar el esquema HTTPS seguro' using errcode = 'P0501';
  end if;

  -- 2.3 Obtener secreto exclusivamente desde Supabase Vault
  select decrypted_secret into v_secret
    from vault.decrypted_secrets
   where name = 'engine_tick_secret'
   limit 1;

  if v_secret is null or length(trim(v_secret)) < 32 then
    raise exception 'engine_tick_secret en Vault ausente o con longitud inferior a 32 caracteres' using errcode = 'P0500';
  end if;

  -- 2.4 Despacho HTTP vía pg_net con timeout explícito de 90 segundos
  select net.http_post(
    url := rtrim(v_engine_url, '/') || '/v1/jobs/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object(
      'source', 'pg_cron',
      'triggered_at', now()
    ),
    timeout_milliseconds := 90000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function private.trigger_engine_tick() from public, anon, authenticated;
grant execute on function private.trigger_engine_tick() to service_role;

commit;
