# ADR-006: Estado de Sprint 11 (Caja Chica) — Pendiente de Auditoría Retroactiva

- **Estado:** Aceptado con advertencia / Pendiente de auditoría formal
- **Fecha:** 2026-09-30
- **Contexto:** Sprint 11 (Caja chica) implementado y fusionado fuera de orden cronológico antes de Sprints 8, 9 y 10.

---

## 1. Contexto

Durante la ejecución del proyecto, las funcionalidades del **Sprint 11 (Caja Chica: Libro inmutable, solicitudes, arqueo y cierre)** fueron desarrolladas y fusionadas a la rama principal `main` de manera anticipada por requerimiento urgente de operación, antes de completar los sprints planificados en secuencia (Sprint 8: Automatización I, Sprint 9: Integraciones y continuidad, Sprint 10: Cotizaciones y reportes).

La migración `20260928110000_cash_management_schema.sql` ya fue aplicada en el entorno de Supabase Staging y los componentes visuales y utilitarios existen en el repositorio.

---

## 2. Decisión

1. **Estado del código:** Todo el módulo de Caja Chica (esquema de base de datos, políticas RLS, funciones PL/pgSQL, vistas, interfaz web y servicios) queda catalogado oficialmente como **PENDIENTE DE AUDITORÍA RETROACTIVA**.
2. **Condición de uso:** Queda estrictamente prohibido el ingreso de **datos reales o productivos de fondos** en Staging/Producción en las tablas de caja hasta que la auditoría retroactiva sea aprobada formalmente y se cumpla el checklist de go-live del Sprint 13.
3. **Puntos no negociables a auditar:**
   - **Políticas RLS:** Comprobar aislamiento absoluto por rol y permisos (`cash.read`, `cash.write`, `cash.request`, `cash.approve`, `cash.close`, `settings.manage`). Validar que roles sin permisos (ej. `CONSULT`) no lean ni escriban.
   - **Funciones SECURITY DEFINER y `search_path`:** Revisión línea por línea de funciones internas (`tg_assert_cash_open_period`, `tg_validate_cash_reversal`, `tg_cash_reconciliation_approval`, `verify_cash_integrity`) verificando `set search_path = ''`.
   - **Validación de expediente (`can_access_case`):** Verificar que los movimientos o solicitudes asociados a un `case_id` validen que el usuario solicitante/creador tiene acceso legítimo al caso (`private.can_access_case()`).
   - **Inmutabilidad del libro diario:** Validar mediante pruebas negativas que `UPDATE` y `DELETE` sobre `cash_movements` sean rechazados categóricamente bajo cualquier circunstancia.
   - **Control dual en arqueos:** Comprobar que `approved_by <> opened_by` se imponga tanto por restricción de tabla (`CHECK`) como por trigger de base de datos y validación de aplicación.
   - **Segundo factor (MFA `aal2`):** Verificar que la exigencia de MFA gobernada por `security.mfa_cash` bloquee peticiones no autenticadas en nivel 2.
   - **Trazabilidad en auditoría:** Verificar que toda operación relevante quede registrada en `audit_logs` (append-only).
4. **Tratamiento al llegar formalmente al Sprint 11 en el plan:**
   - Cuando el plan de sprints alcance formalmente el turno del Sprint 11, este **no se ejecutará como un sprint de construcción nueva**, sino como una **auditoría integral y endurecimiento del código existente**, con ejecución completa de pruebas pgTAP, pruebas de estrés y verificación de seguridad.

---

## 3. Consecuencias

- **Positivas:** Se mantiene la integridad y rigurosidad del sistema; se evitan vulnerabilidades en un módulo sensible de manejo de dinero antes de operar comercialmente.
- **A tener en cuenta:** Los desarrollos intermedios (Sprint 8, 9, 10) deben asegurar no generar colisiones de nombres con tablas existentes de caja chica y no depender de datos no auditados de caja chica.
