-- ============================================================================
-- Script de Verificación: 20260926020000_external_filings_and_templates_schema.verify.sql
-- Sprint: 6 (Trámites externos, Días útiles y Plantillas DOCX)
-- Entorno: Supabase Staging SQL Editor
-- ============================================================================

do $$
declare
  v_test_type_id        uuid;
  v_tmpl1               uuid;
  v_tmpl2               uuid;
  v_due_date            date;
  v_overlap_rejected    boolean := false;
  v_auth_write_blocked  boolean := false;
  v_rls_missing_count   integer;
begin
  -- 1. Verificar extensión btree_gist
  assert exists(select 1 from pg_extension where extname = 'btree_gist'),
    'ERROR: La extensión btree_gist no está instalada';

  -- 2. Verificar bucket privado 'templates'
  assert exists(select 1 from storage.buckets where id = 'templates' and public = false),
    'ERROR: El bucket templates no existe o es público';

  -- 3. Verificar que las 5 tablas nuevas tienen RLS habilitada
  select count(*) into v_rls_missing_count
    from pg_tables
   where schemaname = 'public'
     and tablename in ('external_entities', 'case_filings', 'document_fields', 'templates', 'template_fields')
     and rowsecurity = false;

  assert v_rls_missing_count = 0,
    format('ERROR: Existen %s tablas nuevas sin RLS habilitada', v_rls_missing_count);

  -- 4. Probar add_business_days sin feriados (debe calcular días hábiles correctamente)
  -- Lunes 2026-10-05 + 5 días hábiles = Lunes 2026-10-12
  v_due_date := public.add_business_days('2026-10-05'::date, 5);
  assert v_due_date = '2026-10-12'::date,
    format('ERROR: add_business_days falló. Esperado 2026-10-12, obtenido %s', v_due_date);

  -- 4.1 Verificar parámetro en setting_definitions y system_settings
  assert exists(select 1 from public.setting_definitions where key = 'filings.publication_wait_business_days'),
    'ERROR: La definición del parámetro filings.publication_wait_business_days no existe en setting_definitions';

  assert exists(select 1 from public.system_settings where key = 'filings.publication_wait_business_days'),
    'ERROR: El valor del parámetro filings.publication_wait_business_days no existe en system_settings';

  -- 5. Obtener un tipo documental de prueba
  select id into v_test_type_id from public.document_types limit 1;
  assert v_test_type_id is not null,
    'ERROR: Debe existir al menos un document_type registrado para probar templates';

  -- 6. Probar como service_role (simulando la escritura legítima del engine tras el lint)
  execute 'set local role service_role';

  -- 6.1 Insertar plantilla 1 válida
  insert into public.templates (document_type_id, name, storage_key, valid_from, valid_until, is_active)
  values (v_test_type_id, 'Plantilla Prueba 1', 'test_key_1.docx', '2026-01-01', '2026-12-31', true)
  returning id into v_tmpl1;

  -- 6.2 Intentar insertar plantilla solapada activa (debe fallar por la restricción EXCLUDE)
  begin
    insert into public.templates (document_type_id, name, storage_key, valid_from, valid_until, is_active)
    values (v_test_type_id, 'Plantilla Prueba 2 Solapada', 'test_key_2.docx', '2026-06-01', '2027-06-30', true)
    returning id into v_tmpl2;
  exception when exclusion_violation then
    v_overlap_rejected := true;
  end;

  assert v_overlap_rejected = true,
    'ERROR: La restricción EXCLUDE no rechazó la plantilla con vigencia solapada';

  -- Limpiar registro de prueba
  delete from public.templates where id = v_tmpl1;

  -- 7. Probar como authenticated (verificar que la escritura directa está estrictamente bloqueada)
  execute 'set local role authenticated';
  begin
    insert into public.templates (document_type_id, name, storage_key, valid_from, valid_until, is_active)
    values (v_test_type_id, 'Plantilla No Autorizada', 'test_unauth.docx', '2028-01-01', '2028-12-31', true);
  exception when insufficient_privilege then
    v_auth_write_blocked := true;
  end;

  assert v_auth_write_blocked = true,
    'ERROR: El rol authenticated no fue bloqueado al intentar escribir directamente en templates';

  -- 8. Restaurar rol de la sesión
  execute 'reset role';

  raise notice 'VERIFICACIÓN EXITOSA: Extensiones, bucket, add_business_days, restricción EXCLUDE y blindaje RLS/grants operativos al 100%%.';
end;
$$;
