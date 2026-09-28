# Bitácora de Migraciones de Base de Datos

Registro de migraciones ejecutadas, entorno de aplicación y resultado de su respectivo script de verificación.

---

| Migración | Fecha Aplicada | Entorno | Resultado Verify | Notas |
|---|---|---|---|---|
| `20260924000000_initial_schema.sql` | 2026-09-24 | Staging (Cloud) | Exitoso | Extensiones, esquema `private`, `audit_logs`, `case_counters`, `job_queue`. RLS 100%. |
| `20260924100000_identity_and_roles.sql` | 2026-09-24 | Staging (Cloud) | Exitoso | `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`, `private.has_permission`, trigger último admin. |
| `20260924110000_security_hardening.sql` | 2026-09-24 | Staging (Cloud) | Exitoso | Anti-escalada, validación de `profiles.is_active` y `aal2` en `has_permission`, funciones con `search_path = ''`, y disparadores de auditoría automáticos. |
| `20260924120000_settings_and_catalogs.sql` | 2026-09-24 | Staging (Cloud) | Verificado OK | Catálogos, flags, settings, historial inmutable, custom fields, holidays y RLS settings.manage. |
| `20260924130000_settings_seeds.sql` | 2026-09-24 | Staging (Cloud) | Verificado OK | Semillas de 23 catálogos, 28 flags, 39 definiciones y parámetros por defecto. |
| `20260925100000_cases_and_persons_schema.sql` | 2026-09-25 | Staging (Cloud) | Verificado OK | Tablas `persons`, `cases`, `case_assignments`, `process_definitions`, `workflow_statuses`, `case_models`, `case_model_versions`, `case_model_processes`, `case_model_process_deps`, `case_processes`, `case_events`. RLS, trigger avance ponderado y compuertas. |
| `20260925110000_workflow_and_models_seeds.sql` | 2026-09-25 | Staging (Cloud) | Verificado OK | Estados de workflow con categorías semánticas, definiciones de procesos y los 5 modelos de caso iniciales (incluye SUCESION_INTESTADA_NOTARIAL v1 publicado con 11 procesos). |
| `20260925120000_fix_persons_rls_unassigned.sql` | 2026-09-25 | Staging (Cloud) | Verificado OK | Directorio compartido de personas sin casos asociados (Opción A), columna `created_by` para trazabilidad y actualización de `private.can_access_person`. Verificado exitosamente con aislamiento RLS. |
| `20260925130000_case_parties_and_estate_schema.sql` | 2026-09-25 | Staging (Cloud) | Verificado OK (25/25 pgTAP + verify.sql) | Aplicada manualmente por el operador en Staging. Tablas `case_parties`, `case_assets`, `case_liabilities` con RLS habilitada. Índice parcial `one_causante_per_case`, CHECK de 4 dígitos exactos para `CUENTA_BANCARIA`, función atómica `create_case_from_model` y semáforos en BD `get_case_semaphore_warnings` protegidos por `can_access_case`. |
| `20260925140000_case_comments_and_search_schema.sql` | 2026-09-25 | Staging (Cloud) | Verificado OK (24/24 pgTAP + verify.sql) | Aplicada manualmente por el operador en Staging. Tabla `case_comments` con RLS gobernada por `private.can_access_case()`, permisos `cases.read.assigned`/`cases.write.assigned` y flag `module.case_comments`. Disparador de auditoría `tg_audit_log`. Función `public.duplicate_case` con clonación condicional de partes y cuotas (activos y pasivos excluidos por diseño). Función `public.global_search` con `SECURITY DEFINER` filtrada por `private.can_access_case` para casos y `private.has_permission('clients.read') AND private.can_access_person` para personas. |
| `20260926000000_storage_and_documents_schema.sql` | 2026-09-26 | Staging (Cloud) | Verificado OK (10/10 verify.sql) | Aplicada manualmente por el operador en Staging. Tablas `storage_backends`, `document_types`, `document_alternatives`, `case_model_documents`, `case_documents`, `document_versions` con RLS habilitada. Bucket privado `case-documents` sin políticas públicas/autenticadas (100% blindado a `service_role`). Función `sync_case_document_slots` SECURITY DEFINER y trigger de inmutabilidad `trg_guard_case_model_documents_immutability`. Clave foránea circular `fk_case_documents_current_version` e índice único por proceso que evita colisiones en `HEREDERO`. |
| `20260926010000_case_documents_audit_trigger.sql` | 2026-09-26 | Staging (Cloud) | Verificado OK (Verify #11) | Aplicada manualmente por el operador en Staging. Conexión del trigger de auditoría `trg_audit_case_documents` a `public.case_documents` (AFTER INSERT OR UPDATE) para registrar cambios de estado (VALIDATED/OBSERVED) y notas en `audit_logs` con `user_id`, `old_data` y `new_data`. |
| `20260926020000_external_filings_and_templates_schema.sql` | 2026-09-26 | Staging (Cloud) | Verificado OK (Verify #12) | Aplicada manualmente por el operador en Staging. Tablas `external_entities`, `case_filings`, `document_fields`, `templates`, `template_fields` con RLS habilitada. Extensión `btree_gist` y restricción `EXCLUDE` sobre vigencias no solapadas en `templates`. Bucket privado `templates` blindado a `service_role`. Trigger `trg_audit_case_filings` conectado a `audit_logs`. Función `add_business_days` con tolerancia a tabla `holidays` vacía. Parámetro `filings.publication_wait_business_days` en `setting_definitions` y `system_settings`. |
| `20260927000000_document_rules_and_recommendations_schema.sql` | 2026-09-26 | Staging (Cloud) | Verificado OK (Verify #13) | Aplicada manualmente por el operador en Staging. Tablas `document_rules` y `ai_recommendations` con RLS habilitada y optimizada con `(select ...)`. Triggers `trg_audit_document_rules` y `trg_audit_ai_recommendations` conectados a `private.tg_audit_log`. Permiso `ai.use` asignado a rol `LAWYER`. Restricción `CHECK` `ck_ai_recommendations_model_provider` forzando `RULES_ONLY`. Carga de las 7 reglas semilla de `00-maestro` §4.4 asociadas a versión 1 de `SUCESION_INTESTADA_NOTARIAL`. |
| `20260927100000_generation_jobs_schema.sql` | 2026-09-27 | Staging (Cloud) | Verificado OK | Tablas `generation_jobs` y `generated_documents`, enum `gen_status`, trigger `tg_audit_log`, RLS estricta. |
| `20260928000000_generation_jobs_security_hardening.sql` | 2026-09-28 | Staging (Cloud) | Verificado OK | Hardening de RLS para generation jobs y ruta de aprobación. |
| `20260928110000_cash_management_schema.sql` | 2026-09-28 | Staging (Cloud) | Pendiente aplicación | Tablas `cash_accounts`, `cash_periods`, `cash_requests`, `cash_movements`, `cash_reconciliations`, vista `cash_account_balances`, bucket `cash-support`, triggers inmutabilidad y control dual, permisos `cash.*` y flag `module.cash`. |

---

## Resumen de Estado de Migraciones (Sprint 11)

- **Total de migraciones en repositorio (`supabase/migrations/`):** 17
- **Total de migraciones aplicadas en Staging:** 16
- **Total de migraciones verificadas con `verify.sql`:** 16
- **Migraciones pendientes por aplicar:** 1 (`20260928110000_cash_management_schema.sql`)
- **Fecha de última verificación:** 2026-09-28
- **Próximas migraciones:** N/A (Sprint 11 en curso).

### Procedimiento de comprobación en SQL Editor de Supabase (Catálogo de Objetos):
```sql
with migration_check as (
  select '20260924000000_initial_schema' as migration,
         exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'audit_logs') as applied
  union all
  select '20260924100000_identity_and_roles',
         exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'roles')
  union all
  select '20260924110000_security_hardening',
         exists(select 1 from pg_proc where proname = 'has_permission')
  union all
  select '20260924120000_settings_and_catalogs',
         exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'holidays')
  union all
  select '20260924130000_settings_seeds',
         exists(select 1 from public.catalog_items limit 1)
  union all
  select '20260925100000_cases_and_persons_schema',
         exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'cases')
  union all
  select '20260925110000_workflow_and_models_seeds',
         exists(select 1 from public.case_models where code = 'SUCESION_INTESTADA_NOTARIAL')
  union all
  select '20260925120000_fix_persons_rls_unassigned',
         exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'persons' and column_name = 'created_by')
  union all
  select '20260925130000_case_parties_and_estate_schema',
         exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'case_parties')
  union all
  select '20260925140000_case_comments_and_search_schema',
         exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'case_comments')
  union all
  select '20260926000000_storage_and_documents_schema',
         exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'case_documents')
  union all
  select '20260926010000_case_documents_audit_trigger',
         exists(select 1 from pg_trigger where tgname = 'trg_audit_case_documents')
  union all
  select '20260926020000_external_filings_and_templates_schema',
         exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'case_filings')
         and exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'templates')
         and exists(select 1 from pg_extension where extname = 'btree_gist')
  union all
  select '20260927000000_document_rules_and_recommendations_schema',
         exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'document_rules')
         and exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'ai_recommendations')
  union all
  select '20260928110000_cash_management_schema',
         exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'cash_accounts')
         and exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'cash_movements')
         and exists(select 1 from information_schema.views where table_schema = 'public' and table_name = 'cash_account_balances')
)
select 
  migration,
  case when applied then 'OK - Aplicada y Activa' else 'PENDIENTE' end as estado
from migration_check
order by migration asc;

-- 2. Confirmación funcional de la migración de Caja Chica (Sprint 11)
-- Ejecutar el contenido de:
-- supabase/verify/20260928110000_cash_management_schema.verify.sql
-- Debe retornar: 'VERIFICACIÓN EXITOSA: Tablas de caja chica con RLS, libro inmutable, control dual de arqueo, bucket cash-support y feature flag module.cash activos.'
```
