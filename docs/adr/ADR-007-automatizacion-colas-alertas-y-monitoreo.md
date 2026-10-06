# ADR-007: Automatización I — Colas de Trabajos, Alertas de Dominio y Monitoreo

- **Estado:** Aceptado
- **Fecha:** 2026-10-06
- **Contexto:** Sprint 8 — Automatización I (`v2` §10, `v2.1` §5, `00-maestro` §3.4).

---

## 1. Contexto

El sistema de gestión de casos sucesorios y trámites notariales requería un motor autónomo capaz de:
1. Procesar tareas asíncronas en segundo plano de forma confiable tolerando entornos sin worker continuo (modo `TICK` para capas gratuitas de Render).
2. Despachar alertas de vencimientos de trámites, caducidad de documentos, estancamiento de expedientes y controversias hereditarias sin incurrir en duplicaciones ni vulnerar la privacidad de los expedientes.
3. Brindar a los usuarios interfaces de trabajo diario ("Qué Hago Hoy", "Cola de Aprobaciones"), campana de notificaciones en tiempo real y consola administrativa de monitoreo de trabajos.

---

## 2. Decisiones de Arquitectura

### 2.1 Despertador de Engine y Modo de Ejecución (`TICK` / `CONTINUOUS`)
- **Despacho seguro vía pg_cron y pg_net:** En modalidad `TICK`, `pg_cron` despierta al Engine invocando `POST /v1/jobs/tick` a través de `net.http_post` con timeout explícito de 90 segundos.
- **Blindaje del secreto en Supabase Vault:** El secreto `engine_tick_secret` vive exclusivamente en `vault.decrypted_secrets` con longitud mínima obligatoria de 32 caracteres. Se eliminó la clave `platform.engine_tick_secret` de `setting_definitions` y `system_settings` para evitar exposición en texto plano.
- **Validación estricta en el Engine:** `POST /v1/jobs/tick` verifica la cabecera `Authorization: Bearer <token>` mediante comparación en tiempo constante (`crypto.timingSafeEqual`) contra `ENGINE_TICK_SECRET`, o token JWT de usuario con permiso `settings.manage`.

### 2.2 Motor de Cola de Trabajos (`job_queue`)
- **Concurrencia con `SKIP LOCKED`:** La función `public.claim_jobs()` bloquea lotes mediante `FOR UPDATE SKIP LOCKED` para prevenir condiciones de carrera entre múltiples workers.
- **Recuperación de bloqueos huérfanos:** Trabajos retenidos más allá de `platform.lock_timeout_minutes` (15 min) son desbloqueados automáticamente para reintento.
- **Manejo de fallos y estado `DEAD`:** Los trabajos con error incrementan `attempts` con backoff exponencial. Al alcanzar `max_attempts` transicionan al estado `DEAD`.
- **Aislamiento RLS y RPC de Monitoreo:** Se revocó el privilegio directo de `SELECT` sobre `public.job_queue` a `authenticated`. La consulta desde la interfaz web se realiza exclusivamente mediante la función RPC `public.get_monitoring_jobs()` con paginación (`p_offset`), controlada por `module.monitoring` y con redacción condicional de `payload` y `last_error` según si el usuario posee `settings.manage` o `monitoring.read`.
- **Auditoría de reintentos:** Toda transición desde `FAILED` o `DEAD` hacia `QUEUED` mediante `public.retry_job()` es auditada de forma inmutable mediante el trigger `trg_audit_job_retry`.

### 2.3 Motores de Alerta y Privacidad del Destinatario
- **Control de privacidad en el destinatario:** Toda notificación vinculada a un expediente (`p_case_id` no nulo) valida mediante `private.user_can_access_case()` que el destinatario tenga perfil activo (`P0404`) y acceso legítimo al caso (`P0403`), evitando fugas de información hacia terceros o usuarios inactivos.
- **Deduplicación canónica diaria:** Clave única determinista `p_type:entity_id:user_id:YYYY-MM-DD` calculada en la zona horaria `America/Lima` para evitar saturación de alertas en el mismo día.
- **Cómputo en días hábiles (Decisión D8):** Los plazos de trámites notariales (T-3, T-1, T-0) y caducidad documental (T-30, T-15, T-5) se calculan en días útiles consultando la tabla `holidays`.
- **Estancamiento condicional:** El cálculo de días de inactividad de un caso pausa el conteo si el estado actual pertenece a la categoría semántica `WAITING`.
- **Ventana operativa horaria:** Las alertas automáticas solo se despachan en días y horas laborales configurados (`alerts.working_hours`, `alerts.working_days`).
- **Unificación de canales:** Preferencias de canal unificadas bajo el identificador canónico `APP` (resolución de deuda técnica #7).

### 2.4 Purga y Retención Nocturna
- A las 23:00 Lima (`0 4 * * *` UTC), el mantenimiento nocturno purga exclusivamente:
  - Registros de `job_queue` en estado `DONE` con antigüedad mayor a `retention.done_jobs_days` (7 días provisionales).
  - Notificaciones marcadas como leídas (`is_read = true`) con antigüedad mayor a `retention.notifications_days` (30 días provisionales).
- **Invariante:** Los trabajos en estado `FAILED` y `DEAD` **nunca se purgan automáticamente**, garantizando la trazabilidad y la posibilidad de reintento.

### 2.5 Experiencia de Usuario y Bandejas Operativas
- **Qué Hago Hoy (`/today`):** Muestra trámites por vencer y documentos observados exclusivamente de casos con asignación activa (`case_assignments` con `ended_at` nulo) para el usuario autenticado.
- **Cola de Aprobaciones (`/approvals`):** Bandeja restringida a usuarios con permiso `documents.approve` para revisión de documentos generados, aplicando la regla de cuatro ojos (`docs.four_eyes`).
- **Campana de Notificaciones:** Componente `NotificationsBell` en barra superior con suscripción Realtime, conteo reactivo de no leídas y marcado individual o masivo mediante RPCs dedicadas.

---

## 3. Deuda Técnica Aceptada y Monitoreada

Para asegurar el cierre en tiempo y forma del Sprint 8 sin desviar el alcance, quedan formalmente aceptados y documentados los siguientes ítems para abordaje en sus sprints correspondientes:
1. *Mapeo de roles en pruebas legacy de partes:* Conservar compatibilidad histórica con roles de intervinientes.
2. *Canales adicionales de alerta:* Telegram e integraciones externas quedan programados para el Sprint 9.
3. *Políticas de retención legal definitiva:* Los umbrales de 7 y 30 días se mantienen como provisionales hasta la validación de cumplimiento legal en el Sprint 13.
4. *Módulo de Caja Chica:* Continúa sujeto a la advertencia de auditoría retroactiva establecida en ADR-006.

---

## 4. Consecuencias

- **Positivas:**
  - El sistema cuenta con un motor de automatización completamente desacoplado y funcional en arquitecturas de despliegue gratuitas o de bajo costo (Render + Supabase Cloud).
  - La superficie de ataque RLS queda blindada al impedir el acceso directo de usuarios autenticados a tablas internas (`job_queue`, secretos en `system_settings`).
  - Las alertas de dominio orientan la operación jurídica sin emitir falsos positivos ni alertas duplicadas.
- **Mitigaciones aplicadas:**
  - En caso de indisponibilidad temporal del engine, los cron jobs de Supabase continúan encolando y reintentando sin pérdida de transacciones.
