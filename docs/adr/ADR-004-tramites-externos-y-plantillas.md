# ADR-004: Trámites Externos, Cómputo Legal en Días Útiles y Gestión Segura de Plantillas DOCX

- **Estado:** Aceptado
- **Fecha:** 2026-09-26
- **Contexto:** Sprint 6 — Trámites externos y plantillas (S6-01 a S6-06)

---

## 1. Contexto del Problema
Los trámites sucesorios y notariales requieren interactuar con entidades externas (notarías, SUNARP, bancos, estudios jurídicos) y efectuar seguimiento estricto de plazos legales (por ejemplo, 15 días útiles para publicación de edictos notariales). Adicionalmente, para preparar la generación automatizada de documentos (Sprint 7), se necesita administrar plantillas Word (.docx) con marcadores de reemplazo, evitando:
1. Inexactitud en el cómputo de plazos legales (deben descontarse fines de semana y feriados oficiales peruanos sin fallar si la tabla de feriados está vacía).
2. Ambigüedades en la vigencia de plantillas (no pueden coexistir dos versiones activas de una plantilla para el mismo tipo documental con fechas solapadas).
3. Brechas de seguridad o corrupción de documentos por macros maliciosas (`.docm`, `vbaProject.bin`) o marcadores rotos por el particionamiento interno de Word en múltiples nodos `<w:r>`.
4. Marcadores no autorizados que lleguen como texto literal (`{{campo_desconocido}}`) a documentos legales generados.

---

## 2. Decisiones de Arquitectura

### 2.1 Restricción Relacional de Exclusión Real (`EXCLUDE USING gist`)
- Se habilitó la extensión `btree_gist` en PostgreSQL.
- Se implementó la restricción `exclude_overlapping_template_validity` en la tabla `templates`:
  ```sql
  alter table public.templates add constraint exclude_overlapping_template_validity
    exclude using gist (
      document_type_id with =,
      daterange(valid_from, coalesce(valid_until, 'infinity'::date), '[]') with &&
    ) where (is_active = true);
  ```
- Garantiza a nivel relacional que nunca coexistan versiones activas solapadas en tiempo para un mismo tipo documental.

### 2.2 Blindaje 100% de Mutaciones de Plantillas en el Engine
- En Supabase se revocaron todos los permisos de inserción, actualización y eliminación directa para roles cliente (`authenticated`, `anon`).
- La creación de plantillas ocurre exclusivamente a través de `POST /v1/templates/upload` en el Engine, validando JWT activo, MFA (si corresponde) y el permiso `templates.manage`.
- El registro en base de datos e inserción en el bucket privado `templates` se efectúa con `service_role` únicamente tras la aprobación exitosa del linting de marcadores.
- La descarga segura (`GET /v1/templates/:id/download`) requiere autenticación y emite URLs firmadas de 60 segundos.

### 2.3 Cómputo de Plazos en Días Útiles Tolerante (`add_business_days`)
- La función SQL `public.add_business_days(_from_date date, _days int)` y su contraparte en TypeScript (`addBusinessDays` en `@workflow/shared`) descuentan sábados, domingos y días no laborables activos en `holidays`.
- Si la tabla `holidays` está vacía o no tiene registros en el rango, opera tolerante descontando únicamente sábados y domingos sin interrumpir el flujo.
- El plazo notarial de 15 días útiles se configuró dinámicamente en `system_settings` (`filings.publication_wait_business_days = 15`).

### 2.4 Semántica de Estados y Semáforo de Urgencia en Trámites
- `case_filings.status` se enlaza mediante clave foránea compuesta `(status_cat, status)` a `catalog_items ('filing_statuses')`.
- La evaluación de urgencia (`getFilingUrgency`) lee la categoría semántica (`DONE`, `REJECTED`, `SUBMITTED`, `OBSERVED`) y no cadenas o etiquetas de interfaz, clasificando en `DONE`, `ON_TRACK`, `EXPIRING_SOON` y `EXPIRED`.

### 2.5 Validación Estricta de Marcadores (Linting) y Bloqueo de Macros
- Se analiza el XML interno de Word (`word/document.xml`, `word/header*.xml`, `word/footer*.xml`), reconstituyendo marcadores partidos entre etiquetas XML (`<w:t>`).
- Detección y rechazo inmediato (HTTP 422) ante macros (`.docm`, `vbaProject.bin`).
- Todo marcador no registrado en la lista blanca de `document_fields` bloquea la subida con `TEMPLATE_LINT_ERROR`.
- Deduplicación criptográfica por hash SHA-256 evitando redundancia en el almacenamiento.

---

## 3. Consecuencias
- **Positivas:** Cero riesgo de macros maliciosas; fechas legales exactas ajustadas al calendario laboral peruano; imposibilidad de solapar plantillas activas; arquitectura limpia basada en microservicios y RLS estricta.
- **A tener en cuenta:** Los administradores deben mantener actualizada la tabla `holidays` al inicio de cada año fiscal para que los plazos de trámites nuevos computen con precisión los feriados decretados.
