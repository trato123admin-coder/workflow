# Sistema de Gestión de Casos Sucesorios y Trámites Documentarios

Sistema integral de gestión de trámites sucesorios, notariales y registrales, flujo de documentos, reglas y caja chica.

---

## 1. Arquitectura y Stack

- **Web:** Next.js (App Router), TypeScript estricto, Tailwind CSS, shadcn/ui, `next-intl` (es-PE) → Despliegue en **Vercel**.
- **Engine:** Fastify en Node.js 22, TypeScript, Pino Logger, Docker → Despliegue en **Render** (Modo TICK / Free Tier).
- **Datos y Seguridad:** PostgreSQL vía **Supabase** (Auth, Storage, RLS por permisos, pgvector, `audit_logs` append-only).
- **Tooling:** Monorepo con `pnpm`, ESLint, Prettier, Vitest y pgTAP.

---

## 2. Requisitos Previos

- **Node.js:** v22 o superior
- **pnpm:** v10 o superior (`npm install -g pnpm`)
- **Docker Desktop:** Para desarrollo y pruebas locales de base de datos
- **Supabase CLI:** `npm install -g supabase`

---

## 3. Instalación y Puesta en Marcha Local

1. **Clonar e instalar dependencias:**

   ```bash
   git clone https://github.com/trato123admin-coder/workflow.git
   cd workflow
   pnpm install
   ```

2. **Variables de entorno:**
   - Copia `.env.example` a `.env.local` en la raíz (ignorado por Git):
     ```bash
     cp .env.example .env.local
     ```

3. **Iniciar Supabase Local (requiere Docker):**

   ```bash
   supabase start
   ```

4. **Ejecutar todo el monorepo en desarrollo:**
   ```bash
   pnpm dev
   ```
   - **Web:** [http://localhost:3000](http://localhost:3000) (redirige a `/health`)
   - **Engine:** [http://localhost:3001](http://localhost:3001) (`/healthz`, `/readyz`)

---

## 4. Comandos de Verificación y Calidad

| Comando            | Acción                                             |
| ------------------ | -------------------------------------------------- |
| `pnpm dev`         | Levanta todos los servicios concurrentemente       |
| `pnpm build`       | Compila todos los paquetes y aplicaciones          |
| `pnpm lint`        | Analiza el código con ESLint                       |
| `pnpm typecheck`   | Valida tipos de TypeScript en modo estricto        |
| `pnpm test`        | Ejecuta las suites de pruebas unitarias con Vitest |
| `supabase test db` | Ejecuta las pruebas de seguridad y RLS con pgTAP   |

---

## 5. Demostración de Vigilancia de RLS

El sistema garantiza que ninguna tabla en `public` pueda existir sin RLS. Si se ejecuta:

```sql
CREATE TABLE public.tabla_insegura (id integer);
```

Al correr `supabase test db`, la prueba `01_rls_enforcement.test.sql` fallará inmediatamente:

```text
CRITICAL: All public tables must have Row Level Security (RLS) enabled
```

El pipeline de CI en GitHub Actions bloqueará cualquier Pull Request que contenga tablas sin RLS.

---

## 6. Despliegue en Staging

Consulta la guía paso a paso en [docs/staging-guide.md](docs/staging-guide.md).
