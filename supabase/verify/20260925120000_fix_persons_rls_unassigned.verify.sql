-- Script de Verificación: 20260925120000_fix_persons_rls_unassigned.verify.sql
-- Ejecutar en el SQL Editor de Supabase Staging tras aplicar la migración 20260925120000_fix_persons_rls_unassigned.sql
-- No modifica datos permanentes. Cada consulta incluye el resultado esperado en comentarios.

-- 1. Verificar definición de private.can_access_person
-- Resultado esperado: la definición incluye 'not exists' para casos con client_person_id
select pg_get_functiondef('private.can_access_person(uuid)'::regprocedure) as function_def;
-- Esperado: la definición contiene:
-- not exists (
--   select 1 from public.cases c
--    where c.client_person_id = _person_id
-- )

-- 2. Prueba de comportamiento en bloque de transacción temporal:
-- Gestor autenticado debe poder ver a una persona recién insertada sin casos asociados
do $$
declare
  v_test_person_id uuid;
  v_visible_count int;
begin
  -- Insertar persona de prueba
  insert into public.persons (
    person_type, identity_document_type, identity_document_number,
    first_name, last_name
  ) values (
    'NATURAL', 'DNI', '99999991', 'Persona', 'Verificacion'
  ) returning id into v_test_person_id;

  -- Simular usuario gestor (ANALYST)
  set local role authenticated;
  set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated", "aal": "aal1"}';

  -- Consultar la persona recién creada
  select count(*) into v_visible_count
    from public.persons
   where id = v_test_person_id;

  if v_visible_count <> 1 then
    raise exception 'Fallo de verificación: el gestor no pudo leer la persona sin casos (count = %)', v_visible_count;
  end if;

  raise notice 'Verificación exitosa: persona sin casos es visible al gestor (count = %)', v_visible_count;
end $$;
