-- Migración: 20260925100000_cases_and_persons_schema.sql
-- Sprint 3: Esquema de personas, modelos de caso versionados, dependencias, avance ponderado, casos, asignaciones, compuertas de cierre y RLS
-- Precedencia y reglas: AGENTS.md, 00-maestro §3.1-§3.3, §4.1-§4.2, v2 §4, §5, v2.1 §3.1

begin;

-- ============================================================================
-- 1. FUNCIÓN AUXILIAR DE SEGURIDAD: private.is_superuser()
-- ============================================================================
-- Consulta directamente si el usuario activo tiene un rol activo de nivel superusuario con MFA válido
create or replace function private.is_superuser()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.user_roles ur
      join public.profiles p on p.id = ur.user_id and p.is_active = true
      join public.roles r on r.id = ur.role_id and r.is_active = true
     where ur.user_id = (select auth.uid())
       and r.is_superuser = true
       and ((not r.requires_mfa) or (coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'))
  );
$$;

revoke execute on function private.is_superuser() from public, anon;
grant execute on function private.is_superuser() to authenticated, service_role;

-- ============================================================================
-- 2. FUNCIÓN DE VALIDACIÓN RUC (MÓDULO 11)
-- ============================================================================
create or replace function private.validate_ruc_mod11(_ruc text)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_factors int[] := array[5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  v_sum int := 0;
  v_i int;
  v_digit int;
  v_check_digit int;
  v_calculated int;
begin
  if _ruc is null or length(_ruc) <> 11 or _ruc !~ '^\d{11}$' then
    return false;
  end if;

  -- Prefijos válidos en Perú (10: Natural con negocio, 15/17: Especiales, 20: Jurídica)
  if substring(_ruc from 1 for 2) not in ('10', '15', '17', '20') then
    return false;
  end if;

  for v_i in 1..10 loop
    v_digit := substring(_ruc from v_i for 1)::int;
    v_sum := v_sum + (v_digit * v_factors[v_i]);
  end loop;

  v_check_digit := substring(_ruc from 11 for 1)::int;
  v_calculated := 11 - (v_sum % 11);

  if v_calculated = 10 then
    v_calculated := 0;
  elsif v_calculated = 11 then
    v_calculated := 1;
  end if;

  return v_calculated = v_check_digit;
end;
$$;

revoke execute on function private.validate_ruc_mod11(text) from public, anon;
grant execute on function private.validate_ruc_mod11(text) to authenticated, service_role;

-- ============================================================================
-- 3. TABLA persons (S3-01 - Reemplaza a clients)
-- ============================================================================
create table if not exists public.persons (
  id                        uuid primary key default gen_random_uuid(),
  person_type               text not null,
  person_type_cat           text generated always as ('person_types') stored,
  identity_document_type    text,
  identity_doc_cat          text generated always as ('identity_document_types') stored,
  identity_document_number  text,
  first_name                text,
  last_name                 text,                       -- Apellido paterno
  second_last_name          text,                       -- Apellido materno
  legal_name                text,                       -- Razón social (persona jurídica)
  trade_name                text,                       -- Nombre comercial
  birth_date                date,
  marital_status            text,
  marital_status_cat        text generated always as ('marital_statuses') stored,
  nationality               text,
  nationality_cat           text generated always as ('countries') stored,
  email                     text,
  phone                     text,
  address                   text,
  country                   text,
  is_deceased               boolean not null default false,
  death_date                date,
  death_place               text,
  death_certificate_number  text,
  custom_data               jsonb not null default '{}'::jsonb,
  external_data             jsonb,
  is_active                 boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- Claves foráneas compuestas a catálogos oficiales
  foreign key (person_type_cat, person_type)
    references public.catalog_items (catalog_code, code),
  foreign key (identity_doc_cat, identity_document_type)
    references public.catalog_items (catalog_code, code),
  foreign key (marital_status_cat, marital_status)
    references public.catalog_items (catalog_code, code),
  foreign key (nationality_cat, nationality)
    references public.catalog_items (catalog_code, code),

  -- Restricciones de integridad y unicidad
  unique (identity_document_type, identity_document_number),
  check (death_date is null or birth_date is null or death_date >= birth_date),
  check (
    identity_document_type <> 'RUC'
    or identity_document_number is null
    or private.validate_ruc_mod11(identity_document_number)
  ),
  check (
    identity_document_type <> 'DNI'
    or identity_document_number is null
    or identity_document_number ~ '^\d{8}$'
  )
);

create index if not exists idx_persons_document
  on public.persons (identity_document_type, identity_document_number);
create index if not exists idx_persons_active
  on public.persons (is_active);

alter table public.persons enable row level security;

create trigger set_persons_updated_at
  before update on public.persons
  for each row execute function private.set_updated_at();

-- ============================================================================
-- 4. TABLA user_preferences (S3-08 - Filtros persistentes)
-- ============================================================================
create table if not exists public.user_preferences (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  key         text not null,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_preferences enable row level security;

create trigger set_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function private.set_updated_at();

-- ============================================================================
-- 5. TABLAS DE WORKFLOW Y MODELOS DE CASO (S3-03)
-- ============================================================================

-- 5.1 process_definitions
create table if not exists public.process_definitions (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,
  name            text not null,
  description     text,
  default_weight  numeric(5,2) check (default_weight is null or (default_weight >= 0 and default_weight <= 100)),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.process_definitions enable row level security;

create trigger set_process_definitions_updated_at
  before update on public.process_definitions
  for each row execute function private.set_updated_at();

-- 5.2 workflow_statuses (Con categoría semántica obligatoria)
create table if not exists public.workflow_statuses (
  id                       uuid primary key default gen_random_uuid(),
  code                     text unique not null,
  name                     text not null,
  category                 text not null check (category in ('NOT_STARTED', 'IN_PROGRESS', 'WAITING', 'REWORK', 'DONE')),
  percentage               numeric(5,2) not null check (percentage between 0.00 and 100.00),
  semantic_color           text not null default 'neutral',
  keeps_previous_progress  boolean not null default false,
  is_final                 boolean not null default false,
  is_active                boolean not null default true,
  sort_order               int not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_workflow_statuses_category
  on public.workflow_statuses (category);

alter table public.workflow_statuses enable row level security;

create trigger set_workflow_statuses_updated_at
  before update on public.workflow_statuses
  for each row execute function private.set_updated_at();

-- 5.3 case_models
create table if not exists public.case_models (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  name          text not null,
  description   text,
  category      text not null default 'SUCESION_INTESTADA',
  category_cat  text generated always as ('case_categories') stored,
  is_recurring  boolean not null default false,
  is_active     boolean not null default true,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  foreign key (category_cat, category)
    references public.catalog_items (catalog_code, code)
);

alter table public.case_models enable row level security;

create trigger set_case_models_updated_at
  before update on public.case_models
  for each row execute function private.set_updated_at();

-- 5.4 case_model_versions (Inmutable al pasar a PUBLISHED)
create table if not exists public.case_model_versions (
  id             uuid primary key default gen_random_uuid(),
  case_model_id  uuid not null references public.case_models(id) on delete cascade,
  version        integer not null default 1,
  status         text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  published_at   timestamptz,
  published_by   uuid references public.profiles(id),
  change_summary text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (case_model_id, version)
);

create index if not exists idx_case_model_versions_model
  on public.case_model_versions (case_model_id, status);

alter table public.case_model_versions enable row level security;

create trigger set_case_model_versions_updated_at
  before update on public.case_model_versions
  for each row execute function private.set_updated_at();

-- 5.5 case_model_processes (Secuencia, peso, sla_days, is_required)
create table if not exists public.case_model_processes (
  id                     uuid primary key default gen_random_uuid(),
  case_model_version_id  uuid not null references public.case_model_versions(id) on delete cascade,
  process_definition_id  uuid not null references public.process_definitions(id),
  sequence               integer not null,
  weight                 numeric(5,2) not null check (weight >= 0.00 and weight <= 100.00),
  sla_days               integer check (sla_days is null or sla_days > 0),
  is_required            boolean not null default true,
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  unique (case_model_version_id, sequence)
);

create index if not exists idx_case_model_processes_version
  on public.case_model_processes (case_model_version_id);
create index if not exists idx_case_model_processes_definition
  on public.case_model_processes (process_definition_id);

alter table public.case_model_processes enable row level security;

create trigger set_case_model_processes_updated_at
  before update on public.case_model_processes
  for each row execute function private.set_updated_at();

-- 5.6 case_model_process_deps (Grafo de dependencias entre procesos del modelo)
create table if not exists public.case_model_process_deps (
  case_model_process_id  uuid not null references public.case_model_processes(id) on delete cascade,
  depends_on_id          uuid not null references public.case_model_processes(id) on delete cascade,
  created_at             timestamptz not null default now(),

  primary key (case_model_process_id, depends_on_id),
  check (case_model_process_id <> depends_on_id)
);

create index if not exists idx_case_model_process_deps_dep
  on public.case_model_process_deps (depends_on_id);

alter table public.case_model_process_deps enable row level security;

-- ============================================================================
-- 6. TRIGGERS DE INMUTABILIDAD Y SUMA DE PESOS EN MODELOS
-- ============================================================================

-- Trigger sobre case_model_versions:
-- 1) Valida que la suma de pesos de procesos activos sea exactamente 100.00 al pasar a PUBLISHED
-- 2) Impide modificar o eliminar una versión que ya se encuentra en PUBLISHED
create or replace function private.tg_guard_case_model_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sum_weight numeric(8,2);
  v_proc_count integer;
begin
  -- 1. Transición hacia PUBLISHED
  if new.status = 'PUBLISHED' and (tg_op = 'INSERT' or old.status is distinct from 'PUBLISHED') then
    select coalesce(sum(weight), 0.00), count(*)
      into v_sum_weight, v_proc_count
      from public.case_model_processes
     where case_model_version_id = new.id
       and is_active = true;

    if v_proc_count = 0 then
      raise exception 'No se puede publicar una versión de modelo sin procesos configurados';
    end if;

    if v_sum_weight <> 100.00 then
      raise exception 'No se puede publicar el modelo: la suma de pesos de los procesos debe ser exactamente 100.00%% (suma actual: %)', v_sum_weight;
    end if;

    new.published_at := coalesce(new.published_at, now());
    new.published_by := coalesce(new.published_by, (select auth.uid()));
  end if;

  -- 2. Inmutabilidad de versión ya publicada
  if tg_op = 'UPDATE' and old.status = 'PUBLISHED' then
    if new.status <> 'PUBLISHED' then
      raise exception 'Una versión de modelo PUBLISHED es inmutable y no puede cambiar de estado (clone a una nueva versión)';
    end if;
    if new.version <> old.version or new.case_model_id <> old.case_model_id then
      raise exception 'Una versión de modelo PUBLISHED es inmutable: los identificadores y estructura no pueden alterarse';
    end if;
  end if;

  if tg_op = 'DELETE' and old.status = 'PUBLISHED' then
    raise exception 'Una versión de modelo PUBLISHED es inmutable y no puede ser eliminada';
  end if;

  return new;
end;
$$;

create trigger trg_guard_case_model_version_immutability
  before insert or update or delete on public.case_model_versions
  for each row execute function private.tg_guard_case_model_version();

-- Trigger sobre tablas hijas de modelo: impide mutar procesos o dependencias de una versión PUBLISHED
create or replace function private.tg_guard_published_model_child()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version_id uuid;
  v_status text;
begin
  if tg_table_name = 'case_model_processes' then
    v_version_id := coalesce(new.case_model_version_id, old.case_model_version_id);
  else
    -- case_model_process_deps
    select case_model_version_id into v_version_id
      from public.case_model_processes
     where id = coalesce(new.case_model_process_id, old.case_model_process_id);
  end if;

  select status into v_status
    from public.case_model_versions
   where id = v_version_id;

  if v_status = 'PUBLISHED' then
    raise exception 'No se pueden agregar, modificar ni eliminar elementos de una versión de modelo PUBLISHED (es inmutable; clone a una nueva versión)';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_guard_case_model_processes_immutability
  before insert or update or delete on public.case_model_processes
  for each row execute function private.tg_guard_published_model_child();

create trigger trg_guard_case_model_process_deps_immutability
  before insert or update or delete on public.case_model_process_deps
  for each row execute function private.tg_guard_published_model_child();

-- ============================================================================
-- 7. TABLAS DE EJECUCIÓN DE CASOS (S3-02, S3-05, S3-06)
-- ============================================================================

-- 7.1 cases
create table if not exists public.cases (
  id                     uuid primary key default gen_random_uuid(),
  case_number            text unique not null,
  case_model_version_id  uuid not null references public.case_model_versions(id),
  client_person_id       uuid not null references public.persons(id),
  parent_case_id         uuid references public.cases(id),
  title                  text not null,
  description            text,
  route                  text not null default 'POR_DEFINIR',
  route_cat              text generated always as ('case_routes') stored,
  has_dispute            boolean not null default false,
  priority               text not null default 'NORMAL',
  priority_cat           text generated always as ('case_priorities') stored,
  status                 text not null default 'OPEN',
  status_cat             text generated always as ('case_statuses') stored,
  current_progress       numeric(5,2) not null default 0.00
                           check (current_progress between 0.00 and 100.00),
  start_date             date not null default current_date,
  due_date               date,
  closed_at              timestamptz,
  ai_allowed             boolean not null default true,
  is_confidential        boolean not null default false,
  last_activity_at       timestamptz not null default now(),
  custom_data            jsonb not null default '{}'::jsonb,
  created_by             uuid references public.profiles(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- Claves foráneas compuestas a catálogos
  foreign key (route_cat, route)
    references public.catalog_items (catalog_code, code),
  foreign key (priority_cat, priority)
    references public.catalog_items (catalog_code, code),
  foreign key (status_cat, status)
    references public.catalog_items (catalog_code, code)
);

create index if not exists idx_cases_client
  on public.cases (client_person_id);
create index if not exists idx_cases_model_version
  on public.cases (case_model_version_id);
create index if not exists idx_cases_confidential
  on public.cases (is_confidential);
create index if not exists idx_cases_status
  on public.cases (status);

alter table public.cases enable row level security;

create trigger set_cases_updated_at
  before update on public.cases
  for each row execute function private.set_updated_at();

-- 7.2 case_assignments
create table if not exists public.case_assignments (
  id               uuid primary key default gen_random_uuid(),
  case_id          uuid not null references public.cases(id) on delete cascade,
  user_id          uuid not null references public.profiles(id),
  assignment_type  text not null check (assignment_type in ('RESPONSIBLE', 'COLLABORATOR', 'LAWYER', 'VIEWER')),
  is_primary       boolean not null default false,
  assigned_at      timestamptz not null default now(),
  ended_at         timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists idx_case_assignments_lookup
  on public.case_assignments (case_id, user_id)
  where ended_at is null;

create unique index if not exists uq_case_primary_responsible
  on public.case_assignments (case_id)
  where is_primary = true and ended_at is null;

alter table public.case_assignments enable row level security;

-- 7.3 case_processes
create table if not exists public.case_processes (
  id                     uuid primary key default gen_random_uuid(),
  case_id                uuid not null references public.cases(id) on delete cascade,
  case_model_process_id  uuid not null references public.case_model_processes(id),
  process_definition_id  uuid not null references public.process_definitions(id),
  sequence               integer not null,
  weight                 numeric(5,2) not null check (weight >= 0.00 and weight <= 100.00),
  status_id              uuid not null references public.workflow_statuses(id),
  progress               numeric(5,2) not null default 0.00 check (progress between 0.00 and 100.00),
  manual_progress        numeric(5,2) check (manual_progress is null or (manual_progress between 0.00 and 100.00)),
  is_applicable          boolean not null default true,
  sla_days               integer check (sla_days is null or sla_days > 0),
  started_at             timestamptz,
  completed_at           timestamptz,
  due_date               date,
  assigned_to            uuid references public.profiles(id),
  custom_data            jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  unique (case_id, sequence),
  unique (case_id, case_model_process_id)
);

create index if not exists idx_case_processes_case
  on public.case_processes (case_id);
create index if not exists idx_case_processes_status
  on public.case_processes (status_id);
create index if not exists idx_case_processes_model_proc
  on public.case_processes (case_model_process_id);

alter table public.case_processes enable row level security;

-- 7.4 case_events (Inmutable / Append-Only)
create table if not exists public.case_events (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.cases(id) on delete cascade,
  event_type  text not null,
  actor_id    uuid references public.profiles(id),
  title       text not null,
  description text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_case_events_case
  on public.case_events (case_id, created_at desc);

alter table public.case_events enable row level security;

-- Inmutabilidad garantizada por raise_immutable() (hereda de Sprint 0/Sprint 2)
create trigger trg_case_events_immutable
  before update or delete on public.case_events
  for each row execute function private.raise_immutable();

-- ============================================================================
-- 8. TRIGGERS DE AVANCE PONDERADO Y COMPUERTAS DE CIERRE
-- ============================================================================

-- 8.1 Disparador de Avance Ponderado: BEFORE y AFTER sobre case_processes
create or replace function private.tg_case_process_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev_progress numeric(5,2) := 0.00;
  v_ws record;
  v_case_id uuid;
  v_total_progress numeric(5,2);
begin
  -- -------------------------------------------------------------------------
  -- FASE BEFORE (INSERT / UPDATE)
  -- -------------------------------------------------------------------------
  if tg_when = 'BEFORE' then
    if tg_op = 'UPDATE' then
      v_prev_progress := coalesce(old.progress, 0.00);
    end if;

    select percentage, keeps_previous_progress, category
      into v_ws
      from public.workflow_statuses
     where id = new.status_id;

    if not found then
      raise exception 'El estado de workflow especificado (%) no existe', new.status_id;
    end if;

    -- Precedencia: manual_progress > keeps_previous_progress > status.percentage
    if new.manual_progress is not null then
      new.progress := new.manual_progress;
    elsif v_ws.keeps_previous_progress and tg_op = 'UPDATE' then
      new.progress := v_prev_progress;
    else
      new.progress := coalesce(v_ws.percentage, 0.00);
    end if;

    -- Gestión de marcas de tiempo
    if v_ws.category in ('IN_PROGRESS', 'WAITING', 'REWORK', 'DONE') and new.started_at is null then
      new.started_at := now();
    end if;

    if v_ws.category = 'DONE' then
      if new.completed_at is null then
        new.completed_at := now();
      end if;
    elsif tg_op = 'UPDATE' and old.completed_at is not null and v_ws.category <> 'DONE' then
      new.completed_at := null;
    end if;

    new.updated_at := now();
    return new;
  end if;

  -- -------------------------------------------------------------------------
  -- FASE AFTER (INSERT / UPDATE / DELETE)
  -- -------------------------------------------------------------------------
  v_case_id := case when tg_op = 'DELETE' then old.case_id else new.case_id end;

  select coalesce(
    round(
      sum(cp.progress * cp.weight) / nullif(sum(cp.weight), 0),
      2
    ),
    0.00
  )
  into v_total_progress
  from public.case_processes cp
  where cp.case_id = v_case_id
    and cp.is_applicable = true;

  update public.cases
     set current_progress = v_total_progress,
         last_activity_at = now(),
         updated_at       = now()
   where id = v_case_id;

  return null;
end;
$$;

create trigger trg_case_process_progress_before
  before insert or update on public.case_processes
  for each row execute function private.tg_case_process_progress();

create trigger trg_case_process_progress_after
  after insert or update or delete on public.case_processes
  for each row execute function private.tg_case_process_progress();

-- 8.2 Disparador de Compuertas de Dependencias M1
create or replace function private.tg_check_process_dependencies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_category text;
  v_blocking_deps text;
  v_proc_name text;
  v_new_status_name text;
begin
  if tg_op = 'UPDATE' and old.status_id is not distinct from new.status_id then
    return new;
  end if;

  if not new.is_applicable then
    return new;
  end if;

  select category, name into v_new_category, v_new_status_name
    from public.workflow_statuses
   where id = new.status_id;

  -- Aplica cuando se intenta avanzar a categorías activas o concluidas
  if v_new_category in ('IN_PROGRESS', 'DONE') then
    select string_agg(pd.name || ' [' || ws.name || ']', ', ')
      into v_blocking_deps
      from public.case_model_process_deps d
      join public.case_processes cp_dep
        on cp_dep.case_model_process_id = d.depends_on_id
       and cp_dep.case_id = new.case_id
      join public.process_definitions pd
        on pd.id = cp_dep.process_definition_id
      join public.workflow_statuses ws
        on ws.id = cp_dep.status_id
     where d.case_model_process_id = new.case_model_process_id
       and cp_dep.is_applicable = true
       and ws.category <> 'DONE';

    if v_blocking_deps is not null then
      select name into v_proc_name
        from public.process_definitions
       where id = new.process_definition_id;

      raise exception 'Compuerta de cierre M1: el proceso "%" no puede pasar a "%" porque depende de los siguientes procesos no finalizados: %',
        coalesce(v_proc_name, 'Secuencia ' || new.sequence),
        v_new_status_name,
        v_blocking_deps;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_check_process_dependencies
  before update on public.case_processes
  for each row execute function private.tg_check_process_dependencies();

-- ============================================================================
-- 9. FUNCIONES TRANSACCIONALES: create_case_from_model Y close_case
-- ============================================================================

-- 9.1 Creación atómica de expedientes (SECURITY DEFINER)
create or replace function public.create_case_from_model(
  _model_version_id uuid,
  _client_person_id uuid,
  _title             text,
  _description       text default null,
  _route             text default 'POR_DEFINIR',
  _has_dispute       boolean default false,
  _priority          text default 'NORMAL',
  _is_confidential   boolean default false,
  _ai_allowed        boolean default true,
  _responsible_id    uuid default null,
  _lawyer_id         uuid default null,
  _collaborator_ids  uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_version record;
  v_initial_status_id uuid;
  v_case_number text;
  v_case_id uuid;
  v_proc record;
  v_collab_id uuid;
begin
  if not private.has_permission('cases.create') then
    raise exception 'No tiene permiso para crear casos (cases.create)';
  end if;

  select id, status into v_version
    from public.case_model_versions
   where id = _model_version_id;

  if not found then
    raise exception 'La versión de modelo especificada no existe';
  end if;

  if v_version.status <> 'PUBLISHED' then
    raise exception 'Solo se pueden crear casos a partir de versiones de modelo PUBLICADAS (estado actual: %)', v_version.status;
  end if;

  select id into v_initial_status_id
    from public.workflow_statuses
   where category = 'NOT_STARTED' and is_active = true
   order by sort_order asc limit 1;

  if v_initial_status_id is null then
    raise exception 'No existe un estado de workflow activo en categoría NOT_STARTED';
  end if;

  -- Correlativo atómico seguro ante concurrencia
  v_case_number := private.next_case_number();

  insert into public.cases (
    case_number, case_model_version_id, client_person_id, title, description,
    route, has_dispute, priority, status, current_progress,
    ai_allowed, is_confidential, created_by
  ) values (
    v_case_number, _model_version_id, _client_person_id, trim(_title), _description,
    _route, _has_dispute, _priority, 'OPEN', 0.00,
    _ai_allowed, _is_confidential, v_actor_id
  ) returning id into v_case_id;

  -- Instanciación de procesos del modelo
  for v_proc in
    select id, process_definition_id, sequence, weight, sla_days
      from public.case_model_processes
     where case_model_version_id = _model_version_id
       and is_active = true
     order by sequence asc
  loop
    insert into public.case_processes (
      case_id, case_model_process_id, process_definition_id, sequence,
      weight, status_id, progress, is_applicable, sla_days
    ) values (
      v_case_id, v_proc.id, v_proc.process_definition_id, v_proc.sequence,
      v_proc.weight, v_initial_status_id, 0.00, true, v_proc.sla_days
    );
  end loop;

  -- Asignación de gestor responsable
  insert into public.case_assignments (
    case_id, user_id, assignment_type, is_primary
  ) values (
    v_case_id, coalesce(_responsible_id, v_actor_id), 'RESPONSIBLE', true
  );

  -- Asignación de abogado
  if _lawyer_id is not null and _lawyer_id <> coalesce(_responsible_id, v_actor_id) then
    insert into public.case_assignments (
      case_id, user_id, assignment_type, is_primary
    ) values (
      v_case_id, _lawyer_id, 'LAWYER', false
    );
  end if;

  -- Asignación de colaboradores
  if _collaborator_ids is not null then
    foreach v_collab_id in array _collaborator_ids loop
      if v_collab_id is not null
         and v_collab_id <> coalesce(_responsible_id, v_actor_id)
         and v_collab_id <> coalesce(_lawyer_id, '00000000-0000-0000-0000-000000000000'::uuid) then
        insert into public.case_assignments (
          case_id, user_id, assignment_type, is_primary
        ) values (
          v_case_id, v_collab_id, 'COLLABORATOR', false
        ) on conflict do nothing;
      end if;
    end loop;
  end if;

  -- Evento inicial de apertura
  insert into public.case_events (
    case_id, event_type, actor_id, title, description, metadata
  ) values (
    v_case_id, 'CASE_CREATED', v_actor_id, 'Caso aperturado',
    'Expediente creado a partir del modelo publicado con ' || v_case_number,
    jsonb_build_object('model_version_id', _model_version_id, 'case_number', v_case_number)
  );

  return v_case_id;
end;
$$;

revoke execute on function public.create_case_from_model from public, anon;
grant execute on function public.create_case_from_model to authenticated, service_role;

-- 9.2 Cierre de expediente (SECURITY DEFINER - Deja current_progress intacto)
create or replace function public.close_case(_case_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_curr_status text;
  v_uncompleted_processes text;
begin
  if not private.can_write_case(_case_id) then
    raise exception 'No tiene autorización para modificar este caso';
  end if;

  if not private.has_permission('cases.close') then
    raise exception 'No tiene el permiso necesario para cerrar casos (cases.close)';
  end if;

  select status into v_curr_status
    from public.cases
   where id = _case_id;

  if not found then
    raise exception 'El caso especificado no existe';
  end if;

  if v_curr_status = 'COMPLETED' then
    raise exception 'El caso ya se encuentra cerrado (COMPLETED)';
  elsif v_curr_status = 'CANCELLED' then
    raise exception 'No se puede cerrar un caso que ha sido cancelado';
  end if;

  -- Compuerta de cierre M1: todos los procesos aplicables y obligatorios deben estar en DONE
  select string_agg(pd.name || ' [Sec. ' || cp.sequence || ': ' || ws.name || ']', ', ')
    into v_uncompleted_processes
    from public.case_processes cp
    join public.case_model_processes cmp
      on cmp.id = cp.case_model_process_id
    join public.process_definitions pd
      on pd.id = cp.process_definition_id
    join public.workflow_statuses ws
      on ws.id = cp.status_id
   where cp.case_id = _case_id
     and cp.is_applicable = true
     and cmp.is_required = true
     and ws.category <> 'DONE';

  if v_uncompleted_processes is not null then
    raise exception 'Compuerta de cierre M1: no se puede cerrar el caso porque los siguientes procesos obligatorios no han finalizado: %',
      v_uncompleted_processes;
  end if;

  -- Se actualiza el estado a COMPLETED y closed_at. current_progress queda INTACTO (fuente de verdad del trigger)
  update public.cases
     set status           = 'COMPLETED',
         closed_at        = now(),
         last_activity_at = now(),
         updated_at       = now()
   where id = _case_id;

  insert into public.case_events (
    case_id, event_type, actor_id, title, description, metadata
  ) values (
    _case_id,
    'CASE_CLOSED',
    v_actor_id,
    'Caso completado',
    'Expediente cerrado tras verificar el cumplimiento de los procesos obligatorios',
    jsonb_build_object('closed_at', now(), 'closed_by', v_actor_id)
  );
end;
$$;

revoke execute on function public.close_case(uuid) from public, anon;
grant execute on function public.close_case(uuid) to authenticated, service_role;

-- ============================================================================
-- 10. FUNCIONES DE SEGURIDAD RLS EN private
-- ============================================================================

-- 10.1 Lectura de casos (considera asignación y confidencialidad)
create or replace function private.can_access_case(_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cases c
     where c.id = _case_id
       and (
         case when c.is_confidential then
           (select private.is_superuser())
           or exists (
             select 1 from public.case_assignments ca
              where ca.case_id = _case_id
                and ca.user_id = (select auth.uid())
                and ca.ended_at is null
           )
         else
           (select private.has_permission('cases.read.all'))
           or (
             (select private.has_permission('cases.read.assigned'))
             and exists (
               select 1 from public.case_assignments ca
                where ca.case_id = _case_id
                  and ca.user_id = (select auth.uid())
                  and ca.ended_at is null
             )
           )
         end
       )
  );
$$;

revoke execute on function private.can_access_case(uuid) from public, anon;
grant execute on function private.can_access_case(uuid) to authenticated, service_role;

-- 10.2 Escritura de casos (VIEWER nunca escribe)
create or replace function private.can_write_case(_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cases c
     where c.id = _case_id
       and private.can_access_case(_case_id)
       and (
         (select private.has_permission('cases.write.all'))
         or (
           (select private.has_permission('cases.write.assigned'))
           and exists (
             select 1 from public.case_assignments ca
              where ca.case_id = _case_id
                and ca.user_id = (select auth.uid())
                and ca.ended_at is null
                and ca.assignment_type <> 'VIEWER'
           )
         )
       )
  );
$$;

revoke execute on function private.can_write_case(uuid) from public, anon;
grant execute on function private.can_write_case(uuid) to authenticated, service_role;

-- 10.3 Lectura de personas (transversal: accesible por casos o permiso general)
create or replace function private.can_access_person(_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_permission('cases.read.all'))
      or exists (
        select 1 from public.cases c
         where c.client_person_id = _person_id
           and private.can_access_case(c.id)
      );
$$;

revoke execute on function private.can_access_person(uuid) from public, anon;
grant execute on function private.can_access_person(uuid) to authenticated, service_role;

-- ============================================================================
-- 11. POLÍTICAS RLS (ROW LEVEL SECURITY)
-- ============================================================================

-- 11.1 user_preferences
create policy user_preferences_select on public.user_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy user_preferences_insert on public.user_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_preferences_update on public.user_preferences
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_preferences_delete on public.user_preferences
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 11.2 Catálogos y Modelos: SELECT abierto a authenticated, mutación con models.manage
create policy workflow_statuses_select on public.workflow_statuses
  for select to authenticated using (true);
create policy workflow_statuses_insert on public.workflow_statuses
  for insert to authenticated with check ((select private.has_permission('models.manage')));
create policy workflow_statuses_update on public.workflow_statuses
  for update to authenticated using ((select private.has_permission('models.manage'))) with check ((select private.has_permission('models.manage')));
create policy workflow_statuses_delete on public.workflow_statuses
  for delete to authenticated using ((select private.has_permission('models.manage')));

create policy process_definitions_select on public.process_definitions
  for select to authenticated using (true);
create policy process_definitions_insert on public.process_definitions
  for insert to authenticated with check ((select private.has_permission('models.manage')));
create policy process_definitions_update on public.process_definitions
  for update to authenticated using ((select private.has_permission('models.manage'))) with check ((select private.has_permission('models.manage')));
create policy process_definitions_delete on public.process_definitions
  for delete to authenticated using ((select private.has_permission('models.manage')));

create policy case_models_select on public.case_models
  for select to authenticated using (true);
create policy case_models_insert on public.case_models
  for insert to authenticated with check ((select private.has_permission('models.manage')));
create policy case_models_update on public.case_models
  for update to authenticated using ((select private.has_permission('models.manage'))) with check ((select private.has_permission('models.manage')));
create policy case_models_delete on public.case_models
  for delete to authenticated using ((select private.has_permission('models.manage')));

create policy case_model_versions_select on public.case_model_versions
  for select to authenticated using (true);
create policy case_model_versions_insert on public.case_model_versions
  for insert to authenticated with check ((select private.has_permission('models.manage')));
create policy case_model_versions_update on public.case_model_versions
  for update to authenticated using ((select private.has_permission('models.manage'))) with check ((select private.has_permission('models.manage')));
create policy case_model_versions_delete on public.case_model_versions
  for delete to authenticated using ((select private.has_permission('models.manage')));

create policy case_model_processes_select on public.case_model_processes
  for select to authenticated using (true);
create policy case_model_processes_insert on public.case_model_processes
  for insert to authenticated with check ((select private.has_permission('models.manage')));
create policy case_model_processes_update on public.case_model_processes
  for update to authenticated using ((select private.has_permission('models.manage'))) with check ((select private.has_permission('models.manage')));
create policy case_model_processes_delete on public.case_model_processes
  for delete to authenticated using ((select private.has_permission('models.manage')));

create policy case_model_process_deps_select on public.case_model_process_deps
  for select to authenticated using (true);
create policy case_model_process_deps_insert on public.case_model_process_deps
  for insert to authenticated with check ((select private.has_permission('models.manage')));
create policy case_model_process_deps_update on public.case_model_process_deps
  for update to authenticated using ((select private.has_permission('models.manage'))) with check ((select private.has_permission('models.manage')));
create policy case_model_process_deps_delete on public.case_model_process_deps
  for delete to authenticated using ((select private.has_permission('models.manage')));

-- 11.3 persons
create policy persons_select on public.persons
  for select to authenticated
  using ((select private.has_permission('clients.read')) and (select private.can_access_person(id)));

create policy persons_insert on public.persons
  for insert to authenticated
  with check ((select private.has_permission('clients.write')) or (select private.has_permission('cases.create')));

create policy persons_update on public.persons
  for update to authenticated
  using ((select private.has_permission('clients.write')) and (select private.can_access_person(id)))
  with check ((select private.has_permission('clients.write')));

create policy persons_delete on public.persons
  for delete to authenticated
  using ((select private.has_permission('clients.write')) and (select private.is_superuser()));

-- 11.4 cases
create policy cases_select on public.cases
  for select to authenticated
  using ((select private.can_access_case(id)));

create policy cases_insert on public.cases
  for insert to authenticated
  with check ((select private.has_permission('cases.create')));

create policy cases_update on public.cases
  for update to authenticated
  using ((select private.can_write_case(id)))
  with check ((select private.can_write_case(id)));

create policy cases_delete on public.cases
  for delete to authenticated
  using ((select private.has_permission('cases.write.all')) and (select private.is_superuser()));

-- 11.5 case_assignments
create policy case_assignments_select on public.case_assignments
  for select to authenticated
  using ((select private.can_access_case(case_id)));

create policy case_assignments_insert on public.case_assignments
  for insert to authenticated
  with check ((select private.can_write_case(case_id)));

create policy case_assignments_update on public.case_assignments
  for update to authenticated
  using ((select private.can_write_case(case_id)))
  with check ((select private.can_write_case(case_id)));

create policy case_assignments_delete on public.case_assignments
  for delete to authenticated
  using ((select private.can_write_case(case_id)));

-- 11.6 case_processes
-- NOTA DE DISEÑO: case_processes no tiene políticas de INSERT ni DELETE para authenticated
-- porque su única vía legítima de instanciación es la función transaccional create_case_from_model().
create policy case_processes_select on public.case_processes
  for select to authenticated
  using ((select private.can_access_case(case_id)));

create policy case_processes_update on public.case_processes
  for update to authenticated
  using ((select private.can_write_case(case_id)) and (select private.has_permission('processes.update')))
  with check ((select private.can_write_case(case_id)) and (select private.has_permission('processes.update')));

-- 11.7 case_events (Inmutable / Append-Only)
create policy case_events_select on public.case_events
  for select to authenticated
  using ((select private.can_access_case(case_id)));

create policy case_events_insert on public.case_events
  for insert to authenticated
  with check ((select private.can_write_case(case_id)));

commit;
