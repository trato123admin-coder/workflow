-- ============================================================================
-- Migración: 20260927100000_generation_jobs_schema.sql
-- Sprint: 7b (Generación asíncrona DOCX/PDF, vista previa y aprobación legal)
-- Tablas: generation_jobs, generated_documents
-- Enum: gen_status
-- ============================================================================

-- 1. ENUM gen_status (v2 §4.3, §8.5)
-- Estados del ciclo de vida de documentos generados.
create type public.gen_status as enum (
  'QUEUED',
  'GENERATING',
  'GENERATED',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUPERSEDED',
  'FAILED'
);


-- 2. TABLA generation_jobs (v2 §4.2, §8.2)
-- Trabajos de generación asíncrona. El frontend crea un job y se suscribe
-- a Realtime para ver cambios de status. El worker del engine los procesa.
create table if not exists public.generation_jobs (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid not null references public.cases(id) on delete cascade,
  case_process_id   uuid references public.case_processes(id) on delete set null,
  case_document_id  uuid references public.case_documents(id) on delete set null,
  template_id       uuid not null references public.templates(id) on delete restrict,
  recommendation_id uuid references public.ai_recommendations(id) on delete set null,
  input_data        jsonb not null,
  template_version  integer not null,
  rules_snapshot    jsonb not null default '[]'::jsonb,
  idempotency_key   text not null unique,
  status            gen_status not null default 'QUEUED',
  error             text,
  attempts          integer not null default 0,
  max_attempts      integer not null default 3,
  requested_by      uuid not null references public.profiles(id),
  created_at        timestamptz not null default now(),
  started_at        timestamptz,
  finished_at       timestamptz,
  constraint ck_generation_jobs_input check (jsonb_typeof(input_data) = 'object'),
  constraint ck_generation_jobs_rules check (jsonb_typeof(rules_snapshot) = 'array')
);

create index if not exists idx_generation_jobs_case on public.generation_jobs(case_id);
create index if not exists idx_generation_jobs_status_queued
  on public.generation_jobs(created_at)
  where status = 'QUEUED';
create index if not exists idx_generation_jobs_requested_by on public.generation_jobs(requested_by);

alter table public.generation_jobs enable row level security;

-- Auditoría
create trigger trg_audit_generation_jobs
  after insert or update on public.generation_jobs
  for each row execute function private.tg_audit_log();

-- RLS generation_jobs:
-- SELECT: Acceso al caso + permiso de lectura de documentos o generación
create policy generation_jobs_select on public.generation_jobs
  for select to authenticated
  using (
    (select private.can_access_case(case_id))
    and (
      (select private.has_permission('documents.read'))
      or (select private.has_permission('documents.generate'))
    )
  );

-- INSERT: Escritura en el caso + permiso de generación
create policy generation_jobs_insert on public.generation_jobs
  for insert to authenticated
  with check (
    (select private.can_write_case(case_id))
    and (select private.has_permission('documents.generate'))
  );

-- UPDATE: Solo service_role (el worker actualiza status, attempts, etc.)
-- No se crea política UPDATE para authenticated.

-- Grants
grant select, insert on public.generation_jobs to authenticated;
grant all on public.generation_jobs to service_role;


-- 3. TABLA generated_documents (v2 §4.2)
-- Registro inmutable de cada documento generado, vinculando el job con la
-- versión física del archivo (document_versions) y almacenando snapshots.
create table if not exists public.generated_documents (
  id                        uuid primary key default gen_random_uuid(),
  generation_job_id         uuid not null references public.generation_jobs(id) on delete cascade,
  case_document_id          uuid not null references public.case_documents(id) on delete cascade,
  case_document_version_id  uuid not null references public.document_versions(id) on delete cascade,
  input_snapshot            jsonb not null,
  template_version          integer not null,
  rules_snapshot            jsonb not null default '[]'::jsonb,
  sha256                    text not null,
  format                    text not null check (format in ('DOCX', 'PDF')),
  approval_status           gen_status not null default 'GENERATED',
  approved_by               uuid references public.profiles(id),
  approved_at               timestamptz,
  created_at                timestamptz not null default now(),
  constraint ck_generated_documents_snapshot check (jsonb_typeof(input_snapshot) = 'object'),
  constraint ck_generated_documents_rules check (jsonb_typeof(rules_snapshot) = 'array'),
  constraint ck_generated_documents_approval check (
    (approval_status != 'APPROVED')
    or (approved_by is not null and approved_at is not null)
  )
);

create index if not exists idx_generated_documents_job on public.generated_documents(generation_job_id);
create index if not exists idx_generated_documents_case_doc on public.generated_documents(case_document_id);
create index if not exists idx_generated_documents_status on public.generated_documents(approval_status);

alter table public.generated_documents enable row level security;

-- Auditoría
create trigger trg_audit_generated_documents
  after insert or update on public.generated_documents
  for each row execute function private.tg_audit_log();

-- RLS generated_documents:
-- SELECT: Hereda acceso al caso a través del generation_job
create policy generated_documents_select on public.generated_documents
  for select to authenticated
  using (
    exists (
      select 1 from public.generation_jobs gj
       where gj.id = generation_job_id
         and (select private.can_access_case(gj.case_id))
         and (select private.has_permission('documents.read'))
    )
  );

-- INSERT / UPDATE / DELETE: Solo service_role
-- (el worker crea records; la aprobación también vía service_role desde el engine)
revoke insert, update, delete on public.generated_documents from public, anon, authenticated;
grant select on public.generated_documents to authenticated;
grant all on public.generated_documents to service_role;


-- 4. HABILITAR REALTIME en generation_jobs para suscripción del frontend
alter publication supabase_realtime add table public.generation_jobs;


-- 5. RPC: Función para crear trabajos de generación (invocada desde el frontend)
-- Valida permisos, maneja idempotencia y retorna el job creado.
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
begin
  -- Obtener el usuario autenticado
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado' using errcode = 'P0401';
  end if;

  -- Verificar permisos
  if not (select private.can_write_case(p_case_id)) then
    raise exception 'Sin acceso de escritura al caso' using errcode = 'P0403';
  end if;

  if not (select private.has_permission('documents.generate')) then
    raise exception 'Sin permiso documents.generate' using errcode = 'P0403';
  end if;

  -- Verificar que la plantilla existe y está activa
  select t.version into v_template_version
    from public.templates t
   where t.id = p_template_id
     and t.is_active = true;

  if v_template_version is null then
    raise exception 'Plantilla no encontrada o inactiva' using errcode = 'P0404';
  end if;

  -- Idempotencia: si ya existe un job con la misma key, retornar el existente
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

  -- Crear el job
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

-- Grants para la RPC
grant execute on function public.create_generation_job to authenticated;
