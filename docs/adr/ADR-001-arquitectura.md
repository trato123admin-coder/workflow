# ADR-001: Arquitectura Base, Monorepo y Modelo de Seguridad

- **Estado:** Aceptado
- **Fecha:** 2026-09-24
- **Contexto:** Sprint 0 — Fundaciones

---

## 1. Contexto del Problema
El sistema gestiona casos sucesorios y trámites documentarios notariales/judiciales con requisitos estrictos de confidencialidad, auditoría contable/jurídica, generación documental (DOCX/PDF) y ejecución en plataformas en la nube (Vercel, Render, Supabase).

## 2. Decisiones de Arquitectura

### 2.1 Monorepo pnpm
- **Estructura:** Se adopta un monorepo pnpm con tres espacios de trabajo:
  - `apps/web`: Frontend con Next.js (App Router), Tailwind CSS y `next-intl` (es-PE).
  - `services/engine`: Backend de Fastify en Node.js 22 (Dockerizado) para tareas pesadas, generación y orquestación.
  - `packages/shared`: Biblioteca de contratos, validaciones Zod, utilidades y tipos compartidos.
- **Razón:** Centraliza el versionado, simplifica el tipado compartido de contratos y agiliza los pipelines de CI sin duplicar esquemas.

### 2.2 Seguridad en Base de Datos y Aislamiento (RLS)
- **Regla:** Ninguna tabla en el esquema `public` puede existir sin `Row Level Security` (RLS) habilitada.
- **Esquema `private`:** Las funciones de seguridad definidoras (`SECURITY DEFINER`) y las tablas internas (como contadores y colas de sistema) residen en esquemas protegidos o con RLS estricta sin políticas públicas.
- **Vigilancia Automatizada:** Se implementa una prueba pgTAP obligatoria en CI que falla inmediatamente si cualquier tabla del esquema `public` carece de RLS (`rowsecurity = false`).

### 2.3 Operación en Plan Gratuito (Modo TICK)
- Supabase y Render inician en tiers gratuitos.
- La ejecución en segundo plano utiliza `job_queue` en PostgreSQL y orquestación por llamadas controladas (modo `TICK`), evitando procesos worker persistentes costosos mientras se desarrolla la fase inicial.

### 2.4 Control de Auditoría Inmutable (Append-Only)
- Tablas sensibles como `audit_logs` implementan triggers `raise_immutable()` que revocan y bloquean cualquier sentencia `UPDATE` o `DELETE`.

## 3. Consecuencias
- **Positivas:** Seguridad por diseño desde la capa de datos; cero tablas públicas expuestas por omisión; tipado consistente y verificable en frontend y backend.
- **Trade-offs:** Toda nueva tabla en migraciones requiere explícitamente `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` y sus respectivas políticas antes de pasar el CI.
