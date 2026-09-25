-- pgTAP Tests: Sprint 1 — Anti-escalada de privilegios, usuario desactivado, nivel aal2 y auditoría automática
begin;
select plan(9);

-- Setup de usuarios de prueba
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'superuser@test.pe'),
  ('22222222-2222-2222-2222-222222222222', 'gestor@test.pe'),
  ('33333333-3333-3333-3333-333333333333', 'target@test.pe')
on conflict do nothing;

insert into public.profiles (id, email, first_name, last_name, is_active) values
  ('11111111-1111-1111-1111-111111111111', 'superuser@test.pe', 'Super', 'User', true),
  ('22222222-2222-2222-2222-222222222222', 'gestor@test.pe', 'Gestor', 'Test', true),
  ('33333333-3333-3333-3333-333333333333', 'target@test.pe', 'Target', 'Test', true)
on conflict (id) do update set is_active = true;

-- Asignar rol ADMIN al superuser y ANALYST al gestor
insert into public.user_roles (user_id, role_id)
select '11111111-1111-1111-1111-111111111111', id from public.roles where code = 'ADMIN'
on conflict do nothing;

insert into public.user_roles (user_id, role_id)
select '22222222-2222-2222-2222-222222222222', id from public.roles where code = 'ANALYST'
on conflict do nothing;

-- ============================================================================
-- TEST 1: Anti-escalada - Nadie puede auto-asignarse roles
-- ============================================================================
-- Simular sesión de gestor (22222222-2222-2222-2222-222222222222)
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated", "aal": "aal1"}';

select throws_ok(
  $$
    insert into public.user_roles (user_id, role_id)
    values ('22222222-2222-2222-2222-222222222222', (select id from public.roles where code = 'ADMIN'))
  $$,
  'Operacion rechazada: ningun usuario puede asignar o quitar roles a su propia cuenta (anti-escalada)',
  'Actor cannot self-assign any role (anti-escalation rule A)'
);

-- ============================================================================
-- TEST 2: Anti-escalada - No superusuario no puede asignar rol is_superuser
-- ============================================================================
select throws_ok(
  $$
    insert into public.user_roles (user_id, role_id)
    values ('33333333-3333-3333-3333-333333333333', (select id from public.roles where code = 'ADMIN'))
  $$,
  'Operacion rechazada: solo un superusuario activo puede asignar o retirar roles de nivel superusuario',
  'Non-superuser cannot assign ADMIN role to another user (anti-escalation rule B)'
);

-- ============================================================================
-- TEST 3: Anti-escalada - No superusuario no puede otorgar permisos que no posee
-- ============================================================================
-- Gestor intenta otorgar users.manage (que no tiene) a un rol personalizado
reset role;
insert into public.roles (code, name, is_system, is_superuser, requires_mfa)
values ('CUSTOM_ROLE', 'Rol Test', false, false, false)
on conflict do nothing;

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated", "aal": "aal1"}';

select throws_ok(
  $$
    insert into public.role_permissions (role_id, permission_id)
    values (
      (select id from public.roles where code = 'CUSTOM_ROLE'),
      (select id from public.permissions where code = 'users.manage')
    )
  $$,
  'Operacion rechazada: no puede otorgar permisos que usted no posee directamente (anti-escalada)',
  'Actor cannot grant permissions they do not possess themselves'
);

-- ============================================================================
-- TEST 4: Usuario Desactivado pierde de inmediato has_permission = false
-- ============================================================================
reset role;
-- Desactivar el perfil del gestor
update public.profiles set is_active = false where id = '22222222-2222-2222-2222-222222222222';

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated", "aal": "aal1"}';

select is(
  (select private.has_permission('cases.create')),
  false,
  'Deactivated user (is_active=false) immediately returns false for has_permission'
);

-- ============================================================================
-- TEST 5: MFA nivel aal1 vs aal2 cuando el rol exige requires_mfa = true
-- ============================================================================
reset role;
-- Reactivar superuser (su rol ADMIN exige requires_mfa = true)
update public.profiles set is_active = true where id = '11111111-1111-1111-1111-111111111111';

-- Caso 5A: Con aal1 (solo contraseña, sin TOTP)
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated", "aal": "aal1"}';

select is(
  (select private.has_permission('users.manage')),
  false,
  'User with role requiring MFA returns false under aal1 session'
);

-- Caso 5B: Con aal2 (con verificación TOTP completada)
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated", "aal": "aal2"}';

select is(
  (select private.has_permission('users.manage')),
  true,
  'User with role requiring MFA returns true when session level is aal2'
);

-- ============================================================================
-- TEST 6: Auditoría automática - TOGGLE_USER_STATUS se inserta en audit_logs
-- ============================================================================
reset role;
insert into public.audit_logs (action, module) values ('SENTINEL', 'test');

update public.profiles set is_active = true where id = '22222222-2222-2222-2222-222222222222';

select ok(
  exists (
    select 1 from public.audit_logs
     where action = 'TOGGLE_USER_STATUS'
       and entity_id = '22222222-2222-2222-2222-222222222222'
  ),
  'audit_profiles_trigger automatically inserts TOGGLE_USER_STATUS on is_active change'
);

-- ============================================================================
-- TEST 7: Auditoría automática - ASSIGN_ROLE y REMOVE_ROLE se insertan en audit_logs
-- ============================================================================
insert into public.user_roles (user_id, role_id)
values (
  '33333333-3333-3333-3333-333333333333',
  (select id from public.roles where code = 'CONSULT')
);

select ok(
  exists (
    select 1 from public.audit_logs
     where action = 'ASSIGN_ROLE'
       and entity_id = '33333333-3333-3333-3333-333333333333'
  ),
  'audit_user_roles_trigger automatically inserts ASSIGN_ROLE in audit_logs'
);

delete from public.user_roles
 where user_id = '33333333-3333-3333-3333-333333333333'
   and role_id = (select id from public.roles where code = 'CONSULT');

select ok(
  exists (
    select 1 from public.audit_logs
     where action = 'REMOVE_ROLE'
       and entity_id = '33333333-3333-3333-3333-333333333333'
  ),
  'audit_user_roles_trigger automatically inserts REMOVE_ROLE in audit_logs'
);

select * from finish();
rollback;
