-- Migración: 20260929100000_job_queue_and_claim_jobs.sql
-- Sprint 8: Automatización I — Cola de trabajos (job_queue), claim_jobs con SKIP LOCKED,
-- reintentos con backoff exponencial, recuperación de bloqueos huérfanos y modo TICK.
-- Precedencia: 00-maestro §3.4, v2 §10, v2.1 §5, AGENTS.md

begin;

-- ============================================================================
-- 1. EXTENSIÓN Y AJUSTES DE TABLA job_queue
-- ============================================================================

-- Añadir columna updated_at si no existe
alter table public.job_queue
  add column if not exists updated_at timestamptz not null default now();

-- Trigger para updated_at automático
drop trigger if exists set_job_queue_updated_at on public.job_queue;
create trigger set_job_queue_updated_at
  before update on public.job_queue
  for each row execute function private.set_updated_at();

-- Índices optimizados para sondeo concurrente (SKIP LOCKED) y monitoreo
create index if not exists idx_job_queue_claim
  on public.job_queue (status, run_at, created_at)
  where status in ('QUEUED', 'RUNNING');

create index if not exists idx_job_queue_type
  on public.job_queue (job_type);

create index if not exists idx_job_queue_status_created
  on public.job_queue (status, created_at desc);

-- ============================================================================
-- 2. POLÍTICAS RLS EN job_queue
-- ============================================================================
-- RLS ya está habilitada desde la migración inicial.
-- Permitir lectura (SELECT) a usuarios con monitoring.read o settings.manage.
-- Escritura restringida exclusivamente a service_role o funciones SECURITY DEFINER.

drop policy if exists job_queue_select on public.job_queue;
create policy job_queue_select on public.job_queue
  for select to authenticated
  using (
    (select private.has_permission('monitoring.read'))
    or (select private.has_permission('settings.manage'))
  );

-- Revocar cualquier privilegio de modificación directa para usuarios authenticated y anon
revoke insert, update, delete on public.job_queue from public, anon, authenticated;
grant select on public.job_queue to authenticated;
grant all on public.job_queue to service_role;

-- ============================================================================
-- 3. FUNCIÓN claim_jobs (Con SKIP LOCKED y recuperación de huérfanos)
-- EXCLUSIVA PARA service_role (Engine)
-- ============================================================================
create or replace function public.claim_jobs(
  p_worker_id text,
  p_batch_size integer default 5,
  p_lock_timeout_minutes integer default 15
)
returns setof public.job_queue
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timeout interval;
begin
  if p_worker_id is null or trim(p_worker_id) = '' then
    raise exception 'p_worker_id es obligatorio para reclamar trabajos' using errcode = 'P0400';
  end if;

  v_timeout := (greatest(1, p_lock_timeout_minutes) || ' minutes')::interval;

  -- 3.1 Recuperar bloqueos huérfanos:
  -- Trabajos que permanecieron en RUNNING más allá de p_lock_timeout_minutes
  -- (e.g., el worker o contenedor de Render se durmió o crasheó a medio proceso).
  update public.job_queue
     set status = case
           when attempts >= max_attempts then 'DEAD'::public.job_status
           else 'QUEUED'::public.job_status
         end,
         finished_at = case
           when attempts >= max_attempts then now()
           else null
         end,
         last_error = case
           when attempts >= max_attempts then coalesce(last_error || ' | ', '') || 'Muerto por timeout de ejecucion excedido (' || p_lock_timeout_minutes || 'm)'
           else coalesce(last_error || ' | ', '') || 'Recuperado de bloqueo huerfano (' || p_lock_timeout_minutes || 'm)'
         end,
         locked_at = null,
         locked_by = null,
         updated_at = now()
   where status = 'RUNNING'
     and locked_at < now() - v_timeout;

  -- 3.2 Reclamar candidatos elegibles usando FOR UPDATE SKIP LOCKED
  return query
  with candidate_jobs as (
    select jq.id
      from public.job_queue jq
     where jq.status = 'QUEUED'
       and jq.run_at <= now()
     order by jq.run_at asc, jq.created_at asc
     limit greatest(1, least(p_batch_size, 50))
     for update skip locked
  )
  update public.job_queue jq
     set status = 'RUNNING'::public.job_status,
         attempts = jq.attempts + 1,
         locked_at = now(),
         locked_by = p_worker_id,
         updated_at = now()
    from candidate_jobs cj
   where jq.id = cj.id
  returning jq.*;
end;
$$;

-- Blindaje estricto: Solo service_role puede reclamar trabajos de la cola
revoke execute on function public.claim_jobs(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_jobs(text, integer, integer) to service_role;

-- ============================================================================
-- 4. FUNCIÓN complete_job (Marcar trabajo como DONE)
-- EXCLUSIVA PARA service_role (Engine)
-- ============================================================================
create or replace function public.complete_job(
  p_job_id uuid,
  p_result jsonb default '{}'::jsonb
)
returns public.job_queue
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_queue;
begin
  update public.job_queue
     set status = 'DONE'::public.job_status,
         finished_at = now(),
         locked_at = null,
         locked_by = null,
         payload = jsonb_set(payload, '{result}', coalesce(p_result, '{}'::jsonb), true),
         updated_at = now()
   where id = p_job_id
     and status = 'RUNNING'
  returning * into v_job;

  if v_job.id is null then
    raise exception 'No se pudo completar el trabajo %: no existe o no esta en estado RUNNING', p_job_id
      using errcode = 'P0404';
  end if;

  return v_job;
end;
$$;

-- Blindaje estricto: Solo service_role puede completar trabajos
revoke execute on function public.complete_job(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_job(uuid, jsonb) to service_role;

-- ============================================================================
-- 5. FUNCIÓN fail_job (Reintento con backoff exponencial o transición a DEAD)
-- EXCLUSIVA PARA service_role (Engine)
-- ============================================================================
create or replace function public.fail_job(
  p_job_id uuid,
  p_error text
)
returns public.job_queue
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_queue;
  v_is_dead boolean;
  v_backoff_seconds integer;
begin
  select (attempts >= max_attempts) into v_is_dead
    from public.job_queue
   where id = p_job_id;

  if v_is_dead is null then
    raise exception 'Trabajo con id % no existe', p_job_id using errcode = 'P0404';
  end if;

  if v_is_dead then
    -- Se agotó el límite de reintentos: transición definitiva a DEAD
    update public.job_queue
       set status = 'DEAD'::public.job_status,
           finished_at = now(),
           last_error = coalesce(p_error, 'Error desconocido'),
           locked_at = null,
           locked_by = null,
           updated_at = now()
     where id = p_job_id
    returning * into v_job;
  else
    -- Reintento programado con retroceso exponencial: 30s * 2^(attempts-1), límite 3600s
    select least(3600, (30 * power(2, greatest(0, attempts - 1)))::integer)
      into v_backoff_seconds
      from public.job_queue
     where id = p_job_id;

    update public.job_queue
       set status = 'QUEUED'::public.job_status,
           run_at = now() + (v_backoff_seconds || ' seconds')::interval,
           last_error = coalesce(p_error, 'Error desconocido'),
           locked_at = null,
           locked_by = null,
           updated_at = now()
     where id = p_job_id
    returning * into v_job;
  end if;

  return v_job;
end;
$$;

-- Blindaje estricto: Solo service_role puede reportar fallos de trabajos
revoke execute on function public.fail_job(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_job(uuid, text) to service_role;

-- ============================================================================
-- 6. FUNCIÓN retry_job (Reintento manual de trabajos DEAD o FAILED)
-- ACCESIBLE PARA authenticated ÚNICAMENTE CON PERMISO settings.manage
-- ============================================================================
create or replace function public.retry_job(p_job_id uuid)
returns public.job_queue
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_queue;
  v_can_manage boolean;
begin
  -- Exigir estrictamente permiso de gestión (settings.manage).
  -- monitoring.read es permiso de solo lectura y NO autoriza acciones.
  select (select private.has_permission('settings.manage')) into v_can_manage;

  if not coalesce(v_can_manage, false) then
    raise exception 'Acceso denegado: se requiere permiso settings.manage para reintentar trabajos'
      using errcode = '42501';
  end if;

  update public.job_queue
     set status = 'QUEUED'::public.job_status,
         attempts = 0,
         run_at = now(),
         locked_at = null,
         locked_by = null,
         finished_at = null,
         last_error = coalesce(last_error || ' | ', '') || 'Reintento manual encolado por usuario ' || coalesce(auth.uid()::text, 'admin'),
         updated_at = now()
   where id = p_job_id
     and status in ('DEAD', 'FAILED')
  returning * into v_job;

  if v_job.id is null then
    raise exception 'No se pudo reintentar el trabajo %: debe estar en estado DEAD o FAILED', p_job_id
      using errcode = 'P0400';
  end if;

  return v_job;
end;
$$;

revoke execute on function public.retry_job(uuid) from public, anon;
grant execute on function public.retry_job(uuid) to authenticated, service_role;

-- ============================================================================
-- 7. PARÁMETROS DE CONFIGURACIÓN (platform.jobs_mode y lock_timeout)
-- ============================================================================
insert into public.setting_definitions (
  key, category, label, description, value_type, default_value, constraints, sort_order
) values
(
  'platform.jobs_mode',
  'system',
  'Modo de Ejecución de Cola de Trabajos',
  'Define la modalidad de procesamiento del engine: TICK (Render gratuito con pg_net) o CONTINUOUS (worker persistente)',
  'string',
  '"TICK"'::jsonb,
  '{"enum": ["TICK", "CONTINUOUS"]}'::jsonb,
  10
),
(
  'platform.lock_timeout_minutes',
  'system',
  'Tiempo Límite de Bloqueo de Trabajos (min)',
  'Minutos máximos que un trabajo puede permanecer en RUNNING antes de ser considerado huérfano y reencolado',
  'number',
  '15'::jsonb,
  '{"min": 1, "max": 120}'::jsonb,
  11
)
on conflict (key) do nothing;

insert into public.system_settings (key, value)
values
  ('platform.jobs_mode', '"TICK"'::jsonb),
  ('platform.lock_timeout_minutes', '15'::jsonb)
on conflict (key) do nothing;

commit;
