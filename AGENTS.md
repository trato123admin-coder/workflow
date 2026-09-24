# AGENTS.md

## Proyecto
Sistema de gestión de casos sucesorios y trámites documentarios (workflow, documentos, caja chica).
Punto de entrada: docs/00-maestro.md. Precedencia: 00-maestro > 01-anexo-diseno-almacenamiento > v2.1 > v2.0 > v1.
Referencia visual: docs/design/docuai-mockups.png (estilo y estructura; los datos de muestra NO son el dominio).
Plan de ejecución: docs/02-plan-sprints.md. Un sprint por rama (feat/sprint-N-tema); implementar SOLO los ítems del sprint indicado.

## Stack
- Web: Next.js (App Router), TypeScript estricto, Tailwind, shadcn/ui, TanStack Query, react-hook-form + zod, next-intl (es-PE) -> Vercel
- Engine: Node + TypeScript (Fastify), docxtemplater o docx-templates, LibreOffice headless, Docker -> Render
- Datos: Supabase (PostgreSQL, Auth, Storage, Realtime, pg_cron, pg_net, pgvector)
- Pruebas: Vitest, Playwright, pgTAP
- Monorepo pnpm: apps/web, services/engine, packages/shared, supabase

## Reglas no negociables
- Nunca ejecutar comandos contra producción. Solo local o staging.
- Los secretos solo en variables de entorno. Nunca leer, imprimir ni commitear .env. Nunca pedir claves reales; usar .env.example.
- Todo cambio de esquema es una migración nueva en supabase/migrations. Nunca editar migraciones ya aplicadas.
- Toda tabla en public tiene RLS habilitada, políticas y prueba pgTAP.
- La RLS usa private.has_permission() y private.feature_enabled(), no nombres de rol.
- service_role jamás en apps/web ni en variables NEXT_PUBLIC_*. El navegador nunca llama a servicios externos (APIINTI, IA, Telegram).
- Prohibido escribir listas fijas de negocio en el código (tipos de documento, de persona, prioridades, estados, categorías, roles). Se leen de catálogos, workflow_statuses o settings. La lógica usa categorías semánticas y permisos, nunca etiquetas.
- Todo elemento configurable tiene is_active (toggle). Nunca DELETE de configuración en uso: solo desactivar.
- audit_logs, settings_history y cash_movements son append-only. Correcciones de caja con reversos.
- Archivos solo en Storage privado; descargas por URL firmada emitida por el engine y auditadas.
- Lógica de avance y del DSL de reglas solo en packages/shared, con pruebas unitarias.
- Código e identificadores en inglés; textos de interfaz en español (es-PE) vía i18n; moneda PEN; zona America/Lima.
- Accesibilidad AA y diseño responsive (móvil primero).
- Diseño: colores, tipografía y espaciados solo desde tokens CSS (temas por data-theme); reutilizar los componentes de docs/01-anexo Parte A. Abrir docs/design/docuai-mockups.png al construir cada pantalla.
- Archivos: todo acceso pasa por la interfaz StorageProvider del engine; nunca guardar archivos en tablas de la base de datos; cada versión registra storage_backend, storage_key y sha256. El respaldo a Drive solo va cifrado.

## Reglas del dominio
- El sistema registra y organiza; NO decide derechos. Nunca calcular ni asignar automáticamente herederos, cuotas hereditarias ni la vía procesal (notarial o judicial): eso lo determina un abogado o notario y el sistema solo guarda su decisión.
- La IA solo recomienda, con candidatos definidos por reglas, salida validada con zod y rotulada "Sugerencia para revisión legal". No recibe datos sin enmascarar ni datos de menores. Respetar ai_allowed y is_confidential.
- Cuentas bancarias: solo los últimos 4 dígitos. Nunca números completos.
- Requisitos, pasos y plazos legales son datos editables (modelos, reglas, parámetros) y borradores hasta que los valide el equipo legal. Los plazos se cuentan en días útiles con la tabla holidays.
- Documentos esperados por caso, por persona y por bien se generan con sync_case_document_slots (idempotente); nunca se borran documentos ya cargados.

## Flujo de trabajo
1. Leer las secciones de docs relevantes a la tarea.
2. Proponer un plan por ítems del sprint y esperar aprobación antes de escribir código (siempre si toca esquema, RLS, seguridad, caja, IA o envío de datos a terceros).
3. Trabajar en la rama feat/sprint-N-tema, con cambios pequeños y commits convencionales. Lo que quede fuera del alcance del sprint se anota, no se hace.
4. Ejecutar lint, typecheck, pruebas unitarias, pgTAP y e2e antes de abrir el PR.
5. El PR incluye el checklist de aceptación del sprint, el guion de demo ejecutado, decisiones tomadas y riesgos; actualizar CHANGELOG y ADR.

## Comandos
- pnpm dev | pnpm lint | pnpm typecheck | pnpm test | pnpm e2e
- supabase start | supabase db reset | supabase test db | supabase gen types typescript --local

## Calidad
- Archivos <= 300 líneas, funciones <= 30 líneas, sin console.log (usar logger estructurado).
- Validar con zod toda frontera (formularios, API, respuesta de IA, variables de entorno).

## Detenerse y preguntar cuando
- Una regla de negocio sea ambigua o contradictoria entre documentos.
- El trabajo dependa de una decisión pendiente (docs/00-maestro.md sección 2).
- El cambio afecte RLS, caja chica, auditoría, datos de menores o el envío de datos a la IA.
