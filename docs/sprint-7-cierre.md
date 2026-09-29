# Acta de Cierre — Sprint 7 (Hito M1: MVP Usable)

**Fecha de Cierre:** 2026-09-28  
**Rama:** `feat/sprint-7b-generacion`  
**Hito Asociado:** M1 (MVP usable en staging, sin IA)  
**Estado:** COMPLETADO Y VERIFICADO  

---

## 1. Alcance Entregado

| Ítem | Descripción | Estado |
|---|---|---|
| **S7-01** | Motor de reglas en `packages/shared/rules` (DSL, esquema Zod, evaluador con traza, 41 pruebas unitarias). | ✅ Verificado |
| **S7-02** | Tabla `document_rules`, pantalla de administración y simulador interactivo de reglas con las 7 reglas semilla. | ✅ Verificado |
| **S7-03** | Engine en Docker con LibreOffice headless (`node:22-slim`), fuentes Carlito/Liberation, render DOCX con `docx-templates` (MIT), perfiles aislados y toggle `docs.pdf_generation`. | ✅ Verificado |
| **S7-04** | Tablas `generation_jobs` y `generated_documents` con enum `gen_status`, RPC `create_generation_job` con idempotencia estricta, reintentos y Realtime. | ✅ Verificado |
| **S7-05** | Vista previa en memoria con marca de agua diagonal "BORRADOR" generada con `pdf-lib`. | ✅ Verificado |
| **S7-06** | Flujo de aprobación legal con verificación de permisos `documents.approve`, regla de doble control `docs.four_eyes` (bloqueo de auto-aprobación con HTTP 403) y versiones previas marcadas como `SUPERSEDED`. | ✅ Verificado |
| **S7-07** | Asistente de documentos en modo `RULES_ONLY` con registro idempotente de todos los candidatos evaluados, selección de alternativas y cálculo de completitud de variables. | ✅ Verificado |
| **S7-08** | 3 plantillas doradas (`CONTRATO_SERVICIOS`, `SOLICITUD_SUCESION_INTESTADA`, `CARTA_NOTARIA`) unificadas a la sintaxis canónica `{{campo}}`. | ✅ Verificado |
| **S7-09** | Suite de pruebas automatizadas: 244 tests pasando en monorepo (150 shared, 66 engine, 28 web), 0 errores de typecheck y linter. | ✅ Verificado |

---

## 2. Checklist de Aceptación del Sprint 7 (DoD)

- [x] **Generación completa:** DOCX y PDF renderizados con plantilla dorada, cálculo de hash SHA-256 e incremento de versión.
- [x] **Idempotencia:** Repetir solicitud con la misma `idempotency_key` no duplica jobs ni versiones físicas.
- [x] **Compuerta de aprobación:** Un documento en estado `GENERATED`/`IN_REVIEW` no puede marcarse final sin aprobación explícita de un usuario con permiso `documents.approve`.
- [x] **Doble control:** Regla `docs.four_eyes` impide que quien solicitó la generación apruebe el documento (retorna `403 FOUR_EYES_VIOLATION`).
- [x] **Auditoría inmutable:** Aprobación y rechazo auditados automáticamente mediante trigger de BD `trg_audit_generated_documents` (`private.tg_audit_log()`).
- [x] **Delimitadores unificados:** Todas las plantillas, el linter de XML y las pruebas de integración utilizan la sintaxis canónica de llave doble `{{campo}}`.
- [x] **Blindaje RLS:** Se revocó el `INSERT` directo en `generation_jobs` para `authenticated`; la creación es exclusiva vía la función `SECURITY DEFINER create_generation_job`.
- [x] **Validación de pertenencia:** `create_generation_job` rechaza slots que no pertenezcan al caso indicado.
- [x] **Lista blanca:** `input_data` rechaza claves no autorizadas en el catálogo de campos activos.
- [x] **Tolerancia:** Si `docs.pdf_generation` está inactivo (plan gratuito de Render), el sistema degrada limpiamente generando el documento Word.

---

## 3. Comandos para Verificar

```bash
# 1. Pruebas unitarias e integración en todo el monorepo (244 tests)
pnpm test

# 2. Verificación estricta de tipos de TypeScript (0 errores)
pnpm typecheck

# 3. Análisis de linter en todos los paquetes (0 warnings)
pnpm lint

# 4. Pruebas de integración del motor documental y plantillas doradas
pnpm --filter @workflow/engine test golden-templates approval-flow templates-lint
```

---

## 4. Decisiones de Arquitectura y Mitigación de Riesgos

1. **`docx-templates` vs `docxtemplater`:** Se eligió `docx-templates` por contar con licencia MIT completa sin dependencias de módulos de pago para bucles y condicionales.
2. **Memoria en Render:** Para mitigar el límite de 512 MB del tier gratuito de Render, `docs.pdf_generation` permanece en `false` por defecto, activándose bajo demanda y con semáforo de concurrencia (`max: 1`).
3. **Auditoría Homogénea:** Se eliminó cualquier inserción manual a `audit_logs` en el código de backend, delegando en los triggers de PostgreSQL (`private.tg_audit_log()`) para garantizar consistencia con el resto del sistema.
4. **Hito M1 (MVP):** El sistema es plenamente utilizable para el flujo sucesorio sin requerir componentes de IA externa (modo `RULES_ONLY`).
