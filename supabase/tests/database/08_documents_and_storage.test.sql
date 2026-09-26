-- pgTAP Tests: Sprint 5 — Documentos y Almacenamiento
-- Archivo: supabase/tests/database/08_documents_and_storage.test.sql

create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(18);

-- ============================================================================
-- 1. ESTRUCTURA Y RLS
-- ============================================================================
select has_table('public', 'storage_backends', 'Existe tabla storage_backends');
select has_table('public', 'document_types', 'Existe tabla document_types');
select has_table('public', 'document_alternatives', 'Existe tabla document_alternatives');
select has_table('public', 'case_model_documents', 'Existe tabla case_model_documents');
select has_table('public', 'case_documents', 'Existe tabla case_documents');
select has_table('public', 'document_versions', 'Existe tabla document_versions');

select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'storage_backends'),
  'storage_backends tiene RLS habilitada'
);
select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'document_types'),
  'document_types tiene RLS habilitada'
);
select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'case_documents'),
  'case_documents tiene RLS habilitada'
);
select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'document_versions'),
  'document_versions tiene RLS habilitada'
);

-- ============================================================================
-- 2. CLAVE FORÁNEA CIRCULAR
-- ============================================================================
select ok(
  exists (
    select 1 from information_schema.table_constraints
     where table_schema = 'public'
       and table_name = 'case_documents'
       and constraint_name = 'fk_case_documents_current_version'
  ),
  'Existe clave foránea circular fk_case_documents_current_version hacia document_versions'
);

-- ============================================================================
-- 3. PRUEBA ESPECÍFICA PUNTO 2 (HEREDEROS EN SUCESION_INTESTADA_NOTARIAL v1)
-- Verifica que existen exactamente 2 documentos para HEREDERO y que DNI_COPIA
-- no fue descartado por colisión de secuencia.
-- ============================================================================
select is(
  (
    select string_agg(dt.code, ',' order by dt.code)
      from public.case_model_documents cmd
      join public.case_model_versions cmv on cmv.id = cmd.case_model_version_id
      join public.case_models cm on cm.id = cmv.case_model_id
      join public.document_types dt on dt.id = cmd.document_type_id
     where cm.code = 'SUCESION_INTESTADA_NOTARIAL'
       and cmv.version = 1
       and cmd.party_role = 'HEREDERO'
  ),
  'DNI_COPIA,PARTIDA_NACIMIENTO',
  'Existen exactamente 2 documentos para HEREDERO en Sucesión Intestada Notarial v1 (DNI_COPIA y PARTIDA_NACIMIENTO)'
);

-- ============================================================================
-- 4. PRUEBA DE INMUTABILIDAD DE MODELOS PUBLICADOS (Punto 1 y 3)
-- Intentar agregar un documento a una versión PUBLISHED debe fallar por trigger.
-- ============================================================================
select throws_ok(
  $$
    insert into public.case_model_documents (case_model_version_id, document_type_id, sequence, is_required)
    select cmv.id, (select id from public.document_types limit 1), 99, false
      from public.case_model_versions cmv
      join public.case_models cm on cm.id = cmv.case_model_id
     where cm.code = 'SUCESION_INTESTADA_NOTARIAL'
       and cmv.version = 1;
  $$,
  'No se pueden agregar, modificar ni eliminar elementos de una versión de modelo PUBLISHED (es inmutable; clone a una nueva versión)',
  'El trigger trg_guard_case_model_documents_immutability impide modificar versiones PUBLISHED'
);

-- ============================================================================
-- 5. PRUEBA DE STORAGE BUCKET Y BLINDAJE DE ACCESO (Punto 2)
-- ============================================================================
select ok(
  exists (
    select 1 from storage.buckets
     where id = 'case-documents' and public = false
  ),
  'El bucket case-documents existe y es privado'
);

select is(
  (
    select count(*)::integer
      from pg_policies
     where schemaname = 'storage'
       and tablename = 'objects'
       and (roles @> '{authenticated}'::name[] or roles @> '{public}'::name[])
       and policyname ilike '%case%'
  ),
  0,
  'No existe ninguna política en storage.objects para authenticated/public en case-documents (100% blindado a service_role)'
);

-- ============================================================================
-- 6. PRUEBA DE SINCRONIZACIÓN IDEMPOTENTE (Punto 3 - sync_case_document_slots)
-- Verifica que al retirar un interviniente, sus slots se desactivan y nunca se borran.
-- ============================================================================
do $$
declare
  v_model_version_id uuid;
  v_client_id uuid;
  v_case_id uuid;
  v_heir_person_id uuid;
  v_party_id uuid;
  v_active_slots_before integer;
  v_active_slots_after integer;
  v_total_slots integer;
begin
  select cmv.id into v_model_version_id
    from public.case_model_versions cmv
    join public.case_models cm on cm.id = cmv.case_model_id
   where cm.code = 'SUCESION_INTESTADA_NOTARIAL' and cmv.version = 1;

  -- Crear persona cliente
  insert into public.persons (id, person_type, identity_document_type, identity_document_number, first_name, last_name, is_active)
  values ('bbbbbbbb-5555-bbbb-bbbb-bbbbbbbbbb01', 'NATURAL', 'DNI', '55550001', 'Cliente', 'Test S5', true)
  on conflict (id) do nothing;

  -- Crear caso
  insert into public.cases (
    id, case_number, case_model_version_id, client_person_id, title, status
  ) values (
    'cccccccc-5555-cccc-cccc-cccccccccc01', 'TEST-S5-CASE-01', v_model_version_id,
    'bbbbbbbb-5555-bbbb-bbbb-bbbbbbbbbb01', 'Caso de prueba para slots de documentos', 'OPEN'
  ) on conflict (id) do nothing;

  -- Crear persona heredero
  insert into public.persons (id, person_type, identity_document_type, identity_document_number, first_name, last_name, is_active)
  values ('bbbbbbbb-5555-bbbb-bbbb-bbbbbbbbbb02', 'NATURAL', 'DNI', '55550002', 'Heredero', 'Test S5', true)
  on conflict (id) do nothing;

  -- Agregar heredero
  insert into public.case_parties (
    id, case_id, person_id, party_role, is_active
  ) values (
    'dddddddd-5555-dddd-dddd-dddddddddd01', 'cccccccc-5555-cccc-cccc-cccccccccc01',
    'bbbbbbbb-5555-bbbb-bbbb-bbbbbbbbbb02', 'HEREDERO', true
  ) on conflict (id) do update set is_active = true
  returning id into v_party_id;

  -- Forzar sincronización
  perform public.sync_case_document_slots('cccccccc-5555-cccc-cccc-cccccccccc01');

  select count(*) into v_active_slots_before
    from public.case_documents
   where case_id = 'cccccccc-5555-cccc-cccc-cccccccccc01'
     and party_id = v_party_id
     and is_active = true;

  -- Desactivar heredero
  update public.case_parties
     set is_active = false
   where id = v_party_id;

  -- Resincronizar
  perform public.sync_case_document_slots('cccccccc-5555-cccc-cccc-cccccccccc01');

  select count(*) into v_active_slots_after
    from public.case_documents
   where case_id = 'cccccccc-5555-cccc-cccc-cccccccccc01'
     and party_id = v_party_id
     and is_active = true;

  select count(*) into v_total_slots
    from public.case_documents
   where case_id = 'cccccccc-5555-cccc-cccc-cccccccccc01'
     and party_id = v_party_id;
end;
$$;

select ok(
  exists (
    select 1 from public.case_documents
     where case_id = 'cccccccc-5555-cccc-cccc-cccccccccc01'
       and party_id = 'dddddddd-5555-dddd-dddd-dddddddddd01'
       and is_active = false
  ),
  'sync_case_document_slots desactiva los slots al retirar un interviniente y NUNCA los borra de la BD'
);

-- ============================================================================
-- 7. PRUEBA DE AUDITORÍA AUTOMÁTICA EN case_documents (trg_audit_case_documents)
-- Verifica que al actualizar status a VALIDATED y OBSERVED se registre en audit_logs
-- con user_id, old_data.status y new_data.status.
-- ============================================================================
insert into auth.users (id, email)
values ('11111111-5555-1111-1111-111111111111', 'reviewer.audit.test@local.dev')
on conflict (id) do nothing;

insert into public.profiles (id, email, first_name, last_name, is_active)
values ('11111111-5555-1111-1111-111111111111', 'reviewer.audit.test@local.dev', 'Revisor', 'Audit', true)
on conflict (id) do nothing;

insert into public.user_roles (user_id, role_id)
select '11111111-5555-1111-1111-111111111111', id from public.roles where code = 'ADMIN'
on conflict do nothing;

-- Simular sesión de usuario autenticado
set local "request.jwt.claims" to '{"sub": "11111111-5555-1111-1111-111111111111", "role": "authenticated", "aal": "aal2"}';
select set_config('request.jwt.claim.sub', '11111111-5555-1111-1111-111111111111', true);

create temp table s5_test_doc (id uuid);
insert into s5_test_doc (id)
select id from public.case_documents where case_id = 'cccccccc-5555-cccc-cccc-cccccccccc01' limit 1;

-- 1. Actualizar a VALIDATED
update public.case_documents
   set status = 'VALIDATED', notes = 'Aprobado conforme'
 where id = (select id from s5_test_doc);

-- 2. Actualizar a OBSERVED
update public.case_documents
   set status = 'OBSERVED', notes = 'Falta firma notarial'
 where id = (select id from s5_test_doc);

-- Limpiar sesión
set local "request.jwt.claims" to '';
select set_config('request.jwt.claim.sub', '', true);

select ok(
  exists (
    select 1 from public.audit_logs
     where entity_type = 'case_documents'
       and action = 'UPDATE'
       and user_id = '11111111-5555-1111-1111-111111111111'
       and old_data->>'status' = 'PENDING'
       and new_data->>'status' = 'VALIDATED'
  ),
  'Cambio de status a VALIDATED genera fila en audit_logs con user_id, old_data.status y new_data.status'
);

select ok(
  exists (
    select 1 from public.audit_logs
     where entity_type = 'case_documents'
       and action = 'UPDATE'
       and user_id = '11111111-5555-1111-1111-111111111111'
       and old_data->>'status' = 'VALIDATED'
       and new_data->>'status' = 'OBSERVED'
  ),
  'Cambio de status a OBSERVED genera fila en audit_logs con user_id, old_data.status y new_data.status'
);

select * from finish();
rollback;
