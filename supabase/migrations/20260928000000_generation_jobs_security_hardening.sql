-- ============================================================================
-- Migración: 20260928000000_generation_jobs_security_hardening.sql
-- Sprint: 7b (Refuerzo de seguridad en generación de documentos)
-- 1. Restricción estricta de INSERT directo en generation_jobs (patrón Sprint 6)
-- 2. Validación de pertenencia de case_document_id al caso indicado
-- 3. Validación de input_data contra lista blanca de document_fields activos
-- ============================================================================

-- 1. BLINDAJE DE RLS: Revocar INSERT directo a authenticated
-- Siguiendo el mismo patrón de templates y template_fields (Sprint 6),
-- la creación de generation_jobs es EXCLUSIVA a través de la función
-- SECURITY DEFINER create_generation_job. authenticated solo tiene SELECT.
drop policy if exists generation_jobs_insert on public.generation_jobs;

revoke insert, update, delete on public.generation_jobs from public, anon, authenticated;
grant select on public.generation_jobs to authenticated;
grant all on public.generation_jobs to service_role;


-- 2. RPC create_generation_job REFORZADA
create or replace function public.create_generation_job(
  p_case_id           uuid,
  p_case_document_id  uuid,
  p_template_id       uuid,
  p_input_data        jsonb,
  p_idempotency_key   text,
  p_recommendation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_template_version int;
  v_existing_job record;
  v_new_job record;
  v_has_template_fields boolean;
  v_invalid_key text;
begin
  -- 1. Obtener el usuario autenticado
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado' using errcode = 'P0401';
  end if;

  -- 2. Verificar permisos de escritura en el caso
  if not (select private.can_write_case(p_case_id)) then
    raise exception 'Sin acceso de escritura al caso' using errcode = 'P0403';
  end if;

  -- 3. Verificar permiso semántico de generación
  if not (select private.has_permission('documents.generate')) then
    raise exception 'Sin permiso documents.generate' using errcode = 'P0403';
  end if;

  -- 4. Verificación de pertenencia: case_document_id debe pertenecer estrictamente a p_case_id
  if p_case_document_id is not null then
    if not exists (
      select 1 from public.case_documents cd
       where cd.id = p_case_document_id
         and cd.case_id = p_case_id
    ) then
      raise exception 'El documento no pertenece al caso indicado' using errcode = 'P0400';
    end if;
  end if;

  -- 5. Verificar que la plantilla existe y está activa
  select t.version into v_template_version
    from public.templates t
   where t.id = p_template_id
     and t.is_active = true;

  if v_template_version is null then
    raise exception 'Plantilla no encontrada o inactiva' using errcode = 'P0404';
  end if;

  -- 6. Validación de lista blanca: cada clave en input_data debe corresponder a un campo activo
  select exists (
    select 1 from public.template_fields where template_id = p_template_id
  ) into v_has_template_fields;

  if v_has_template_fields then
    -- Validar contra los placeholders y codes de template_fields autorizados para esta plantilla
    select k into v_invalid_key
      from jsonb_object_keys(p_input_data) as k
     where k not in (
       select tf.placeholder
         from public.template_fields tf
         join public.document_fields df on df.id = tf.document_field_id
        where tf.template_id = p_template_id
          and df.is_active = true
       union
       select df.code
         from public.template_fields tf
         join public.document_fields df on df.id = tf.document_field_id
        where tf.template_id = p_template_id
          and df.is_active = true
     )
     limit 1;
  else
    -- Fallback defensivo: al menos debe existir en el catálogo global de document_fields activos
    select k into v_invalid_key
      from jsonb_object_keys(p_input_data) as k
     where k not in (
       select code from public.document_fields where is_active = true
     )
     limit 1;
  end if;

  if v_invalid_key is not null then
    raise exception 'El campo "%" en input_data no está autorizado en la lista blanca de la plantilla', v_invalid_key
      using errcode = 'P0400';
  end if;

  -- 7. Idempotencia: si ya existe un job con la misma key, retornar el existente
  select id, status, idempotency_key into v_existing_job
    from public.generation_jobs
   where idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'id', v_existing_job.id,
      'status', v_existing_job.status,
      'idempotency_key', v_existing_job.idempotency_key,
      'already_existed', true
    );
  end if;

  -- 8. Crear el job (vía SECURITY DEFINER, blindado contra manipulación de RLS directa)
  insert into public.generation_jobs (
    case_id, case_document_id, template_id, recommendation_id,
    input_data, template_version, idempotency_key, requested_by
  ) values (
    p_case_id, p_case_document_id, p_template_id, p_recommendation_id,
    p_input_data, v_template_version, p_idempotency_key, v_user_id
  )
  returning id, status, idempotency_key into v_new_job;

  return jsonb_build_object(
    'id', v_new_job.id,
    'status', v_new_job.status,
    'idempotency_key', v_new_job.idempotency_key,
    'already_existed', false
  );
end;
$$;

revoke execute on function public.create_generation_job from public, anon;
grant execute on function public.create_generation_job to authenticated, service_role;
