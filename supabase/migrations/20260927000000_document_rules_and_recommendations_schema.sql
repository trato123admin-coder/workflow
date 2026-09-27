-- ============================================================================
-- Migración: 20260927000000_document_rules_and_recommendations_schema.sql
-- Sprint: 7a (Reglas documentales, simulador y recomendador RULES_ONLY)
-- Tablas: document_rules, ai_recommendations
-- ============================================================================

-- 1. TABLA document_rules (v2 §6, 00-maestro §4.4)
create table if not exists public.document_rules (
  id                      uuid primary key default gen_random_uuid(),
  code                    text not null unique,
  name                    text not null,
  description             text,
  case_model_version_id   uuid references public.case_model_versions(id) on delete cascade,
  process_definition_id   uuid references public.process_definitions(id) on delete set null,
  target_document_type_id uuid not null references public.document_types(id) on delete restrict,
  target_template_id      uuid references public.templates(id) on delete set null,
  effect_type             text not null check (effect_type in ('RECOMMEND', 'EXCLUDE', 'REQUIRE')),
  priority                integer not null check (priority >= 1 and priority <= 100),
  explanation             text not null,
  rule_definition         jsonb not null,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid references public.profiles(id) on delete set null,
  constraint ck_document_rules_definition check (
    jsonb_typeof(rule_definition) = 'object'
    and (rule_definition ? 'version')
    and (rule_definition ? 'conditions')
  )
);

create index if not exists idx_document_rules_code on public.document_rules(code);
create index if not exists idx_document_rules_model on public.document_rules(case_model_version_id);
create index if not exists idx_document_rules_target_doc on public.document_rules(target_document_type_id);
create index if not exists idx_document_rules_is_active on public.document_rules(is_active);
create index if not exists idx_document_rules_priority on public.document_rules(priority asc);

alter table public.document_rules enable row level security;

create trigger set_document_rules_updated_at
  before update on public.document_rules
  for each row execute function private.set_updated_at();

-- Disparador de auditoría estándar reutilizando private.tg_audit_log()
create trigger trg_audit_document_rules
  after insert or update on public.document_rules
  for each row execute function private.tg_audit_log();

-- Políticas RLS para document_rules con (select ...)
create policy document_rules_select on public.document_rules
  for select to authenticated
  using (
    (select private.has_permission('documents.read'))
    or (select private.has_permission('documents.generate'))
    or (select private.has_permission('rules.manage'))
  );

create policy document_rules_insert on public.document_rules
  for insert to authenticated
  with check ((select private.has_permission('rules.manage')));

create policy document_rules_update on public.document_rules
  for update to authenticated
  using ((select private.has_permission('rules.manage')))
  with check ((select private.has_permission('rules.manage')));

grant select, insert, update on public.document_rules to authenticated;
grant all on public.document_rules to service_role;


-- 2. TABLA ai_recommendations (v2 §7, 00-maestro §4.4, §6)
create table if not exists public.ai_recommendations (
  id                           uuid primary key default gen_random_uuid(),
  case_id                      uuid not null references public.cases(id) on delete cascade,
  process_id                   uuid references public.case_processes(id) on delete set null,
  model_provider               text not null default 'RULES_ONLY',
  prompt_version               text not null default 'v1',
  recommended_document_type_id  uuid not null references public.document_types(id) on delete restrict,
  recommended_template_id       uuid references public.templates(id) on delete set null,
  score                        numeric(5, 4) not null check (score >= 0 and score <= 1),
  reasons                      text[] not null default '{}',
  missing_fields               text[] not null default '{}',
  alternatives                 jsonb not null default '[]'::jsonb,
  rules_triggered              jsonb not null default '[]'::jsonb,
  was_accepted                 boolean,
  accepted_at                  timestamptz,
  created_at                   timestamptz not null default now(),
  created_by                   uuid references public.profiles(id) on delete set null,
  constraint ck_ai_recommendations_model_provider check (model_provider = 'RULES_ONLY'),
  constraint ck_ai_recommendations_alternatives check (jsonb_typeof(alternatives) = 'array'),
  constraint ck_ai_recommendations_rules_triggered check (jsonb_typeof(rules_triggered) = 'array')
);

create index if not exists idx_ai_recommendations_case on public.ai_recommendations(case_id);
create index if not exists idx_ai_recommendations_doc_type on public.ai_recommendations(recommended_document_type_id);
create index if not exists idx_ai_recommendations_accepted on public.ai_recommendations(was_accepted);
create index if not exists idx_ai_recommendations_created_at on public.ai_recommendations(created_at desc);

alter table public.ai_recommendations enable row level security;

-- Disparador de auditoría para decisiones y registro de sugerencias
create trigger trg_audit_ai_recommendations
  after insert or update on public.ai_recommendations
  for each row execute function private.tg_audit_log();

-- Políticas RLS para ai_recommendations con (select ...)
create policy ai_recommendations_select on public.ai_recommendations
  for select to authenticated
  using (
    (select private.can_access_case(case_id))
    and (
      (select private.has_permission('documents.read'))
      or (select private.has_permission('ai.use'))
    )
  );

create policy ai_recommendations_insert on public.ai_recommendations
  for insert to authenticated
  with check (
    (select private.can_write_case(case_id))
    and (
      (select private.has_permission('documents.generate'))
      or (select private.has_permission('ai.use'))
    )
    and model_provider = 'RULES_ONLY'
  );

create policy ai_recommendations_update on public.ai_recommendations
  for update to authenticated
  using (
    (select private.can_write_case(case_id))
    and (
      (select private.has_permission('documents.generate'))
      or (select private.has_permission('ai.use'))
    )
  )
  with check (
    (select private.can_write_case(case_id))
    and (
      (select private.has_permission('documents.generate'))
      or (select private.has_permission('ai.use'))
    )
    and model_provider = 'RULES_ONLY'
  );

grant select, insert, update on public.ai_recommendations to authenticated;
grant all on public.ai_recommendations to service_role;


-- 3. ALINEACIÓN DE PERMISOS: ASIGNAR ai.use AL ROL LAWYER
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.code = 'LAWYER' and p.code = 'ai.use'
on conflict do nothing;


-- 4. SEMILLAS: LAS 7 REGLAS LITERALES DE 00-MAESTRO §4.4
do $$
declare
  v_version_id uuid;
  v_dt_partida_matrimonio uuid;
  v_dt_informe_legal uuid;
  v_dt_solicitud_intestada uuid;
  v_dt_carta_notaria uuid;
  v_dt_poder uuid;
  v_dt_copia_literal uuid;
  v_dt_edicto uuid;
  v_dt_informe_abogado uuid;
begin
  select id into v_version_id
  from public.case_model_versions
  where case_model_id = (select id from public.case_models where code = 'SUCESION_INTESTADA_NOTARIAL')
    and version = 1;

  select id into v_dt_partida_matrimonio from public.document_types where code = 'PARTIDA_MATRIMONIO';
  select id into v_dt_informe_legal from public.document_types where code = 'INFORME_LEGAL';
  select id into v_dt_solicitud_intestada from public.document_types where code = 'SOLICITUD_SUCESION_INTESTADA';
  select id into v_dt_carta_notaria from public.document_types where code = 'CARTA_NOTARIA';
  select id into v_dt_poder from public.document_types where code = 'PODER_REPRESENTACION';
  select id into v_dt_copia_literal from public.document_types where code = 'COPIA_LITERAL_DOMINIO';
  select id into v_dt_edicto from public.document_types where code = 'EDICTO_PUBLICACION';
  select id into v_dt_informe_abogado from public.document_types where code = 'INFORME_EXPEDIENTE_ABOGADO';

  -- Regla 1: Partida de matrimonio del causante
  insert into public.document_rules (code, name, case_model_version_id, target_document_type_id, effect_type, priority, explanation, rule_definition)
  values (
    'RULE_SEED_01_PARTIDA_MATRIMONIO',
    'Partida de matrimonio del causante',
    v_version_id,
    v_dt_partida_matrimonio,
    'REQUIRE',
    1,
    'Si el causante estuvo casado o viudo, se requiere partida de matrimonio para acreditar el estado civil y al cónyuge supérstite.',
    jsonb_build_object(
      'version', 1,
      'conditions', jsonb_build_object(
        'all', jsonb_build_array(
          jsonb_build_object('fact', 'case_model.code', 'op', 'eq', 'value', 'SUCESION_INTESTADA_NOTARIAL'),
          jsonb_build_object('fact', 'parties.causante.marital_status', 'op', 'in', 'value', jsonb_build_array('CASADO', 'VIUDO'))
        )
      ),
      'effect', jsonb_build_object('type', 'REQUIRE', 'priority', 1)
    )
  ) on conflict (code) do update set rule_definition = excluded.rule_definition, explanation = excluded.explanation;

  -- Regla 2: Heredero menor de edad
  insert into public.document_rules (code, name, case_model_version_id, target_document_type_id, effect_type, priority, explanation, rule_definition)
  values (
    'RULE_SEED_02_HEREDERO_MENOR',
    'Heredero menor de edad',
    v_version_id,
    v_dt_informe_legal,
    'RECOMMEND',
    1,
    'Existen herederos menores de edad: se recomienda informe legal y verificar su debida representación legal o patria potestad.',
    jsonb_build_object(
      'version', 1,
      'conditions', jsonb_build_object(
        'all', jsonb_build_array(
          jsonb_build_object('fact', 'parties.has_minor_heir', 'op', 'eq', 'value', true)
        )
      ),
      'effect', jsonb_build_object('type', 'RECOMMEND', 'priority', 1)
    )
  ) on conflict (code) do update set rule_definition = excluded.rule_definition, explanation = excluded.explanation;

  -- Regla 3A: Controversia entre herederos (EXCLUDE Solicitud Notarial)
  insert into public.document_rules (code, name, case_model_version_id, target_document_type_id, effect_type, priority, explanation, rule_definition)
  values (
    'RULE_SEED_03A_DISPUTA_EXCLUYE_NOTARIAL',
    'Controversia entre herederos: Excluye trámite notarial',
    v_version_id,
    v_dt_solicitud_intestada,
    'EXCLUDE',
    1,
    'Existe controversia o litigio declarado entre herederos: la vía notarial queda excluida por mandato de la Ley 26662.',
    jsonb_build_object(
      'version', 1,
      'conditions', jsonb_build_object(
        'all', jsonb_build_array(
          jsonb_build_object('fact', 'case.has_dispute', 'op', 'eq', 'value', true)
        )
      ),
      'effect', jsonb_build_object('type', 'EXCLUDE', 'priority', 1)
    )
  ) on conflict (code) do update set rule_definition = excluded.rule_definition, explanation = excluded.explanation;

  -- Regla 3B: Controversia entre herederos (RECOMMEND Informe Legal)
  insert into public.document_rules (code, name, case_model_version_id, target_document_type_id, effect_type, priority, explanation, rule_definition)
  values (
    'RULE_SEED_03B_DISPUTA_RECOMIENDA_INFORME',
    'Controversia entre herederos: Recomienda informe legal',
    v_version_id,
    v_dt_informe_legal,
    'RECOMMEND',
    1,
    'Ante controversia declarada, se recomienda dictaminar informe legal sobre la derivación a la vía judicial.',
    jsonb_build_object(
      'version', 1,
      'conditions', jsonb_build_object(
        'all', jsonb_build_array(
          jsonb_build_object('fact', 'case.has_dispute', 'op', 'eq', 'value', true)
        )
      ),
      'effect', jsonb_build_object('type', 'RECOMMEND', 'priority', 1)
    )
  ) on conflict (code) do update set rule_definition = excluded.rule_definition, explanation = excluded.explanation;

  -- Regla 4: Heredero residente en el extranjero
  insert into public.document_rules (code, name, case_model_version_id, target_document_type_id, effect_type, priority, explanation, rule_definition)
  values (
    'RULE_SEED_04_HEREDERO_EXTRANJERO',
    'Heredero residente en el extranjero',
    v_version_id,
    v_dt_poder,
    'RECOMMEND',
    1,
    'Heredero reside en el extranjero: se requiere/recomienda poder especial por escritura pública o consular con facultades expresas.',
    jsonb_build_object(
      'version', 1,
      'conditions', jsonb_build_object(
        'all', jsonb_build_array(
          jsonb_build_object('fact', 'parties.has_foreign_resident', 'op', 'eq', 'value', true)
        )
      ),
      'effect', jsonb_build_object('type', 'RECOMMEND', 'priority', 1)
    )
  ) on conflict (code) do update set rule_definition = excluded.rule_definition, explanation = excluded.explanation;

  -- Regla 5: Hay inmuebles en el patrimonio
  insert into public.document_rules (code, name, case_model_version_id, target_document_type_id, effect_type, priority, explanation, rule_definition)
  values (
    'RULE_SEED_05_INMUEBLES_PATRIMONIO',
    'Inmuebles en el patrimonio',
    v_version_id,
    v_dt_copia_literal,
    'REQUIRE',
    1,
    'El patrimonio contiene bienes inmuebles: se requiere copia literal de dominio actualizada de cada partida registral.',
    jsonb_build_object(
      'version', 1,
      'conditions', jsonb_build_object(
        'all', jsonb_build_array(
          jsonb_build_object('fact', 'assets.types', 'op', 'contains', 'value', 'INMUEBLE')
        )
      ),
      'effect', jsonb_build_object('type', 'REQUIRE', 'priority', 1)
    )
  ) on conflict (code) do update set rule_definition = excluded.rule_definition, explanation = excluded.explanation;

  -- Regla 6: Ruta judicial definida (Excluye documentos notariales de tramitación)
  insert into public.document_rules (code, name, case_model_version_id, target_document_type_id, effect_type, priority, explanation, rule_definition)
  values (
    'RULE_SEED_06_RUTA_JUDICIAL',
    'Ruta judicial definida excluye trámites notariales',
    v_version_id,
    v_dt_solicitud_intestada,
    'EXCLUDE',
    1,
    'El caso ha sido definido con ruta judicial: los documentos y solicitudes notariales no aplican.',
    jsonb_build_object(
      'version', 1,
      'conditions', jsonb_build_object(
        'all', jsonb_build_array(
          jsonb_build_object('fact', 'case.route', 'op', 'eq', 'value', 'JUDICIAL')
        )
      ),
      'effect', jsonb_build_object('type', 'EXCLUDE', 'priority', 1)
    )
  ) on conflict (code) do update set rule_definition = excluded.rule_definition, explanation = excluded.explanation;

  -- Regla 7: Derivación al abogado cuando no está asignado
  insert into public.document_rules (code, name, case_model_version_id, target_document_type_id, effect_type, priority, explanation, rule_definition)
  values (
    'RULE_SEED_07_DERIVACION_ABOGADO',
    'Derivación al abogado en evaluación legal',
    v_version_id,
    v_dt_informe_abogado,
    'RECOMMEND',
    1,
    'El caso se encuentra en proceso de evaluación legal y carece de abogado asignado: se recomienda informe consolidado para letrado.',
    jsonb_build_object(
      'version', 1,
      'conditions', jsonb_build_object(
        'all', jsonb_build_array(
          jsonb_build_object('fact', 'process.code', 'op', 'eq', 'value', 'EVAL_LEGAL'),
          jsonb_build_object('fact', 'case.assigned_lawyer_id', 'op', 'missing', 'value', null)
        )
      ),
      'effect', jsonb_build_object('type', 'RECOMMEND', 'priority', 1)
    )
  ) on conflict (code) do update set rule_definition = excluded.rule_definition, explanation = excluded.explanation;

end;
$$;
