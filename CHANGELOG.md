# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

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
