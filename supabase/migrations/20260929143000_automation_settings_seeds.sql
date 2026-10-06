-- Migración: 20260929143000_automation_settings_seeds.sql
-- Sprint 8: Semillas operativas de caducidad, días útiles, retención provisional y unificación APP

begin;

-- 1. alerts.doc_expiry_days (value_type 'list')
insert into public.setting_definitions (
  key, category, label, description, value_type, default_value, constraints, edit_permission, sort_order
) values (
  'alerts.doc_expiry_days',
  'alerts',
  'Días de anticipación para alerta de caducidad de documentos',
  'Umbrales en días hábiles (T-30 preventiva, T-15 advertencia, T-5 urgente) para documentos de identidad y certificados.',
  'list',
  '[30, 15, 5]'::jsonb,
  '{}'::jsonb,
  'settings.manage',
  4
) on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  default_value = excluded.default_value;

insert into public.system_settings (key, value)
values ('alerts.doc_expiry_days', '[30, 15, 5]'::jsonb)
on conflict (key) do nothing;

-- 2. alerts.working_days (value_type 'list')
insert into public.setting_definitions (
  key, category, label, description, value_type, default_value, constraints, edit_permission, sort_order
) values (
  'alerts.working_days',
  'alerts',
  'Días laborables de oficina',
  'Días de la semana habilitados para despacho de alertas horarias (1=Lunes a 5=Viernes).',
  'list',
  '[1, 2, 3, 4, 5]'::jsonb,
  '{}'::jsonb,
  'settings.manage',
  5
) on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  default_value = excluded.default_value;

insert into public.system_settings (key, value)
values ('alerts.working_days', '[1, 2, 3, 4, 5]'::jsonb)
on conflict (key) do nothing;

-- 3. retention.done_jobs_days (value_type 'number', provisional)
insert into public.setting_definitions (
  key, category, label, description, value_type, default_value, constraints, edit_permission, sort_order
) values (
  'retention.done_jobs_days',
  'system',
  'Retención de trabajos completados (días)',
  'Días de conservación para registros en job_queue con estado DONE (valor provisional: política legal pendiente).',
  'number',
  '7'::jsonb,
  '{"min": 1, "max": 3650}'::jsonb,
  'settings.manage',
  14
) on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  default_value = excluded.default_value,
  constraints = excluded.constraints;

insert into public.system_settings (key, value)
values ('retention.done_jobs_days', '7'::jsonb)
on conflict (key) do nothing;

-- 4. retention.notifications_days (value_type 'number', provisional)
insert into public.setting_definitions (
  key, category, label, description, value_type, default_value, constraints, edit_permission, sort_order
) values (
  'retention.notifications_days',
  'system',
  'Retención de notificaciones leídas (días)',
  'Días de conservación para notificaciones con is_read = true (valor provisional: política legal pendiente).',
  'number',
  '30'::jsonb,
  '{"min": 1, "max": 3650}'::jsonb,
  'settings.manage',
  15
) on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  default_value = excluded.default_value,
  constraints = excluded.constraints;

insert into public.system_settings (key, value)
values ('retention.notifications_days', '30'::jsonb)
on conflict (key) do nothing;

-- 5. Corrección de Deuda #7: Unificar alerts.default_channels de in_app a APP
update public.setting_definitions
   set default_value = '["APP"]'::jsonb
 where key = 'alerts.default_channels';

update public.system_settings
   set value = '["APP"]'::jsonb
 where key = 'alerts.default_channels'
   and value = '["in_app"]'::jsonb;

commit;
