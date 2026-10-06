-- Migración: 20260929120000_cron_schedules_tick_mode.sql
-- Sprint 8: Automatización I — Programación con pg_cron (horarios UTC),
-- modo TICK con pg_net y Supabase Vault, y deduplicación en encolamiento.
-- Precedencia: 00-maestro §3.4, v2 §10, v2.1 §5, AGENTS.md

begin;

-- ============================================================================
-- 1. EXTENSIONES REQUERIDAS (pg_net, pg_cron, supabase_vault)
-- ============================================================================
create extension if not exists pg_net;
create extension if not exists pg_cron;
create extension if not exists supabase_vault cascade;

-- ============================================================================
-- 2. PARÁMETROS DE CONFIGURACIÓN DE CONECTIVIDAD DEL ENGINE
-- ============================================================================
insert into public.setting_definitions (
  key, category, label, description, value_type, default_value, constraints, sort_order
) values
(
  'platform.engine_url',
  'system',
  'URL Base del Engine',
  'URL del servicio Engine (Fastify en Render o local) para invocación de POST /v1/jobs/tick vía pg_net',
  'string',
  '"http://localhost:3001"'::jsonb,
  '{}'::jsonb,
  12
),
(
  'platform.engine_tick_secret',
  'security',
  'Secreto de Autenticación de Tick (Fallback)',
  'Token Bearer para autenticar solicitudes HTTP desde la base de datos hacia POST /v1/jobs/tick (prioriza Supabase Vault si existe)',
  'string',
  '"dev_tick_secret_placeholder"'::jsonb,
  '{}'::jsonb,
  13
)
on conflict (key) do nothing;

insert into public.system_settings (key, value)
values
  ('platform.engine_url', '"http://localhost:3001"'::jsonb),
  ('platform.engine_tick_secret', '"dev_tick_secret_placeholder"'::jsonb)
on conflict (key) do nothing;

-- ============================================================================
-- 3. FUNCIÓN DISPARADORA DE TICK: private.trigger_engine_tick
-- Despierta al engine vía HTTP POST asíncrono con pg_net en modo TICK.
-- Tolera que el servicio esté dormido (Render gratuito).
-- ============================================================================
create or replace function private.trigger_engine_tick()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_engine_url text;
  v_secret text;
  v_request_id bigint;
  v_jobs_mode text;
begin
  -- 3.1 Comprobar modalidad de ejecución
  select replace(value::text, '"', '') into v_jobs_mode
    from public.system_settings
   where key = 'platform.jobs_mode';

  -- Si está en CONTINUOUS (modo de pago con worker persistente), no requiere despertar por HTTP
  if coalesce(v_jobs_mode, 'TICK') = 'CONTINUOUS' then
    return null;
  end if;

  -- 3.2 Obtener URL del engine
  select replace(value::text, '"', '') into v_engine_url
    from public.system_settings
   where key = 'platform.engine_url';

  if v_engine_url is null or trim(v_engine_url) = '' then
    v_engine_url := 'http://localhost:3001';
  end if;

  -- 3.3 Obtener secreto: prioridad a Supabase Vault (decrypted_secrets)
  begin
    select decrypted_secret into v_secret
      from vault.decrypted_secrets
     where name = 'engine_tick_secret'
     limit 1;
  exception when others then
    v_secret := null;
  end;

  -- Fallback a system_settings si no está cargado en Vault
  if v_secret is null or trim(v_secret) = '' then
    select replace(value::text, '"', '') into v_secret
      from public.system_settings
     where key = 'platform.engine_tick_secret';
  end if;

  -- 3.4 Despacho HTTP asíncrono vía pg_net (net.http_post)
  select net.http_post(
    url := v_engine_url || '/v1/jobs/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_secret, '')
    ),
    body := jsonb_build_object(
      'source', 'pg_cron',
      'triggered_at', now()
    )
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function private.trigger_engine_tick() from public, anon, authenticated;
grant execute on function private.trigger_engine_tick() to service_role;

-- ============================================================================
-- 4. PROGRAMACIÓN DE TAREAS PERIÓDICAS (pg_cron en UTC)
-- Conversión estricta: Lima es UTC-5 (sin horario de verano).
--
--  Trabajo              | Hora Lima   | Cron UTC       | Explicación
-- ----------------------------------------------------------------------------
--  due_alerts           | Cada hora   | 0 * * * *      | Encola alertas de vencimiento con dedupe horario
--  daily_digest lun-vie | 07:30       | 30 12 * * 1-5  | 07:30 + 5h = 12:30 UTC
--  nightly_maintenance  | 23:00       | 0 4 * * *      | 23:00 + 5h = 04:00 UTC (día siguiente)
--  engine_tick          | Cada 30 min | */30 * * * *   | Llama a private.trigger_engine_tick()
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Desprogramar jobs si ya existían para garantizar idempotencia
    perform cron.unschedule(jobname)
       from cron.job
      where jobname in ('due_alerts', 'daily_digest', 'nightly_maintenance', 'engine_tick');

    -- 4.1 due_alerts: Cada hora en punto (UTC)
    perform cron.schedule(
      'due_alerts',
      '0 * * * *',
      $cmd$
        insert into public.job_queue (job_type, dedupe_key, payload)
        values (
          'due_alerts',
          'due_alerts:' || to_char(now() at time zone 'America/Lima', 'YYYY-MM-DD"T"HH24'),
          jsonb_build_object('scheduled_for', now())
        )
        on conflict (dedupe_key) do nothing;
      $cmd$
    );

    -- 4.2 daily_digest: 07:30 Lima (lun-vie) -> 12:30 UTC
    perform cron.schedule(
      'daily_digest',
      '30 12 * * 1-5',
      $cmd$
        insert into public.job_queue (job_type, dedupe_key, payload)
        values (
          'daily_digest',
          'daily_digest:' || to_char(now() at time zone 'America/Lima', 'YYYY-MM-DD'),
          jsonb_build_object('digest_date', to_char(now() at time zone 'America/Lima', 'YYYY-MM-DD'))
        )
        on conflict (dedupe_key) do nothing;
      $cmd$
    );

    -- 4.3 nightly_maintenance: 23:00 Lima -> 04:00 UTC (día siguiente)
    perform cron.schedule(
      'nightly_maintenance',
      '0 4 * * *',
      $cmd$
        insert into public.job_queue (job_type, dedupe_key, payload)
        values (
          'nightly_maintenance',
          'nightly_maintenance:' || to_char(now() at time zone 'America/Lima', 'YYYY-MM-DD'),
          jsonb_build_object('maintenance_date', to_char(now() at time zone 'America/Lima', 'YYYY-MM-DD'))
        )
        on conflict (dedupe_key) do nothing;
      $cmd$
    );

    -- 4.4 engine_tick: Cada 30 minutos (UTC) despierta al engine
    perform cron.schedule(
      'engine_tick',
      '*/30 * * * *',
      $cmd$
        select private.trigger_engine_tick();
      $cmd$
    );
  end if;
end $$;

commit;
