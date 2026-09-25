-- pgTAP Tests: Sprint 2 — Settings, catálogos y toggles
-- 1. Todas las tablas de configuración tienen RLS habilitada
-- 2. private.feature_enabled() es SECURITY DEFINER y funciona
-- 3. Inmutabilidad de settings_history (raise_immutable en UPDATE/DELETE)
-- 4. Inmutabilidad de código en catalog_items
-- 5. Protección de feature flags bloqueados (is_locked)
-- 6. Función private.validate_custom_data() valida requeridos y tipos
-- 7. Tabla holidays creada vacía

begin;
select plan(12);

-- Test 1: Verificar que todas las tablas públicas tienen RLS habilitada
select is(
  (select count(*)::integer from pg_tables where schemaname = 'public' and rowsecurity = false),
  0,
  'CRITICAL: All public tables must have Row Level Security (RLS) enabled'
);

-- Test 2: Verificar que las 8 tablas de configuración existen y tienen RLS
select is(
  (select count(*)::integer
     from pg_tables
    where schemaname = 'public'
      and tablename in (
        'catalogs', 'catalog_items', 'feature_flags', 'setting_definitions',
        'system_settings', 'settings_history', 'custom_field_definitions', 'holidays'
      )
      and rowsecurity = true),
  8,
  'All 8 configuration tables must exist and have RLS active'
);

-- Test 3: Verificar que private.feature_enabled exista y sea SECURITY DEFINER
select is(
  (select prosecdef
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'feature_enabled'),
  true,
  'private.feature_enabled must be SECURITY DEFINER'
);

-- Test 4: Evaluar private.feature_enabled con flags sembrados
select is(
  private.feature_enabled('module.cash'),
  true,
  'private.feature_enabled(module.cash) must be true'
);

select is(
  private.feature_enabled('module.ai'),
  false,
  'private.feature_enabled(module.ai) must be false initially'
);

select is(
  private.feature_enabled('non_existent_flag'),
  false,
  'private.feature_enabled on unknown key must return false'
);

-- Test 5: Inmutabilidad de settings_history: UPDATE debe fallar por trigger raise_immutable
prepare test_update_settings_history as
  update public.settings_history set reason = 'hack' where id is not null;

select throws_ok(
  'test_update_settings_history',
  'P0001',
  'Registro inmutable: no se permite modificacion ni eliminacion',
  'UPDATE on settings_history must be rejected by raise_immutable'
);

-- Test 6: Inmutabilidad de settings_history: DELETE debe fallar por trigger raise_immutable
prepare test_delete_settings_history as
  delete from public.settings_history where id is not null;

select throws_ok(
  'test_delete_settings_history',
  'P0001',
  'Registro inmutable: no se permite modificacion ni eliminacion',
  'DELETE on settings_history must be rejected by raise_immutable'
);

-- Test 7: Protección de flags bloqueados: intentar apagar audit.enabled debe lanzar excepción
prepare test_disable_locked_flag as
  update public.feature_flags set is_enabled = false where key = 'audit.enabled';

select throws_ok(
  'test_disable_locked_flag',
  'P0001',
  'Operacion rechazada: el flag audit.enabled esta bloqueado por el nucleo y no puede desactivarse',
  'Disabling a locked flag must raise exception'
);

-- Test 8: Inmutabilidad de código en catalog_items
prepare test_change_catalog_item_code as
  update public.catalog_items set code = 'DNI_NEW' where catalog_code = 'identity_document_types' and code = 'DNI';

select throws_ok(
  'test_change_catalog_item_code',
  'P0001',
  'Operacion rechazada: el codigo de un elemento de catalogo es inmutable',
  'Changing catalog_item code must be rejected'
);

-- Test 9: Validación de datos personalizados requeridos
prepare test_custom_data_missing_required as
  select private.validate_custom_data('case', '{}'::jsonb);

-- Insert temporary test required custom field definition
insert into public.custom_field_definitions (
  entity, code, label, data_type, is_required
) values (
  'case', 'num_partida', 'N.º de Partida Registral', 'TEXT', true
);

select throws_ok(
  'test_custom_data_missing_required',
  'P0001',
  'El campo personalizado N.º de Partida Registral (num_partida) es requerido para la entidad case',
  'validate_custom_data must throw when required field is missing'
);

-- Test 10: Validación de datos correctos en validate_custom_data
select is(
  private.validate_custom_data('case', '{"num_partida": "12345678"}'::jsonb),
  '{"num_partida": "12345678"}'::jsonb,
  'validate_custom_data returns validated jsonb when valid'
);

select * from finish();
rollback;
