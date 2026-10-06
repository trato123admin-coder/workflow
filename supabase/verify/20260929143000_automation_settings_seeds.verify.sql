-- ============================================================================
-- Verificación: 20260929143000_automation_settings_seeds.verify.sql
-- ============================================================================

do $$
begin
  if not exists (select 1 from public.setting_definitions where key = 'alerts.doc_expiry_days') then
    raise exception 'Fallo: definicion alerts.doc_expiry_days no existe';
  end if;
  if not exists (select 1 from public.setting_definitions where key = 'alerts.working_days') then
    raise exception 'Fallo: definicion alerts.working_days no existe';
  end if;
  if not exists (select 1 from public.setting_definitions where key = 'retention.done_jobs_days') then
    raise exception 'Fallo: definicion retention.done_jobs_days no existe';
  end if;
  if not exists (select 1 from public.setting_definitions where key = 'retention.notifications_days') then
    raise exception 'Fallo: definicion retention.notifications_days no existe';
  end if;

  -- Verificar unificación APP
  if exists (
    select 1 from public.system_settings
     where key = 'alerts.default_channels' and value = '["in_app"]'::jsonb
  ) then
    raise exception 'Fallo: alerts.default_channels en system_settings conserva valor in_app';
  end if;
end;
$$;
