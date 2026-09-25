-- Migración: 20260925110000_workflow_and_models_seeds.sql
-- Sprint 3: Semillas de estados de workflow con categorías semánticas, definiciones de proceso y 5 modelos de caso
-- Precedencia y reglas: 00-maestro §4.1-§4.2, §4.5, v1 §10

begin;

-- ============================================================================
-- 1. ESTADOS DE WORKFLOW (workflow_statuses con categoría semántica)
-- ============================================================================
insert into public.workflow_statuses (code, name, category, percentage, semantic_color, keeps_previous_progress, is_final, is_active, sort_order) values
  ('PENDIENTE',   'Pendiente',             'NOT_STARTED',   0.00, 'neutral', false, false, true, 1),
  ('INICIADO',    'Iniciado',              'IN_PROGRESS',  10.00, 'info',    false, false, true, 2),
  ('EN_PROCESO',  'En Proceso',            'IN_PROGRESS',  30.00, 'warning', false, false, true, 3),
  ('EN_TRAMITE',  'En Trámite',            'IN_PROGRESS',  50.00, 'info',    false, false, true, 4),
  ('ESPERA',      'Espera de Respuesta',   'WAITING',      70.00, 'waiting', true,  false, true, 5),
  ('OBSERVADO',   'Observado',             'REWORK',       80.00, 'danger',  true,  false, true, 6),
  ('LISTO',       'Listo / Conforme',      'IN_PROGRESS',  90.00, 'info',    false, false, true, 7),
  ('FINALIZADO',  'Finalizado',            'DONE',        100.00, 'success', false, true,  true, 8)
on conflict (code) do update
  set name                    = excluded.name,
      category                = excluded.category,
      percentage              = excluded.percentage,
      semantic_color          = excluded.semantic_color,
      keeps_previous_progress = excluded.keeps_previous_progress,
      is_final                = excluded.is_final,
      sort_order              = excluded.sort_order;

-- ============================================================================
-- 2. DEFINICIONES DE PROCESO (process_definitions)
-- ============================================================================
insert into public.process_definitions (code, name, description, default_weight, is_active) values
  -- Procesos de Sucesión Intestada Notarial (00-maestro §4.2)
  ('APERTURA',             'Apertura y contrato de servicio',                            'Recepción del caso, verificación preliminar y suscripción de contrato',                    5.00, true),
  ('DOC_CAUSANTE',         'Documentos del causante',                                    'Recolección y verificación de partida de defunción, nacimiento y DNI del causante',        15.00, true),
  ('HEREDEROS',            'Identificación de herederos',                                'Recopilación de partidas y documentos de identidad de todos los llamados a heredar',        10.00, true),
  ('INVENTARIO',           'Inventario de bienes y deudas',                              'Identificación preliminar de activos inmobiliarios, vehiculares, cuentas y deudas',         10.00, true),
  ('BUSQUEDA_REGISTRAL',   'Búsqueda de testamento y de sucesión previa',                'Certificados negativos de testamento y de sucesión intestada en SUNARP',                    5.00, true),
  ('EVAL_LEGAL',           'Evaluación legal y definición de la vía',                    'Informe legal de abogado: ratificación de procedencia notarial y ausencia de controversia', 10.00, true),
  ('SOLICITUD',            'Solicitud y documentos notariales',                          'Minuta y solicitud notarial de sucesión intestada suscrita por los herederos',              10.00, true),
  ('PRESENTACION',         'Presentación en notaría, anotación preventiva y publicación','Ingreso formal a notaría, anotación preventiva registral y publicación de edictos',         10.00, true),
  ('SEGUIMIENTO_NOTARIAL', 'Seguimiento notarial y acta de sucesión',                    'Cómputo de plazo de oposición (15 días hábiles) y emisión de acta de declaratoria',         10.00, true),
  ('SUNARP',               'Inscripción en SUNARP',                                      'Presentación del parte notarial e inscripción definitiva en el Registro de Personas',       10.00, true),
  ('CIERRE',               'Cierre y entrega de expediente',                             'Consolidación de anotaciones finales y entrega de testimonio y constancia al cliente',       5.00, true),

  -- Procesos adicionales para modelos borrador
  ('SOLICITUD_JUDICIAL',   'Solicitud y demanda judicial',                               'Elaboración y presentación de demanda judicial ante juzgado de paz letrado',               20.00, true),
  ('AUDIENCIA_JUDICIAL',   'Seguimiento de audiencias judiciales',                       'Comparecencias, audiencias de pruebas y absolución de observaciones judiciales',            20.00, true),
  ('SENTENCIA_JUDICIAL',   'Resolución judicial definitiva',                             'Sentencia consentida o ejecutoriada que declara herederos',                                 20.00, true),
  ('VERIF_TESTAMENTO',     'Verificación y apertura de testamento',                      'Comprobación de testamento por escritura pública o protocolización de ológrafo',            25.00, true),
  ('ADJUDICACION_BIEN',    'Partición y adjudicación del bien',                          'Elaboración de minuta de partición o adjudicación de inmueble/vehículo',                    30.00, true),
  ('RECOLECCION_DATOS',    'Recolección y cotejo de información',                        'Recepción y verificación documental para trámite genérico',                                 30.00, true),
  ('GESTION_EXTERNA',      'Gestión ante la entidad competente',                         'Tramitación ante notarías, registros, municipalidades u otras dependencias',                40.00, true)
on conflict (code) do update
  set name           = excluded.name,
      description    = excluded.description,
      default_weight = excluded.default_weight;

-- ============================================================================
-- 3. MODELOS DE CASO (5 Modelos de 00-maestro §4.1)
-- ============================================================================
insert into public.case_models (code, name, description, category, is_recurring, is_active) values
  ('SUCESION_INTESTADA_NOTARIAL', 'Sucesión Intestada — Vía Notarial',    'Trámite no contencioso notarial de declaratoria de herederos según Ley 26662', 'SUCESION_INTESTADA', false, true),
  ('SUCESION_INTESTADA_JUDICIAL', 'Sucesión Intestada — Vía Judicial',    'Proceso no contencioso ante el Poder Judicial por existir controversia o menor sin representante', 'SUCESION_INTESTADA', false, true),
  ('SUCESION_TESTADA',            'Sucesión Testada',                     'Ejecución testamentaria y verificación de disposiciones de última voluntad', 'SUCESION_TESTADA', false, true),
  ('TRANSFERENCIA_BIEN_HEREDADO', 'Transferencia de Bien Heredado',       'Caso derivado para inscripción de dominio o partición tras sucesión inscrita', 'TRANSFERENCIA_BIEN', false, true),
  ('TRAMITE_DOCUMENTARIO',        'Trámite Documentario Genérico',        'Recepción, gestión documental externa y entrega de expedientes administrativos', 'TRAMITE_DOCUMENTARIO', false, true)
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      category    = excluded.category;

-- ============================================================================
-- 4. VERSIONES Y PROCESOS DE LOS MODELOS
-- ============================================================================

-- 4.1 Modelo Principal: SUCESION_INTESTADA_NOTARIAL (Versión 1 Completa y Publicada)
do $$
declare
  v_model_id uuid;
  v_version_id uuid;
  v_p1 uuid; v_p2 uuid; v_p3 uuid; v_p4 uuid; v_p5 uuid;
  v_p6 uuid; v_p7 uuid; v_p8 uuid; v_p9 uuid; v_p10 uuid; v_p11 uuid;
begin
  select id into v_model_id from public.case_models where code = 'SUCESION_INTESTADA_NOTARIAL';

  -- Crear versión 1 en DRAFT primero para poder poblar sus procesos
  insert into public.case_model_versions (case_model_id, version, status, change_summary, is_active)
  values (v_model_id, 1, 'DRAFT', 'Versión inicial oficial con 11 procesos y dependencias completas', true)
  on conflict (case_model_id, version) do update set change_summary = excluded.change_summary
  returning id into v_version_id;

  -- 11 Procesos con pesos que suman exactamente 100.00 (00-maestro §4.2)
  -- Secuencia 1: APERTURA (5%)
  insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight, is_required, is_active)
  values (v_version_id, (select id from public.process_definitions where code = 'APERTURA'), 1, 5.00, true, true)
  on conflict (case_model_version_id, sequence) do update set weight = 5.00 returning id into v_p1;

  -- Secuencia 2: DOC_CAUSANTE (15%)
  insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight, is_required, is_active)
  values (v_version_id, (select id from public.process_definitions where code = 'DOC_CAUSANTE'), 2, 15.00, true, true)
  on conflict (case_model_version_id, sequence) do update set weight = 15.00 returning id into v_p2;

  -- Secuencia 3: HEREDEROS (10%)
  insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight, is_required, is_active)
  values (v_version_id, (select id from public.process_definitions where code = 'HEREDEROS'), 3, 10.00, true, true)
  on conflict (case_model_version_id, sequence) do update set weight = 10.00 returning id into v_p3;

  -- Secuencia 4: INVENTARIO (10%)
  insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight, is_required, is_active)
  values (v_version_id, (select id from public.process_definitions where code = 'INVENTARIO'), 4, 10.00, true, true)
  on conflict (case_model_version_id, sequence) do update set weight = 10.00 returning id into v_p4;

  -- Secuencia 5: BUSQUEDA_REGISTRAL (5%)
  insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight, is_required, is_active)
  values (v_version_id, (select id from public.process_definitions where code = 'BUSQUEDA_REGISTRAL'), 5, 5.00, true, true)
  on conflict (case_model_version_id, sequence) do update set weight = 5.00 returning id into v_p5;

  -- Secuencia 6: EVAL_LEGAL (10%)
  insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight, is_required, is_active)
  values (v_version_id, (select id from public.process_definitions where code = 'EVAL_LEGAL'), 6, 10.00, true, true)
  on conflict (case_model_version_id, sequence) do update set weight = 10.00 returning id into v_p6;

  -- Secuencia 7: SOLICITUD (10%)
  insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight, is_required, is_active)
  values (v_version_id, (select id from public.process_definitions where code = 'SOLICITUD'), 7, 10.00, true, true)
  on conflict (case_model_version_id, sequence) do update set weight = 10.00 returning id into v_p7;

  -- Secuencia 8: PRESENTACION (10%)
  insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight, is_required, is_active)
  values (v_version_id, (select id from public.process_definitions where code = 'PRESENTACION'), 8, 10.00, true, true)
  on conflict (case_model_version_id, sequence) do update set weight = 10.00 returning id into v_p8;

  -- Secuencia 9: SEGUIMIENTO_NOTARIAL (10%)
  insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight, is_required, is_active)
  values (v_version_id, (select id from public.process_definitions where code = 'SEGUIMIENTO_NOTARIAL'), 9, 10.00, true, true)
  on conflict (case_model_version_id, sequence) do update set weight = 10.00 returning id into v_p9;

  -- Secuencia 10: SUNARP (10%)
  insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight, is_required, is_active)
  values (v_version_id, (select id from public.process_definitions where code = 'SUNARP'), 10, 10.00, true, true)
  on conflict (case_model_version_id, sequence) do update set weight = 10.00 returning id into v_p10;

  -- Secuencia 11: CIERRE (5%)
  insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight, is_required, is_active)
  values (v_version_id, (select id from public.process_definitions where code = 'CIERRE'), 11, 5.00, true, true)
  on conflict (case_model_version_id, sequence) do update set weight = 5.00 returning id into v_p11;

  -- Dependencias entre procesos (00-maestro §4.2)
  -- 2 (DOC_CAUSANTE) depende de 1 (APERTURA)
  insert into public.case_model_process_deps (case_model_process_id, depends_on_id)
  values (v_p2, v_p1) on conflict do nothing;

  -- 3 (HEREDEROS) depende de 2 (DOC_CAUSANTE)
  insert into public.case_model_process_deps (case_model_process_id, depends_on_id)
  values (v_p3, v_p2) on conflict do nothing;

  -- 4 (INVENTARIO) depende de 1 (APERTURA)
  insert into public.case_model_process_deps (case_model_process_id, depends_on_id)
  values (v_p4, v_p1) on conflict do nothing;

  -- 5 (BUSQUEDA_REGISTRAL) depende de 1 (APERTURA)
  insert into public.case_model_process_deps (case_model_process_id, depends_on_id)
  values (v_p5, v_p1) on conflict do nothing;

  -- 6 (EVAL_LEGAL) depende de 3 (HEREDEROS) y 5 (BUSQUEDA_REGISTRAL)
  insert into public.case_model_process_deps (case_model_process_id, depends_on_id)
  values (v_p6, v_p3), (v_p6, v_p5) on conflict do nothing;

  -- 7 (SOLICITUD) depende de 6 (EVAL_LEGAL)
  insert into public.case_model_process_deps (case_model_process_id, depends_on_id)
  values (v_p7, v_p6) on conflict do nothing;

  -- 8 (PRESENTACION) depende de 7 (SOLICITUD)
  insert into public.case_model_process_deps (case_model_process_id, depends_on_id)
  values (v_p8, v_p7) on conflict do nothing;

  -- 9 (SEGUIMIENTO_NOTARIAL) depende de 8 (PRESENTACION)
  insert into public.case_model_process_deps (case_model_process_id, depends_on_id)
  values (v_p9, v_p8) on conflict do nothing;

  -- 10 (SUNARP) depende de 9 (SEGUIMIENTO_NOTARIAL)
  insert into public.case_model_process_deps (case_model_process_id, depends_on_id)
  values (v_p10, v_p9) on conflict do nothing;

  -- 11 (CIERRE) depende de 10 (SUNARP)
  insert into public.case_model_process_deps (case_model_process_id, depends_on_id)
  values (v_p11, v_p10) on conflict do nothing;

  -- Una vez configurada la versión completa y con pesos que suman 100, se publica (inmutable)
  update public.case_model_versions
     set status = 'PUBLISHED',
         published_at = now()
   where id = v_version_id;
end $$;

-- 4.2 Modelo SUCESION_INTESTADA_JUDICIAL (Borrador - DRAFT)
do $$
declare
  v_model_id uuid;
  v_version_id uuid;
begin
  select id into v_model_id from public.case_models where code = 'SUCESION_INTESTADA_JUDICIAL';

  insert into public.case_model_versions (case_model_id, version, status, change_summary, is_active)
  values (v_model_id, 1, 'DRAFT', 'Borrador preliminar de sucesión vía judicial', true)
  on conflict (case_model_id, version) do nothing
  returning id into v_version_id;

  if v_version_id is not null then
    insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight, is_required)
    values
      (v_version_id, (select id from public.process_definitions where code = 'APERTURA'), 1, 10.00, true),
      (v_version_id, (select id from public.process_definitions where code = 'DOC_CAUSANTE'), 2, 20.00, true),
      (v_version_id, (select id from public.process_definitions where code = 'SOLICITUD_JUDICIAL'), 3, 30.00, true),
      (v_version_id, (select id from public.process_definitions where code = 'AUDIENCIA_JUDICIAL'), 4, 20.00, true),
      (v_version_id, (select id from public.process_definitions where code = 'SENTENCIA_JUDICIAL'), 5, 20.00, true)
    on conflict do nothing;
  end if;
end $$;

-- 4.3 Modelo SUCESION_TESTADA (Borrador - DRAFT)
do $$
declare
  v_model_id uuid;
  v_version_id uuid;
begin
  select id into v_model_id from public.case_models where code = 'SUCESION_TESTADA';

  insert into public.case_model_versions (case_model_id, version, status, change_summary, is_active)
  values (v_model_id, 1, 'DRAFT', 'Borrador preliminar de sucesión testada', true)
  on conflict (case_model_id, version) do nothing
  returning id into v_version_id;

  if v_version_id is not null then
    insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight, is_required)
    values
      (v_version_id, (select id from public.process_definitions where code = 'APERTURA'), 1, 15.00, true),
      (v_version_id, (select id from public.process_definitions where code = 'VERIF_TESTAMENTO'), 2, 35.00, true),
      (v_version_id, (select id from public.process_definitions where code = 'HEREDEROS'), 3, 20.00, true),
      (v_version_id, (select id from public.process_definitions where code = 'CIERRE'), 4, 30.00, true)
    on conflict do nothing;
  end if;
end $$;

-- 4.4 Modelo TRANSFERENCIA_BIEN_HEREDADO (Borrador - DRAFT)
do $$
declare
  v_model_id uuid;
  v_version_id uuid;
begin
  select id into v_model_id from public.case_models where code = 'TRANSFERENCIA_BIEN_HEREDADO';

  insert into public.case_model_versions (case_model_id, version, status, change_summary, is_active)
  values (v_model_id, 1, 'DRAFT', 'Borrador preliminar de transferencia de bien', true)
  on conflict (case_model_id, version) do nothing
  returning id into v_version_id;

  if v_version_id is not null then
    insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight, is_required)
    values
      (v_version_id, (select id from public.process_definitions where code = 'APERTURA'), 1, 15.00, true),
      (v_version_id, (select id from public.process_definitions where code = 'INVENTARIO'), 2, 25.00, true),
      (v_version_id, (select id from public.process_definitions where code = 'ADJUDICACION_BIEN'), 3, 35.00, true),
      (v_version_id, (select id from public.process_definitions where code = 'SUNARP'), 4, 25.00, true)
    on conflict do nothing;
  end if;
end $$;

-- 4.5 Modelo TRAMITE_DOCUMENTARIO (Borrador - DRAFT)
do $$
declare
  v_model_id uuid;
  v_version_id uuid;
begin
  select id into v_model_id from public.case_models where code = 'TRAMITE_DOCUMENTARIO';

  insert into public.case_model_versions (case_model_id, version, status, change_summary, is_active)
  values (v_model_id, 1, 'DRAFT', 'Borrador preliminar de trámite documentario genérico', true)
  on conflict (case_model_id, version) do nothing
  returning id into v_version_id;

  if v_version_id is not null then
    insert into public.case_model_processes (case_model_version_id, process_definition_id, sequence, weight, is_required)
    values
      (v_version_id, (select id from public.process_definitions where code = 'APERTURA'), 1, 10.00, true),
      (v_version_id, (select id from public.process_definitions where code = 'RECOLECCION_DATOS'), 2, 30.00, true),
      (v_version_id, (select id from public.process_definitions where code = 'GESTION_EXTERNA'), 3, 40.00, true),
      (v_version_id, (select id from public.process_definitions where code = 'CIERRE'), 4, 20.00, true)
    on conflict do nothing;
  end if;
end $$;

commit;
