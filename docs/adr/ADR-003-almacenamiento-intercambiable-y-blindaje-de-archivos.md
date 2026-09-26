# ADR-003: Almacenamiento Intercambiable, Blindaje de Archivos y Sincronización Idempotente

- **Estado:** Aceptado
- **Fecha:** 2026-09-26
- **Contexto:** Sprint 5 — Documentos y Almacenamiento

---

## 1. Contexto del Problema
Los expedientes sucesorios administran documentación sensible (partidas de defunción, nacimiento, DNI, testamentos, copias literales). Se requiere:
1. Evitar dependencia de un único proveedor de almacenamiento físico (Supabase Storage, Cloudflare R2, Google Drive).
2. Impedir accesos directos desde el navegador al almacenamiento para asegurar que toda descarga sea auditada y expire en corto tiempo (URLs firmadas de 60 segundos).
3. Prevenir desbordamiento de cuota en planes gratuitos mediante optimización y compresión en el cliente, deduplicación de bytes y alertas tempranas de ocupación (80%).
4. Vincular automáticamente los documentos requeridos ante la incorporación o baja de herederos y bienes inmuebles sin borrar archivos ya cargados.
5. Garantizar auditoría integral cuando un abogado o revisor legal aprueba (`VALIDATED`) u observa (`OBSERVED`) un documento.

## 2. Decisiones de Arquitectura

### 2.1 Patrón StorageProvider y Blindaje 100% en el Engine
- Todo acceso a archivos físicos pasa por la interfaz desacoplada `StorageProvider` implementada en el motor Fastify (`services/engine`), ejecutada con `service_role`.
- El bucket `case-documents` en Supabase Storage es privado y cuenta con **cero políticas** para roles `authenticated` o `anon`. El navegador nunca interactúa directamente con el bucket.
- Las descargas se emiten exclusivamente vía URLs firmadas con tiempo de vida estricto de **60 segundos** (`GET /v1/downloads/:versionId`), registrando de forma inmutable el evento `DOWNLOAD_DOCUMENT` en `audit_logs`.

### 2.2 Validación Dinámica de Archivos y Parámetros desde `system_settings`
- Queda prohibido hardcodear listas de MIME y topes de tamaño en el código. Los límites se consultan dinámicamente desde `system_settings` (`storage.allowed_mime`, `storage.max_file_mb`).
- Se validan firmas hexadecimales binarias (*magic bytes*) en el servidor para impedir la subida de ejecutables o scripts camuflados como PDF/imágenes.
- Los archivos idénticos se deduplican físicamente calculando el hash criptográfico SHA-256: si el hash ya existe, se reutiliza el `storage_key` en el backend físico y solo se registra una nueva versión lógica en `document_versions`.

### 2.3 Optimización en el Cliente y Generación Nativa de PDF
- Las imágenes se reducen en el navegador a un lado máximo de 2000 px y compresión JPEG 82% mediante HTML5 Canvas antes de transferir.
- Las capturas tomadas con la cámara del dispositivo móvil se convierten nativamente a formato PDF 1.4 (`convertImageToPdf`) sin librerías externas pesadas, encapsulando los bytes JPEG mediante flujo `/DCTDecode`.

### 2.4 Sincronización Idempotente de Slots (`sync_case_document_slots`)
- La función de base de datos `public.sync_case_document_slots` (`SECURITY DEFINER`) evalúa el modelo del caso, las partes activas (`HEREDERO`, `CAUSANTE`) y los bienes inmuebles para instanciar los slots correspondientes en `case_documents`.
- Si un interviniente o bien es desactivado, los slots asociados se marcan como inactivos (`is_active = false`), pero **nunca se eliminan físicamente** de la base de datos para preservar la trazabilidad documental y los archivos históricos.

### 2.5 Trazabilidad y Disparador de Auditoría en `case_documents`
- Para cerrar la brecha de auditoría en la validación legal de documentos, el trigger `trg_audit_case_documents` (`AFTER INSERT OR UPDATE`) conecta `case_documents` con `private.tg_audit_log()`.
- Cualquier cambio de estado a `VALIDATED` u `OBSERVED` realizado por los revisores legales queda registrado en `audit_logs` con `user_id`, `old_data.status` y `new_data.status`.

## 3. Consecuencias
- **Positivas:**
  - Desacoplamiento total del almacenamiento físico (cambiar `storage.primary_backend` a Cloudflare R2 no altera la lógica de negocio).
  - Máxima seguridad de datos: ni siquiera un token de usuario autenticado puede evadir la auditoría de descargas.
  - Trazabilidad y no repudio ante observaciones o aprobaciones legales.
  - Ahorro sustancial de cuota mediante optimización y deduplicación.
- **Trade-offs:**
  - Cada subida y descarga requiere el pasaje por el Engine (mitigado con avisos de cold-start de Render > 3.5 s).
