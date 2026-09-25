-- Script de Verificación: 20260925120000_fix_persons_rls_unassigned.verify.sql
-- Ejecutar en el SQL Editor de Supabase Staging tras aplicar la migración 20260925120000_fix_persons_rls_unassigned.sql
-- No modifica datos permanentes. Cada consulta incluye el resultado esperado en comentarios.

-- 1. Verificar existencia de la columna created_by en public.persons
-- Resultado esperado: 1 fila con column_name = 'created_by' y data_type = 'uuid'
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'persons'
   and column_name = 'created_by';
-- Esperado: 1 fila ('created_by', 'uuid', 'YES')

-- 2. Verificar existencia de la clave foránea a public.profiles
-- Resultado esperado: 1 fila indicando foreign key a public.profiles(id)
select conname, pg_get_constraintdef(c.oid) as definition
  from pg_constraint c
 where conrelid = 'public.persons'::regclass
   and conname like '%created_by%';
-- Esperado: FOREIGN KEY (created_by) REFERENCES profiles(id)

-- 3. Verificar definición de private.can_access_person
-- Resultado esperado: definición contiene 'not exists' para prospectos sin caso
select pg_get_functiondef('private.can_access_person(uuid)'::regprocedure) as function_def;
-- Esperado: contiene "or not exists ( select 1 from public.cases c where c.client_person_id = _person_id )"

-- 4. Prueba de comportamiento RLS (Opción A):
-- - Persona sin casos creada por Gestor 1 es VISIBLE a Gestor 2
-- - Al vincular la persona a un caso confidencial de Gestor 1, Gestor 2 YA NO PUEDE VERLA
-- - Se ejecuta dentro de un sub-bloque con reversión automática para no alterar datos de staging
do $$
declare
  v_test_pid uuid;
  v_test_cid uuid;
  v_vid uuid;
  v_visible_before int;
  v_visible_after int;
begin
  begin
    -- Setup: crear persona con created_by asignado a Gestor 1
    insert into public.persons (
      person_type, identity_document_type, identity_document_number,
      first_name, last_name, created_by
    ) values (
      'NATURAL', 'DNI', '98765431', 'Test', 'Trazabilidad', '22222222-2222-2222-2222-222222222222'
    ) returning id into v_test_pid;

    -- Test A: Gestor 2 consulta la persona sin casos (debe verla, directorio compartido)
    set local role authenticated;
    set local "request.jwt.claims" to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated", "aal": "aal1"}';

    select count(*) into v_visible_before
      from public.persons
     where id = v_test_pid;

    if v_visible_before <> 1 then
      raise exception 'Fallo A: Gestor 2 no pudo leer la persona sin casos creada por Gestor 1';
    end if;

    -- Test B: Vincular persona a caso confidencial de Gestor 1
    reset role;
    select v.id into v_vid
      from public.case_model_versions v
      join public.case_models m on m.id = v.case_model_id
     where m.code = 'SUCESION_INTESTADA_NOTARIAL' and v.status = 'PUBLISHED';

    v_test_cid := public.create_case_from_model(
      _model_version_id => v_vid,
      _client_person_id => v_test_pid,
      _title             => 'Caso Confidencial Gestor 1',
      _responsible_id    => '22222222-2222-2222-2222-222222222222'::uuid,
      _is_confidential   => true
    );

    -- Test C: Gestor 2 consulta la persona ahora vinculada al caso confidencial (NO debe verla)
    set local role authenticated;
    set local "request.jwt.claims" to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated", "aal": "aal1"}';

    select count(*) into v_visible_after
      from public.persons
     where id = v_test_pid;

    if v_visible_after <> 0 then
      raise exception 'Fallo B: Gestor 2 pudo ver la persona vinculada al caso confidencial ajeno (count = %)', v_visible_after;
    end if;

    -- Forzar rollback para dejar el entorno limpio e idempotente
    raise exception 'ROLLBACK_VERIFY_SUCCESS';
  exception
    when others then
      reset role;
      if sqlerrm = 'ROLLBACK_VERIFY_SUCCESS' then
        raise notice 'Verificación exitosa: Opción A de RLS probada correctamente (visible antes = 1, visible después = 0). Datos temporales revertidos.';
      else
        raise;
      end if;
  end;
end $$;
