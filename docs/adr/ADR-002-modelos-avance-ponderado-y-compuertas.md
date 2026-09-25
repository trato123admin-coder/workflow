# ADR-002: Modelos Versionados Inmutables, Avance Ponderado y Compuertas de Dependencias

- **Estado:** Aceptado
- **Fecha:** 2026-09-25
- **Contexto:** Sprint 3 — Casos, Procesos, Intervinientes y Modelos de Workflow

---

## 1. Contexto del Problema
El sistema gestiona expedientes sucesorios cuyos trámites varían según la vía procesal (notarial o judicial) y requieren trazabilidad de avance, control riguroso de prerrequisitos (dependencias entre etapas) y aislamiento confidencial entre gestores asignados. Asimismo, cualquier cambio en las etapas o pesos de un modelo de caso no debe corromper los expedientes en curso.

## 2. Decisiones de Arquitectura

### 2.1 Modelos de Caso Versionados e Inmutables
- Los modelos se estructuran en `case_models`, `case_model_versions`, `case_model_processes` y `case_model_process_deps`.
- Una versión en estado `PUBLISHED` es **estrictamente inmutable** (disparador `trg_guard_case_model_version_immutability`).
- La suma de pesos de los procesos en una versión a publicar debe sumar exactamente **100.00%** (disparador `tg_guard_case_model_version`).
- Todo ajuste en un modelo publicado requiere clonar a una nueva versión (`version + 1`) en borrador (`DRAFT`).

### 2.2 Creación Atómica de Casos (`create_case_from_model`)
- La instanciación de un caso clona la versión publicada del modelo a `case_processes` en una sola transacción atómica mediante la función `public.create_case_from_model`.
- Se genera el código correlativo de expediente mediante `private.next_case_number()`.
- Se registra la asignación del gestor responsable en `case_assignments` y el evento inicial en `case_events`.

### 2.3 Cálculo Automático del Avance Ponderado
- El campo `current_progress` de `cases` se calcula de forma reactiva y determinista mediante el disparador `trg_case_process_progress_after` en `case_processes`.
- Fórmula: suma de `weight` de los procesos con estado finalizado (`category = 'DONE'`) sobre la suma de pesos de procesos aplicables (`is_applicable = true`), escalado al 100%.

### 2.4 Compuertas de Dependencias M1 y Cierre de Caso
- Antes de iniciar o finalizar un proceso, el disparador `trg_guard_case_process_dependencies` valida que todos sus prerrequisitos en `case_model_process_deps` estén en estado `DONE`.
- La función `public.close_case` verifica la compuerta de cierre: ningún proceso obligatorio (`is_required = true`) y aplicable puede quedar pendiente.

### 2.5 Aislamiento RLS en Casos y Directorio de Personas
- Los gestores solo acceden a los casos donde están explícitamente asignados en `case_assignments` (salvo usuarios con permiso `cases.read.all`).
- Las personas no vinculadas a ningún caso permanecen accesibles en el directorio general para usuarios con `clients.read`, pero al vincularse a expedientes quedan sujetas al aislamiento del caso (`private.can_access_person`).

## 3. Consecuencias
- **Positivas:** Trazabilidad determinista; imposibilidad de saltear trámites obligatorios; casos antiguos no se ven afectados por cambios futuros en plantillas de workflow; cero posibilidad de discrepancia en porcentajes de avance.
- **Trade-offs:** La creación de casos y avance de procesos debe realizarse obligatoriamente respetando el grafo de dependencias definido por el modelo.
