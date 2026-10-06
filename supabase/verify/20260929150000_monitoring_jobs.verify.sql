-- ============================================================================
-- Verificación: 20260929150000_monitoring_jobs.verify.sql
-- ============================================================================

do $$
begin
  if has_table_privilege('authenticated', 'public.job_queue', 'select') then
    raise exception 'Fallo: authenticated conserva privilegio SELECT directo sobre public.job_queue';
  end if;

  if not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'get_monitoring_jobs'
  ) then
    raise exception 'Fallo: RPC public.get_monitoring_jobs no existe';
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'trg_audit_job_retry'
  ) then
    raise exception 'Fallo: trigger trg_audit_job_retry no existe en public.job_queue';
  end if;
end;
$$;
