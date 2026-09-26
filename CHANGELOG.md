# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

### Sprint 4b — Tableros, búsqueda, actividad y rendimiento

#### Agregado

- **Base de Datos & Seguridad (Supabase):**
  - Migración `20260925140000_case_comments_and_search_schema.sql`:
    - Tabla `case_comments` con RLS habilitada (`comments_select_policy`, `comments_insert_policy`, `comments_update_policy`), sujeta a `private.can_access_case()`, permisos `cases.read.assigned`/`cases.write.assigned` y flag `module.case_comments`.
    - Función RPC `public.global_search(_query text, _limit integer)` con `SECURITY DEFINER`, filtrado estricto por `private.can_access_case()` para casos y `private.has_permission('clients.read') AND private.can_access_person()` para personas (coincidiendo con las políticas de tabla del Sprint 3).
    - Función RPC `public.duplicate_case(_source_case_id, _title, _include_parties, _copy_heir_shares)`: clonación controlada y atómica de expedientes, con reasignación del creador y clonación condicional de intervinientes y cuotas sucesorias (activos y pasivos excluidos por diseño para no arrastrar bienes ni deudas de forma automática).
    - Disparador de auditoría automática `private.tg_audit_log()` conectado a `case_comments`.
  - Script de verificación `20260925140000_case_comments_and_search_schema.verify.sql` (11 comprobaciones de integridad).
  - Suite de pruebas pgTAP `supabase/tests/database/07_comments_and_search.test.sql` con 24 pruebas automatizadas exitosas.
- **Paquete Compartido (`@workflow/shared`):**
  - Diccionario canónico de métricas y KPI (`packages/shared/src/kpis.ts`):
    - Función pura `computeKpis()` para cálculo unificado de métricas de expediente (Total casos, Activos, Concluidos, Detenidos/Bloqueados, Alerta Semáforo, Fuera de SLA, Avance promedio).
    - Función `computeStatusDistribution()` para consolidación de estados en categorías semánticas (`PENDING`, `IN_PROGRESS`, `BLOCKED`, `DONE`, `CANCELLED`).
    - Función `computeProcessFunnel()` para embudo de avance de procesos sucesorios.
    - Función `computeAnalystWorkload()` para balanceo de carga de trabajo por analista/gestor.
    - 6 pruebas unitarias completas en Vitest verificando consistencia matemática transversal entre tarjetas y gráficos.
- **Aplicación Web (`apps/web`):**
  - Tablero de Dirección / Admin (`AdminDashboard.tsx`, Mockup 1):
    - 4 tarjetas KPI principales (`KpiCard`), gráfico de dona de distribución de estados (`StatusDonutChart.tsx`), embudo de procesos sucesorios (`ProcessFunnelWidget.tsx`) y carga por analista (`AnalystWorkloadWidget.tsx`).
  - Tablero de Operaciones / Gestor (`GestorDashboard.tsx`, Mockup 2):
    - 4 tarjetas operativas (`Mis casos activos`, `En curso`, `Alertas semáforo`, `Fuera de SLA`), selector de vista Kanban / Tabla, y conmutador de perfil en cabecera persistido en `user_preferences`.
  - Diálogo de Búsqueda Global Ctrl+K (`GlobalSearchDialog.tsx`):
    - Búsqueda con debounce (300 ms), navegación por teclado (flechas y Enter), iconos semánticos por tipo de entidad y badges de estado y vía procesal.
    - Acceso rápido integrado en `Topbar.tsx`.
  - Duplicación de Expedientes (`DuplicateCaseDialog.tsx`):
    - Modal accesible integrado en `CaseHeader.tsx` con opciones para transferir causante, herederos y cuotas hereditarias.
  - Pestaña de Actividad y Línea de Tiempo (`CaseActivityTab.tsx`, `ActivityTimelineItem.tsx`):
    - Vista unificada en tiempo real de eventos del sistema (`case_events`) y comentarios con menciones (`case_comments`).
    - Formulario reactivo para publicar notas y comentarios internos con permisos validados.
  - Bandeja "Qué hago hoy" (`TodayTasksWidget.tsx`):
    - Widget operativo que prioriza casos detenidos, advertencias de semáforos (`get_case_semaphore_warnings`) y vencimientos de SLA.
- **Rendimiento & Validación a Escala Real (`scripts/`):**
  - Script de generación sintética `scripts/seed-load.ts`:
    - Generación masiva de **10 000 casos**, 100 personas, 20 009 partes, 20 bienes y 110 000 procesos (140 129 filas totales).
    - Caso benchmark completo con 10 herederos, 20 bienes y 11 procesos.
    - Consumo atómico y seguro de números consecutivos desde `case_counters` (`private.next_case_number()`).
    - Aislamiento absoluto con flag `custom_data: { is_synthetic: true }`.
  - Script de limpieza segura `scripts/seed-clean.ts`:
    - Eliminación en cascada de datos sintéticos con verificación de 0 casos y 0 personas residuales, sin alterar contadores de producción.
  - Script de validación de latencia `scripts/benchmark-perf.ts`:
    - Consulta concurrente de ficha completa (caso + intervinientes + bienes + procesos + advertencias de semáforo).
    - **Resultado en Staging sobre 10 000 casos:** **p95 = 373.4 ms** (objetivo p95 < 2 000 ms superado ampliamente).

### Sprint 4a — Intervinientes, patrimonio, semáforos y asistente de 5 pasos

#### Agregado

- **Base de Datos & Seguridad (Supabase):**
  - Migración `20260925130000_case_parties_and_estate_schema.sql`:
    - Tablas `case_parties`, `case_assets` y `case_liabilities` con RLS habilitada y políticas gobernadas por permisos (`parties.read`, `parties.write`, `estate.read`, `estate.write`) y feature flags (`module.case_parties`, `module.estate_inventory`).
    - Índice único parcial `one_causante_per_case` en `case_parties` para garantizar máximo un causante activo por expediente.
    - Restricción CHECK `chk_case_assets_bank_account_digits`: regla no negociable que obliga a que cuentas bancarias (`CUENTA_BANCARIA`) solo almacenen hasta 4 dígitos exactos en `registry_ref` (nunca números completos ni CCI).
    - Extensión atómica de `public.create_case_from_model`: instanciación transaccional completa del expediente, equipo asignado, causante e intervinientes iniciales en una sola llamada segura ante concurrencia.
    - Función de semáforos de base de datos `public.get_case_semaphore_warnings` con verificación obligatoria de acceso (`private.can_access_case`) para detección segura de inconsistencias (menores sin tutor, cuotas != 100%, causante sin defunción).
    - Disparador de auditoría automática `private.tg_audit_log()` conectado a las nuevas entidades.
  - Script de verificación `20260925130000_case_parties_and_estate_schema.verify.sql` (7 comprobaciones de integridad).
  - Suite de pruebas pgTAP `supabase/tests/database/06_case_parties_and_estate.test.sql` con 25 pruebas automatizadas exitosas (incluye rechazo a usuarios no autorizados).
- **Paquete Compartido (`@workflow/shared`):**
  - Esquemas de dominio y validaciones Zod para intervinientes y cuotas sucesorias (`case-parties.ts`).
  - Esquemas para inventario patrimonial de activos y pasivos con cálculo de balance neto (`case-estate.ts`).
  - Lógica pura de semáforos y validaciones de negocio: `validateHeirSharesSum`, `validateMinorRepresentation`, `validateCausanteDeathDate`, `validateBankAccountDigits`.
  - 13 pruebas unitarias adicionales en Vitest cubriendo herederos, patrimonio y semáforos (48 pruebas totales en `@workflow/shared`).
- **Aplicación Web (`apps/web`):**
  - Asistente de creación de expedientes en 5 pasos (`CaseWizardModal.tsx`): datos generales, causante, modelo versionado, intervinientes iniciales y confirmación atómica.
  - Pestaña "Intervinientes" en detalle de caso (`CasePartiesTab.tsx`): tarjeta de causante, listado de herederos, barra de distribución de cuotas (100%) y modales de edición con asignación de representantes legales a menores.
  - Pestaña "Patrimonio" en detalle de caso (`CaseEstateTab.tsx`): resumen financiero (activo bruto, pasivo total, patrimonio neto), listados de bienes y deudas, y modales con validación estricta de 4 dígitos bancarios.
  - Badges visuales de semáforo reactivo en la cabecera del expediente (`/cases/[id]`) y en las tarjetas del tablero.
  - Componentes modulares de tablero Kanban (`CaseKanbanBoard.tsx`, `CaseCard.tsx`, `CasesTable.tsx`).
- **Documentación:**
  - Actualización de `docs/db-migrations-log.md` tras confirmación de ejecución exitosa en staging.

### Sprint 3 — Casos, modelos versionados, avance ponderado y compuertas

#### Agregado

- **Base de Datos & Seguridad (Supabase):**
  - Migración `20260925100000_cases_and_persons_schema.sql`:
    - Tablas de dominio: `persons`, `cases`, `case_assignments`, `process_definitions`, `workflow_statuses`, `case_models`, `case_model_versions`, `case_model_processes`, `case_model_process_deps`, `case_processes` y `case_events`.
    - RLS activada en las 11 tablas con validación granular de permisos (`cases.read.assigned`, `cases.write.assigned`, `cases.read.all`, `clients.read`, `clients.write`).
    - Disparadores de inmutabilidad en versiones de modelo publicadas (`PUBLISHED`), validación de suma exacta de pesos al 100.00% e inmutabilidad en `case_events`.
    - Disparador de cálculo automático del avance ponderado (`current_progress`) en `cases` basado en pesos de procesos finalizados.
    - Disparador de compuerta de dependencias M1 (`trg_guard_case_process_dependencies`) y función de compuerta de cierre `public.close_case()`.
    - Función transaccional atómica `public.create_case_from_model()`.
  - Migración `20260925110000_workflow_and_models_seeds.sql`:
    - Semillas de estados de workflow con categorías semánticas (`PENDING`, `IN_PROGRESS`, `BLOCKED`, `DONE`, `CANCELLED`).
    - 11 definiciones canónicas de procesos sucesorios.
    - 5 modelos de casos iniciales, destacando `SUCESION_INTESTADA_NOTARIAL` (v1 publicada, 11 procesos, pesos al 100.00%).
  - Migración `20260925120000_fix_persons_rls_unassigned.sql`:
    - Actualización de `private.can_access_person` para permitir lectura de personas de directorio sin casos asociados.
  - Scripts de verificación: `20260925100000_cases_and_persons_schema.verify.sql`, `20260925110000_workflow_and_models_seeds.verify.sql` y `20260925120000_fix_persons_rls_unassigned.verify.sql`.
  - Suite pgTAP `supabase/tests/database/05_cases_and_persons.test.sql` con 28 pruebas automatizadas.
- **Paquete Compartido (`@workflow/shared`):**
  - Esquemas y validaciones Zod para personas, DNI (8 dígitos) y RUC con algoritmo Módulo 11 (`persons.ts`).
  - Esquemas de creación de expedientes con asistente de 3 pasos y actualización de estado de procesos (`cases.ts`).
  - Pruebas unitarias para personas y casos (13 pruebas nuevas, 35 en total).
- **Aplicación Web (`apps/web`):**
  - Directorio de Personas (`/persons`): listado responsivo, filtros y modal dinámico para persona natural y jurídica (`PersonModal.tsx`).
  - Selector reutilizable de personas (`PersonPicker.tsx`).
  - Gestión de Modelos y Procesos en `/settings?tab=workflow`: visualización de modelos, versiones y tabla de procesos con candado para versiones publicadas.
  - Vista general de expedientes (`/cases`): lista con filtros por vía procesal y prioridad, barra de progreso ponderado y modal de asistente en 3 pasos (`CaseWizardModal.tsx`).
  - Vista de detalle de expediente (`/cases/[id]`): cabecera con avance reactivo y tabla de procesos con compuertas de dependencias M1 integradas.
- **Documentación:**
  - `docs/adr/ADR-002-modelos-avance-ponderado-y-compuertas.md`.
  - Actualización de `docs/db-migrations-log.md` y `docs/02-plan-sprints.md`.

### Sprint 2 — Configuración, catálogos y feature flags

#### Agregado

- Catálogos del sistema, configuración dinámica (`system_settings`), feature flags con resolución de entorno, campos personalizados e historial inmutable (`settings_history`).
- Pantallas de configuración en `/settings` (general, catálogos, flags, campos personalizados y días no laborables).

### Sprint 1 — Identidad, seguridad y sistema de diseño

#### Agregado

- **Base de Datos & Seguridad (Supabase):**
  - Migración `20260924100000_identity_and_roles.sql`:
    - Tablas de identidad: `profiles` (vinculada a `auth.users`), `roles`, `permissions`, `role_permissions` y `user_roles`. Todas con RLS activada.
    - Catálogo canónico de 40 permisos del sistema según `00-maestro.md §3.3` y `v2.1 §3.8`.
    - 5 roles base sembrados: `ADMIN` (Superusuario con MFA obligatoria), `ANALYST` (Gestor), `LAWYER` (Abogado), `CONSULT` (Consulta) y `CASHIER` (Caja Chica).
    - Apertura mínima del esquema `private` (`GRANT USAGE TO authenticated`).
    - Función de evaluación de seguridad `private.has_permission(_perm)` (`SECURITY DEFINER`, `search_path = ''`). Las políticas RLS evalúan permisos, no nombres de rol.
    - Trigger `private.handle_new_user()` que crea el perfil automáticamente al registrarse en `auth.users`.
    - Trigger de seguridad `private.prevent_last_admin_removal()` que impide desactivar al último administrador activo, quitarle el rol ADMIN o alterar el rol ADMIN del sistema.
  - Script de verificación de solo lectura: `supabase/verify/20260924100000_identity_and_roles.verify.sql`.
  - Suite de pruebas de seguridad pgTAP: `supabase/tests/database/02_identity_and_roles.test.sql`.
  - Guía de aprovisionamiento del primer administrador: `docs/first-admin-setup.md`.
  - Bitácora de migraciones: `docs/db-migrations-log.md`.
- **Paquete Compartido (`@workflow/shared`):**
  - Catálogo canónico y constantes de permisos y roles (`permissions.ts`).
  - Esquemas de validación Zod para inicio de sesión, recuperación de contraseña, verificación MFA, creación y edición de usuarios y roles (`auth.ts`).
  - Constantes de auditoría e interfaces de eventos (`audit.ts`).
  - Pruebas unitarias para esquemas y constantes.
- **Aplicación Web (`apps/web`):**
  - Cliente de Supabase para navegador (`lib/supabase/client.ts`), servidor con cookies Next.js 15 (`lib/supabase/server.ts`) y middleware de sesión (`lib/supabase/middleware.ts` y `middleware.ts`).
  - Rutas de autenticación con diseño accesible y tokens DocuAI:
    - `/login`: formulario con validación Zod y redirección automática si requiere MFA.
    - `/forgot-password`: solicitud de enlace de recuperación.
    - `/reset-password`: cambio de contraseña seguro.
    - `/mfa/verify`: desafío de código TOTP (6 dígitos) para sesión AAL2.
    - `/mfa/enroll`: registro de nuevo factor TOTP con código QR y clave manual.
    - `/auth/callback` y `/auth/signout`: manejadores de sesión y cierre de sesión.
  - Componentes del Sistema de Diseño (DocuAI tokens, Inter, temas Claro y Oscuro con `data-theme`):
    - `AppShell`: contenedor principal con barra superior, navegación responsiva y barra inferior para móviles (< 768px).
    - `Sidebar`: barra lateral azul marino oscuro con filtrado de navegación por permisos (`01-anexo` A.3).
    - `Topbar`: barra superior con buscador global (Ctrl+K), selector de tema claro/oscuro y perfil de usuario.
    - `BottomNav`: barra de navegación inferior táctil para dispositivos móviles.
    - `StatusBadge`: insignias semánticas con icono y texto para accesibilidad AA.
    - `KpiCard`: tarjetas métricas con valores, iconos y variación porcentual.
    - `DataTable`: tabla tipada responsiva con ordenamiento, búsqueda, paginación y vista alternativa en tarjetas para móviles.
    - `Tabs`, `Stepper`, `FormField`, `EmptyState`, `Skeleton` y `Modal`.
    - Página de catálogo de componentes `/design-system` para desarrollo y validación.
  - Pantalla de Gestión de Usuarios y Roles (`/users`, Mockup 8):
    - Pestaña de Usuarios: tabla con avatar, roles, estado MFA, toggle de activación protegido y acciones. Modal para invitar nuevo usuario.
    - Pestaña de Roles: selector de rol y matriz editable de permisos agrupada por módulos con protección especial de superusuario en ADMIN. Modal para crear roles personalizados.

## [0.1.0] - 2026-09-24

### Sprint 0 — Fundaciones

#### Agregado

- **Monorepo pnpm:** Configuración multi-paquete con `apps/web`, `services/engine` y `packages/shared`.
- **Tooling:** TypeScript estricto (`tsconfig.base.json`), ESLint, Prettier y escaneo de secretos con Gitleaks.
- **Base de Datos (Supabase):**
  - Extensiones `pgcrypto`, `pg_trgm`, `unaccent` y `vector`.
  - Esquema `private` con acceso revocado a roles públicos.
  - Funciones de seguridad `private.set_updated_at()` y `private.raise_immutable()`.
  - Contador de casos seguro ante concurrencia `case_counters` y función `private.next_case_number()`.
  - Tablas base `audit_logs` (append-only) y `job_queue` (con estado enum y cola indexada).
  - RLS obligatoria en el 100% de tablas públicas.
- **Pruebas de Seguridad (pgTAP):** Suite en `supabase/tests/database/01_rls_enforcement.test.sql` que audita automáticamente la presencia de RLS en toda tabla de `public`, revoca privilegios a `anon`/`authenticated` y prueba la inmutabilidad de la auditoría.
- **Engine (Fastify):**
  - Endpoints de salud `/healthz` y `/readyz`.
  - Logger estructurado JSON con `request_id` trazable.
  - Validación de variables de entorno en arranque con Zod.
  - Dockerfile multi-etapa con usuario no-root.
- **Web (Next.js):**
  - Next.js App Router con Tailwind CSS y variables de diseño compatibles con DocuAI.
  - Internacionalización con `next-intl` (localización inicial `es-PE`).
  - Página `/health` de diagnóstico visual y endpoint `/api/health`.
- **CI / CD:**
  - Pipeline de GitHub Actions en `.github/workflows/ci.yml` ejecutando lint, typecheck, vitest, gitleaks y pgTAP.
  - Manifiesto `render.yaml` para despliegue automatizado en Render con health check `/healthz`.
- **Documentación:**
  - `README.md`, `CONTRIBUTING.md`, `ADR-001-arquitectura.md` y `docs/staging-guide.md`.
  - Especificación técnica de APIINTI en `docs/integrations/apiinti.md`.
