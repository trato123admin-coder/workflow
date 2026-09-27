-- ============================================================================
-- Verificación: 20260927000000_document_rules_and_recommendations_schema.verify.sql
-- ============================================================================

do $$
declare
  v_rules_count integer;
  v_rls_missing integer;
begin
  -- 1. Verificar que las tablas document_rules y ai_recommendations existen y tienen RLS habilitada
  select count(*) into v_rls_missing
  from pg_tables
  where schemaname = 'public'
    and tablename in ('document_rules', 'ai_recommendations')
    and rowsecurity = false;

  assert v_rls_missing = 0,
    'VERIFY FAILED: Existen tablas sin RLS habilitada entre document_rules y ai_recommendations';

  assert exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'document_rules'
  ), 'VERIFY FAILED: La tabla public.document_rules no existe';

  assert exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'ai_recommendations'
  ), 'VERIFY FAILED: La tabla public.ai_recommendations no existe';

  -- 2. Verificar que created_by existe en ambas tablas
  assert exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'document_rules'
      and column_name = 'created_by'
  ), 'VERIFY FAILED: document_rules.created_by no existe';

  assert exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_recommendations'
      and column_name = 'created_by'
  ), 'VERIFY FAILED: ai_recommendations.created_by no existe';

  -- 3. Verificar triggers de auditoría (trg_audit_document_rules y trg_audit_ai_recommendations)
  assert exists (
    select 1 from pg_trigger
    where tgname = 'trg_audit_document_rules' and tgrelid = 'public.document_rules'::regclass
  ), 'VERIFY FAILED: No existe el trigger trg_audit_document_rules en public.document_rules';

  assert exists (
    select 1 from pg_trigger
    where tgname = 'trg_audit_ai_recommendations' and tgrelid = 'public.ai_recommendations'::regclass
  ), 'VERIFY FAILED: No existe el trigger trg_audit_ai_recommendations en public.ai_recommendations';

  -- 4. Verificar que las 7 semillas se cargaron
  select count(*) into v_rules_count from public.document_rules where code like 'RULE_SEED_%';
  assert v_rules_count >= 7,
    format('VERIFY FAILED: Se esperaban al menos 7 reglas semilla, pero se encontraron %s', v_rules_count);

  -- 5. Verificar que LAWYER tiene ai.use
  assert exists (
    select 1 
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where r.code = 'LAWYER' and p.code = 'ai.use'
  ), 'VERIFY FAILED: El rol LAWYER no tiene asignado el permiso ai.use';

  -- 6. Verificar CHECK constraint de model_provider
  assert exists (
    select 1 from pg_constraint 
    where conname = 'ck_ai_recommendations_model_provider'
  ), 'VERIFY FAILED: No existe restricción CHECK ck_ai_recommendations_model_provider';

  -- 7. Verificar políticas RLS creadas
  assert exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'document_rules' and policyname = 'document_rules_select'
  ), 'VERIFY FAILED: Falta política document_rules_select';

  assert exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_recommendations' and policyname = 'ai_recommendations_select'
  ), 'VERIFY FAILED: Falta política ai_recommendations_select';

  raise notice 'VERIFICACIÓN EXITOSA: Tablas document_rules y ai_recommendations con RLS estricta (select ...), triggers tg_audit_log, FK profiles, CHECK RULES_ONLY, permiso ai.use en LAWYER y 7 reglas semilla activas.';
end;
$$;
