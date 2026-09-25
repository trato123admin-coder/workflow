-- Consultas de verificación para: 20260924130000_settings_seeds.sql
-- Ejecutar en Supabase SQL Editor después de aplicar la migración en Staging.

-- 1. Verificar conteo de catálogos sembrados
-- Resultado esperado: al menos 23 catálogos
select count(*)::int as total_catalogs from public.catalogs;

-- 2. Verificar conteo de elementos de catálogo sembrados
-- Resultado esperado: al menos 85 elementos
select count(*)::int as total_catalog_items from public.catalog_items;

-- 3. Verificar que DNI, CE y RUC estén activos, y PASAPORTE y OTRO inactivos
-- Resultado esperado: 5 filas (DNI=true, CE=true, RUC=true, PASAPORTE=false, OTRO=false)
select code, label, is_active, is_system
  from public.catalog_items
 where catalog_code = 'identity_document_types'
 order by sort_order;

-- 4. Verificar estados de workflow con su respectiva categoría semántica
-- Resultado esperado: 8 filas, todas con category poblada en metadata
select code, label, metadata->>'category' as semantic_category
  from public.catalog_items
 where catalog_code = 'workflow_statuses'
 order by sort_order;

-- 5. Verificar conteo de feature flags sembrados
-- Resultado esperado: 28 flags
select count(*)::int as total_flags from public.feature_flags;

-- 6. Verificar flags de seguridad y núcleo bloqueados
-- Resultado esperado: audit.enabled, rls.enforced y storage.backup_encrypt con is_locked = true
select key, is_enabled, is_locked
  from public.feature_flags
 where is_locked = true
 order by key;

-- 7. Verificar conteo de setting_definitions y system_settings sincronizados
-- Resultado esperado: total_definitions = total_settings (al menos 39 parámetros)
select
  (select count(*)::int from public.setting_definitions) as total_definitions,
  (select count(*)::int from public.system_settings) as total_settings;

-- 8. Probar la función private.feature_enabled con flag activo e inactivo
-- Resultado esperado: module_cash = true, module_ai = false, flag_inexistente = false
select
  private.feature_enabled('module.cash') as module_cash,
  private.feature_enabled('module.ai') as module_ai,
  private.feature_enabled('flag_inexistente') as flag_inexistente;
