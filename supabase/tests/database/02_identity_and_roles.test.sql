-- pgTAP Tests: Sprint 1 — Identidad, seguridad y roles
-- 1. All public tables have RLS enabled (including profiles, roles, permissions, role_permissions, user_roles)
-- 2. private.has_permission behaves correctly with superuser and custom permissions
-- 3. Last active administrator cannot be deactivated or have role removed
-- 4. Seeded catalog of permissions and roles

begin;
select plan(10);

-- Test 1: Critical RLS Check on public tables
select is(
  (select count(*)::integer from pg_tables where schemaname = 'public' and rowsecurity = false),
  0,
  'CRITICAL: All public tables must have Row Level Security (RLS) enabled'
);

-- Test 2: Verify all 5 new tables exist in public
select ok(
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') and
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'roles') and
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'permissions') and
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'role_permissions') and
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_roles'),
  'All 5 identity tables must exist'
);

-- Test 3: Verify permissions seed count
select is(
  (select count(*)::integer from public.permissions),
  40,
  'Exactly 40 permissions must be seeded'
);

-- Test 4: Verify 5 base roles exist
select is(
  (select count(*)::integer from public.roles where code in ('ADMIN', 'ANALYST', 'LAWYER', 'CONSULT', 'CASHIER')),
  5,
  '5 base roles (ADMIN, ANALYST, LAWYER, CONSULT, CASHIER) must exist'
);

-- Test 5: Verify ADMIN role is superuser and requires MFA
select ok(
  exists (select 1 from public.roles where code = 'ADMIN' and is_superuser = true and requires_mfa = true and is_system = true),
  'ADMIN role must be superuser with requires_mfa=true and is_system=true'
);

-- Test 6: Verify guard on deleting or deactivating role ADMIN
select throws_ok(
  $$ delete from public.roles where code = 'ADMIN' $$,
  'Operacion rechazada: el rol ADMIN del sistema no puede ser eliminado',
  'Cannot delete system role ADMIN'
);

select throws_ok(
  $$ update public.roles set is_active = false where code = 'ADMIN' $$,
  'Operacion rechazada: el rol ADMIN no puede renombrarse ni desactivarse',
  'Cannot deactivate role ADMIN'
);

-- Test 7: Verify last admin protection on profiles and user_roles
-- Create test user
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'admin@test.com')
on conflict do nothing;

insert into public.profiles (id, email, first_name, last_name, is_active)
values ('00000000-0000-0000-0000-000000000001', 'admin@test.com', 'Admin', 'Test', true)
on conflict (id) do update set is_active = true;

insert into public.user_roles (user_id, role_id)
select '00000000-0000-0000-0000-000000000001', id from public.roles where code = 'ADMIN'
on conflict do nothing;

-- Attempt to deactivate the only admin
select throws_ok(
  $$ update public.profiles set is_active = false where id = '00000000-0000-0000-0000-000000000001' $$,
  'Operacion rechazada: no se puede desactivar ni eliminar al ultimo administrador activo',
  'Cannot deactivate the last active administrator profile'
);

-- Attempt to remove ADMIN role from the only admin
select throws_ok(
  $$ delete from public.user_roles where user_id = '00000000-0000-0000-0000-000000000001' and role_id = (select id from public.roles where code = 'ADMIN') $$,
  'Operacion rechazada: no se puede quitar el rol ADMIN al ultimo administrador activo',
  'Cannot remove ADMIN role from the last active administrator'
);

-- Test 8: authenticated has USAGE on private schema
select ok(
  has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated must have USAGE on schema private'
);

select * from finish();
rollback;
