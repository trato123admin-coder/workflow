-- Migración: 20260924100000_identity_and_roles.sql
-- Sprint 1: Identidad, seguridad y roles
-- Requiere migración previa: 20260924000000_initial_schema.sql

begin;

-- ============================================================================
-- 1. APERTURA MÍNIMA DEL ESQUEMA PRIVATE
-- ============================================================================
-- Se otorga USAGE a authenticated para que pueda invocar funciones de seguridad en RLS.
-- El acceso a tablas dentro de private sigue estrictamente revocado.
grant usage on schema private to authenticated;

-- ============================================================================
-- 2. TABLAS DE IDENTIDAD Y SEGURIDAD
-- ============================================================================

-- 2.1 Perfiles de usuario (vinculados a auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  email text not null,
  is_active boolean not null default true,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- 2.2 Roles del sistema (editables salvo ADMIN)
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  is_superuser boolean not null default false,
  requires_mfa boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.roles enable row level security;

create trigger roles_set_updated_at
  before update on public.roles
  for each row execute function private.set_updated_at();

-- 2.3 Catálogo de permisos
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  module text not null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.permissions enable row level security;

-- 2.4 Matriz asociativa: roles <-> permisos
create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

alter table public.role_permissions enable row level security;

-- 2.5 Asignación de roles: usuarios <-> roles
create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles(id),
  primary key (user_id, role_id)
);

alter table public.user_roles enable row level security;

-- ============================================================================
-- 3. FUNCIÓN AUXILIAR DE RLS: private.has_permission
-- ============================================================================
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
      join public.roles r on r.id = ur.role_id and r.is_active
      left join public.role_permissions rp on rp.role_id = r.id
      left join public.permissions p on p.id = rp.permission_id
     where ur.user_id = (select auth.uid())
       and (r.is_superuser or p.code = _perm)
  );
$$;

revoke execute on function private.has_permission(text) from public, anon;
grant execute on function private.has_permission(text) to authenticated, service_role;

-- ============================================================================
-- 4. POLÍTICAS RLS (Gobernadas por permisos, NO por nombre de rol)
-- ============================================================================

-- 4.1 Políticas para profiles
create policy profiles_select on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or (select private.has_permission('users.manage')));

create policy profiles_update on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id or (select private.has_permission('users.manage')))
  with check ((select auth.uid()) = id or (select private.has_permission('users.manage')));

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id or (select private.has_permission('users.manage')));

create policy profiles_delete on public.profiles
  for delete to authenticated
  using ((select private.has_permission('users.manage')));

-- 4.2 Políticas para roles
create policy roles_select on public.roles
  for select to authenticated
  using (is_active or (select private.has_permission('roles.manage')));

create policy roles_insert on public.roles
  for insert to authenticated
  with check ((select private.has_permission('roles.manage')));

create policy roles_update on public.roles
  for update to authenticated
  using ((select private.has_permission('roles.manage')))
  with check ((select private.has_permission('roles.manage')));

create policy roles_delete on public.roles
  for delete to authenticated
  using ((select private.has_permission('roles.manage')) and not is_system);

-- 4.3 Políticas para permissions
create policy permissions_select on public.permissions
  for select to authenticated
  using (true);

-- 4.4 Políticas para role_permissions
create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (true);

create policy role_permissions_insert on public.role_permissions
  for insert to authenticated
  with check ((select private.has_permission('roles.manage')));

create policy role_permissions_delete on public.role_permissions
  for delete to authenticated
  using ((select private.has_permission('roles.manage')));

-- 4.5 Políticas para user_roles
create policy user_roles_select on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_permission('users.manage')));

create policy user_roles_insert on public.user_roles
  for insert to authenticated
  with check ((select private.has_permission('users.manage')));

create policy user_roles_delete on public.user_roles
  for delete to authenticated
  using ((select private.has_permission('users.manage')));

-- ============================================================================
-- 5. TRIGGER: ALTA AUTOMÁTICA DE PERFIL AL CREAR USUARIO EN AUTH
-- ============================================================================
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon;
grant execute on function private.handle_new_user() to service_role;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ============================================================================
-- 6. TRIGGER DE SEGURIDAD: PROTECCIÓN DEL ÚLTIMO ADMINISTRADOR ACTIVO
-- ============================================================================
create or replace function private.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_role_id uuid;
  v_active_admins_count int;
begin
  select id into v_admin_role_id from public.roles where code = 'ADMIN';

  -- A. Protección al actualizar o eliminar perfil
  if (tg_table_name = 'profiles') then
    if (tg_op = 'UPDATE' and old.is_active = true and new.is_active = false) or (tg_op = 'DELETE') then
      if exists (
        select 1 from public.user_roles
        where user_id = old.id and role_id = v_admin_role_id
      ) then
        select count(distinct ur.user_id) into v_active_admins_count
          from public.user_roles ur
          join public.profiles p on p.id = ur.user_id
          join public.roles r on r.id = ur.role_id
         where r.code = 'ADMIN' and p.is_active = true and r.is_active = true;

        if v_active_admins_count <= 1 then
          raise exception 'Operacion rechazada: no se puede desactivar ni eliminar al ultimo administrador activo';
        end if;
      end if;
    end if;
    return coalesce(new, old);
  end if;

  -- B. Protección al retirar el rol ADMIN a un usuario
  if (tg_table_name = 'user_roles') then
    if (tg_op = 'DELETE') or (tg_op = 'UPDATE' and old.role_id <> new.role_id) then
      if old.role_id = v_admin_role_id then
        select count(distinct ur.user_id) into v_active_admins_count
          from public.user_roles ur
          join public.profiles p on p.id = ur.user_id
          join public.roles r on r.id = ur.role_id
         where r.code = 'ADMIN' and p.is_active = true and r.is_active = true
           and ur.user_id <> old.user_id;

        if v_active_admins_count = 0 then
          raise exception 'Operacion rechazada: no se puede quitar el rol ADMIN al ultimo administrador activo';
        end if;
      end if;
    end if;
    return coalesce(new, old);
  end if;

  -- C. Protección al rol ADMIN propiamente dicho
  if (tg_table_name = 'roles') then
    if old.code = 'ADMIN' then
      if tg_op = 'DELETE' then
        raise exception 'Operacion rechazada: el rol ADMIN del sistema no puede ser eliminado';
      end if;
      if tg_op = 'UPDATE' and (new.code <> 'ADMIN' or new.is_active = false) then
        raise exception 'Operacion rechazada: el rol ADMIN no puede renombrarse ni desactivarse';
      end if;
    end if;
    return coalesce(new, old);
  end if;

  return coalesce(new, old);
end;
$$;

revoke execute on function private.prevent_last_admin_removal() from public, anon;
grant execute on function private.prevent_last_admin_removal() to authenticated, service_role;

drop trigger if exists guard_last_admin_profile on public.profiles;
create trigger guard_last_admin_profile
  before update or delete on public.profiles
  for each row execute function private.prevent_last_admin_removal();

drop trigger if exists guard_last_admin_user_role on public.user_roles;
create trigger guard_last_admin_user_role
  before update or delete on public.user_roles
  for each row execute function private.prevent_last_admin_removal();

drop trigger if exists guard_admin_role on public.roles;
create trigger guard_admin_role
  before update or delete on public.roles
  for each row execute function private.prevent_last_admin_removal();

-- ============================================================================
-- 7. DATOS SEMILLA: CATÁLOGO DE PERMISOS (40 PERMISOS)
-- ============================================================================
insert into public.permissions (code, module, description) values
  -- Clientes y Personas
  ('clients.read', 'clients', 'Consultar personas y clientes'),
  ('clients.write', 'clients', 'Crear y editar personas y clientes'),
  -- Casos
  ('cases.read.all', 'cases', 'Ver todos los casos de la empresa'),
  ('cases.read.assigned', 'cases', 'Ver solo los casos asignados'),
  ('cases.create', 'cases', 'Crear nuevos casos'),
  ('cases.write.all', 'cases', 'Modificar cualquier caso'),
  ('cases.write.assigned', 'cases', 'Modificar casos asignados'),
  ('cases.close', 'cases', 'Cerrar casos (completar o cancelar)'),
  -- Procesos
  ('processes.update', 'processes', 'Actualizar estado y avance de procesos'),
  -- Documentos
  ('documents.read', 'documents', 'Ver y descargar documentos del caso'),
  ('documents.upload', 'documents', 'Subir documentos al caso'),
  ('documents.generate', 'documents', 'Generar documentos con plantillas'),
  ('documents.approve', 'documents', 'Aprobar documentos legales generados'),
  -- Plantillas, Reglas y Modelos
  ('templates.manage', 'templates', 'Administrar plantillas DOCX'),
  ('rules.manage', 'rules', 'Administrar reglas del DSL'),
  ('models.manage', 'models', 'Administrar modelos de casos y procesos'),
  -- Dominio sucesorio (00-maestro §3.3)
  ('parties.read', 'parties', 'Ver intervinientes del caso (causante, herederos)'),
  ('parties.write', 'parties', 'Gestionar intervinientes y cuotas'),
  ('estate.read', 'estate', 'Ver inventario de bienes y deudas'),
  ('estate.write', 'estate', 'Gestionar bienes y deudas'),
  ('filings.read', 'filings', 'Ver trámites externos notariales y registrales'),
  ('filings.write', 'filings', 'Crear y actualizar trámites externos y plazos'),
  ('entities.read', 'entities', 'Consultar directorio de notarías y entidades'),
  ('entities.manage', 'entities', 'Gestionar entidades externas'),
  -- Cotizaciones
  ('quotes.read', 'quotes', 'Ver cotizaciones de proveedores'),
  ('quotes.write', 'quotes', 'Gestionar cotizaciones y selección'),
  -- Caja Chica
  ('cash.read', 'cash', 'Consultar libro y saldos de caja chica'),
  ('cash.write', 'cash', 'Registrar movimientos de caja chica'),
  ('cash.request', 'cash', 'Solicitar fondos de caja chica'),
  ('cash.approve', 'cash', 'Aprobar solicitudes y arqueos de caja'),
  ('cash.close', 'cash', 'Cerrar periodos y realizar arqueos de caja'),
  -- Reportes
  ('reports.read', 'reports', 'Consultar reportes y dashboards'),
  ('reports.export', 'reports', 'Exportar reportes a Excel/PDF'),
  -- Administración y Auditoría
  ('users.manage', 'admin', 'Administrar usuarios y asignación de roles'),
  ('roles.manage', 'admin', 'Administrar roles y matriz de permisos'),
  ('settings.manage', 'admin', 'Modificar configuración y catálogos'),
  ('audit.read', 'admin', 'Consultar pistas de auditoría'),
  ('monitoring.read', 'admin', 'Consultar estado y métricas del sistema'),
  -- IA
  ('ai.use', 'ai', 'Utilizar el asistente de sugerencias documentales'),
  ('ai.manage', 'ai', 'Gestionar parámetros y base de conocimiento de IA')
on conflict (code) do nothing;

-- ============================================================================
-- 8. DATOS SEMILLA: 5 ROLES BASE DEL SISTEMA
-- ============================================================================
insert into public.roles (code, name, description, is_system, is_superuser, requires_mfa) values
  ('ADMIN', 'Administrador', 'Control total y superusuario del sistema', true, true, true),
  ('ANALYST', 'Gestor', 'Gestor de casos, intervinientes y trámites documentarios', true, false, false),
  ('LAWYER', 'Abogado', 'Revisor legal, aprobación de documentos e informes', true, false, false),
  ('CONSULT', 'Consulta', 'Acceso de solo lectura a casos asignados', true, false, false),
  ('CASHIER', 'Caja Chica', 'Gestión de libro de caja, movimientos y arqueos', true, false, true)
on conflict (code) do nothing;

-- ============================================================================
-- 9. ASIGNACIÓN DE PERMISOS POR DEFECTO A ROLES (00-maestro §3.3)
-- ============================================================================

-- ANALYST (Gestor)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r, public.permissions p
 where r.code = 'ANALYST'
   and p.code in (
     'clients.read', 'clients.write',
     'cases.read.assigned', 'cases.create', 'cases.write.assigned',
     'processes.update',
     'documents.read', 'documents.upload', 'documents.generate',
     'parties.read', 'parties.write',
     'estate.read', 'estate.write',
     'filings.read', 'filings.write',
     'entities.read',
     'quotes.read', 'quotes.write',
     'cash.request',
     'reports.read',
     'ai.use'
   )
on conflict do nothing;

-- LAWYER (Abogado)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r, public.permissions p
 where r.code = 'LAWYER'
   and p.code in (
     'clients.read',
     'cases.read.assigned', 'cases.write.assigned',
     'documents.read', 'documents.upload', 'documents.generate', 'documents.approve',
     'parties.read', 'parties.write',
     'estate.read',
     'filings.read', 'filings.write',
     'entities.read',
     'reports.read'
   )
on conflict do nothing;

-- CONSULT (Consulta)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r, public.permissions p
 where r.code = 'CONSULT'
   and p.code in (
     'clients.read',
     'cases.read.assigned',
     'documents.read',
     'parties.read',
     'estate.read',
     'filings.read',
     'reports.read'
   )
on conflict do nothing;

-- CASHIER (Caja Chica)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r, public.permissions p
 where r.code = 'CASHIER'
   and p.code in (
     'cash.read', 'cash.write', 'cash.request', 'cash.close',
     'reports.read'
   )
on conflict do nothing;

commit;
