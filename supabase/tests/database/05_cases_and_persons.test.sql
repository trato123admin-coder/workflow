-- pgTAP Tests: Sprint 3 — Personas, casos, modelos versionados, avance ponderado y compuertas de cierre
-- Archivo: supabase/tests/database/05_cases_and_persons.test.sql

begin;
select plan(24);

-- ============================================================================
-- 1. SETUP DE USUARIOS Y ROLES DE PRUEBA
-- ============================================================================
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin_s3@test.pe'),
  ('22222222-2222-2222-2222-222222222222', 'gestor1_s3@test.pe'),
  ('33333333-3333-3333-3333-333333333333', 'gestor2_s3@test.pe'),
  ('44444444-4444-4444-4444-444444444444', 'viewer_s3@test.pe')
on conflict (id) do nothing;

insert into public.profiles (id, email, first_name, last_name, is_active) values
  ('11111111-1111-1111-1111-111111111111', 'admin_s3@test.pe', 'Admin', 'Sprint3', true),
  ('22222222-2222-2222-2222-222222222222', 'gestor1_s3@test.pe', 'Gestor1', 'Sprint3', true),
  ('33333333-3333-3333-3333-333333333333', 'gestor2_s3@test.pe', 'Gestor2', 'Sprint3', true),
  ('44444444-4444-4444-4444-444444444444', 'viewer_s3@test.pe', 'Viewer', 'Sprint3', true)
on conflict (id) do update set is_active = true;

insert into public.user_roles (user_id, role_id)
select '11111111-1111-1111-1111-111111111111', id from public.roles where code = 'ADMIN'
on conflict do nothing;

insert into public.user_roles (user_id, role_id)
select '22222222-2222-2222-2222-222222222222', id from public.roles where code = 'ANALYST'
on conflict do nothing;

insert into public.user_roles (user_id, role_id)
select '33333333-3333-3333-3333-333333333333', id from public.roles where code = 'ANALYST'
on conflict do nothing;

insert into public.user_roles (user_id, role_id)
select '44444444-4444-4444-4444-444444444444', id from public.roles where code = 'CONSULT'
on conflict do nothing;

-- ============================================================================
-- TEST 1: Verificar que las 12 tablas tienen RLS habilitada
-- ============================================================================
select is(
  (select count(*)::integer
     from pg_tables
    where schemaname = 'public'
      and tablename in (
        'persons', 'user_preferences', 'process_definitions', 'workflow_statuses',
        'case_models', 'case_model_versions', 'case_model_processes', 'case_model_process_deps',
        'cases', 'case_assignments', 'case_processes', 'case_events'
      )
      and rowsecurity = true),
  12,
  'Todas las 12 tablas de negocio del Sprint 3 tienen RLS habilitada'
);

-- ============================================================================
-- TEST 2: Función de seguridad private.is_superuser()
-- ============================================================================
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated", "aal": "aal2"}';
select is(private.is_superuser(), true, 'private.is_superuser() retorna true para usuario con rol ADMIN (aal2)');

set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated", "aal": "aal1"}';
select is(private.is_superuser(), false, 'private.is_superuser() retorna false para usuario gestor sin rol superusuario');
reset role;

-- ============================================================================
-- TEST 3 (a): Trigger tg_guard_case_model_version rechaza publicar con suma != 100
-- ============================================================================
do $$
declare
  v_mid uuid;
  v_vid uuid;
begin
  insert into public.case_models (code, name, category)
  values ('MODEL_WEIGHT_TEST', 'Modelo Prueba Pesos', 'SUCESION_INTESTADA')
  returning id into v_mid;

  insert into public.case_model_versions (case_model_id, version, status)
  values (v_mid, 1, 'DRAFT')
  returning id into v_vid;

  -- Insertar procesos cuya suma es 70 (30 + 40 != 100)
  insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight)
  values
    (v_vid, (select id from public.process_definitions where code = 'APERTURA'), 1, 30.00),
    (v_vid, (select id from public.process_definitions where code = 'DOC_CAUSANTE'), 2, 40.00);
end $$;

select throws_ok(
  $$
    update public.case_model_versions
       set status = 'PUBLISHED'
     where case_model_id = (select id from public.case_models where code = 'MODEL_WEIGHT_TEST')
  $$,
  'No se puede publicar el modelo: la suma de pesos de los procesos debe ser exactamente 100.00% (suma actual: 70.00)',
  '(a) Trigger de suma de pesos rechaza publicar una versión cuyos pesos no suman exactamente 100.00'
);

-- Corregir peso a 70 (30 + 70 = 100) y publicar con éxito
update public.case_model_processes
   set weight = 70.00
 where case_model_version_id = (
   select v.id from public.case_model_versions v
   join public.case_models m on m.id = v.case_model_id
   where m.code = 'MODEL_WEIGHT_TEST'
 ) and sequence = 2;

select lives_ok(
  $$
    update public.case_model_versions
       set status = 'PUBLISHED'
     where case_model_id = (select id from public.case_models where code = 'MODEL_WEIGHT_TEST')
  $$,
  '(a) Trigger de suma de pesos permite publicar cuando la suma de procesos activos es exactamente 100.00'
);

-- ============================================================================
-- TEST 4 (b): Trigger de inmutabilidad rechaza editar procesos de versión PUBLISHED
-- ============================================================================
select throws_ok(
  $$
    update public.case_model_processes
       set weight = 50.00
     where case_model_version_id = (
       select v.id from public.case_model_versions v
       join public.case_models m on m.id = v.case_model_id
       where m.code = 'MODEL_WEIGHT_TEST'
     ) and sequence = 1
  $$,
  'No se pueden agregar, modificar ni eliminar elementos de una versión de modelo PUBLISHED (es inmutable; clone a una nueva versión)',
  '(b) Trigger de inmutabilidad rechaza UPDATE en procesos de versión PUBLISHED'
);

select throws_ok(
  $$
    insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight)
    values (
      (select v.id from public.case_model_versions v join public.case_models m on m.id = v.case_model_id where m.code = 'MODEL_WEIGHT_TEST'),
      (select id from public.process_definitions where code = 'HEREDEROS'),
      3, 10.00
    )
  $$,
  'No se pueden agregar, modificar ni eliminar elementos de una versión de modelo PUBLISHED (es inmutable; clone a una nueva versión)',
  '(b) Trigger de inmutabilidad rechaza INSERT en procesos de versión PUBLISHED'
);

select throws_ok(
  $$
    update public.case_model_versions
       set status = 'DRAFT'
     where case_model_id = (select id from public.case_models where code = 'MODEL_WEIGHT_TEST')
  $$,
  'Una versión de modelo PUBLISHED es inmutable y no puede cambiar de estado (clone a una nueva versión)',
  '(b) Trigger de inmutabilidad rechaza revertir versión PUBLISHED a DRAFT'
);

-- ============================================================================
-- TEST 5 (c): create_case_from_model es atómica
-- ============================================================================
-- 5.1 Falla si el modelo está en DRAFT
select throws_ok(
  $$
    select public.create_case_from_model(
      (select v.id from public.case_model_versions v join public.case_models m on m.id = v.case_model_id where m.code = 'SUCESION_INTESTADA_JUDICIAL'),
      gen_random_uuid(),
      'Caso No Permitido'
    )
  $$,
  'Solo se pueden crear casos a partir de versiones de modelo PUBLICADAS (estado actual: DRAFT)',
  '(c) create_case_from_model falla si la versión de modelo está en DRAFT'
);

-- ============================================================================
-- SETUP DE PERSONA Y CASO PARA DEPENDENCIAS, AVANCE Y CIERRE
-- ============================================================================
create temp table s3_test_vars (
  test_person_id uuid,
  test_case_id uuid,
  proc_1_id uuid,
  proc_2_id uuid,
  proc_3_id uuid
);

do $$
declare
  v_person_id uuid;
  v_model_version_id uuid;
  v_case_id uuid;
  v_p1 uuid; v_p2 uuid; v_p3 uuid;
begin
  -- Crear persona cliente
  insert into public.persons (
    person_type, identity_document_type, identity_document_number,
    first_name, last_name, second_last_name
  ) values (
    'NATURAL', 'DNI', '70809012', 'Carlos', 'Mamani', 'Quispe'
  ) returning id into v_person_id;

  -- Obtener versión publicada de SUCESION_INTESTADA_NOTARIAL
  select v.id into v_model_version_id
    from public.case_model_versions v
    join public.case_models m on m.id = v.case_model_id
   where m.code = 'SUCESION_INTESTADA_NOTARIAL'
     and v.status = 'PUBLISHED';

  -- Crear caso con gestor1 asignado como responsable
  set local role authenticated;
  set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated", "aal": "aal1"}';

  v_case_id := public.create_case_from_model(
    _model_version_id => v_model_version_id,
    _client_person_id => v_person_id,
    _title             => 'Sucesión Intestada Familia Mamani',
    _responsible_id    => '22222222-2222-2222-2222-222222222222'::uuid
  );

  reset role;

  select id into v_p1 from public.case_processes where case_id = v_case_id and sequence = 1;
  select id into v_p2 from public.case_processes where case_id = v_case_id and sequence = 2;
  select id into v_p3 from public.case_processes where case_id = v_case_id and sequence = 3;

  insert into s3_test_vars values (v_person_id, v_case_id, v_p1, v_p2, v_p3);
end $$;

-- 5.2 Verificar creación atómica completa
select is(
  (select count(*)::integer from public.case_processes where case_id = (select test_case_id from s3_test_vars)),
  11,
  '(c) create_case_from_model instanció los 11 procesos del modelo publicado en una sola transacción'
);

select is(
  (select count(*)::integer from public.case_assignments where case_id = (select test_case_id from s3_test_vars) and is_primary = true),
  1,
  '(c) create_case_from_model asignó al gestor responsable'
);

select is(
  (select event_type from public.case_events where case_id = (select test_case_id from s3_test_vars) limit 1),
  'CASE_CREATED',
  '(c) create_case_from_model registró el evento inicial CASE_CREATED'
);

-- ============================================================================
-- TEST 6 (d): Compuerta de dependencias M1 bloquea el avance con motivo exacto
-- ============================================================================
-- Secuencia 2 (DOC_CAUSANTE) depende de Secuencia 1 (APERTURA).
-- Con Secuencia 1 en PENDIENTE (NOT_STARTED), intentar mover Secuencia 2 a INICIADO o EN_PROCESO debe fallar.
select throws_ok(
  $$
    update public.case_processes
       set status_id = (select id from public.workflow_statuses where code = 'INICIADO')
     where id = (select proc_2_id from s3_test_vars)
  $$,
  'Compuerta de cierre M1: el proceso "Documentos del causante" no puede pasar a "Iniciado" porque depende de los siguientes procesos no finalizados: Apertura y contrato de servicio [Pendiente]',
  '(d) Compuerta de cierre M1 bloquea avance de proceso si su dependencia previa no está FINALIZADO'
);

-- Completar proceso 1 a FINALIZADO
update public.case_processes
   set status_id = (select id from public.workflow_statuses where code = 'FINALIZADO')
 where id = (select proc_1_id from s3_test_vars);

-- Ahora el proceso 2 sí puede avanzar a INICIADO
select lives_ok(
  $$
    update public.case_processes
       set status_id = (select id from public.workflow_statuses where code = 'INICIADO')
     where id = (select proc_2_id from s3_test_vars)
  $$,
  '(d) Proceso puede avanzar exitosamente una vez que su dependencia pasa a categoría DONE'
);

-- ============================================================================
-- TEST 7 (e): Caso exacto de avance ponderado en BD (20/30/30/20 con 100/80/40/0 => 56.00)
-- ============================================================================
do $$
declare
  v_mid uuid; v_vid uuid; v_cid uuid; v_pid uuid;
  v_proc_a uuid; v_proc_b uuid; v_proc_c uuid; v_proc_d uuid;
  v_dummy_status uuid;
begin
  select test_person_id into v_pid from s3_test_vars;

  insert into public.case_models (code, name, category)
  values ('MODEL_WEIGHT_56', 'Modelo Avance 56', 'SUCESION_INTESTADA')
  returning id into v_mid;

  insert into public.case_model_versions (case_model_id, version, status)
  values (v_mid, 1, 'DRAFT')
  returning id into v_vid;

  -- 4 procesos con pesos exactos 20, 30, 30, 20 (suma = 100)
  insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight, is_required)
  values
    (v_vid, (select id from public.process_definitions where code = 'APERTURA'), 1, 20.00, true),
    (v_vid, (select id from public.process_definitions where code = 'DOC_CAUSANTE'), 2, 30.00, true),
    (v_vid, (select id from public.process_definitions where code = 'HEREDEROS'), 3, 30.00, true),
    (v_vid, (select id from public.process_definitions where code = 'INVENTARIO'), 4, 20.00, true);

  update public.case_model_versions set status = 'PUBLISHED' where id = v_vid;

  v_cid := public.create_case_from_model(
    _model_version_id => v_vid,
    _client_person_id => v_pid,
    _title             => 'Caso Prueba Ponderado 56'
  );

  select id into v_dummy_status from public.workflow_statuses where code = 'PENDIENTE';

  -- Asignar avances manuales: 100, 80, 40, 0
  update public.case_processes set manual_progress = 100.00 where case_id = v_cid and sequence = 1;
  update public.case_processes set manual_progress = 80.00  where case_id = v_cid and sequence = 2;
  update public.case_processes set manual_progress = 40.00  where case_id = v_cid and sequence = 3;
  update public.case_processes set manual_progress = 0.00   where case_id = v_cid and sequence = 4;
end $$;

select is(
  (select current_progress from public.cases where title = 'Caso Prueba Ponderado 56'),
  56.00,
  '(e) El cálculo de avance ponderado en BD da exactamente 56.00 para pesos 20/30/30/20 y avances 100/80/40/0'
);

-- ============================================================================
-- TEST 8 (f): public.close_case y compuertas de cierre
-- ============================================================================
-- Escenario: Caso de prueba con 2 procesos obligatorios donde el proceso 2 no está finalizado
create temp table s3_close_case_vars (
  c_case_id uuid,
  c_p1_id uuid,
  c_p2_id uuid
);

do $$
declare
  v_mid uuid; v_vid uuid; v_cid uuid; v_pid uuid;
  v_p1 uuid; v_p2 uuid;
begin
  select test_person_id into v_pid from s3_test_vars;

  insert into public.case_models (code, name, category)
  values ('MODEL_CLOSE_TEST', 'Modelo Close Test', 'SUCESION_INTESTADA')
  returning id into v_mid;

  insert into public.case_model_versions (case_model_id, version, status)
  values (v_mid, 1, 'DRAFT')
  returning id into v_vid;

  insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight, is_required)
  values
    (v_vid, (select id from public.process_definitions where code = 'APERTURA'), 1, 50.00, true),
    (v_vid, (select id from public.process_definitions where code = 'DOC_CAUSANTE'), 2, 50.00, true);

  update public.case_model_versions set status = 'PUBLISHED' where id = v_vid;

  v_cid := public.create_case_from_model(
    _model_version_id => v_vid,
    _client_person_id => v_pid,
    _title             => 'Caso para Prueba de Cierre'
  );

  select id into v_p1 from public.case_processes where case_id = v_cid and sequence = 1;
  select id into v_p2 from public.case_processes where case_id = v_cid and sequence = 2;

  -- Proceso 1 FINALIZADO, Proceso 2 PENDIENTE
  update public.case_processes set status_id = (select id from public.workflow_statuses where code = 'FINALIZADO') where id = v_p1;

  insert into s3_close_case_vars values (v_cid, v_p1, v_p2);
end $$;

-- Test C1: Bloqueo cuando hay un proceso obligatorio pendiente
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated", "aal": "aal2"}';

select throws_ok(
  $$
    select public.close_case((select c_case_id from s3_close_case_vars))
  $$,
  'Compuerta de cierre M1: no se puede cerrar el caso porque los siguientes procesos obligatorios no han finalizado: Documentos del causante [Sec. 2: Pendiente]',
  '(f) close_case debe fallar si existen procesos obligatorios que no han finalizado'
);

-- Test C2: Proceso con is_applicable = false no bloquea aunque no esté DONE
reset role;
update public.case_processes
   set is_applicable = false
 where id = (select c_p2_id from s3_close_case_vars);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated", "aal": "aal2"}';

select lives_ok(
  $$
    select public.close_case((select c_case_id from s3_close_case_vars))
  $$,
  '(f) close_case se ejecuta exitosamente si el único proceso pendiente tiene is_applicable = false'
);

-- Test C3: Verificar que el estado cambió a COMPLETED, closed_at registrado y current_progress intacto
select is(
  (select status from public.cases where id = (select c_case_id from s3_close_case_vars)),
  'COMPLETED',
  '(f) El caso cerrado debe registrar status = COMPLETED'
);

select isnt(
  (select closed_at from public.cases where id = (select c_case_id from s3_close_case_vars)),
  null,
  '(f) El caso cerrado debe registrar closed_at no nulo'
);

select is(
  (select current_progress from public.cases where id = (select c_case_id from s3_close_case_vars)),
  100.00,
  '(f) current_progress no es sobreescrito artificialmente; refleja 100% calculado del único proceso aplicable'
);

-- Test C4: Rechazo al intentar cerrar un caso ya completado
select throws_ok(
  $$
    select public.close_case((select c_case_id from s3_close_case_vars))
  $$,
  'El caso ya se encuentra cerrado (COMPLETED)',
  '(f) close_case rechaza re-cerrar un caso previamente cerrado'
);
reset role;

-- ============================================================================
-- TEST 9 (g): Inmutabilidad append-only en case_events
-- ============================================================================
select throws_ok(
  $$
    update public.case_events
       set title = 'Titulo Modificado'
     where case_id = (select test_case_id from s3_test_vars)
  $$,
  'Operacion rechazada: esta tabla es append-only y no admite modificaciones ni eliminaciones',
  '(g) case_events es inmutable frente a UPDATE mediante raise_immutable()'
);

select throws_ok(
  $$
    delete from public.case_events
     where case_id = (select test_case_id from s3_test_vars)
  $$,
  'Operacion rechazada: esta tabla es append-only y no admite modificaciones ni eliminaciones',
  '(g) case_events es inmutable frente a DELETE mediante raise_immutable()'
);

-- ============================================================================
-- TEST 10 (h): Aislamiento RLS en casos y casos confidenciales
-- ============================================================================
-- Gestor 2 intenta consultar el caso asignado exclusivamente a Gestor 1
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated", "aal": "aal1"}';

select is(
  (select count(*)::integer from public.cases where id = (select test_case_id from s3_test_vars)),
  0,
  '(h) Gestor no asignado no ve el caso regular de otro gestor'
);

-- Marcar el caso como confidencial
reset role;
update public.cases
   set is_confidential = true
 where id = (select test_case_id from s3_test_vars);

-- Gestor 1 (asignado) sí lo ve
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated", "aal": "aal1"}';
select is(
  (select count(*)::integer from public.cases where id = (select test_case_id from s3_test_vars)),
  1,
  '(h) Gestor asignado sí ve su caso aun siendo confidencial'
);

-- Gestor 2 (no asignado) sigue sin verlo
set local "request.jwt.claims" to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated", "aal": "aal1"}';
select is(
  (select count(*)::integer from public.cases where id = (select test_case_id from s3_test_vars)),
  0,
  '(h) Gestor no asignado no puede ver un caso confidencial ajeno'
);

-- Admin (superuser) sí lo ve
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated", "aal": "aal2"}';
select is(
  (select count(*)::integer from public.cases where id = (select test_case_id from s3_test_vars)),
  1,
  '(h) Superusuario (ADMIN) tiene visibilidad de casos confidenciales'
);

reset role;
rollback;
