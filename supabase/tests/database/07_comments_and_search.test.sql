-- pgTAP Tests: Sprint 4b — Comentarios, Duplicar Caso y Búsqueda Global (Ctrl+K)
-- Archivo: supabase/tests/database/07_comments_and_search.test.sql

create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(24);

-- ============================================================================
-- 1. SETUP DE USUARIOS Y ROLES DE PRUEBA
-- ============================================================================
insert into auth.users (id, email) values
  ('11111111-4444-1111-1111-111111111111', 'admin_s4b@test.pe'),
  ('22222222-4444-2222-2222-222222222222', 'gestor1_s4b@test.pe'),
  ('33333333-4444-3333-3333-333333333333', 'gestor2_s4b@test.pe')
on conflict (id) do nothing;

insert into public.profiles (id, email, first_name, last_name, is_active) values
  ('11111111-4444-1111-1111-111111111111', 'admin_s4b@test.pe', 'Admin', 'S4B', true),
  ('22222222-4444-2222-2222-222222222222', 'gestor1_s4b@test.pe', 'Gestor1', 'S4B', true),
  ('33333333-4444-3333-3333-333333333333', 'gestor2_s4b@test.pe', 'Gestor2', 'S4B', true)
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

-- ============================================================================
-- 2. SETUP DE DATOS PARA PRUEBAS FUNCIONALES
-- ============================================================================
create temp table s4b_vars (
  v_model_version_id uuid,
  v_client_a_id uuid,
  v_person_secret_b_id uuid,
  v_case_a_id uuid,
  v_case_confidential_b_id uuid,
  v_comment_id uuid,
  v_dup_case_1_id uuid,
  v_dup_case_2_id uuid
);

insert into s4b_vars (
  v_model_version_id,
  v_client_a_id,
  v_person_secret_b_id,
  v_case_a_id,
  v_case_confidential_b_id,
  v_comment_id,
  v_dup_case_1_id,
  v_dup_case_2_id
) values (
  (select id from public.case_model_versions where status = 'PUBLISHED' limit 1),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(),
  null,
  null
);

-- Personas de prueba
insert into public.persons (id, person_type, identity_document_type, identity_document_number, first_name, last_name, is_active)
values
  ((select v_client_a_id from s4b_vars), 'NATURAL', 'DNI', '10203040', 'Carlos', 'Publico', true),
  ((select v_person_secret_b_id from s4b_vars), 'NATURAL', 'DNI', '77889900', 'Secreta', 'Confidencial', true);

-- Caso A: Normal (asignado a Gestor 1)
insert into public.cases (id, case_number, case_model_version_id, client_person_id, title, description, is_confidential, created_by)
values (
  (select v_case_a_id from s4b_vars),
  '2026-800001',
  (select v_model_version_id from s4b_vars),
  (select v_client_a_id from s4b_vars),
  'Caso Publico Alpha',
  'Expediente regular accesible para Gestor 1',
  false,
  '22222222-4444-2222-2222-222222222222'
);

insert into public.case_assignments (case_id, user_id, assignment_type, is_primary)
values ((select v_case_a_id from s4b_vars), '22222222-4444-2222-2222-222222222222', 'RESPONSIBLE', true);

-- Interviniente, Activo y Pasivo en Caso A
insert into public.case_parties (case_id, person_id, party_role, heir_status, share_percent, is_active)
values ((select v_case_a_id from s4b_vars), (select v_client_a_id from s4b_vars), 'CAUSANTE', null, null, true);

insert into public.case_assets (case_id, asset_type, description, estimated_value, status, is_active)
values ((select v_case_a_id from s4b_vars), 'INMUEBLE', 'Departamento 101 Miraflores', 450000.00, 'VERIFICADO', true);

insert into public.case_liabilities (case_id, liability_type, creditor_name, amount, status, is_active)
values ((select v_case_a_id from s4b_vars), 'BANCARIA', 'Banco de Credito', 15000.00, 'IDENTIFICADA', true);

-- Caso B: Confidencial (asignado EXCLUSIVAMENTE a Gestor 1)
insert into public.cases (id, case_number, case_model_version_id, client_person_id, title, description, is_confidential, created_by)
values (
  (select v_case_confidential_b_id from s4b_vars),
  '2026-800002',
  (select v_model_version_id from s4b_vars),
  (select v_client_a_id from s4b_vars),
  'Caso Secreto Beta',
  'Expediente estrictamente confidencial ajeno para Gestor 2',
  true,
  '22222222-4444-2222-2222-222222222222'
);

insert into public.case_assignments (case_id, user_id, assignment_type, is_primary)
values ((select v_case_confidential_b_id from s4b_vars), '22222222-4444-2222-2222-222222222222', 'RESPONSIBLE', true);

-- La persona Secreta Confidencial (77889900) solo interviene en Caso B
insert into public.case_parties (case_id, person_id, party_role, heir_status, share_percent, is_active)
values ((select v_case_confidential_b_id from s4b_vars), (select v_person_secret_b_id from s4b_vars), 'HEREDERO', 'CONFIRMADO', 100.00, true);

-- ============================================================================
-- TEST 1: RLS activa en case_comments
-- ============================================================================
select is(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'case_comments'),
  true,
  '1. La tabla case_comments tiene RLS activa (rowsecurity = true)'
);

-- ============================================================================
-- TEST 2 a 10: RLS, Triggers y Operaciones en case_comments
-- ============================================================================

-- Simular Gestor 1 (asignado al Caso A)
select set_config('request.jwt.claims', '{"sub":"22222222-4444-2222-2222-222222222222","role":"authenticated","aal":"aal1"}', true);

-- 2. Insertar comentario como Gestor 1
insert into public.case_comments (id, case_id, user_id, comment_text, mentions)
values (
  (select v_comment_id from s4b_vars),
  (select v_case_a_id from s4b_vars),
  '22222222-4444-2222-2222-222222222222',
  'Primer comentario sobre el expediente Alpha',
  '["11111111-4444-1111-1111-111111111111"]'::jsonb
);

select is(
  (select count(*)::integer from public.case_comments where id = (select v_comment_id from s4b_vars)),
  1,
  '2. Gestor asignado inserta comentario en su expediente con éxito'
);

-- 3. Disparador de auditoría genera evento COMMENT_ADDED en case_events
select is(
  (select count(*)::integer from public.case_events where case_id = (select v_case_a_id from s4b_vars) and event_type = 'COMMENT_ADDED'),
  1,
  '3. Disparador genera evento COMMENT_ADDED en case_events automáticamente'
);

-- 4. Disparador actualiza last_activity_at en cases
select is(
  ((select last_activity_at from public.cases where id = (select v_case_a_id from s4b_vars)) is not null),
  true,
  '4. Disparador actualiza cases.last_activity_at tras nuevo comentario'
);

-- 5. Gestor 1 puede leer comentarios de su caso
select is(
  (select count(*)::integer from public.case_comments where case_id = (select v_case_a_id from s4b_vars)),
  1,
  '5. Gestor asignado lee los comentarios del expediente'
);

-- Simular Gestor 2 (NO asignado al Caso B confidencial)
select set_config('request.jwt.claims', '{"sub":"33333333-4444-3333-3333-333333333333","role":"authenticated","aal":"aal1"}', true);

-- 6. Gestor 2 no puede leer comentarios de un caso confidencial ajeno
select is(
  (select count(*)::integer from public.case_comments where case_id = (select v_case_confidential_b_id from s4b_vars)),
  0,
  '6. Gestor no asignado no ve comentarios de un caso confidencial (retorna 0)'
);

-- 7. Gestor 2 no puede insertar comentarios en caso confidencial ajeno (RLS bloquea)
select throws_ok(
  $$
    insert into public.case_comments (case_id, user_id, comment_text)
    values (
      (select v_case_confidential_b_id from s4b_vars),
      '33333333-4444-3333-3333-333333333333',
      'Comentario no autorizado'
    )
  $$,
  '42501',
  null,
  '7. Gestor no asignado no puede insertar comentario en caso confidencial (violación RLS 42501)'
);

-- 8. Gestor 1 puede actualizar su propio comentario
select set_config('request.jwt.claims', '{"sub":"22222222-4444-2222-2222-222222222222","role":"authenticated","aal":"aal1"}', true);

update public.case_comments
   set comment_text = 'Comentario Alpha editado por su autor'
 where id = (select v_comment_id from s4b_vars);

select is(
  (select comment_text from public.case_comments where id = (select v_comment_id from s4b_vars)),
  'Comentario Alpha editado por su autor',
  '8. Autor puede editar su propio comentario'
);

-- 9. Gestor 2 no puede actualizar el comentario de Gestor 1
select set_config('request.jwt.claims', '{"sub":"33333333-4444-3333-3333-333333333333","role":"authenticated","aal":"aal1"}', true);

update public.case_comments
   set comment_text = 'Intento de edicion ajena'
 where id = (select v_comment_id from s4b_vars);

select is(
  (select comment_text from public.case_comments where id = (select v_comment_id from s4b_vars)),
  'Comentario Alpha editado por su autor',
  '9. Otro usuario no puede editar el comentario de un tercero'
);

-- 10. Superusuario (Admin) puede eliminar cualquier comentario con private.is_superuser()
select set_config('request.jwt.claims', '{"sub":"11111111-4444-1111-1111-111111111111","role":"authenticated","aal":"aal2"}', true);

delete from public.case_comments where id = (select v_comment_id from s4b_vars);

select is(
  (select count(*)::integer from public.case_comments where id = (select v_comment_id from s4b_vars)),
  0,
  '10. Superusuario puede eliminar comentarios de terceros vía private.is_superuser()'
);

-- ============================================================================
-- TEST 11 a 19: Función public.duplicate_case (M8)
-- ============================================================================

-- 11. Gestor 2 intenta duplicar caso confidencial ajeno (debe arrojar excepción)
select set_config('request.jwt.claims', '{"sub":"33333333-4444-3333-3333-333333333333","role":"authenticated","aal":"aal1"}', true);

select throws_ok(
  $$
    select public.duplicate_case((select v_case_confidential_b_id from s4b_vars), 'Copia Ilegal')
  $$,
  'No tiene acceso al expediente de origen',
  '11. Gestor no asignado no puede duplicar caso confidencial ajeno'
);

-- 12. Gestor 1 duplica Caso A (con partes, sin activos)
select set_config('request.jwt.claims', '{"sub":"22222222-4444-2222-2222-222222222222","role":"authenticated","aal":"aal1"}', true);

update s4b_vars
   set v_dup_case_1_id = public.duplicate_case(
     (select v_case_a_id from s4b_vars),
     'Caso Derivado 1',
     true,  -- include_parties
     false  -- include_assets
   );

select is(
  ((select v_dup_case_1_id from s4b_vars) is not null),
  true,
  '12. Gestor asignado duplica expediente con éxito'
);

-- 13. Nuevo caso tiene nuevo case_number correlativo y progreso 0.00
select is(
  (select progress from public.cases where id = (select v_dup_case_1_id from s4b_vars)),
  0.00,
  '13. Caso duplicado inicia en progreso 0.00% y estado inicial'
);

-- 14. Caso duplicado registra parent_case_id apuntando al caso de origen
select is(
  (select parent_case_id from public.cases where id = (select v_dup_case_1_id from s4b_vars)),
  (select v_case_a_id from s4b_vars),
  '14. Caso duplicado registra parent_case_id vinculando al expediente de origen'
);

-- 15. Caso duplicado clonó los intervinientes (case_parties)
select is(
  (select count(*)::integer from public.case_parties where case_id = (select v_dup_case_1_id from s4b_vars)),
  1,
  '15. Caso duplicado con _include_parties = true clonó intervinientes del origen'
);

-- 16. Caso duplicado NO clonó bienes porque _include_assets = false
select is(
  (select count(*)::integer from public.case_assets where case_id = (select v_dup_case_1_id from s4b_vars)),
  0,
  '16. Caso duplicado con _include_assets = false no copia activos'
);

-- 17. Caso duplicado NUNCA clona deudas (case_liabilities = 0)
select is(
  (select count(*)::integer from public.case_liabilities where case_id = (select v_dup_case_1_id from s4b_vars)),
  0,
  '17. Caso duplicado no arrastra deudas ni pasivos por regla de dominio'
);

-- 18. Registro de evento CASE_DUPLICATED en case_events
select is(
  (select count(*)::integer from public.case_events where case_id = (select v_dup_case_1_id from s4b_vars) and event_type = 'CASE_DUPLICATED'),
  1,
  '18. Duplicación genera evento CASE_DUPLICATED en case_events'
);

-- 19. Duplicar con _include_assets = true clona bienes reiniciando estado a IDENTIFICADO
update s4b_vars
   set v_dup_case_2_id = public.duplicate_case(
     (select v_case_a_id from s4b_vars),
     'Caso Derivado 2 con Bienes',
     true, -- include_parties
     true  -- include_assets
   );

select is(
  (select status from public.case_assets where case_id = (select v_dup_case_2_id from s4b_vars) limit 1),
  'IDENTIFICADO',
  '19. Duplicación con _include_assets = true clona bienes con estado reiniciado a IDENTIFICADO'
);

-- ============================================================================
-- TEST 20 a 24: Búsqueda Global Ctrl+K (public.global_search)
-- ============================================================================

-- 20. Gestor 1 (asignado al caso confidencial B) busca a Persona Secreta por DNI
select is(
  (select count(*)::integer from public.global_search('77889900') where entity_type = 'PERSON'),
  1,
  '20. Gestor autorizado encuentra persona de caso confidencial en global_search'
);

-- 21. Gestor 2 (NO asignado al caso confidencial B) busca por DNI '77889900' (DEBE DAR 0)
select set_config('request.jwt.claims', '{"sub":"33333333-4444-3333-3333-333333333333","role":"authenticated","aal":"aal1"}', true);

select is(
  (select count(*)::integer from public.global_search('77889900')),
  0,
  '21. Gestor no asignado NO encuentra persona que solo pertenece a caso confidencial ajeno'
);

-- 22. Gestor 2 busca el título del caso confidencial B (DEBE DAR 0)
select is(
  (select count(*)::integer from public.global_search('Secreto Beta')),
  0,
  '22. Gestor no asignado NO encuentra caso confidencial en global_search'
);

-- 23. Gestor 1 busca caso accesible Alpha
select set_config('request.jwt.claims', '{"sub":"22222222-4444-2222-2222-222222222222","role":"authenticated","aal":"aal1"}', true);

select is(
  (select count(*)::integer from public.global_search('Alpha') where entity_type = 'CASE'),
  1,
  '23. Gestor autorizado encuentra expediente asignado en global_search'
);

-- 24. Búsqueda con consulta menor a 2 caracteres retorna 0 resultados
select is(
  (select count(*)::integer from public.global_search('a')),
  0,
  '24. Búsqueda con menos de 2 caracteres retorna 0 resultados sin ejecutar consulta'
);

select * from finish();
rollback;
