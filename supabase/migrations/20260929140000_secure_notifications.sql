-- Migración: 20260929140000_secure_notifications.sql
-- Sprint 8: Helper private.user_can_access_case, errores P0403/P0404 y RLS blindada en notifications

begin;

-- ============================================================================
-- 1. HELPER: private.user_can_access_case(_user_id, _case_id)
-- ============================================================================
create or replace function private.user_can_access_case(_user_id uuid, _case_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_is_active_profile boolean;
  v_is_superuser boolean;
  v_has_active_assignment boolean;
  v_is_confidential boolean;
  v_has_read_all boolean;
  v_has_read_assigned boolean;
begin
  if _user_id is null or _case_id is null then
    return false;
  end if;

  -- 1. Perfil activo obligatorio
  select exists (
    select 1 from public.profiles
     where id = _user_id and is_active = true
  ) into v_is_active_profile;

  if not coalesce(v_is_active_profile, false) then
    return false;
  end if;

  -- 2. Superusuario (a través de roles activos)
  select exists (
    select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id and r.is_active = true
     where ur.user_id = _user_id
       and r.is_superuser = true
  ) into v_is_superuser;

  if coalesce(v_is_superuser, false) then
    return true;
  end if;

  -- 3. Asignación activa en el expediente
  select exists (
    select 1
      from public.case_assignments ca
     where ca.case_id = _case_id
       and ca.user_id = _user_id
       and ca.ended_at is null
  ) into v_has_active_assignment;

  -- 4. Confidencialidad del expediente
  select coalesce(c.is_confidential, false)
    into v_is_confidential
    from public.cases c
   where c.id = _case_id;

  if v_is_confidential is null then
    return false;
  end if;

  if v_is_confidential then
    return v_has_active_assignment;
  end if;

  -- 5. Expediente público: permiso cases.read.all
  select exists (
    select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id and r.is_active = true
      join public.role_permissions rp on rp.role_id = r.id
      join public.permissions p on p.id = rp.permission_id
     where ur.user_id = _user_id
       and p.code = 'cases.read.all'
  ) into v_has_read_all;

  if coalesce(v_has_read_all, false) then
    return true;
  end if;

  -- 6. Expediente público: permiso cases.read.assigned + asignación
  select exists (
    select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id and r.is_active = true
      join public.role_permissions rp on rp.role_id = r.id
      join public.permissions p on p.id = rp.permission_id
     where ur.user_id = _user_id
       and p.code = 'cases.read.assigned'
  ) into v_has_read_assigned;

  if coalesce(v_has_read_assigned, false) and v_has_active_assignment then
    return true;
  end if;

  return false;
end;
$$;

revoke execute on function private.user_can_access_case(uuid, uuid) from public, anon, authenticated;
grant execute on function private.user_can_access_case(uuid, uuid) to service_role;

-- ============================================================================
-- 2. REDEFINICIÓN DE create_notification
-- Modifica ÚNICAMENTE el bloque 5.2 para utilizar private.user_can_access_case
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
begin
  -- 5.1 Validaciones requeridas
  if p_user_id is null then
    raise exception 'p_user_id es obligatorio' using errcode = 'P0400';
  end if;

  if p_type is null or trim(p_type) = '' then
    raise exception 'p_type es obligatorio' using errcode = 'P0400';
  end if;

  -- Verificación de destinatario activo
  if not exists (select 1 from public.profiles where id = p_user_id and is_active = true) then
    raise exception 'Destinatario inactivo o inexistente' using errcode = 'P0404';
  end if;

  -- 5.2 Control de privacidad y fuga de información (Regla e)
  if p_case_id is not null then
    if not private.user_can_access_case(p_user_id, p_case_id) then
      raise exception 'Destinatario sin acceso al expediente' using errcode = 'P0403';
    end if;
  end if;

  -- 5.3 Preferencias del usuario
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

  -- 5.4 Dedupe canónico diario en America/Lima
  v_lima_date := to_char(now() at time zone 'America/Lima', 'YYYY-MM-DD');

  v_dedupe_key := coalesce(
    p_dedupe_key,
    p_type || ':' ||
    coalesce(p_entity_id::text, coalesce(p_case_id::text, 'general')) || ':' ||
    p_user_id::text || ':' ||
    v_lima_date
  );

  -- 5.5 Inserción idempotente
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

revoke execute on function public.create_notification(uuid, text, text, text, text, uuid, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_notification(uuid, text, text, text, text, uuid, uuid, text, text, text, text, jsonb) to service_role;

-- ============================================================================
-- 3. AJUSTE DE PRIVILEGIOS Y POLÍTICAS RLS EN notifications
-- ============================================================================
revoke all on public.notifications from anon;
revoke truncate, trigger, references, update on public.notifications from authenticated;
grant select on public.notifications to authenticated;

drop policy if exists notifications_update on public.notifications;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and (case_id is null or (select private.can_access_case(case_id)))
  );

create index if not exists idx_notifications_case_id on public.notifications (case_id);

-- ============================================================================
-- 4. AJUSTE DE PRIVILEGIOS EN notification_preferences
-- ============================================================================
revoke all on public.notification_preferences from anon;
revoke truncate, trigger, references on public.notification_preferences from authenticated;

commit;
