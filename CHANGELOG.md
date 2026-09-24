# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
