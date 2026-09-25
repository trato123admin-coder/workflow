-- Script de Verificación: 20260925110000_workflow_and_models_seeds.verify.sql
-- Ejecutar en el SQL Editor de Supabase Staging tras aplicar la migración 20260925110000_workflow_and_models_seeds.sql
-- No modifica datos. Cada consulta incluye el resultado esperado en comentarios.

-- 1. Verificar los 8 estados de workflow sembrados con sus categorías semánticas
-- Resultado esperado: 8 filas
select code, name, category, percentage, semantic_color, keeps_previous_progress, is_final, sort_order
  from public.workflow_statuses
 order by sort_order;
-- Esperado:
-- PENDIENTE   | NOT_STARTED |   0.00 | neutral | f | f
-- INICIADO    | IN_PROGRESS |  10.00 | info    | f | f
-- EN_PROCESO  | IN_PROGRESS |  30.00 | warning | f | f
-- EN_TRAMITE  | IN_PROGRESS |  50.00 | info    | f | f
-- ESPERA      | WAITING     |  70.00 | waiting | t | f
-- OBSERVADO   | REWORK      |  80.00 | danger  | t | f
-- LISTO       | IN_PROGRESS |  90.00 | info    | f | f
-- FINALIZADO  | DONE        | 100.00 | success | f | t

-- 2. Verificar existencia de los 5 modelos de caso
-- Resultado esperado: 5 filas
select code, name, category, is_active
  from public.case_models
 order by code;
-- Esperado:
-- SUCESION_INTESTADA_JUDICIAL | Sucesión Intestada — Vía Judicial
-- SUCESION_INTESTADA_NOTARIAL | Sucesión Intestada — Vía Notarial
-- SUCESION_TESTADA            | Sucesión Testada
-- TRAMITE_DOCUMENTARIO        | Trámite Documentario Genérico
-- TRANSFERENCIA_BIEN_HEREDADO | Transferencia de Bien Heredado

-- 3. Verificar estado de las versiones de los modelos
-- Resultado esperado: SUCESION_INTESTADA_NOTARIAL en PUBLISHED, los demás en DRAFT
select m.code, v.version, v.status, v.published_at is not null as has_published_at
  from public.case_models m
  join public.case_model_versions v on v.case_model_id = m.id
 order by m.code;
-- Esperado:
-- SUCESION_INTESTADA_JUDICIAL | 1 | DRAFT     | f
-- SUCESION_INTESTADA_NOTARIAL | 1 | PUBLISHED | t
-- SUCESION_TESTADA            | 1 | DRAFT     | f
-- TRAMITE_DOCUMENTARIO        | 1 | DRAFT     | f
-- TRANSFERENCIA_BIEN_HEREDADO | 1 | DRAFT     | f

-- 4. Verificar que SUCESION_INTESTADA_NOTARIAL tiene 11 procesos y la suma de pesos es exactamente 100.00
select count(*) as total_processes,
       sum(cmp.weight) as total_weight
  from public.case_model_processes cmp
  join public.case_model_versions cmv on cmv.id = cmp.case_model_version_id
  join public.case_models cm on cm.id = cmv.case_model_id
 where cm.code = 'SUCESION_INTESTADA_NOTARIAL'
   and cmv.version = 1;
-- Esperado: total_processes = 11, total_weight = 100.00

-- 5. Verificar dependencias del modelo principal (SUCESION_INTESTADA_NOTARIAL)
select p_from.sequence as sec_proceso, pd_from.code as proceso,
       p_dep.sequence as sec_depende, pd_dep.code as depende_de
  from public.case_model_process_deps d
  join public.case_model_processes p_from on p_from.id = d.case_model_process_id
  join public.process_definitions pd_from on pd_from.id = p_from.process_definition_id
  join public.case_model_processes p_dep on p_dep.id = d.depends_on_id
  join public.process_definitions pd_dep on pd_dep.id = p_dep.process_definition_id
  join public.case_model_versions cmv on cmv.id = p_from.case_model_version_id
  join public.case_models cm on cm.id = cmv.case_model_id
 where cm.code = 'SUCESION_INTESTADA_NOTARIAL'
 order by p_from.sequence, p_dep.sequence;
-- Esperado: 11 dependencias (sec 6 tiene 2 dependencias: sec 3 y sec 5)
