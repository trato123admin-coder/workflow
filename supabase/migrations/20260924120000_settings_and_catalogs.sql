-- Migración: 20260924120000_settings_and_catalogs.sql
-- Sprint 2: Catálogos genéricos, feature flags, parámetros tipados, historial inmutable, campos personalizados y feriados
-- Precedencia y reglas: AGENTS.md, v2.1 §1-§3, 00-maestro §4.5

begin;

-- ============================================================================
-- 1. TABLA catalogs Y catalog_items (S2-01)
-- ============================================================================

create table if not exists public.catalogs (
  code            text primary key,
  name            text not null,
  description     text,
  module          text not null,
  allow_new_items boolean not null default true,
  item_schema     jsonb not null default '{}'::jsonb,
  is_system       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.catalogs enable row level security;

create trigger set_catalogs_updated_at
  before update on public.catalogs
  for each row execute function private.set_updated_at();

create table if not exists public.catalog_items (
  catalog_code text not null references public.catalogs(code) on delete cascade,
  code         text not null,
  label        text not null,
  description  text,
  sort_order   int not null default 0,
  color        text,
  metadata     jsonb not null default '{}'::jsonb,
  is_system    boolean not null default false,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (catalog_code, code)
);

alter table public.catalog_items enable row level security;

create trigger set_catalog_items_updated_at
  before update on public.catalog_items
  for each row execute function private.set_updated_at();

-- Trigger: Inmutabilidad de código y protección de elementos del sistema
create or replace function private.guard_catalog_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.code <> new.code then
      raise exception 'Operacion rechazada: el codigo de un elemento de catalogo es inmutable';
    end if;
    if old.is_system = true and new.is_system = false then
      raise exception 'Operacion rechazada: no se puede remover la proteccion is_system a un elemento del sistema';
    end if;
  elsif tg_op = 'DELETE' then
    if old.is_system = true then
      raise exception 'Operacion rechazada: no se puede eliminar un elemento protegido del sistema (desactivelo con is_active)';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function private.guard_catalog_item() from public, anon;
grant execute on function private.guard_catalog_item() to authenticated, service_role;

create trigger guard_catalog_item_trigger
  before update or delete on public.catalog_items
  for each row execute function private.guard_catalog_item();

-- Función auxiliar para verificar si un elemento de catálogo está activo
create or replace function private.assert_catalog_item_active(_catalog_code text, _item_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.catalog_items
     where catalog_code = _catalog_code
       and code = _item_code
       and is_active = true
  );
$$;

revoke execute on function private.assert_catalog_item_active(text, text) from public, anon;
grant execute on function private.assert_catalog_item_active(text, text) to authenticated, service_role;

-- ============================================================================
-- 2. TABLA feature_flags Y FUNCIÓN private.feature_enabled (S2-02)
-- ============================================================================

create table if not exists public.feature_flags (
  key             text primary key,
  module          text not null,
  label           text not null,
  description     text,
  is_enabled      boolean not null default false,
  is_locked       boolean not null default false,
  depends_on      text[] not null default '{}'::text[],
  requires_config text[] not null default '{}'::text[],
  config          jsonb not null default '{}'::jsonb,
  updated_by      uuid references public.profiles(id),
  updated_at      timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

create trigger set_feature_flags_updated_at
  before update on public.feature_flags
  for each row execute function private.set_updated_at();

-- Función evaluadora de flags (SECURITY DEFINER, search_path vacío)
create or replace function private.feature_enabled(_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select is_enabled from public.feature_flags where key = _key),
    false
  );
$$;

revoke execute on function private.feature_enabled(text) from public, anon;
grant execute on function private.feature_enabled(text) to authenticated, service_role;

-- Trigger: Proteger flags bloqueados y validar dependencias al activar
create or replace function private.guard_feature_flags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  dep text;
  dep_enabled boolean;
begin
  if tg_op = 'UPDATE' then
    -- No permitir desactivar flags con candado (audit.enabled, rls.enforced, etc.)
    if old.is_locked = true and old.is_enabled = true and new.is_enabled = false then
      raise exception 'Operacion rechazada: el flag % esta bloqueado por el nucleo y no puede desactivarse', old.key;
    end if;

    -- Validar dependencias si se intenta habilitar
    if new.is_enabled = true and (old.is_enabled = false or old.depends_on <> new.depends_on) then
      if array_length(new.depends_on, 1) > 0 then
        foreach dep in array new.depends_on loop
          select is_enabled into dep_enabled from public.feature_flags where key = dep;
          if dep_enabled is distinct from true then
            raise exception 'Operacion rechazada: no se puede activar % porque la dependencia % esta inactiva', new.key, dep;
          end if;
        end loop;
      end if;
    end if;
  elsif tg_op = 'DELETE' then
    if old.is_locked = true then
      raise exception 'Operacion rechazada: no se puede eliminar un flag bloqueado del sistema';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

revoke execute on function private.guard_feature_flags() from public, anon;
grant execute on function private.guard_feature_flags() to authenticated, service_role;

create trigger guard_feature_flags_trigger
  before update or delete on public.feature_flags
  for each row execute function private.guard_feature_flags();

-- ============================================================================
-- 3. PARAMETROS TIPADOS Y HISTORIAL INMUTABLE (S2-03, S2-11)
-- ============================================================================

create table if not exists public.setting_definitions (
  key             text primary key,
  category        text not null,
  label           text not null,
  description     text,
  value_type      text not null check (value_type in ('string','number','boolean','enum','json','color','time','duration','list')),
  default_value   jsonb not null,
  constraints     jsonb not null default '{}'::jsonb,
  edit_permission text not null default 'settings.manage',
  requires_flag   text references public.feature_flags(key),
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.setting_definitions enable row level security;

create trigger set_setting_definitions_updated_at
  before update on public.setting_definitions
  for each row execute function private.set_updated_at();

create table if not exists public.system_settings (
  key         text primary key references public.setting_definitions(key) on delete cascade,
  value       jsonb not null,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);

alter table public.system_settings enable row level security;

create trigger set_system_settings_updated_at
  before update on public.system_settings
  for each row execute function private.set_updated_at();

-- settings_history: append-only inmutable
create table if not exists public.settings_history (
  id         uuid primary key default gen_random_uuid(),
  key        text not null,
  old_value  jsonb,
  new_value  jsonb,
  reason     text,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);

alter table public.settings_history enable row level security;

-- Trigger inmutable con raise_immutable del Sprint 0
create trigger settings_history_immutable
  before update or delete on public.settings_history
  for each row execute function private.raise_immutable();

revoke update, delete on public.settings_history from public, anon, authenticated;
grant select, insert on public.settings_history to authenticated, service_role;

-- Trigger que audita cambios de system_settings hacia settings_history
create or replace function private.audit_system_settings_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := coalesce(new.updated_by, (select auth.uid()));
begin
  insert into public.settings_history (
    key,
    old_value,
    new_value,
    reason,
    changed_by
  )
  values (
    new.key,
    case when tg_op = 'UPDATE' then old.value else null end,
    new.value,
    'Actualizacion de parametro de sistema',
    v_actor
  );
  return new;
end;
$$;

revoke execute on function private.audit_system_settings_change() from public, anon;
grant execute on function private.audit_system_settings_change() to authenticated, service_role;

create trigger audit_system_settings_trigger
  after insert or update on public.system_settings
  for each row execute function private.audit_system_settings_change();

-- ============================================================================
-- 4. CAMPOS PERSONALIZADOS: custom_field_definitions (S2-04)
-- ============================================================================

create table if not exists public.custom_field_definitions (
  id               uuid primary key default gen_random_uuid(),
  entity           text not null check (entity in ('client','case','case_process')),
  code             text not null,
  label            text not null,
  help_text        text,
  data_type        text not null check (data_type in ('TEXT','TEXTAREA','NUMBER','DATE','BOOLEAN','CURRENCY','SELECT','MULTISELECT')),
  catalog_code     text references public.catalogs(code),
  options          jsonb,
  is_required      boolean not null default false,
  validation       jsonb not null default '{}'::jsonb,
  default_value    jsonb,
  section          text,
  sort_order       int not null default 0,
  applies_to       jsonb not null default '{}'::jsonb,
  read_permission  text,
  write_permission text,
  is_active        boolean not null default true,
  is_system        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (entity, code)
);

alter table public.custom_field_definitions enable row level security;

create trigger set_custom_field_definitions_updated_at
  before update on public.custom_field_definitions
  for each row execute function private.set_updated_at();

-- Trigger: Proteger campos de sistema e inmutabilidad de entity y code
create or replace function private.guard_custom_field_definition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.entity <> new.entity or old.code <> new.code then
      raise exception 'Operacion rechazada: la entidad y el codigo de un campo personalizado son inmutables';
    end if;
    if old.is_system = true and new.is_system = false then
      raise exception 'Operacion rechazada: no se puede remover is_system de un campo protegido';
    end if;
  elsif tg_op = 'DELETE' then
    if old.is_system = true then
      raise exception 'Operacion rechazada: no se puede eliminar un campo personalizado protegido del sistema';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function private.guard_custom_field_definition() from public, anon;
grant execute on function private.guard_custom_field_definition() to authenticated, service_role;

create trigger guard_custom_field_definition_trigger
  before update or delete on public.custom_field_definitions
  for each row execute function private.guard_custom_field_definition();

-- Función para validar datos personalizados contra definiciones activas
create or replace function private.validate_custom_data(_entity text, _data jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  f record;
  val jsonb;
begin
  if _data is null then
    _data := '{}'::jsonb;
  end if;

  for f in
    select code, label, data_type, is_required
      from public.custom_field_definitions
     where entity = _entity
       and is_active = true
  loop
    val := _data -> f.code;

    -- Validar campo requerido
    if f.is_required and (val is null or val = 'null'::jsonb or (jsonb_typeof(val) = 'string' and trim(both '"' from val::text) = '')) then
      raise exception 'El campo personalizado % (%) es requerido para la entidad %', f.label, f.code, _entity;
    end if;

    -- Validar tipo si está presente
    if val is not null and val <> 'null'::jsonb then
      case f.data_type
        when 'NUMBER', 'CURRENCY' then
          if jsonb_typeof(val) <> 'number' then
            raise exception 'El campo % (%) debe ser numerico', f.label, f.code;
          end if;
        when 'BOOLEAN' then
          if jsonb_typeof(val) <> 'boolean' then
            raise exception 'El campo % (%) debe ser booleano', f.label, f.code;
          end if;
        when 'TEXT', 'TEXTAREA', 'DATE', 'SELECT' then
          if jsonb_typeof(val) <> 'string' then
            raise exception 'El campo % (%) debe ser texto', f.label, f.code;
          end if;
        when 'MULTISELECT' then
          if jsonb_typeof(val) <> 'array' then
            raise exception 'El campo % (%) debe ser un arreglo de opciones', f.label, f.code;
          end if;
        else
          null;
      end case;
    end if;
  end loop;

  return _data;
end;
$$;

revoke execute on function private.validate_custom_data(text, jsonb) from public, anon;
grant execute on function private.validate_custom_data(text, jsonb) to authenticated, service_role;

-- ============================================================================
-- 5. TABLA holidays (S2-05 - Vacía y editable)
-- ============================================================================

create table if not exists public.holidays (
  date        date primary key,
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.holidays enable row level security;

-- ============================================================================
-- 6. BUCKET PÚBLICO logos Y POLÍTICAS DE STORAGE (S2-07)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- Políticas sobre storage.objects para el bucket 'logos'
create policy "Logos lectura publica"
  on storage.objects for select
  using (bucket_id = 'logos');

create policy "Logos subida por administradores"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'logos' and (select private.has_permission('settings.manage')));

create policy "Logos modificacion por administradores"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'logos' and (select private.has_permission('settings.manage')));

create policy "Logos eliminacion por administradores"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'logos' and (select private.has_permission('settings.manage')));

-- ============================================================================
-- 7. POLÍTICAS RLS (Gobernadas por private.has_permission('settings.manage'))
-- ============================================================================

-- 7.1 catalogs
create policy catalogs_select on public.catalogs
  for select to authenticated
  using (true);

create policy catalogs_insert on public.catalogs
  for insert to authenticated
  with check ((select private.has_permission('settings.manage')));

create policy catalogs_update on public.catalogs
  for update to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));

create policy catalogs_delete on public.catalogs
  for delete to authenticated
  using ((select private.has_permission('settings.manage')) and not is_system);

-- 7.2 catalog_items
create policy catalog_items_select on public.catalog_items
  for select to authenticated
  using (true);

create policy catalog_items_insert on public.catalog_items
  for insert to authenticated
  with check ((select private.has_permission('settings.manage')));

create policy catalog_items_update on public.catalog_items
  for update to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));

create policy catalog_items_delete on public.catalog_items
  for delete to authenticated
  using ((select private.has_permission('settings.manage')) and not is_system);

-- 7.3 feature_flags
create policy feature_flags_select on public.feature_flags
  for select to authenticated
  using (true);

create policy feature_flags_update on public.feature_flags
  for update to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));

create policy feature_flags_insert on public.feature_flags
  for insert to authenticated
  with check ((select private.has_permission('settings.manage')));

create policy feature_flags_delete on public.feature_flags
  for delete to authenticated
  using ((select private.has_permission('settings.manage')) and not is_locked);

-- 7.4 setting_definitions
create policy setting_definitions_select on public.setting_definitions
  for select to authenticated
  using (true);

create policy setting_definitions_insert on public.setting_definitions
  for insert to authenticated
  with check ((select private.has_permission('settings.manage')));

create policy setting_definitions_update on public.setting_definitions
  for update to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));

create policy setting_definitions_delete on public.setting_definitions
  for delete to authenticated
  using ((select private.has_permission('settings.manage')));

-- 7.5 system_settings
create policy system_settings_select on public.system_settings
  for select to authenticated
  using (true);

create policy system_settings_insert on public.system_settings
  for insert to authenticated
  with check ((select private.has_permission('settings.manage')));

create policy system_settings_update on public.system_settings
  for update to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));

create policy system_settings_delete on public.system_settings
  for delete to authenticated
  using ((select private.has_permission('settings.manage')));

-- 7.6 settings_history
create policy settings_history_select on public.settings_history
  for select to authenticated
  using ((select private.has_permission('settings.manage')) or (select private.has_permission('audit.read')));

create policy settings_history_insert on public.settings_history
  for insert to authenticated
  with check (true);

-- 7.7 custom_field_definitions
create policy custom_field_definitions_select on public.custom_field_definitions
  for select to authenticated
  using (true);

create policy custom_field_definitions_insert on public.custom_field_definitions
  for insert to authenticated
  with check ((select private.has_permission('settings.manage')));

create policy custom_field_definitions_update on public.custom_field_definitions
  for update to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));

create policy custom_field_definitions_delete on public.custom_field_definitions
  for delete to authenticated
  using ((select private.has_permission('settings.manage')) and not is_system);

-- 7.8 holidays
create policy holidays_select on public.holidays
  for select to authenticated
  using (true);

create policy holidays_insert on public.holidays
  for insert to authenticated
  with check ((select private.has_permission('settings.manage')));

create policy holidays_update on public.holidays
  for update to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));

create policy holidays_delete on public.holidays
  for delete to authenticated
  using ((select private.has_permission('settings.manage')));

-- ============================================================================
-- 8. PERMISOS DE TABLAS PARA authenticated Y service_role
-- ============================================================================

grant select, insert, update, delete on public.catalogs to authenticated, service_role;
grant select, insert, update, delete on public.catalog_items to authenticated, service_role;
grant select, insert, update, delete on public.feature_flags to authenticated, service_role;
grant select, insert, update, delete on public.setting_definitions to authenticated, service_role;
grant select, insert, update, delete on public.system_settings to authenticated, service_role;
grant select, insert on public.settings_history to authenticated, service_role;
grant select, insert, update, delete on public.custom_field_definitions to authenticated, service_role;
grant select, insert, update, delete on public.holidays to authenticated, service_role;

commit;
