# Plan de Sprints para Antigravity
## Sistema de Gestión de Casos Sucesorios y Trámites Documentarios

**Versión:** 1.0 · **Fecha:** 23 de septiembre de 2026
**Ubicación en el repo:** `docs/02-plan-sprints.md`
**Base:** `00-maestro`, `01-anexo-diseno-almacenamiento`, `v2.1`, `v2.0`, `v1` y `docs/design/docuai-mockups.png`

> Este documento **ordena y empaqueta** el trabajo en sprints. **No redefine requisitos:** cada ítem remite a la sección del documento que lo especifica. Si el contenido de un ítem difiere de su documento fuente, gana el documento fuente (precedencia: `00-maestro` > `01-anexo` > `v2.1` > `v2.0` > `v1`).

---

## 1. Cómo usar este plan

1. **Un sprint = una rama = una conversación con el agente.** Rama `feat/sprint-N-tema`. No se empieza un sprint sin cerrar el anterior.
2. Cada sprint termina con algo **demostrable en staging** (guion de demo incluido).
3. Los ítems tienen ID (`S3-05`) para pedirle al agente exactamente lo que necesitas y para trazar avances.
4. El tamaño es **relativo** (S, M, L, XL), no una promesa de tiempo. El ritmo real depende de cuánto revises entre sprints. **Si el plan que propone el agente supera ~12 ítems, divide el sprint en `a` y `b`.**
5. Todo sprint arranca en modo **planificación**: el agente presenta su plan y **tú lo apruebas** antes de que escriba código.

### 1.1 Ciclo de cada sprint

| Paso | Qué ocurre | Quién |
|---|---|---|
| **Planificación** | El agente lee los documentos indicados y presenta el plan por ítems | Agente → **tú apruebas** |
| **Construcción** | Implementa en la rama, con migraciones, pruebas y documentación | Agente |
| **Revisión** | Revisas **migraciones SQL, políticas RLS** y las pantallas contra el mockup | **Tú** (o un revisor técnico) |
| **Demo** | Ejecutas el guion de demo en staging | Tú |
| **Cierre** | PR fusionado, `CHANGELOG` y ADR actualizados; decisiones nuevas anotadas | Agente + tú |

### 1.2 Definición de "listo para empezar" (DoR)

- [ ] El sprint anterior está cerrado y fusionado.
- [ ] Están disponibles los documentos y decisiones que el sprint necesita (ver "Precondiciones").
- [ ] Staging funciona (web, engine y Supabase) y el CI está en verde.

### 1.3 Definición de "hecho" global (DoD) — aplica a **todos** los sprints

- [ ] `lint`, `typecheck` y pruebas unitarias en verde.
- [ ] Toda tabla nueva de `public` tiene **RLS, políticas y prueba pgTAP** (el CI falla si falta alguna).
- [ ] Migraciones nuevas (nunca se edita una ya aplicada); esquema solo por migraciones.
- [ ] **Ninguna lista de negocio escrita en el código**: sale de catálogos, estados o settings (`v2.1` §1).
- [ ] Todo elemento configurable tiene toggle `is_active`.
- [ ] Textos en español (es-PE) por i18n; código en inglés.
- [ ] Pantallas **responsive** (móvil primero), con estados vacío, carga y error, y `axe` sin errores críticos.
- [ ] Componentes y colores desde **tokens** (`01-anexo` A.8); revisado contra el mockup cuando aplique.
- [ ] Sin secretos en el repositorio (escáner en CI); `.env.example` actualizado.
- [ ] El guion de demo pasa en staging.
- [ ] `CHANGELOG` actualizado y un **ADR** si se tomó una decisión de arquitectura.

### 1.4 Plantilla de prompt (se repite en cada sprint)

```text
Lee AGENTS.md y docs/02-plan-sprints.md (Sprint <N>). Lee también las secciones de referencia indicadas en ese sprint.
Objetivo: Sprint <N> — <nombre>. Rama: feat/sprint-<N>-<tema>.

1) Presenta un plan por pasos con los ítems S<N>-xx y espera mi aprobación. No escribas código antes.
2) Implementa SOLO los ítems de este sprint. Si algo cae fuera del alcance, anótalo y no lo hagas.
3) Migraciones nuevas, RLS con pruebas pgTAP, tipos generados, pruebas unitarias y e2e cuando apliquen.
4) No toques producción. No pidas ni escribas claves reales; usa .env.example.
5) Detente y pregunta si una regla es ambigua o contradice otro documento.

Al terminar entrega: checklist de aceptación marcado, comandos para verificarlo, guion de demo ejecutado,
y una lista de decisiones tomadas y riesgos encontrados.
```

---

## 2. Tablero general

| Sprint | Nombre | Se entrega (demostrable) | Fase de origen | Tamaño | Depende de | Hito |
|---|---|---|---|---|---|---|
| **0** | Fundaciones | Repo, CI, staging desplegado, RLS vigilada | 0 | M | — | |
| **1** | Identidad, seguridad y sistema de diseño | Login con MFA, usuarios, roles y permisos, shell y componentes | 1A | L | 0 | |
| **2** | Settings, catálogos y toggles | Configuración sin código: catálogos, módulos, campos, tema | 1B | L | 1 | |
| **3** | Personas y casos (núcleo) | Modelos versionados, casos, procesos y avance ponderado | 2a | XL | 2 | |
| **4** | Intervinientes, patrimonio y tableros | Herederos, bienes, validaciones, dashboards, Kanban, búsqueda | 2b | XL | 3 | |
| **5** | Documentos y almacenamiento | Subida, versionado, checklist por persona/bien, biblioteca | 3a | L | 4 | |
| **6** | Trámites externos y plantillas | Notaría/SUNARP con plazos en días útiles; plantillas con lint | 3b | M | 5 | |
| **7** | Reglas y generación de documentos | DSL, simulador, Word/PDF, aprobación, asistente en modo reglas | 4 | XL | 6 | **M1 · MVP** |
| **8** | Automatización I | Cola de trabajos, alertas, notificaciones, resumen matutino | 5a | M | 7 | |
| **9** | Integraciones y continuidad | APIINTI, Telegram, recurrencia, monitoreo, respaldo cifrado | 5b | L | 8 | **M2** |
| **10** | Cotizaciones y reportes | Proveedores, comparación histórica, reportes y exportación | 6 | M | 9 | |
| **11** | Caja chica | Libro inmutable, solicitudes, arqueo y cierre | 8 | L | 10 | **M3** |
| **12** | IA *(condicional a D3)* | Recomendador reglas-primero con IA y base de conocimiento | 7 | L | 11 y D3 | |
| **13** | Endurecimiento y salida a producción | Rendimiento, seguridad, restauración probada, go-live | 9 | M | 12 (o 11) | **M4** |

**Hitos**
- **M1 (fin del Sprint 7): MVP usable** en staging, sin IA. Piloto con **datos de prueba**.
- **M2 (fin del Sprint 9):** operación automatizada y con respaldo probado.
- **M3 (fin del Sprint 11):** producto completo sin IA.
- **M4 (fin del Sprint 13):** listo para **datos reales** (requiere cumplir la lista go-live del Sprint 13).

*Cambio respecto al plan por fases: la **Caja chica (Sprint 11) va antes de la IA (Sprint 12)** porque es independiente, ya está en el diseño y la IA depende de la decisión D3 y de tener historial. Si la caja es prioritaria, puede adelantarse tras el Sprint 4 sin afectar lo demás.*

---

# SPRINT 0 — Fundaciones

**Objetivo:** dejar una base ejecutable, desplegable y vigilada por el CI.
**Leer:** `00-maestro` §0, §1, §8 · `v2` §2, §4.1, §11, §12 · `v2.1` §1, §5.

**Alcance**

| ID | Ítem |
|---|---|
| S0-01 | Monorepo pnpm: `apps/web`, `services/engine`, `packages/shared`, `supabase/`. TypeScript estricto, ESLint, Prettier |
| S0-02 | Supabase local (CLI). Migración base: extensiones (`pgcrypto`, `pg_trgm`, `unaccent`, `vector`), esquema `private`, `set_updated_at`, `raise_immutable`, `audit_logs` (append-only), `job_queue`, `case_counters` y `next_case_number` |
| S0-03 | `engine` (Fastify): `/healthz`, `/readyz`, validación de variables de entorno con zod, logger JSON con `request_id`, `Dockerfile` base |
| S0-04 | `web` (Next.js App Router): Tailwind, shadcn/ui, next-intl es-PE, página `/health` |
| S0-05 | CI en GitHub Actions: lint, typecheck, vitest, `supabase db reset` + `supabase test db`, escáner de secretos |
| S0-06 | Prueba pgTAP que **falla si alguna tabla de `public` no tiene RLS** |
| S0-07 | Despliegue a staging: Vercel (web), Render gratuito (engine), proyecto Supabase de staging; variables por entorno; `.env.example` |
| S0-08 | `README`, `CONTRIBUTING`, `CHANGELOG`, `docs/adr/ADR-001-arquitectura.md` |

**Fuera de alcance:** LibreOffice en el `Dockerfile` (Sprint 7), cualquier tabla de negocio.

**Precondiciones:** lista de arranque de `00-maestro` §8.1 completada (repo privado, proyectos Supabase, Vercel y Render creados).

**Criterios de aceptación:** `pnpm dev` levanta todo · CI verde · staging responde `/health` y `/healthz` · crear una tabla sin RLS hace fallar el CI.

**Demo:** clonar el repo limpio → `pnpm install && pnpm dev` → abrir `/health` local y en staging → mostrar el CI fallando al agregar una tabla sin RLS y verde al corregirla.

**Prompt:** usar la plantilla 1.4 con `N = 0` y `tema = fundaciones`. Nota específica: *"El engine solo necesita los endpoints de salud por ahora. No agregues tablas de negocio."*

---

# SPRINT 1 — Identidad, seguridad y sistema de diseño

**Objetivo:** que las personas puedan entrar de forma segura y que exista el lenguaje visual base.
**Leer:** `v2` §5, §12 · `v2.1` §3.8 · `00-maestro` §3.3 · `01-anexo` Parte A · `docs/design/docuai-mockups.png` (pantalla 8).

**Alcance**

| ID | Ítem |
|---|---|
| S1-01 | Supabase Auth (correo y contraseña), sesión con `@supabase/ssr`, cierre de sesión, recuperación de contraseña |
| S1-02 | MFA TOTP (alta y verificación). Columna `roles.requires_mfa`; en Sprint 2 pasa a gobernarse también por toggles |
| S1-03 | Tablas `profiles`, `roles` (`is_system`, `is_superuser`, `requires_mfa`), `permissions`, `user_roles`, `role_permissions`. Semilla: catálogo completo de permisos (`v2.1` §3.8 + `00-maestro` §3.3) y 5 roles (`ADMIN`, `ANALYST`→Gestor, `LAWYER`→Abogado, `CONSULT`, `CASHIER`→Caja Chica) con permisos por defecto |
| S1-04 | Función `private.has_permission()`. **La RLS usa permisos, no nombres de rol** |
| S1-05 | Trigger que impide desactivar o quitar el rol al **último administrador** |
| S1-06 | Pantallas de administración: usuarios (crear/invitar, activar/desactivar, asignar roles, ver/restablecer MFA, cerrar sesiones) y roles (matriz de permisos editable) |
| S1-07 | Auditoría base: inicios de sesión y cambios de usuarios, roles y permisos (desde la capa API) |
| S1-08 | **Sistema de diseño**: tokens CSS, temas Claro y Oscuro por `data-theme`, componentes de `01-anexo` A.5 (AppShell, Sidebar por permisos, Topbar, KpiCard, StatusBadge, DataTable, Tabs, Stepper, FormField, EmptyState, Skeleton), página `/design-system` solo en desarrollo |
| S1-09 | Pantallas: login, MFA y **Gestión de Usuarios** (mockup 8, con ajustes A.7 #9); shell responsive con barra inferior en móvil |

**Fuera de alcance:** `can_access_case` (se crea con los casos, Sprint 3), catálogos y toggles (Sprint 2).

**Criterios de aceptación:** login con MFA · ADMIN crea usuarios y roles nuevos con permisos elegidos · el último ADMIN no puede desactivarse · la navegación se filtra por permisos · capturas de escritorio y móvil coinciden en estructura con el mockup · `axe` sin errores críticos.

**Pruebas:** pgTAP (matriz rol × tabla × operación de las tablas nuevas; último admin; rol nuevo funcional) · e2e de login + MFA · capturas visuales de shell y Usuarios.

**Demo:** entrar como ADMIN con MFA → crear el rol "Supervisor" con 3 permisos → crear un usuario con ese rol → entrar con él y comprobar que solo ve lo permitido → intentar desactivar al único ADMIN (debe fallar).

**Prompt:** plantilla 1.4 con `N = 1`. Nota específica: *"Abre docs/design/docuai-mockups.png. Colores y tamaños solo desde tokens. No escribas nombres de rol en las políticas RLS."*

---

# SPRINT 2 — Settings, catálogos y toggles

**Objetivo:** que casi todo se pueda cambiar desde la interfaz, sin desplegar código.
**Leer:** `v2.1` §1, §2, §3 (completo) · `00-maestro` §4.5 · `01-anexo` A.7 #8, #12 (mockup 7).

**Alcance**

| ID | Ítem |
|---|---|
| S2-01 | `catalogs` y `catalog_items` (`item_schema` valida `metadata`), patrón de FK compuesta a catálogos y trigger que impide asignar elementos inactivos |
| S2-02 | `feature_flags` con dependencias y `requires_config`; función `private.feature_enabled()`; **respuesta 403 `feature_disabled` en el engine**; ocultamiento en UI; las políticas RLS de módulos futuros la usarán |
| S2-03 | `setting_definitions`, `system_settings` y `settings_history` (append-only); formularios de Settings **generados desde las definiciones** |
| S2-04 | `custom_field_definitions` + `validate_custom_data()` + componente `FormField` dinámico |
| S2-05 | Semillas: catálogos (`v2.1` §3.2, `00-maestro` §4.5), flags (`v2.1` §3.5 + los de dominio), parámetros (`v2.1` §3.7), y tabla `holidays` **vacía y editable** (los feriados oficiales los carga el equipo desde la fuente oficial) |
| S2-06 | UI de Settings con las pestañas de `v2.1` §2: General, Apariencia, Módulos, Clientes, Casos, Workflow (esqueleto), Documentos (esqueleto), Usuarios y roles (reutiliza Sprint 1), Alertas, Caja (esqueleto), Integraciones (solo estado), Seguridad, Catálogos, Campos personalizados, Almacenamiento (esqueleto), Avanzado |
| S2-07 | Apariencia: selector de tema (Claro, Oscuro, Corporativo, Personalizado), vista previa en vivo, **validación de contraste AA**, `general.app_name` y logo (bucket público `logos`) |
| S2-08 | Editor genérico de catálogos: toggle `is_active`, candado en `is_system`, etiqueta "En uso (N)", código inmutable |
| S2-09 | `ConfirmImpactDialog` y registro de "resolutores de uso" (cada módulo registra cómo contar dónde se usa un elemento) |
| S2-10 | Exportar/importar configuración con *diff* previo; restaurar valores por defecto por pestaña |
| S2-11 | Toda modificación queda en `settings_history` con usuario, valores y motivo; `security.mfa_admin` y `security.mfa_cash` como flags |

**Fuera de alcance:** campos y catálogos propios del dominio sucesorio distintos de los listados (llegan con sus sprints), integraciones reales.

**Criterios de aceptación:** crear un elemento de catálogo y un campo personalizado desde la UI sin tocar código · apagar un flag oculta el módulo, responde 403 y **queda bloqueado por RLS**, conservando datos · no se puede apagar auditoría ni RLS · no se puede desactivar el valor por defecto de un catálogo obligatorio · exportar en staging e importar en un entorno limpio reproduce la configuración.

**Pruebas:** pgTAP de flags y RLS · pruebas unitarias de validación de `metadata` y de `validate_custom_data` · e2e del panel de Módulos · prueba de contraste del selector de tema.

**Demo:** crear el tipo de documento de identidad "PASAPORTE" activo y usarlo en un formulario → desactivarlo con el diálogo de impacto → agregar un campo personalizado "N.º de partida" y verlo en un formulario → apagar `module.cash` y comprobar 403 → exportar e importar la configuración.

**Prompt:** plantilla 1.4 con `N = 2`. Nota específica: *"Ningún listado de negocio va en el código. No guardes secretos en system_settings."*

---

# SPRINT 3 — Personas y casos (núcleo)

**Objetivo:** poder crear casos a partir de modelos versionados, con procesos y avance ponderado.
**Leer:** `00-maestro` §3.1–3.3, §4.1–4.2, §4.5 · `v2` §4, §5 · `v1` §7–10, §31–33, §48 · `01-anexo` A.4 (mockups 2 y 5).

**Alcance**

| ID | Ítem |
|---|---|
| S3-01 | `persons` con validación por catálogo (patrón, longitud, dígito verificador RUC), documento de identidad único y formulario dinámico según tipo de persona |
| S3-02 | `cases`, `case_assignments` (responsable, colaborador, abogado, VIEWER) y los campos de dominio (`client_person_id`, `parent_case_id`, `route`, `has_dispute`, `ai_allowed`, `is_confidential`, `last_activity_at`); uso de `next_case_number`; funciones `private.can_access_case`, `can_write_case`, `can_access_person`; RLS |
| S3-03 | `process_definitions`, `workflow_statuses` (con **categoría semántica**), `case_models`, `case_model_versions`, `case_model_processes` (peso, `sla_days`, `UNIQUE(versión, secuencia)`), `case_model_process_deps` |
| S3-04 | Administración de modelos: crear, clonar, **publicar (inmutable)**, editor de procesos (orden, pesos que suman 100, dependencias, SLA) y toggles. Sobre una versión publicada, el botón ofrece "Crear nueva versión con este cambio" |
| S3-05 | `case_processes` copiados desde la versión publicada; trigger de avance ponderado (`is_applicable`, `manual_progress`, `keeps_previous_progress`); estado del caso derivado de las categorías |
| S3-06 | `case_events` y `last_activity_at`; **compuertas de cierre** (M1) por dependencias (las de documentos se suman en el Sprint 5) |
| S3-07 | Semillas: los 5 modelos de `00-maestro` §4.1–4.2 (procesos, pesos y dependencias) y los estados de workflow con categoría |
| S3-08 | UI **Personas** (lista, ficha, alta y edición; el botón de consulta DNI/RUC queda deshabilitado hasta el Sprint 9) y **Casos** (lista con filtros persistentes en `user_preferences`, vistas tarjetas y lista) |
| S3-09 | Asistente "Nuevo caso" v1 (contratante → modelo → asignación) y **Detalle de caso** con Resumen y Procesos (mockup 5): cambio de estado de proceso con compuertas y "Cerrar caso" |

**Fuera de alcance:** causante, herederos y patrimonio (Sprint 4); documentos (Sprint 5); Kanban (Sprint 4).

**Criterios de aceptación:** pesos 20/30/30/20 con avances 100/80/40/0 dan **56,00** · una versión `PUBLISHED` no se puede editar · crear un caso desde un modelo publicado genera sus procesos y dependencias · no se puede iniciar o finalizar un proceso con dependencias abiertas · el gestor solo ve sus casos asignados; CONSULT no escribe · una persona solo es visible si figura en un caso accesible.

**Pruebas:** unitaria del avance (incluye N/A, *override* manual y `keeps_previous_progress`) · pgTAP de RLS de `cases`, `case_assignments`, `persons` · e2e de creación de caso.

**Demo:** crear una persona natural (DNI) → publicar el modelo `SUCESION_INTESTADA_NOTARIAL` → crear un caso asignado a un gestor → avanzar procesos y ver el % → intentar iniciar un proceso con dependencia abierta (se bloquea con el motivo) → entrar como otro gestor y no ver el caso.

**Prompt:** plantilla 1.4 con `N = 3`. Nota específica: *"Toca esquema y RLS: presenta primero las migraciones y políticas para mi revisión. Las categorías semánticas gobiernan la lógica, no las etiquetas."*

---

# SPRINT 4 — Intervinientes, patrimonio y tableros

**Objetivo:** modelar el caso sucesorio completo (personas, bienes, deudas) y dar visibilidad con tableros, Kanban y búsqueda.
**Leer:** `00-maestro` §3.2–3.5, §5, §10 · `01-anexo` A.4 (mockups 1 y 2), A.7 #4 · `v2` §3 (M2, M4–M6, M8).

**Alcance**

| ID | Ítem |
|---|---|
| S4-01 | `case_parties` (índice único de un solo causante activo) y pestaña **Personas**: causante, herederos, representantes, relación, estado del heredero, cuota, "representado por" |
| S4-02 | `case_assets` y `case_liabilities` con pestaña **Patrimonio** (totales por moneda). Cuentas bancarias: **solo últimos 4 dígitos** |
| S4-03 | Validaciones tipo semáforo (`00-maestro` §3.5) en `packages/shared`, con advertencias en la UI y las bloqueantes también en la base de datos |
| S4-04 | Asistente "Nuevo caso" completo de 5 pasos (contratante, causante, modelo, herederos opcionales, asignación) |
| S4-05 | **Kanban** de procesos (al mover se aplican compuertas y se muestra el motivo si se bloquea), vistas tarjetas y lista, componente `CaseCard` |
| S4-06 | **Diccionario de KPIs** único en `packages/shared` y **Dashboards Administrador y Gestor** (mockups 1 y 2), sin caja ni IA; distribución configurable por usuario |
| S4-07 | Búsqueda global (Ctrl+K) con texto completo en español (`unaccent`, `pg_trgm`), filtrada por RLS; búsqueda de personas por DNI o RUC |
| S4-08 | Duplicar caso (M8), casos **confidenciales** (M6), `case_comments` con menciones y pestaña **Actividad** (M4) |
| S4-09 | Bandeja "qué hago hoy" v1 (procesos vencidos, casos sin abogado, advertencias abiertas) |
| S4-10 | Generador de datos de prueba (`pnpm seed:load`) para 10 000 casos y volúmenes de rendimiento |

**Fuera de alcance:** documentos y checklist (Sprint 5), widgets de caja e IA, notificaciones (Sprint 8).

**Criterios de aceptación:** los pasos 1 a 3 y 5 del **escenario dorado** (`00-maestro` §10) funcionan · advertencias por menor sin representante y cuotas ≠ 100 % · un caso confidencial es invisible para quien no está asignado · los KPI de tarjetas y gráficos coinciden porque usan el mismo diccionario · la ficha de un caso con 10 herederos y 20 bienes responde con **p95 < 2 s** sobre 10 000 casos.

**Pruebas:** pgTAP de las tablas nuevas y de confidencialidad · unitarias de validaciones y KPI · e2e del asistente completo · prueba de rendimiento con datos generados · capturas de dashboards.

**Demo:** crear el caso completo del escenario dorado (contratante, causante, 3 herederos con un menor, un inmueble) → ver advertencias → arrastrar en el Kanban hacia un estado bloqueado → buscar por DNI con Ctrl+K → marcar el caso confidencial y entrar con otro gestor.

**Prompt:** plantilla 1.4 con `N = 4`. Nota específica: *"Si el plan supera ~12 ítems, propón dividirlo en 4a (S4-01 a S4-05) y 4b (S4-06 a S4-10)."*

---

# SPRINT 5 — Documentos y almacenamiento

**Objetivo:** cargar, versionar y controlar documentos por caso, persona y bien, con almacenamiento intercambiable.
**Leer:** `00-maestro` §3.2 (slots), §4.3 · `01-anexo` Parte B y A.4 (mockup 6), A.7 #7 · `v2` §5.3 · `v1` §11–14, §34.

**Alcance**

| ID | Ítem |
|---|---|
| S5-01 | `document_types` (naturaleza Generado/Subido/Externo, ámbito, vigencia, tipos de persona aplicables), `document_alternatives`, `case_model_documents` (`is_required`, `applies_to`, `party_role`, `asset_type`); semillas de `00-maestro` §4.3 y de documentos por proceso (§4.2) |
| S5-02 | `case_documents` (persona, bien, fechas de emisión y vigencia, estado de revisión), `document_versions` (`storage_backend`, `storage_key`, `sha256`, tamaño, MIME) y `sync_case_document_slots(case_id)` con sus disparadores al agregar o quitar intervinientes o bienes |
| S5-03 | Interfaz **`StorageProvider`** + implementación Supabase; `storage_backends`; buckets y políticas de Storage (`v2` §5.3); rutas generadas por el servidor; `sha256` y deduplicación |
| S5-04 | Subida: arrastrar, **cámara del celular**, compresión en el navegador, conversión de fotos a PDF de varias páginas; validación de MIME y firma de archivo; límites por parámetros |
| S5-05 | Descarga por `GET /v1/downloads/:versionId`: auditada y con URL firmada de **60 s** |
| S5-06 | **Checklist** por proceso, persona y bien con semáforo (M3), historial de versiones y estado de revisión (Pendiente, Subido, Validado, Observado) |
| S5-07 | Compuertas de cierre (M1) por documentos obligatorios pendientes |
| S5-08 | **Biblioteca documentaria** (mockup 6, con los ajustes A.7 #7) |
| S5-09 | Pantalla de uso de almacenamiento con aviso al 80 % (`storage.usage_warn_percent`) |
| S5-10 | Engine en Render con endpoints reales y mensaje "Despertando el servicio…" en la interfaz |

**Fuera de alcance:** respaldo a Drive (Sprint 9), plantillas y generación (Sprints 6 y 7).

**Criterios de aceptación:** al agregar un heredero aparece su checklist (partida y DNI) y al agregar un inmueble su copia literal · un gestor solo accede a documentos de sus casos · la descarga queda auditada · cambiar `storage.primary_backend` no exige tocar la lógica de negocio · ningún archivo se guarda en tablas · un proceso no se finaliza con documentos obligatorios pendientes.

**Pruebas:** pgTAP de tablas nuevas y políticas de Storage · unitarias de `sync_case_document_slots` (idempotencia, sin borrar cargados) · e2e de subida, versionado y descarga · prueba de tipos de archivo falsificados.

**Demo:** agregar un heredero y un inmueble → ver los documentos esperados → subir una foto desde el móvil (queda como PDF comprimido) → subir una nueva versión → descargar y ver el registro de auditoría → intentar finalizar el proceso sin documentos.

**Prompt:** plantilla 1.4 con `N = 5`. Nota específica: *"No implementes respaldo a Drive. Todo acceso a archivos pasa por StorageProvider. Nunca guardes archivos en la base de datos."*

---

# SPRINT 6 — Trámites externos y plantillas

**Objetivo:** seguir los trámites con notarías y registros con plazos en días útiles, y preparar las plantillas para generar documentos.
**Leer:** `00-maestro` §3.2, §3.4, §4.2 · `v2` §8.3 · `v1` §12–13 (plantillas y campos).

**Precondición:** plantillas DOCX reales o de ejemplo, y el parámetro `filings.publication_wait_business_days` validado por los abogados (D7, L1).

**Alcance**

| ID | Ítem |
|---|---|
| S6-01 | `external_entities` y pantalla **Entidades** (notarías, estudios, SUNARP, bancos, con contactos) |
| S6-02 | `case_filings` y pestaña **Trámites externos** (n.º de expediente o título, estado por categoría, `response_due_date`) |
| S6-03 | Administración de `holidays`; función `add_business_days` con pruebas; "tiempo restante" de casos y procesos en **días útiles** |
| S6-04 | `templates`, `template_fields`, `document_fields` (origen en lista blanca, incluye campos personalizados), versionado, restricción de vigencias no solapadas, `estimated_manual_minutes` |
| S6-05 | Subida de plantillas y **lint** en el engine: marcadores contra campos, marcadores rotos por Word, rechazo de macros (`.docm`) |
| S6-06 | UI de plantillas y campos, con un **caso dorado** (datos de ejemplo) por plantilla |

**Fuera de alcance:** generación de documentos (Sprint 7), alertas automáticas (Sprint 8).

**Criterios de aceptación:** registrar un trámite en notaría calcula su plazo con feriados y fines de semana · el lint detecta un marcador roto y un campo desconocido · dos plantillas activas con vigencias solapadas para el mismo tipo son rechazadas · un `.docm` es rechazado.

**Pruebas:** unitarias de `add_business_days` (feriados, cruce de mes) · lint con plantillas buenas y malas · pgTAP de nuevas tablas.

**Demo:** cargar los feriados → registrar un trámite con espera de 15 días útiles y ver la fecha → subir una plantilla con un marcador roto y ver el aviso → subir la corregida.

**Prompt:** plantilla 1.4 con `N = 6`.

---

# SPRINT 7 — Reglas y generación de documentos (MVP)

**Objetivo:** recomendar y generar documentos Word y PDF con reglas, con aprobación del abogado. Al cerrar este sprint el sistema **es utilizable sin IA**.
**Leer:** `v2` §6, §8 · `00-maestro` §4.4, §6, §10 · `01-anexo` A.4 (mockup 4), A.7 #3.

**Alcance**

| ID | Ítem |
|---|---|
| S7-01 | Motor de reglas en `packages/shared/rules`: DSL, esquema zod, evaluador con **traza**, registro de hechos (incluye campos personalizados y los hechos nuevos de `00-maestro` §4.4); **≥ 40 pruebas** |
| S7-02 | `document_rules`, pantalla de administración y **simulador** (M7); 7 reglas semilla de `00-maestro` §4.4 |
| S7-03 | Engine: `Dockerfile` con **LibreOffice y fuentes** (Carlito, Liberation), render DOCX (docxtemplater o docx-templates; **verificar licencias**), conversión a PDF con perfil aislado, concurrencia y tiempo límite; toggle `docs.pdf_generation` |
| S7-04 | `generation_jobs` asíncronos (RPC + Realtime), `idempotency_key`, reintentos, snapshot de datos, plantilla y reglas; `generated_documents` integrado con `document_versions` |
| S7-05 | Vista previa en PDF con marca de agua **BORRADOR** (M12) |
| S7-06 | Estados y **aprobación** (rol Abogado con `documents.approve`), `docs.four_eyes`, versiones `SUPERSEDED` |
| S7-07 | **Asistente de documentos en modo reglas** (mockup 4 con ajustes A.7 #3): candidatos, por qué, campos faltantes, estadística de aceptación; tabla `ai_recommendations` con `model_provider = RULES_ONLY` |
| S7-08 | 3 plantillas de ejemplo (`CONTRATO_SERVICIOS`, `SOLICITUD_SUCESION_INTESTADA`, `CARTA_NOTARIA`) como **casos dorados** en CI |
| S7-09 | Prueba e2e del **escenario dorado** (`00-maestro` §10, pasos 1 a 7, 10 y 11) |

**Fuera de alcance:** IA (Sprint 12), alertas (Sprint 8).

**Criterios de aceptación:** generación completa con plantilla dorada (Word y PDF, hash, versión + 1) · repetir la solicitud no duplica versiones · un documento no aprobado no puede marcarse final · el simulador explica qué reglas aplican · `has_dispute = true` excluye la solicitud notarial y recomienda el informe legal · si la generación de PDF está apagada el sistema sigue generando Word.

**Pruebas:** ≥ 40 unitarias del DSL · integración de generación con plantillas doradas · idempotencia · e2e del escenario dorado.

**Demo:** ejecutar el escenario dorado en staging de principio a fin, con el abogado aprobando el documento.

**Hito M1 — MVP:** revisión go/no-go para piloto con **datos de prueba** (checklist de `v2` §13.3 y de `00-maestro` §10).

**Prompt:** plantilla 1.4 con `N = 7`. Nota específica: *"Si la memoria del plan gratuito de Render no alcanza para LibreOffice, deja docs.pdf_generation apagado y avísame; no cambies de plan por tu cuenta."* Propón dividir en 7a (S7-01, S7-02, S7-07 base) y 7b (S7-03 a S7-06, S7-08, S7-09) si el plan es extenso.

---

# SPRINT 8 — Automatización I

**Objetivo:** que el sistema avise solo: cola de trabajos, alertas y notificaciones.
**Leer:** `v2` §10 · `v2.1` §5 · `00-maestro` §3.4 · `v1` §41.

**Alcance**

| ID | Ítem |
|---|---|
| S8-01 | Función `claim_jobs` (`SKIP LOCKED`, reintentos con espera creciente, recuperación de bloqueos), *worker* y endpoint `POST /v1/jobs/tick` con secreto; parámetro `platform.jobs_mode` (`TICK` / `CONTINUOUS`) |
| S8-02 | Programación con `pg_cron` (horarios en UTC según `v2` §10) y `pg_net` para despertar al engine; secreto en Supabase Vault; `dedupe_key` |
| S8-03 | `notifications` (en la aplicación), `notification_preferences`, deduplicación y campana en la interfaz |
| S8-04 | Motores de alerta: trámite por vencer/vencido, documento por caducar, estancamiento (los estados con categoría `WAITING` pausan el conteo), heredero sin documentos, controversia declarada → abogado, caso sin abogado |
| S8-05 | Horario laboral, **resumen matutino** (07:30 Lima, en la aplicación por ahora) y mantenimiento nocturno (métricas, expiración de recomendaciones, limpieza de borradores, uso de almacenamiento) |
| S8-06 | Bandeja "qué hago hoy" completa (M2) y **cola de aprobaciones** del administrador |
| S8-07 | Pantalla de trabajos (cola, `DEAD`, reintentar) dentro de Monitoreo |

**Fuera de alcance:** Telegram y APIINTI (Sprint 9).

**Criterios de aceptación:** ninguna alerta se duplica el mismo día · en modo `TICK` un trabajo pendiente se procesa en el siguiente *tick* aunque el engine estuviera dormido · un trabajo que falla reintenta y termina en `DEAD` con su error visible · las alertas respetan el horario laboral configurado.

**Pruebas:** integración de la cola (concurrencia, reintentos, bloqueos huérfanos) · unitarias de cada regla de alerta · prueba de deduplicación.

**Demo:** crear un trámite con vencimiento cercano → esperar el *tick* → ver la notificación → forzar un trabajo fallido y verlo reintentar.

**Prompt:** plantilla 1.4 con `N = 8`. Nota específica: *"El engine puede estar dormido (plan gratuito): el diseño debe tolerarlo. No mantengas el servicio despierto con pings."*

---

# SPRINT 9 — Integraciones y continuidad

**Objetivo:** conectar servicios externos y asegurar que los datos se puedan recuperar.
**Leer:** `v2.1` §4, §5 · `01-anexo` B.6 · `v2` §11 · `docs/integrations/apiinti.md`.

**Precondiciones:** API key de APIINTI **regenerada** y su documentación guardada en `docs/integrations/apiinti.md` (T1) · cuenta de Google definida para el respaldo (S1) · bot de Telegram creado.

**Alcance**

| ID | Ítem |
|---|---|
| S9-01 | `IdentityLookupProvider` para **APIINTI**: mapeo configurable, caché (`identity_lookup_cache`), contador de cuota, auditoría, límite de uso; flag `clients.external_lookup`; integrado en los formularios de persona **con alta manual siempre disponible** |
| S9-02 | **Telegram**: `telegram_links` con código de un solo uso (10 min), webhook con token secreto, mensajes mínimos (sin nombres, montos ni contenido), *throttling*, preferencias; resumen matutino por Telegram |
| S9-03 | `recurrence_rules`, trabajo de creación de casos recurrentes (06:00 Lima) y pantalla de administración |
| S9-04 | `service_health_checks` y pantalla de **Monitoreo** (salud y latencia); vigilancia del estado del token de Google |
| S9-05 | **Respaldo**: workflow de GitHub Actions con `pg_dump` cifrado; trabajo `backup_storage` cifrado (AES-256-GCM) hacia Drive, incremental y reanudable; script `restore` |
| S9-06 | Runbook v1 (falla de LibreOffice, Supabase, proveedor de IA, cola con `DEAD`) y, opcionalmente, Sentry |

**Fuera de alcance:** IA y caja.

**Criterios de aceptación:** una consulta DNI/RUC precarga los datos y, si falla o no hay cuota, se puede seguir a mano · un mensaje de Telegram nunca contiene datos personales · el respaldo cifrado se sube y una **restauración de prueba en staging recupera un caso completo** · si el token de Google falla, se genera una alerta · la API key solo existe como variable de entorno.

**Pruebas:** integración con el proveedor simulado (éxito, error, cuota agotada) · prueba de que ningún mensaje de Telegram incluye datos personales · **prueba de restauración** · escáner de secretos.

**Demo:** crear una persona por DNI con precarga → vincular Telegram y recibir el resumen → ejecutar el respaldo y restaurarlo en staging → desconectar el token de Google y ver la alerta.

**Hito M2.**

**Prompt:** plantilla 1.4 con `N = 9`. Nota específica: *"La clave de APIINTI y la de cifrado de respaldo solo por variables de entorno. Nunca leas ni imprimas .env. Si falta docs/integrations/apiinti.md, detente y pregúntame."*

---

# SPRINT 10 — Cotizaciones y reportes

**Objetivo:** controlar cotizaciones y costos de terceros (notarías, publicaciones) y generar reportes exportables.
**Leer:** `v1` §17, §50 · `v2` §4.2 · `01-anexo` A.4 (mockup 1).

**Alcance**

| ID | Ítem |
|---|---|
| S10-01 | `suppliers` y `quotes` (una sola cotización seleccionada por caso, índice único parcial); pestaña **Cotizaciones** del caso; comparación con el promedio histórico y % de diferencia |
| S10-02 | Reportes mínimos de `v1` §50 y exportación CSV, Excel y PDF (`module.reports_export`), **respetando RLS** |
| S10-03 | Completar el diccionario de KPIs (productividad, embudo por proceso, tiempos por proceso) y vistas materializadas refrescadas por el mantenimiento nocturno |
| S10-04 | Dashboards personalizables por usuario (`user_preferences`) |

**Criterios de aceptación:** la comparación usa el historial real del proveedor · una exportación solo contiene lo que el usuario puede ver · todos los widgets del dashboard usan el diccionario de KPIs.

**Pruebas:** pgTAP de nuevas tablas y exportaciones · unitarias de KPI y comparación histórica.

**Demo:** registrar 3 cotizaciones y seleccionar una → ver la diferencia contra el histórico → exportar a Excel y comprobar que un gestor no recibe casos ajenos.

**Prompt:** plantilla 1.4 con `N = 10`.

---

# SPRINT 11 — Caja chica

**Objetivo:** controlar los fondos de caja con un libro inmutable, solicitudes y cierre de periodo.
**Leer:** `v2` §9, §4.3 · `v2.1` §3.5 · `01-anexo` A.4 (mockup 3) · `v1` (secciones de caja).

**Alcance**

| ID | Ítem |
|---|---|
| S11-01 | `cash_accounts` (tipo y moneda por catálogo), `cash_categories`, `cash_periods`, `cash_movements` **inmutable** con reversos, vista `cash_account_balances`, `cash_requests`, `cash_reconciliations` con control dual; RLS con permiso + flag + **MFA `aal2`** |
| S11-02 | UI: **dashboard de caja** (mockup 3), registrar movimientos, adjuntar soporte (bucket `cash-support`), reversar, flujo de solicitudes (Gestor → Administrador → Caja), arqueo y cierre de periodo |
| S11-03 | Gasto vinculado a caso (M9) y costo por caso en el detalle; reportes de caja |
| S11-04 | Alertas de saldo mínimo y soporte faltante; **comprobación nocturna** de integridad (libro contra vista) |

**Criterios de aceptación:** `UPDATE` y `DELETE` sobre movimientos **fallan incluso con `service_role`** · no se registra en un periodo cerrado · quien abre el arqueo no puede aprobarlo · sin MFA no se escribe en caja · con `module.cash` apagado la caja es inaccesible por API y por consulta directa · CASHIER no ve casos ni documentos.

**Pruebas:** pgTAP de inmutabilidad, periodos cerrados, control dual y MFA · prueba de propiedad "saldo = apertura + Σ movimientos" con reversos aleatorios · e2e del flujo de solicitud.

**Demo:** solicitar fondos como Gestor → aprobar como Administrador → desembolsar como Caja → reversar un movimiento → hacer el arqueo con una diferencia y cerrar el periodo.

**Hito M3.**

**Prompt:** plantilla 1.4 con `N = 11`. Nota específica: *"Toca dinero: presenta migraciones y políticas para mi revisión antes de aplicarlas. Ningún UPDATE/DELETE sobre cash_movements."*

---

# SPRINT 12 — IA de recomendaciones *(condicional a D3)*

**Objetivo:** sumar IA al recomendador de documentos **sin salirse de las reglas**.
**Leer:** `v2` §7 · `00-maestro` §6, §7 · `01-anexo` A.7 #3.

**Precondiciones (sin ellas, este sprint no se ejecuta):** D3 resuelta (proveedor y política de datos aprobados), validación legal del tratamiento, clave del proveedor en variables de entorno, `module.ai` habilitado y suficiente historial de aceptaciones. Si D3 no se aprueba, el sistema sigue operando en modo `RULES_ONLY` (ya entregado en el Sprint 7).

**Alcance**

| ID | Ítem |
|---|---|
| S12-01 | Interfaz `AiProvider` con el adaptador del proveedor elegido; parámetros de `system_settings.ai`; `ai_usage_log`, presupuesto mensual con alerta al 80 %, límite por usuario, caché por `context_hash` |
| S12-02 | Pipeline: constructor de contexto (lista blanca, **enmascarado**, exclusión de menores, `ai_allowed` y `is_confidential`), candidatos desde reglas, estadística histórica, reordenamiento por IA, validación zod, reintento único, degradación a `RULES_ONLY` |
| S12-03 | Puntuación calculada por el sistema (`v2` §7.3) con pesos y umbrales editables |
| S12-04 | `knowledge_documents` y `knowledge_chunks` (pgvector) con administración de la base de conocimiento |
| S12-05 | UI del asistente: puntuación, por qué, campos faltantes, prellenado con su origen, rótulo **"Sugerencia para revisión legal"** |
| S12-06 | Detectores de faltantes por persona/bien e incoherencias; resumen del expediente para el abogado |
| S12-07 | Conjunto dorado de ≥ 50 casos con métricas top-1 y top-3, regresión por `prompt_version`, pruebas de inyección de instrucciones, dashboard de uso de IA |

**Criterios de aceptación:** la IA solo puede elegir candidatos aprobados por reglas · **nunca** determina herederos, cuotas ni la vía procesal · ningún dato sin enmascarar ni de menores sale del sistema · un documento con instrucciones maliciosas no altera el resultado · con la IA apagada o caída el flujo continúa · métrica top-3 sobre el umbral acordado.

**Pruebas:** conjunto dorado · inyección · enmascarado (verificar el contenido exacto enviado) · degradación · presupuesto.

**Demo:** obtener una recomendación con puntuación y explicación → apagar `module.ai` y comprobar el modo reglas → subir un documento con una instrucción maliciosa y ver que se ignora.

**Prompt:** plantilla 1.4 con `N = 12`. Nota específica: *"Verifica las precondiciones antes de planificar. Si falta alguna, detente y pregúntame. Registra qué campos se envían al proveedor."*

---

# SPRINT 13 — Endurecimiento y salida a producción

**Objetivo:** dejar el sistema listo para operar con datos reales.
**Leer:** `v2` §11, §12 · `v2.1` §5 · `01-anexo` B.7 · `00-maestro` §7, §11.

**Alcance**

| ID | Ítem |
|---|---|
| S13-01 | Rendimiento: datos de prueba (10 000 casos, 100 000 documentos), `EXPLAIN` de consultas clave, índices; p95 < 2 s en dashboards y ficha del caso |
| S13-02 | Seguridad: checklist OWASP ASVS nivel 2, CSP/HSTS, *rate limiting*, revisión de dependencias, rotación de secretos, **auditoría completa de la matriz RLS** |
| S13-03 | Ensayo de `storage_migrate` (a R2 o a Supabase Pro) verificando `sha256`, y ensayo del cambio `platform.tier` a `PAID` |
| S13-04 | **Simulacro de restauración** completo, definición de RTO/RPO y runbook final |
| S13-05 | Accesibilidad completa, revisión de i18n, tema oscuro completo, pulido móvil y regresión visual contra el mockup |
| S13-06 | Manual de usuario por rol, material de capacitación y guía de carga inicial de datos reales |
| S13-07 | **Lista go-live** (abajo) y plan de reversa |

**Lista go-live (todas deben cumplirse)**

- [ ] **L1–L4** validados por los abogados: modelos, requisitos, plazos, vigencias, tratamiento de convivientes, política de retención y cláusulas de protección de datos.
- [ ] Plantillas DOCX reales cargadas y aprobadas por un abogado (D7).
- [ ] **Supabase en plan Pro** (o alternativa con backups) y decisión sobre Render y Vercel para uso comercial.
- [ ] Respaldo cifrado en ejecución y **restauración probada** en el último mes.
- [ ] MFA activo para Administrador, Caja y Abogado.
- [ ] Monitor externo configurado y alertas de fallo funcionando.
- [ ] API key de APIINTI regenerada y sin rastro en el repositorio.
- [ ] D3 resuelta (IA activa con política aprobada, o `module.ai` apagado).
- [ ] Cuenta de Google del respaldo definida (S1) y clave de cifrado guardada fuera de línea.
- [ ] Revisión de seguridad ASVS firmada y sin hallazgos críticos abiertos.

**Criterios de aceptación:** metas de rendimiento cumplidas · simulacro de restauración exitoso · lista go-live completa.

**Hito M4 — listo para datos reales.**

**Prompt:** plantilla 1.4 con `N = 13`. Nota específica: *"No cargues datos reales ni cambies planes de pago: presenta la lista go-live con su estado para mi decisión."*

---

## 3. Matriz de cobertura

**Mejoras funcionales de `v2` §3**

| Mejora | Sprint |
|---|---|
| M1 Compuertas de cierre | 3 (dependencias) y 5 (documentos) |
| M2 Bandeja de trabajo y aprobaciones | 4 (v1) y 8 (completa) |
| M3 Checklist documental | 5 |
| M4 Actividad y comentarios | 3 (eventos) y 4 |
| M5 Búsqueda global | 4 |
| M6 Casos confidenciales | 3 (campo y RLS) y 4 (UI) |
| M7 Simulador de reglas | 7 |
| M8 Duplicar caso | 4 |
| M9 Gasto de caja por caso | 11 |
| M10 Modo "solo reglas" | 7 (base) y 12 |
| M11 Resumen matutino | 8 y 9 (Telegram) |
| M12 Vista previa PDF con marca de agua | 7 |
| M13 Temas con contraste validado | 2 |
| M14 Partes del caso | 4 |

**Bloques de la especificación**

| Bloque | Sprint |
|---|---|
| Arquitectura, entornos, CI (`v2` §2, §12) | 0 |
| Seguridad, roles y permisos (`v2` §5, `v2.1` §3.8) | 1 |
| Sistema de diseño (`01-anexo` A) | 1 (base) y todos (uso) |
| Settings, catálogos, toggles, campos (`v2.1` §3) | 2 |
| Personas, casos, modelos, avance (`00-maestro` §3–4) | 3–4 |
| Documentos y almacenamiento (`01-anexo` B) | 5 (base), 9 (respaldo), 13 (migración) |
| Trámites y plantillas | 6 |
| Reglas y generación (`v2` §6, §8) | 7 |
| Trabajos, alertas (`v2` §10) | 8–9 |
| APIINTI, Telegram, recurrencia, monitoreo | 9 |
| Cotizaciones y reportes | 10 |
| Caja chica (`v2` §9) | 11 |
| IA (`v2` §7) | 12 |
| Rendimiento, seguridad, continuidad (`v2` §11) | 9 (respaldo) y 13 |

---

## 4. Paquete de archivos para Antigravity

Estructura final del repositorio (el archivo `paquete_antigravity.zip` ya la trae armada):

```text
/
├─ AGENTS.md                                   ← reglas permanentes del agente
├─ .env.example                                ← nombres de variables, sin valores
└─ docs/
   ├─ 00-maestro.md                            ← punto de entrada: dominio, semillas, decisiones
   ├─ 01-anexo-diseno-almacenamiento.md        ← diseño DocuAI y almacenamiento
   ├─ 02-plan-sprints.md                       ← este documento
   ├─ v2.1.md                                  ← Settings, catálogos, toggles, APIINTI, plan gratuito
   ├─ v2.md                                    ← arquitectura técnica, RLS, reglas, IA, jobs
   ├─ v1.md                                    ← especificación funcional original
   ├─ design/
   │  └─ docuai-mockups.png                    ← referencia visual
   ├─ integrations/
   │  └─ apiinti.md                            ← LO APORTAS TÚ (antes del Sprint 9)
   └─ adr/                                     ← decisiones de arquitectura (las crea el agente)
```

**Precedencia:** `00-maestro` > `01-anexo` > `v2.1` > `v2` > `v1`. Este plan de sprints define el **orden y el empaquetado**, no los requisitos.

**Aportes pendientes de tu parte**

| Archivo / dato | Antes de | Quién |
|---|---|---|
| `docs/integrations/apiinti.md` (URL base, autenticación, endpoints y ejemplo de respuesta) y API key regenerada | Sprint 9 | Tú |
| Plantillas DOCX reales o de ejemplo y requisitos validados por abogados | Sprint 6 | Abogados |
| Decisión D3 (IA) | Sprint 12 | Dirección |
| Cuenta de Google del respaldo (S1) | Sprint 9 | Dirección |
| Feriados oficiales del año | Sprint 6 | Tú |
