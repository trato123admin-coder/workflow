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
| `20260925120000_fix_persons_rls_unassigned.sql` | 2026-09-25 | Staging (Cloud) | Pendiente de confirmación verify | Directorio compartido de personas sin casos asociados (Opción A), columna `created_by` para trazabilidad y actualización de `private.can_access_person`. |

