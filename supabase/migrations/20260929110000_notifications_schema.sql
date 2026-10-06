-- Migración: 20260929110000_notifications_schema.sql
-- Sprint 8: Automatización I — Esquema de notificaciones, preferencias,
-- deduplicación diaria estricta, RLS y función SECURITY DEFINER blindada (exclusiva service_role)
-- con validación estricta de acceso al caso para el DESTINATARIO.
-- Precedencia: 00-maestro §3.4, v2 §10, v2.1 §5, AGENTS.md

begin;

-- ============================================================================
-- 1. TABLA notifications (Agnóstica de canal: APP, TELEGRAM, EMAIL)
-- ============================================================================
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text not null,
  entity_type text,
  entity_id   uuid,
  case_id     uuid references public.cases(id) on delete cascade,
  action_url  text,
  severity    text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  channel     text not null default 'APP' check (channel in ('APP', 'TELEGRAM', 'EMAIL')),
  is_read     boolean not null default false,
  read_at     timestamptz,
  dedupe_key  text not null unique,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Trigger de updated_at
drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at
  before update on public.notifications
  for each row execute function private.set_updated_at();

-- Índices de consulta frecuente
create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, created_at desc)
  where not is_read;

create index if not exists idx_notifications_user_all
  on public.notifications (user_id, created_at desc);

create index if not exists idx_notifications_case
  on public.notifications (case_id)
  where case_id is not null;

create index if not exists idx_notifications_dedupe
  on public.notifications (dedupe_key);

-- ============================================================================
-- 2. TABLA notification_preferences (Configuración por usuario y canal)
-- ============================================================================
create table if not exists public.notification_preferences (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  channel     text not null default 'APP' check (channel in ('APP', 'TELEGRAM', 'EMAIL')),
  alert_type  text not null,
  is_enabled  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, channel, alert_type)
);

drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function private.set_updated_at();

create index if not exists idx_notification_preferences_lookup
  on public.notification_preferences (user_id, channel, alert_type);

-- ============================================================================
-- 3. HABILITACIÓN DE REALTIME (Para campana de notificaciones interactiva)
-- ============================================================================
alter publication supabase_realtime add table public.notifications;

-- ============================================================================
-- 4. SEGURIDAD Y POLÍTICAS RLS (Aislamiento estricto por usuario)
-- ============================================================================
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

-- 4.1 RLS notifications:
-- SELECT: El usuario solo ve sus propias notificaciones
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

-- UPDATE: El usuario solo puede actualizar sus propias notificaciones (marcar como leída)
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Revocar INSERT y DELETE directo a authenticated: inserción solo vía service_role
revoke insert, delete on public.notifications from public, anon, authenticated;
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- 4.2 RLS notification_preferences:
-- CRUD completo exclusivo para el propio usuario sobre sus preferencias
drop policy if exists notification_preferences_select on public.notification_preferences;
create policy notification_preferences_select on public.notification_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notification_preferences_insert on public.notification_preferences;
create policy notification_preferences_insert on public.notification_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists notification_preferences_update on public.notification_preferences;
create policy notification_preferences_update on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists notification_preferences_delete on public.notification_preferences;
create policy notification_preferences_delete on public.notification_preferences
  for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;

-- ============================================================================
-- 5. FUNCIÓN SECURITY DEFINER: create_notification
-- EXCLUSIVA PARA service_role (Engine y workers de fondo).
-- Valida que el DESTINATARIO tenga acceso legítimo al caso si p_case_id no es nulo.
-- ============================================================================
create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_case_id uuid default null,
  p_action_url text default null,
  p_severity text default 'info',
  p_channel text default 'APP',
  p_dedupe_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.notifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notification public.notifications;
  v_dedupe_key text;
  v_is_disabled boolean;
  v_lima_date text;
  v_recipient_has_access boolean;
begin
  -- 5.1 Validaciones de parámetros requeridos
  if p_user_id is null then
    raise exception 'p_user_id es obligatorio para emitir una notificacion' using errcode = 'P0400';
  end if;

  if p_type is null or trim(p_type) = '' then
    raise exception 'p_type es obligatorio' using errcode = 'P0400';
  end if;

  -- 5.2 Control de privacidad y fuga de información (Regla e):
  -- Si la notificación está vinculada a un expediente (p_case_id no es nulo),
  -- se valida OBLIGATORIAMENTE que el DESTINATARIO (p_user_id) tenga acceso al caso:
  --   a) Tiene asignación activa en el caso (case_assignments con ended_at null), O
  --   b) Es usuario con rol ADMIN / superusuario, O
  --   c) El caso no es confidencial y el usuario posee el permiso cases.read.all
  if p_case_id is not null then
    select exists (
      select 1
        from public.cases c
       where c.id = p_case_id
         and (
           -- 1. Asignación activa en el caso
           exists (
             select 1 from public.case_assignments ca
              where ca.case_id = p_case_id
                and ca.user_id = p_user_id
                and ca.ended_at is null
           )
           -- 2. Rol administrador del sistema
           or exists (
             select 1 from public.user_roles ur
               join public.roles r on r.id = ur.role_id
              where ur.user_id = p_user_id
                and r.code = 'ADMIN'
           )
           -- 3. Caso no confidencial y usuario con cases.read.all
           or (
             not coalesce(c.is_confidential, false)
             and exists (
               select 1 from public.user_roles ur
                 join public.role_permissions rp on rp.role_id = ur.role_id
                 join public.permissions p on p.id = rp.permission_id
                where ur.user_id = p_user_id
                  and p.code = 'cases.read.all'
             )
           )
         )
    ) into v_recipient_has_access;

    if not coalesce(v_recipient_has_access, false) then
      raise exception 'Privacidad violada: el destinatario % no tiene acceso al caso %', p_user_id, p_case_id
        using errcode = '42501';
    end if;
  end if;

  -- 5.3 Comprobar preferencias de notificación del usuario
  -- Si el usuario desactivó este tipo de alerta para este canal, se omite silenciosamente
  select exists (
    select 1
      from public.notification_preferences np
     where np.user_id = p_user_id
       and np.channel = coalesce(p_channel, 'APP')
       and np.alert_type = p_type
       and np.is_enabled = false
  ) into v_is_disabled;

  if coalesce(v_is_disabled, false) then
    return null;
  end if;

  -- 5.4 Construcción del dedupe_key canónico: tipo:entidad:destinatario:fecha
  -- Se calcula en zona horaria America/Lima (UTC-5) para garantizar deduplicación diaria precisa
  v_lima_date := to_char(now() at time zone 'America/Lima', 'YYYY-MM-DD');

  v_dedupe_key := coalesce(
    p_dedupe_key,
    p_type || ':' ||
    coalesce(p_entity_id::text, coalesce(p_case_id::text, 'general')) || ':' ||
    p_user_id::text || ':' ||
    v_lima_date
  );

  -- 5.5 Inserción idempotente protegida contra duplicados
  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    entity_type,
    entity_id,
    case_id,
    action_url,
    severity,
    channel,
    dedupe_key,
    metadata
  ) values (
    p_user_id,
    p_type,
    p_title,
    p_body,
    p_entity_type,
    p_entity_id,
    p_case_id,
    p_action_url,
    coalesce(p_severity, 'info'),
    coalesce(p_channel, 'APP'),
    v_dedupe_key,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (dedupe_key) do nothing
  returning * into v_notification;

  return v_notification;
end;
$$;

-- Blindaje estricto: Solo service_role puede emitir notificaciones (trabajadores de fondo del Engine)
revoke execute on function public.create_notification(uuid, text, text, text, text, uuid, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_notification(uuid, text, text, text, text, uuid, uuid, text, text, text, text, jsonb) to service_role;

-- ============================================================================
-- 6. RPC DE GESTIÓN: mark_notification_as_read y mark_all_as_read
-- ACCESIBLES PARA authenticated (operan estrictamente sobre auth.uid())
-- ============================================================================
create or replace function public.mark_notification_as_read(p_notification_id uuid)
returns public.notifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notification public.notifications;
begin
  update public.notifications
     set is_read = true,
         read_at = coalesce(read_at, now()),
         updated_at = now()
   where id = p_notification_id
     and user_id = (select auth.uid())
  returning * into v_notification;

  return v_notification;
end;
$$;

revoke execute on function public.mark_notification_as_read(uuid) from public, anon;
grant execute on function public.mark_notification_as_read(uuid) to authenticated, service_role;

create or replace function public.mark_all_notifications_as_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated_count integer;
begin
  update public.notifications
     set is_read = true,
         read_at = coalesce(read_at, now()),
         updated_at = now()
   where user_id = (select auth.uid())
     and not is_read;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;

revoke execute on function public.mark_all_notifications_as_read() from public, anon;
grant execute on function public.mark_all_notifications_as_read() to authenticated, service_role;

commit;
