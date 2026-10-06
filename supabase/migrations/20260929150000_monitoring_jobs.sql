-- Migración: 20260929150000_monitoring_jobs.sql
-- Sprint 8: RPC get_monitoring_jobs con p_offset, redacción de datos y trigger de auditoría de reintentos

begin;

-- ============================================================================
-- 1. RPC: public.get_monitoring_jobs
-- ============================================================================
create or replace function public.get_monitoring_jobs(
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  job_type text,
  payload jsonb,
  status public.job_status,
  run_at timestamptz,
  attempts integer,
  max_attempts integer,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  dedupe_key text,
  created_at timestamptz,
  finished_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_manage boolean;
  v_has_read boolean;
  v_status_enum public.job_status;
begin
  -- 1.1 Verificar feature flag del módulo de monitoreo
  if not coalesce(private.feature_enabled('module.monitoring'), false) then
    raise exception 'Modulo de monitoreo inactivo' using errcode = '42501';
  end if;

  -- 1.2 Evaluar permisos semánticos
  v_has_manage := private.has_permission('settings.manage');
  v_has_read := private.has_permission('monitoring.read');

  if not (v_has_manage or v_has_read) then
    raise exception 'Permiso insuficiente para consultar monitoreo de trabajos' using errcode = '42501';
  end if;

  -- 1.3 Castear filtro de estado si viene provisto
  if p_status is not null and trim(p_status) <> '' then
    v_status_enum := p_status::public.job_status;
  end if;

  -- 1.4 Retorno tipado con redacción selectiva y paginación
  return query
  select
    jq.id,
    jq.job_type,
    case when v_has_manage then jq.payload else null end as payload,
    jq.status,
    jq.run_at,
    jq.attempts,
    jq.max_attempts,
    jq.locked_at,
    jq.locked_by,
    case when v_has_manage then jq.last_error else null end as last_error,
    jq.dedupe_key,
    jq.created_at,
    jq.finished_at
  from public.job_queue jq
  where (v_status_enum is null or jq.status = v_status_enum)
  order by jq.created_at desc
  limit least(coalesce(p_limit, 50), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke execute on function public.get_monitoring_jobs(text, integer, integer) from public, anon;
grant execute on function public.get_monitoring_jobs(text, integer, integer) to authenticated, service_role;

-- Revocar SELECT directo sobre job_queue a authenticated (forzando paso por la RPC)
revoke select on public.job_queue from authenticated;

-- ============================================================================
-- 2. TRIGGER DE AUDITORÍA: tg_audit_job_retry
-- ============================================================================
create or replace function private.tg_audit_job_retry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if (old.status in ('DEAD'::public.job_status, 'FAILED'::public.job_status)
      and new.status = 'QUEUED'::public.job_status
      and v_actor is not null) then
    perform private.log_audit_event(
      v_actor,
      'jobs',
      'job_queue',
      new.id,
      'RETRY',
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status),
      null,
      null
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_job_retry on public.job_queue;
create trigger trg_audit_job_retry
  before update on public.job_queue
  for each row execute function private.tg_audit_job_retry();

commit;
