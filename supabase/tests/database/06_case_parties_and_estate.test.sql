-- pgTAP Tests: Sprint 4a — Intervinientes, patrimonio, semáforos y compuertas
-- Archivo: supabase/tests/database/06_case_parties_and_estate.test.sql

create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(25);

-- ============================================================================
-- 1. SETUP DE USUARIOS Y ROLES DE PRUEBA
-- ============================================================================
insert into auth.users (id, email) values
  ('11111111-4444-1111-1111-111111111111', 'admin_s4@test.pe'),
  ('22222222-4444-2222-2222-222222222222', 'gestor1_s4@test.pe'),
  ('33333333-4444-3333-3333-333333333333', 'gestor2_s4@test.pe'),
  ('44444444-4444-4444-4444-444444444444', 'viewer_s4@test.pe')
on conflict (id) do nothing;

insert into public.profiles (id, email, first_name, last_name, is_active) values
  ('11111111-4444-1111-1111-111111111111', 'admin_s4@test.pe', 'Admin', 'S4', true),
  ('22222222-4444-2222-2222-222222222222', 'gestor1_s4@test.pe', 'Gestor1', 'S4', true),
  ('33333333-4444-3333-3333-333333333333', 'gestor2_s4@test.pe', 'Gestor2', 'S4', true),
  ('44444444-4444-4444-4444-444444444444', 'viewer_s4@test.pe', 'Viewer', 'S4', true)
on conflict (id) do update set is_active = true;

insert into public.user_roles (user_id, role_id)
select '11111111-4444-1111-1111-111111111111', id from public.roles where code = 'ADMIN'
on conflict do nothing;

insert into public.user_roles (user_id, role_id)
select '22222222-4444-2222-2222-222222222222', id from public.roles where code = 'ANALYST'
on conflict do nothing;

insert into public.user_roles (user_id, role_id)
select '33333333-4444-3333-3333-333333333333', id from public.roles where code = 'ANALYST'
on conflict do nothing;

insert into public.user_roles (user_id, role_id)
select '44444444-4444-4444-4444-444444444444', id from public.roles where code = 'CONSULT'
on conflict do nothing;

-- ============================================================================
-- TEST 1: RLS activa en las tablas nuevas
-- ============================================================================
select is(
  (select count(*)::integer
     from pg_tables
    where schemaname = 'public'
      and tablename in ('case_parties', 'case_assets', 'case_liabilities')
      and rowsecurity = true),
  3,
  '1. Las 3 tablas de intervinientes y patrimonio tienen RLS habilitada'
);

-- ============================================================================
-- SETUP DE DATOS PARA PRUEBAS FUNCIONALES
-- ============================================================================
create temp table s4_vars (
  v_client_id uuid,
  v_causante_id uuid,
  v_heir_adult_id uuid,
  v_heir_minor_id uuid,
  v_rep_id uuid,
  v_model_version_id uuid,
  v_case_id uuid,
  v_confidential_case_id uuid
);
grant all on s4_vars to public;

do $$
declare
  v_cl uuid;
  v_ca uuid;
  v_ha uuid;
  v_hm uuid;
  v_rp uuid;
  v_mv uuid;
  v_cs uuid;
  v_cc uuid;
begin
  -- Personas
  insert into public.persons (person_type, identity_document_type, identity_document_number, first_name, last_name, is_deceased)
  values ('NATURAL', 'DNI', '91000001', 'Contratante', 'Prueba', false) returning id into v_cl;

  insert into public.persons (person_type, identity_document_type, identity_document_number, first_name, last_name, is_deceased, death_date, birth_date)
  values ('NATURAL', 'DNI', '91000002', 'Causante', 'Fallecido', true, '2025-05-10', '1960-01-01') returning id into v_ca;

  insert into public.persons (person_type, identity_document_type, identity_document_number, first_name, last_name, birth_date)
  values ('NATURAL', 'DNI', '91000003', 'Heredero', 'Mayor', '1990-03-15') returning id into v_ha;

  insert into public.persons (person_type, identity_document_type, identity_document_number, first_name, last_name, birth_date)
  values ('NATURAL', 'DNI', '91000004', 'Heredero', 'Menor', (current_date - interval '10 years')::date) returning id into v_hm;

  insert into public.persons (person_type, identity_document_type, identity_document_number, first_name, last_name, birth_date)
  values ('NATURAL', 'DNI', '91000005', 'Tutor', 'Representante', '1985-07-20') returning id into v_rp;

  select cmv.id into v_mv
    from public.case_model_versions cmv
    join public.case_models cm on cm.id = cmv.case_model_id
   where cm.code = 'SUCESION_INTESTADA_NOTARIAL' and cmv.status = 'PUBLISHED'
   limit 1;

  -- Caso normal
  insert into public.cases (
    case_number, case_model_version_id, client_person_id, title, status, priority, is_confidential, created_by
  ) values (
    '2026-900001', v_mv, v_cl, 'Caso Test S4 Normal', 'OPEN', 'NORMAL', false, '11111111-4444-1111-1111-111111111111'
  ) returning id into v_cs;

  -- Asignar gestor 1 al caso normal
  insert into public.case_assignments (case_id, user_id, assignment_type, is_primary)
  values (v_cs, '22222222-4444-2222-2222-222222222222', 'RESPONSIBLE', true);

  -- Caso confidencial asignado SOLO a gestor 1
  insert into public.cases (
    case_number, case_model_version_id, client_person_id, title, status, priority, is_confidential, created_by
  ) values (
    '2026-900002', v_mv, v_cl, 'Caso Test S4 Confidencial', 'OPEN', 'NORMAL', true, '11111111-4444-1111-1111-111111111111'
  ) returning id into v_cc;

  insert into public.case_assignments (case_id, user_id, assignment_type, is_primary)
  values (v_cc, '22222222-4444-2222-2222-222222222222', 'RESPONSIBLE', true);

  insert into s4_vars values (v_cl, v_ca, v_ha, v_hm, v_rp, v_mv, v_cs, v_cc);
end;
$$;

-- ============================================================================
-- TEST 2: Unicidad de un solo CAUSANTE activo por caso
-- ============================================================================
select lives_ok(
  $$
    insert into public.case_parties (case_id, person_id, party_role, is_active)
    values ((select v_case_id from s4_vars), (select v_causante_id from s4_vars), 'CAUSANTE', true)
  $$,
  '2.1 Primer CAUSANTE activo se inserta exitosamente'
);

select throws_ok(
  $$
    insert into public.case_parties (case_id, person_id, party_role, is_active)
    values ((select v_case_id from s4_vars), (select v_heir_adult_id from s4_vars), 'CAUSANTE', true)
  $$,
  '23505',
  '2.2 Segundo CAUSANTE activo en el mismo caso es rechazado por el índice único'
);

select lives_ok(
  $$
    insert into public.case_parties (case_id, person_id, party_role, is_active)
    values ((select v_case_id from s4_vars), (select v_heir_adult_id from s4_vars), 'CAUSANTE', false)
  $$,
  '2.3 Un CAUSANTE inactivo adicional sí se permite (histórico)'
);

-- ============================================================================
-- TEST 3: Cuentas bancarias (solo últimos 4 dígitos en registry_ref)
-- ============================================================================
select throws_ok(
  $$
    insert into public.case_assets (case_id, asset_type, description, registry_ref, status)
    values ((select v_case_id from s4_vars), 'CUENTA_BANCARIA', 'Cuenta BCP Corriente', '123456', 'IDENTIFICADO')
  $$,
  '23514',
  '3.1 Cuenta bancaria con más de 4 dígitos (123456) es rechazada por CHECK'
);

select throws_ok(
  $$
    insert into public.case_assets (case_id, asset_type, description, registry_ref, status)
    values ((select v_case_id from s4_vars), 'CUENTA_BANCARIA', 'Cuenta BCP Corriente', '12A4', 'IDENTIFICADO')
  $$,
  '23514',
  '3.2 Cuenta bancaria con caracteres no numéricos es rechazada por CHECK'
);

select throws_ok(
  $$
    insert into public.case_assets (case_id, asset_type, description, registry_ref, status)
    values ((select v_case_id from s4_vars), 'CUENTA_BANCARIA', 'Cuenta BCP Corta', '123', 'IDENTIFICADO')
  $$,
  '23514',
  '3.3 Cuenta bancaria con menos de 4 dígitos (123) es rechazada por CHECK'
);

select lives_ok(
  $$
    insert into public.case_assets (case_id, asset_type, description, registry_ref, status)
    values ((select v_case_id from s4_vars), 'CUENTA_BANCARIA', 'Cuenta BBVA Ahorros', '9876', 'IDENTIFICADO')
  $$,
  '3.4 Cuenta bancaria con exactamente 4 dígitos (9876) se acepta'
);

select lives_ok(
  $$
    insert into public.case_assets (case_id, asset_type, description, registry_ref, status)
    values ((select v_case_id from s4_vars), 'CUENTA_BANCARIA', 'Cuenta sin número aún', null, 'IDENTIFICADO')
  $$,
  '3.5 Cuenta bancaria con registry_ref null se acepta'
);

select lives_ok(
  $$
    insert into public.case_assets (case_id, asset_type, description, registry_ref, status)
    values ((select v_case_id from s4_vars), 'INMUEBLE', 'Predio Urbano', 'P0123456789', 'IDENTIFICADO')
  $$,
  '3.6 Otros activos (INMUEBLE) sí pueden tener referencias registrales largas'
);

-- ============================================================================
-- TEST 4: Punto 4 — case_process con is_applicable = false NO bloquea dependencias
-- ============================================================================
create temp table s4_dep_vars (
  v_cid uuid,
  v_p1_id uuid,
  v_p2_id uuid
);
grant all on s4_dep_vars to public;

do $$
declare
  v_mv uuid;
  v_cid uuid;
  v_p1 uuid;
  v_p2 uuid;
  v_w_not uuid;
  v_w_prog uuid;
  v_def1 uuid;
  v_def2 uuid;
  v_mp1 uuid;
  v_mp2 uuid;
begin
  select id into v_w_not from public.workflow_statuses where category = 'NOT_STARTED' limit 1;
  select id into v_w_prog from public.workflow_statuses where category = 'IN_PROGRESS' limit 1;

  select id into v_def1 from public.process_definitions where code = 'APERTURA' limit 1;
  select id into v_def2 from public.process_definitions where code = 'DOC_CAUSANTE' limit 1;

  -- Crear modelo temporal con versión DRAFT primero, agregar procesos y dependencias, luego PUBLICAR
  insert into public.case_model_versions (case_model_id, version, status)
  values ((select id from public.case_models limit 1), 999, 'DRAFT')
  returning id into v_mv;

  insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight, is_required)
  values (v_mv, v_def1, 1, 50.00, true) returning id into v_mp1;

  insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight, is_required)
  values (v_mv, v_def2, 2, 50.00, true) returning id into v_mp2;

  insert into public.case_model_process_deps (case_model_process_id, depends_on_id)
  values (v_mp2, v_mp1);

  update public.case_model_versions set status = 'PUBLISHED' where id = v_mv;

  -- Crear caso para la prueba de dependencias
  insert into public.cases (
    case_number, case_model_version_id, client_person_id, title, status, priority, created_by
  ) values (
    '2026-900003', v_mv, (select v_client_id from s4_vars), 'Caso Test Dependencia', 'OPEN', 'NORMAL', '11111111-4444-1111-1111-111111111111'
  ) returning id into v_cid;

  insert into public.case_processes (case_id, case_model_process_id, process_definition_id, sequence, weight, status_id, progress, is_applicable)
  values (v_cid, v_mp1, v_def1, 1, 50.00, v_w_not, 0.00, true) returning id into v_p1;

  insert into public.case_processes (case_id, case_model_process_id, process_definition_id, sequence, weight, status_id, progress, is_applicable)
  values (v_cid, v_mp2, v_def2, 2, 50.00, v_w_not, 0.00, true) returning id into v_p2;

  insert into s4_dep_vars values (v_cid, v_p1, v_p2);
end;
$$;

-- Intentar iniciar el proceso 2 con el proceso 1 en NOT_STARTED y is_applicable = true (DEBE FALLAR)
select throws_ok(
  $$
    update public.case_processes
       set status_id = (select id from public.workflow_statuses where category = 'IN_PROGRESS' limit 1)
     where id = (select v_p2_id from s4_dep_vars)
  $$,
  'Compuerta de cierre M1',
  '4.1 Proceso 2 se bloquea porque el Proceso 1 está pendiente e is_applicable = true'
);

-- Marcar el proceso 1 como is_applicable = false
update public.case_processes
   set is_applicable = false
 where id = (select v_p1_id from s4_dep_vars);

-- Intentar iniciar el proceso 2 ahora (DEBE FUNCIONAR)
select lives_ok(
  $$
    update public.case_processes
       set status_id = (select id from public.workflow_statuses where category = 'IN_PROGRESS' limit 1)
     where id = (select v_p2_id from s4_dep_vars)
  $$,
  '4.2 Proceso 2 avanza sin bloqueo porque el Proceso 1 tiene is_applicable = false'
);

-- ============================================================================
-- TEST 5: private.can_access_person() con case_parties
-- ============================================================================
create temp table s4_prospect (v_id uuid);
insert into s4_prospect (v_id) values (gen_random_uuid());

insert into public.persons (id, person_type, identity_document_type, identity_document_number, first_name, last_name)
values ((select v_id from s4_prospect), 'NATURAL', 'DNI', '91000099', 'Prospecto', 'Sin Caso');

-- Simular identidad Gestor 2
select set_config('request.jwt.claims', '{"sub":"33333333-4444-3333-3333-333333333333","role":"authenticated","aal":"aal1"}', true);

select is(
  (select private.can_access_person((select v_id from s4_prospect))),
  true,
  '5.1 Persona prospecto sin caso asignado es visible por cualquier gestor (Opción A)'
);

-- Reset temporal de claims para insertar interviniente confidencial como sistema
select set_config('request.jwt.claims', '', true);

create temp table s4_conf_person (v_id uuid);
insert into s4_conf_person (v_id) values (gen_random_uuid());

insert into public.persons (id, person_type, identity_document_type, identity_document_number, first_name, last_name)
values ((select v_id from s4_conf_person), 'NATURAL', 'DNI', '91000098', 'Interviniente', 'Secreto');

insert into public.case_parties (case_id, person_id, party_role, is_active)
values ((select v_confidential_case_id from s4_vars), (select v_id from s4_conf_person), 'HEREDERO', true);

-- Simular nuevamente identidad Gestor 2
select set_config('request.jwt.claims', '{"sub":"33333333-4444-3333-3333-333333333333","role":"authenticated","aal":"aal1"}', true);

select is(
  (select private.can_access_person((select v_id from s4_conf_person))),
  false,
  '5.2 Interviniente de caso confidencial NO es accesible para gestor no asignado'
);

select set_config('request.jwt.claims', '', true);

-- ============================================================================
-- TEST 6: Creación atómica vía create_case_from_model con causante y herederos
-- ============================================================================
-- Simular identidad Admin (con aal2 para roles que requieren MFA)
select set_config('request.jwt.claims', '{"sub":"11111111-4444-1111-1111-111111111111","role":"authenticated","aal":"aal2"}', true);

create temp table s4_atomic_res (v_case_id uuid);

select lives_ok(
  $$
    insert into s4_atomic_res (v_case_id)
    values (
      public.create_case_from_model(
        (select v_model_version_id from s4_vars),
        (select v_client_id from s4_vars),
        'Caso Atómico Completo S4',
        'Descripción prueba atómica',
        'NOTARIAL',
        false,
        'HIGH',
        false,
        true,
        '22222222-4444-2222-2222-222222222222',
        null,
        '{}'::uuid[],
        (select v_causante_id from s4_vars),
        jsonb_build_array(
          jsonb_build_object(
            'person_id', (select v_heir_adult_id from s4_vars),
            'party_role', 'HEREDERO',
            'relationship_to_deceased', 'HIJO',
            'heir_status', 'CONFIRMADO',
            'share_percent', 50.00
          ),
          jsonb_build_object(
            'person_id', (select v_heir_minor_id from s4_vars),
            'party_role', 'HEREDERO',
            'relationship_to_deceased', 'HIJO',
            'heir_status', 'CONFIRMADO',
            'share_percent', 50.00,
            'represented_by', (select v_rep_id from s4_vars)
          )
        )
      )
    )
  $$,
  '6.1 create_case_from_model atómico crea expediente con causante y herederos'
);

select is(
  (select count(*)::integer from public.case_parties where case_id = (select v_case_id from s4_atomic_res)),
  3,
  '6.2 Se registraron exactamente 3 intervinientes en el nuevo caso'
);

select is(
  (select party_role from public.case_parties where case_id = (select v_case_id from s4_atomic_res) and person_id = (select v_causante_id from s4_vars)),
  'CAUSANTE',
  '6.3 Causante inicial quedó correctamente asignado con rol CAUSANTE'
);

select set_config('request.jwt.claims', '', true);

-- ============================================================================
-- TEST 7: Semáforos en base de datos (public.get_case_semaphore_warnings)
-- ============================================================================
create temp table s4_sem_case (v_id uuid);
insert into s4_sem_case (v_id) values (gen_random_uuid());

insert into public.cases (id, case_number, case_model_version_id, client_person_id, title, created_by)
values ((select v_id from s4_sem_case), '2026-900004', (select v_model_version_id from s4_vars), (select v_client_id from s4_vars), 'Caso Semáforo Test', '11111111-4444-1111-1111-111111111111');

-- 1. Heredero menor sin representante
insert into public.case_parties (case_id, person_id, party_role, heir_status, share_percent, represented_by)
values ((select v_id from s4_sem_case), (select v_heir_minor_id from s4_vars), 'HEREDERO', 'CONFIRMADO', 60.00, null);

-- Simular usuario con acceso al caso (Admin con permiso cases.read.all)
select set_config('request.jwt.claims', '{"sub":"11111111-4444-1111-1111-111111111111","role":"authenticated","aal":"aal2"}', true);

select is(
  (select public.get_case_semaphore_warnings((select v_id from s4_sem_case))->'warning_codes' ? 'MINOR_WITHOUT_REPRESENTATIVE'),
  true,
  '7.1 Semáforo detecta menor de edad sin representante legal'
);

select is(
  (select public.get_case_semaphore_warnings((select v_id from s4_sem_case))->'warning_codes' ? 'HEIR_SHARES_NOT_100'),
  true,
  '7.2 Semáforo detecta cuotas confirmadas que no suman 100% (60%)'
);

-- Agregar segundo heredero para cuadrar al 100%
insert into public.case_parties (case_id, person_id, party_role, heir_status, share_percent)
values ((select v_id from s4_sem_case), (select v_heir_adult_id from s4_vars), 'HEREDERO', 'CONFIRMADO', 40.00);

select is(
  (select public.get_case_semaphore_warnings((select v_id from s4_sem_case))->'warning_codes' ? 'HEIR_SHARES_NOT_100'),
  false,
  '7.3 Semáforo confirma que cuotas suman 100% (60% + 40%) y retira la advertencia'
);

-- Asignar representante al menor
update public.case_parties
   set represented_by = (select v_rep_id from s4_vars)
 where case_id = (select v_id from s4_sem_case)
   and person_id = (select v_heir_minor_id from s4_vars);

select is(
  (select public.get_case_semaphore_warnings((select v_id from s4_sem_case))->'warning_codes' ? 'MINOR_WITHOUT_REPRESENTATIVE'),
  false,
  '7.4 Semáforo retira advertencia de menor cuando se le asigna representante'
);

-- Simular Gestor 2 intentando consultar semáforos de un caso confidencial ajeno (DEBE FALLAR)
select set_config('request.jwt.claims', '{"sub":"33333333-4444-3333-3333-333333333333","role":"authenticated","aal":"aal1"}', true);

select throws_ok(
  $$
    select public.get_case_semaphore_warnings((select v_confidential_case_id from s4_vars))
  $$,
  'No tiene acceso a este expediente',
  '7.5 Gestor no asignado no puede consultar semáforos de un caso confidencial'
);

select set_config('request.jwt.claims', '', true);

-- ============================================================================
-- TEST 8: Aislamiento RLS en case_parties, case_assets y case_liabilities
-- ============================================================================
-- Insertar activo y pasivo en caso confidencial como sistema
insert into public.case_assets (case_id, asset_type, description, status)
values ((select v_confidential_case_id from s4_vars), 'INMUEBLE', 'Predio Confidencial', 'IDENTIFICADO');

insert into public.case_liabilities (case_id, liability_type, creditor_name, status)
values ((select v_confidential_case_id from s4_vars), 'BANCARIA', 'Banco Confidencial', 'IDENTIFICADA');

-- Simular Gestor 2 (no asignado al caso confidencial) con rol authenticated
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"33333333-4444-3333-3333-333333333333","role":"authenticated","aal":"aal1"}';

select is(
  (select count(*)::integer from public.case_assets where case_id = (select v_confidential_case_id from s4_vars)),
  0,
  '8.1 Gestor no asignado no puede ver los activos de un caso confidencial'
);

select is(
  (select count(*)::integer from public.case_parties where case_id = (select v_confidential_case_id from s4_vars)),
  0,
  '8.2 Gestor no asignado no puede ver los intervinientes de un caso confidencial'
);

select is(
  (select count(*)::integer from public.case_liabilities where case_id = (select v_confidential_case_id from s4_vars)),
  0,
  '8.3 Gestor no asignado no puede ver los pasivos de un caso confidencial'
);

reset role;

rollback;
