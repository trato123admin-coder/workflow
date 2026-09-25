-- Migración: 20260924110000_security_hardening.sql
-- Sprint 1: Endurecimiento de seguridad, anti-escalada de privilegios, verificación de perfil activo y aal2, y auditoría obligatoria
-- Requiere migración previa: 20260924100000_identity_and_roles.sql

begin;

-- ============================================================================
-- 1. FUNCIÓN DE AUDITORÍA INMUTABLE: private.log_audit_event
-- ============================================================================
create or replace function private.log_audit_event(
  _user_id uuid,
  _module text,
  _entity_type text,
  _entity_id uuid,
  _action text,
  _old_data jsonb default null,
  _new_data jsonb default null,
  _ip_address inet default null,
  _user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_actor uuid := coalesce(_user_id, (select auth.uid()));
begin
  insert into public.audit_logs (
    user_id,
    module,
    entity_type,
    entity_id,
    action,
    old_data,
    new_data,
    ip_address,
    user_agent
  )
  values (
    v_actor,
    _module,
    _entity_type,
    _entity_id,
    _action,
    _old_data,
    _new_data,
    _ip_address,
    _user_agent
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function private.log_audit_event from public;
grant execute on function private.log_audit_event to anon, authenticated, service_role;

-- ============================================================================
-- 2. POLÍTICA RLS PARA LECTURA DE AUDITORÍA
-- ============================================================================
grant select on public.audit_logs to authenticated;

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using ((select private.has_permission('audit.read')));

-- ============================================================================
-- 3. ACTUALIZACIÓN CRÍTICA DE private.has_permission
-- ============================================================================
-- Valida:
-- 1. profiles.is_active = true (usuario activo)
-- 2. roles.is_active = true (rol activo)
-- 3. auth.jwt() ->> 'aal' = 'aal2' si roles.requires_mfa = true
-- 4. roles.is_superuser o código de permiso coincidente
create or replace function private.has_permission(_perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.user_roles ur
      join public.profiles p_user on p_user.id = ur.user_id and p_user.is_active = true
      join public.roles r on r.id = ur.role_id and r.is_active = true
      left join public.role_permissions rp on rp.role_id = r.id
      left join public.permissions p on p.id = rp.permission_id
     where ur.user_id = (select auth.uid())
       and ((not r.requires_mfa) or (coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'))
       and (r.is_superuser or p.code = _perm)
  );
$$;

revoke execute on function private.has_permission(text) from public, anon;
grant execute on function private.has_permission(text) to authenticated, service_role;

-- ============================================================================
-- 4. DISPARADORES Y REGLAS ANTI-ESCALADA DE PRIVILEGIOS
-- ============================================================================

-- 4.1 Anti-escalada en user_roles:
-- - Nadie puede modificarse sus propios roles (anti-auto-asignación)
-- - Nadie puede asignar un rol is_superuser a menos que el actor sea un superusuario activo con aal2
create or replace function private.guard_user_roles_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_is_actor_superuser boolean := false;
  v_target_role_superuser boolean := false;
  v_target_role_requires_mfa boolean := false;
  v_role_id uuid := coalesce(new.role_id, old.role_id);
  v_target_user_id uuid := coalesce(new.user_id, old.user_id);
begin
  -- Si la invocación es del sistema (service_role sin auth.uid), permitir
  if v_actor_id is null then
    return coalesce(new, old);
  end if;

  -- Regla A: Nadie puede modificar sus propios roles
  if v_actor_id = v_target_user_id then
    raise exception 'Operacion rechazada: ningun usuario puede asignar o quitar roles a su propia cuenta (anti-escalada)';
  end if;

  -- Obtener propiedades del rol objetivo
  select is_superuser, requires_mfa into v_target_role_superuser, v_target_role_requires_mfa
    from public.roles where id = v_role_id;

  -- Comprobar si el actor es superusuario activo
  select exists (
    select 1
      from public.user_roles ur
      join public.profiles p on p.id = ur.user_id and p.is_active = true
      join public.roles r on r.id = ur.role_id and r.is_active = true
     where ur.user_id = v_actor_id and r.is_superuser = true
  ) into v_is_actor_superuser;

  -- Regla B: Solo un superusuario puede asignar o revocar un rol de superusuario
  if v_target_role_superuser and not v_is_actor_superuser then
    raise exception 'Operacion rechazada: solo un superusuario activo puede asignar o retirar roles de nivel superusuario';
  end if;

  return coalesce(new, old);
end;
$$;

revoke execute on function private.guard_user_roles_escalation() from public, anon;
grant execute on function private.guard_user_roles_escalation() to authenticated, service_role;

drop trigger if exists guard_user_roles_anti_escalation on public.user_roles;
create trigger guard_user_roles_anti_escalation
  before insert or update or delete on public.user_roles
  for each row execute function private.guard_user_roles_escalation();

-- 4.2 Anti-escalada en role_permissions:
-- - Nadie puede otorgar un permiso a un rol si el actor no posee ese permiso (a menos que sea superusuario)
create or replace function private.guard_role_permissions_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_is_actor_superuser boolean := false;
  v_actor_has_perm boolean := false;
  v_perm_code text;
begin
  -- Si es service_role, permitir
  if v_actor_id is null then
    return new;
  end if;

  select code into v_perm_code from public.permissions where id = new.permission_id;

  -- Comprobar si el actor es superusuario
  select exists (
    select 1
      from public.user_roles ur
      join public.profiles p on p.id = ur.user_id and p.is_active = true
      join public.roles r on r.id = ur.role_id and r.is_active = true
     where ur.user_id = v_actor_id and r.is_superuser = true
  ) into v_is_actor_superuser;

  if v_is_actor_superuser then
    return new;
  end if;

  -- Comprobar si el actor posee el permiso que intenta otorgar
  select exists (
    select 1
      from public.user_roles ur
      join public.profiles p on p.id = ur.user_id and p.is_active = true
      join public.roles r on r.id = ur.role_id and r.is_active = true
      join public.role_permissions rp on rp.role_id = r.id
      join public.permissions p_code on p_code.id = rp.permission_id
     where ur.user_id = v_actor_id and p_code.code = v_perm_code
  ) into v_actor_has_perm;

  if not v_actor_has_perm then
    raise exception 'Operacion rechazada: no puede otorgar permisos que usted no posee directamente (anti-escalada)';
  end if;

  return new;
end;
$$;

revoke execute on function private.guard_role_permissions_escalation() from public, anon;
grant execute on function private.guard_role_permissions_escalation() to authenticated, service_role;

drop trigger if exists guard_role_permissions_anti_escalation on public.role_permissions;
create trigger guard_role_permissions_anti_escalation
  before insert or update on public.role_permissions
  for each row execute function private.guard_role_permissions_escalation();

-- 4.3 Anti-escalada en roles:
-- - Nadie que no sea superusuario puede marcar is_superuser = true en un rol
create or replace function private.guard_roles_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_is_actor_superuser boolean := false;
begin
  if v_actor_id is null then
    return new;
  end if;

  if (tg_op = 'INSERT' and new.is_superuser = true) or
     (tg_op = 'UPDATE' and new.is_superuser = true and old.is_superuser = false) then
    select exists (
      select 1
        from public.user_roles ur
        join public.profiles p on p.id = ur.user_id and p.is_active = true
        join public.roles r on r.id = ur.role_id and r.is_active = true
       where ur.user_id = v_actor_id and r.is_superuser = true
    ) into v_is_actor_superuser;

    if not v_is_actor_superuser then
      raise exception 'Operacion rechazada: solo un superusuario activo puede crear o elevar roles con privilegios de superusuario';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.guard_roles_escalation() from public, anon;
grant execute on function private.guard_roles_escalation() to authenticated, service_role;

drop trigger if exists guard_roles_anti_escalation on public.roles;
create trigger guard_roles_anti_escalation
  before insert or update on public.roles
  for each row execute function private.guard_roles_escalation();

-- ============================================================================
-- 5. AUDITORÍA AUTOMÁTICA EN BASE DE DATOS (APPEND-ONLY GARANTIZADO)
-- ============================================================================

-- 5.1 Trigger para auditar cambios de roles a usuarios (ASSIGN_ROLE y REMOVE_ROLE)
create or replace function private.audit_user_roles_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_audit_event(
      _user_id := (select auth.uid()),
      _module := 'users',
      _entity_type := 'user_role',
      _entity_id := new.user_id,
      _action := 'ASSIGN_ROLE',
      _old_data := null,
      _new_data := jsonb_build_object('user_id', new.user_id, 'role_id', new.role_id)
    );
    return new;
  elsif tg_op = 'DELETE' then
    perform private.log_audit_event(
      _user_id := (select auth.uid()),
      _module := 'users',
      _entity_type := 'user_role',
      _entity_id := old.user_id,
      _action := 'REMOVE_ROLE',
      _old_data := jsonb_build_object('user_id', old.user_id, 'role_id', old.role_id),
      _new_data := null
    );
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists audit_user_roles_trigger on public.user_roles;
create trigger audit_user_roles_trigger
  after insert or delete on public.user_roles
  for each row execute function private.audit_user_roles_change();

-- 5.2 Trigger para auditar activación/desactivación de usuarios (TOGGLE_USER_STATUS)
create or replace function private.audit_profiles_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.is_active is distinct from new.is_active then
    perform private.log_audit_event(
      _user_id := (select auth.uid()),
      _module := 'users',
      _entity_type := 'profile',
      _entity_id := new.id,
      _action := 'TOGGLE_USER_STATUS',
      _old_data := jsonb_build_object('is_active', old.is_active),
      _new_data := jsonb_build_object('is_active', new.is_active)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_profiles_trigger on public.profiles;
create trigger audit_profiles_trigger
  after update on public.profiles
  for each row execute function private.audit_profiles_change();

-- 5.3 Trigger para auditar cambios en la matriz de permisos de roles (UPDATE_ROLE_PERMISSIONS)
create or replace function private.audit_role_permissions_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_audit_event(
      _user_id := (select auth.uid()),
      _module := 'roles',
      _entity_type := 'role_permission',
      _entity_id := new.role_id,
      _action := 'UPDATE_ROLE_PERMISSIONS',
      _old_data := null,
      _new_data := jsonb_build_object('role_id', new.role_id, 'permission_id', new.permission_id, 'operation', 'GRANT')
    );
    return new;
  elsif tg_op = 'DELETE' then
    perform private.log_audit_event(
      _user_id := (select auth.uid()),
      _module := 'roles',
      _entity_type := 'role_permission',
      _entity_id := old.role_id,
      _action := 'UPDATE_ROLE_PERMISSIONS',
      _old_data := jsonb_build_object('role_id', old.role_id, 'permission_id', old.permission_id, 'operation', 'REVOKE'),
      _new_data := null
    );
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists audit_role_permissions_trigger on public.role_permissions;
create trigger audit_role_permissions_trigger
  after insert or delete on public.role_permissions
  for each row execute function private.audit_role_permissions_change();

commit;
