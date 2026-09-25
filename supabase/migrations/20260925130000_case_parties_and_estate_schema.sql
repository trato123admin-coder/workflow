-- Migración: 20260925130000_case_parties_and_estate_schema.sql
-- Sprint 4a: Intervinientes del caso, patrimonio (activos y pasivos), semáforos y creación atómica
-- Precedencia y reglas: AGENTS.md, 00-maestro §3.2-3.5, 01-anexo A.4, v2.1 §3.1, §3.5, §3.8

begin;

-- ============================================================================
-- 0. TRIGGER DE AUDITORÍA AUTOMÁTICA (private.tg_audit_log)
-- ============================================================================
create or replace function private.tg_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity_id uuid;
  v_old jsonb := null;
  v_new jsonb := null;
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'CREATE';
    v_entity_id := new.id;
    v_new := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_action := 'UPDATE';
    v_entity_id := new.id;
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
  elsif tg_op = 'DELETE' then
    v_action := 'DELETE';
    v_entity_id := old.id;
    v_old := to_jsonb(old);
  end if;

  perform private.log_audit_event(
    _user_id := (select auth.uid()),
    _module := 'cases',
    _entity_type := tg_table_name::text,
    _entity_id := v_entity_id,
    _action := v_action,
    _old_data := v_old,
    _new_data := v_new
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function private.tg_audit_log() from public, anon;
grant execute on function private.tg_audit_log() to authenticated, service_role;

-- ============================================================================
-- 1. TABLA case_parties (S4-01 - Intervinientes del caso)
-- ============================================================================
create table if not exists public.case_parties (
  id                        uuid primary key default gen_random_uuid(),
  case_id                   uuid not null references public.cases(id) on delete cascade,
  person_id                 uuid not null references public.persons(id),
  party_role                text not null,
  party_role_cat            text generated always as ('party_roles') stored,
  relationship_to_deceased  text,
  relationship_cat          text generated always as ('relationship_types') stored,
  heir_status               text,
  heir_status_cat           text generated always as ('heir_statuses') stored,
  share_percent             numeric(7,4) check (share_percent is null or (share_percent >= 0 and share_percent <= 100)),
  represented_by            uuid references public.persons(id),
  notes                     text,
  custom_data               jsonb not null default '{}'::jsonb,
  is_active                 boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- Claves foráneas compuestas a catálogos oficiales
  foreign key (party_role_cat, party_role)
    references public.catalog_items (catalog_code, code),
  foreign key (relationship_cat, relationship_to_deceased)
    references public.catalog_items (catalog_code, code),
  foreign key (heir_status_cat, heir_status)
    references public.catalog_items (catalog_code, code),

  -- Una persona solo puede tener un rol específico una vez por caso
  unique (case_id, person_id, party_role)
);

-- REGLA BLOQUEANTE (00-maestro §3.2, §3.5): Solo un CAUSANTE activo por expediente
create unique index if not exists one_causante_per_case on public.case_parties (case_id)
  where party_role = 'CAUSANTE' and is_active = true;

-- Índices de consulta y rendimiento en claves foráneas
create index if not exists idx_case_parties_case_id on public.case_parties (case_id);
create index if not exists idx_case_parties_person_id on public.case_parties (person_id);
create index if not exists idx_case_parties_represented_by on public.case_parties (represented_by);
create index if not exists idx_case_parties_role_active on public.case_parties (party_role, is_active);

alter table public.case_parties enable row level security;

create trigger set_case_parties_updated_at
  before update on public.case_parties
  for each row execute function private.set_updated_at();

create trigger trg_audit_case_parties
  after insert or update or delete on public.case_parties
  for each row execute function private.tg_audit_log();

-- ============================================================================
-- 2. TABLA case_assets (S4-02 - Activos / Bienes del causante)
-- ============================================================================
create table if not exists public.case_assets (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid not null references public.cases(id) on delete cascade,
  asset_type        text not null,
  asset_type_cat    text generated always as ('asset_types') stored,
  description       text not null,
  registry_office   text,
  registry_ref      text,
  ownership_percent numeric(7,4) not null default 100.0000 check (ownership_percent >= 0 and ownership_percent <= 100),
  estimated_value   numeric(14,2),
  currency          text not null default 'PEN',
  currency_cat      text generated always as ('currencies') stored,
  status            text not null,
  status_cat        text generated always as ('asset_statuses') stored,
  custom_data       jsonb not null default '{}'::jsonb,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Claves foráneas compuestas a catálogos oficiales
  foreign key (asset_type_cat, asset_type)
    references public.catalog_items (catalog_code, code),
  foreign key (currency_cat, currency)
    references public.catalog_items (catalog_code, code),
  foreign key (status_cat, status)
    references public.catalog_items (catalog_code, code),

  -- REGLA NO NEGOCIABLE (00-maestro §3.2, §7): Cuentas bancarias SOLO almacenan los últimos 4 dígitos.
  -- NUNCA debe guardarse el número completo de cuenta bancaria ni el CCI.
  -- Si asset_type = 'CUENTA_BANCARIA', registry_ref debe ser nulo o contener exactamente 4 dígitos numéricos.
  constraint chk_case_assets_bank_account_digits check (
    asset_type <> 'CUENTA_BANCARIA' or (
      registry_ref is null or registry_ref ~ '^[0-9]{4}$'
    )
  )
);

create index if not exists idx_case_assets_case_id on public.case_assets (case_id);
create index if not exists idx_case_assets_type on public.case_assets (asset_type);

alter table public.case_assets enable row level security;

create trigger set_case_assets_updated_at
  before update on public.case_assets
  for each row execute function private.set_updated_at();

create trigger trg_audit_case_assets
  after insert or update or delete on public.case_assets
  for each row execute function private.tg_audit_log();

-- ============================================================================
-- 3. TABLA case_liabilities (S4-02 - Pasivos / Deudas de la masa hereditaria)
-- ============================================================================
create table if not exists public.case_liabilities (
  id                  uuid primary key default gen_random_uuid(),
  case_id             uuid not null references public.cases(id) on delete cascade,
  liability_type      text not null,
  liability_type_cat  text generated always as ('liability_types') stored,
  creditor_name       text not null,
  creditor_person_id  uuid references public.persons(id),
  amount              numeric(14,2),
  currency            text not null default 'PEN',
  currency_cat        text generated always as ('currencies') stored,
  status              text not null,
  status_cat          text generated always as ('liability_statuses') stored,
  due_date            date,
  notes               text,
  custom_data         jsonb not null default '{}'::jsonb,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  foreign key (liability_type_cat, liability_type)
    references public.catalog_items (catalog_code, code),
  foreign key (currency_cat, currency)
    references public.catalog_items (catalog_code, code),
  foreign key (status_cat, status)
    references public.catalog_items (catalog_code, code)
);

create index if not exists idx_case_liabilities_case_id on public.case_liabilities (case_id);
create index if not exists idx_case_liabilities_creditor_id on public.case_liabilities (creditor_person_id);

alter table public.case_liabilities enable row level security;

create trigger set_case_liabilities_updated_at
  before update on public.case_liabilities
  for each row execute function private.set_updated_at();

create trigger trg_audit_case_liabilities
  after insert or update or delete on public.case_liabilities
  for each row execute function private.tg_audit_log();

-- ============================================================================
-- 4. SEGURIDAD RLS (S4-01, S4-02 - Reutiliza can_access_case y can_write_case)
-- ============================================================================

-- 4.1 Políticas RLS para case_parties (requiere flag module.case_parties)
create policy case_parties_select_policy on public.case_parties
  for select
  using (
    (select private.feature_enabled('module.case_parties'))
    and (select private.has_permission('parties.read'))
    and (select private.can_access_case(case_id))
  );

create policy case_parties_insert_policy on public.case_parties
  for insert
  with check (
    (select private.feature_enabled('module.case_parties'))
    and (select private.has_permission('parties.write'))
    and (select private.can_write_case(case_id))
  );

create policy case_parties_update_policy on public.case_parties
  for update
  using (
    (select private.feature_enabled('module.case_parties'))
    and (select private.has_permission('parties.write'))
    and (select private.can_write_case(case_id))
  )
  with check (
    (select private.feature_enabled('module.case_parties'))
    and (select private.has_permission('parties.write'))
    and (select private.can_write_case(case_id))
  );

create policy case_parties_delete_policy on public.case_parties
  for delete
  using (
    (select private.feature_enabled('module.case_parties'))
    and (select private.has_permission('parties.write'))
    and (select private.can_write_case(case_id))
  );

-- 4.2 Políticas RLS para case_assets (requiere flag module.estate_inventory)
create policy case_assets_select_policy on public.case_assets
  for select
  using (
    (select private.feature_enabled('module.estate_inventory'))
    and (select private.has_permission('estate.read'))
    and (select private.can_access_case(case_id))
  );

create policy case_assets_insert_policy on public.case_assets
  for insert
  with check (
    (select private.feature_enabled('module.estate_inventory'))
    and (select private.has_permission('estate.write'))
    and (select private.can_write_case(case_id))
  );

create policy case_assets_update_policy on public.case_assets
  for update
  using (
    (select private.feature_enabled('module.estate_inventory'))
    and (select private.has_permission('estate.write'))
    and (select private.can_write_case(case_id))
  )
  with check (
    (select private.feature_enabled('module.estate_inventory'))
    and (select private.has_permission('estate.write'))
    and (select private.can_write_case(case_id))
  );

create policy case_assets_delete_policy on public.case_assets
  for delete
  using (
    (select private.feature_enabled('module.estate_inventory'))
    and (select private.has_permission('estate.write'))
    and (select private.can_write_case(case_id))
  );

-- 4.3 Políticas RLS para case_liabilities (requiere flag module.estate_inventory)
create policy case_liabilities_select_policy on public.case_liabilities
  for select
  using (
    (select private.feature_enabled('module.estate_inventory'))
    and (select private.has_permission('estate.read'))
    and (select private.can_access_case(case_id))
  );

create policy case_liabilities_insert_policy on public.case_liabilities
  for insert
  with check (
    (select private.feature_enabled('module.estate_inventory'))
    and (select private.has_permission('estate.write'))
    and (select private.can_write_case(case_id))
  );

create policy case_liabilities_update_policy on public.case_liabilities
  for update
  using (
    (select private.feature_enabled('module.estate_inventory'))
    and (select private.has_permission('estate.write'))
    and (select private.can_write_case(case_id))
  )
  with check (
    (select private.feature_enabled('module.estate_inventory'))
    and (select private.has_permission('estate.write'))
    and (select private.can_write_case(case_id))
  );

create policy case_liabilities_delete_policy on public.case_liabilities
  for delete
  using (
    (select private.feature_enabled('module.estate_inventory'))
    and (select private.has_permission('estate.write'))
    and (select private.can_write_case(case_id))
  );

-- ============================================================================
-- 5. ACTUALIZAR private.can_access_person(_person_id) (S3 Opción A + case_parties)
-- ============================================================================
-- Regla de Negocio:
-- a) Acceso global con 'cases.read.all' (ADMIN, COORDINATOR)
-- b) Prospectos / personas que no están vinculadas a ningún expediente aún (visibles con clients.read)
-- c) Si la persona está vinculada como contratante en un caso accesible vía private.can_access_case()
-- d) Si la persona está vinculada como interviniente activo en un caso accesible vía private.can_access_case()
create or replace function private.can_access_person(_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_permission('cases.read.all'))
      or (
        not exists (
          select 1 from public.cases c
           where c.client_person_id = _person_id
        )
        and not exists (
          select 1 from public.case_parties cp
           where cp.person_id = _person_id
             and cp.is_active = true
        )
      )
      or exists (
        select 1 from public.cases c
         where c.client_person_id = _person_id
           and private.can_access_case(c.id)
      )
      or exists (
        select 1 from public.case_parties cp
          join public.cases c on c.id = cp.case_id
         where cp.person_id = _person_id
           and cp.is_active = true
           and private.can_access_case(c.id)
      );
$$;

revoke execute on function private.can_access_person(uuid) from public, anon;
grant execute on function private.can_access_person(uuid) to authenticated, service_role;

-- ============================================================================
-- 6. EXTENSIÓN ATÓMICA: public.create_case_from_model (S4-04)
-- ============================================================================
-- Permite instanciar el caso y sus intervinientes iniciales (Causante y Herederos)
-- en una sola transacción atómica, evitando casos huérfanos o inconsistentes.
drop function if exists public.create_case_from_model(
  uuid, uuid, text, text, text, boolean, text, boolean, boolean, uuid, uuid, uuid[]
);

create or replace function public.create_case_from_model(
  _model_version_id   uuid,
  _client_person_id   uuid,
  _title               text,
  _description         text default null,
  _route               text default 'POR_DEFINIR',
  _has_dispute         boolean default false,
  _priority            text default 'NORMAL',
  _is_confidential     boolean default false,
  _ai_allowed          boolean default true,
  _responsible_id      uuid default null,
  _lawyer_id           uuid default null,
  _collaborator_ids    uuid[] default '{}'::uuid[],
  _causante_person_id  uuid default null,
  _initial_parties     jsonb default '[]'::jsonb
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
  v_party jsonb;
  v_party_person_id uuid;
  v_party_role text;
  v_party_rel text;
  v_party_heir_status text;
  v_party_share numeric(7,4);
  v_party_rep uuid;
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

  -- Inserción del expediente principal
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
     order by sequence asc
  loop
    insert into public.case_processes (
      case_id, case_model_process_id, process_definition_id,
      sequence, weight, sla_days, status_id, progress, is_applicable
    ) values (
      v_case_id, v_proc.id, v_proc.process_definition_id,
      v_proc.sequence, v_proc.weight, v_proc.sla_days, v_initial_status_id, 0.00, true
    );
  end loop;

  -- Asignaciones de equipo
  if _responsible_id is not null then
    insert into public.case_assignments (case_id, user_id, assignment_type, assigned_by)
    values (v_case_id, _responsible_id, 'RESPONSIBLE', v_actor_id);
  end if;

  if _lawyer_id is not null then
    insert into public.case_assignments (case_id, user_id, assignment_type, assigned_by)
    values (v_case_id, _lawyer_id, 'LAWYER', v_actor_id);
  end if;

  if _collaborator_ids is not null and array_length(_collaborator_ids, 1) > 0 then
    foreach v_collab_id in array _collaborator_ids loop
      if v_collab_id <> coalesce(_responsible_id, '00000000-0000-0000-0000-000000000000'::uuid)
         and v_collab_id <> coalesce(_lawyer_id, '00000000-0000-0000-0000-000000000000'::uuid) then
        insert into public.case_assignments (case_id, user_id, assignment_type, assigned_by)
        values (v_case_id, v_collab_id, 'COLLABORATOR', v_actor_id);
      end if;
    end loop;
  end if;

  -- Registro atómico del Causante inicial (si fue provisto en el paso 2 del wizard)
  if _causante_person_id is not null then
    insert into public.case_parties (
      case_id, person_id, party_role, is_active
    ) values (
      v_case_id, _causante_person_id, 'CAUSANTE', true
    );
  end if;

  -- Registro atómico de Herederos e intervinientes iniciales (si fueron provistos en el paso 4)
  if _initial_parties is not null and jsonb_typeof(_initial_parties) = 'array' then
    for v_party in select * from jsonb_array_elements(_initial_parties) loop
      v_party_person_id := (v_party->>'person_id')::uuid;
      v_party_role      := coalesce(v_party->>'party_role', 'HEREDERO');
      v_party_rel       := v_party->>'relationship_to_deceased';
      v_party_heir_status := v_party->>'heir_status';
      v_party_share     := (v_party->>'share_percent')::numeric;
      v_party_rep       := (v_party->>'represented_by')::uuid;

      if v_party_person_id is not null then
        insert into public.case_parties (
          case_id, person_id, party_role, relationship_to_deceased,
          heir_status, share_percent, represented_by, is_active
        ) values (
          v_case_id, v_party_person_id, v_party_role, v_party_rel,
          v_party_heir_status, v_party_share, v_party_rep, true
        );
      end if;
    end loop;
  end if;

  -- Evento inicial de apertura en historial inmutable
  insert into public.case_events (case_id, actor_id, action, details)
  values (
    v_case_id, v_actor_id, 'CASE_CREATED',
    jsonb_build_object(
      'case_number', v_case_number,
      'model_version_id', _model_version_id,
      'causante_person_id', _causante_person_id,
      'initial_parties_count', coalesce(jsonb_array_length(_initial_parties), 0)
    )
  );

  return v_case_id;
end;
$$;

revoke execute on function public.create_case_from_model(
  uuid, uuid, text, text, text, boolean, text, boolean, boolean, uuid, uuid, uuid[], uuid, jsonb
) from public, anon;

grant execute on function public.create_case_from_model(
  uuid, uuid, text, text, text, boolean, text, boolean, boolean, uuid, uuid, uuid[], uuid, jsonb
) to authenticated, service_role;

-- ============================================================================
-- 7. FUNCIÓN Y VISTA DE SEMÁFORO EN BASE DE DATOS (S4-03, S4-05, S4-09)
-- ============================================================================
-- Previene consultas N+1 en tableros Kanban, listas y bandeja "qué hago hoy".
create or replace function public.get_case_semaphore_warnings(_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_has_minor_without_rep boolean := false;
  v_heir_shares_invalid   boolean := false;
  v_causante_no_death     boolean := false;
  v_route_undefined       boolean := false;
  v_total_share           numeric(7,4) := 0;
  v_warnings              text[] := '{}';
begin
  -- 1. Heredero menor de edad sin representante legal
  -- Considera mayoría de edad cumplida a los 18 años
  select exists (
    select 1
      from public.case_parties cp
      join public.persons p on p.id = cp.person_id
     where cp.case_id = _case_id
       and cp.party_role = 'HEREDERO'
       and cp.is_active = true
       and p.birth_date is not null
       and (p.birth_date + interval '18 years') > current_date
       and cp.represented_by is null
  ) into v_has_minor_without_rep;

  if v_has_minor_without_rep then
    v_warnings := array_append(v_warnings, 'MINOR_WITHOUT_REPRESENTATIVE');
  end if;

  -- 2. Cuotas de herederos confirmados que no suman exactamente 100%
  select coalesce(sum(cp.share_percent), 0)
    into v_total_share
    from public.case_parties cp
   where cp.case_id = _case_id
     and cp.party_role = 'HEREDERO'
     and cp.heir_status = 'CONFIRMADO'
     and cp.is_active = true;

  if exists (
    select 1 from public.case_parties cp
     where cp.case_id = _case_id
       and cp.party_role = 'HEREDERO'
       and cp.heir_status = 'CONFIRMADO'
       and cp.is_active = true
  ) and v_total_share <> 100.0000 then
    v_heir_shares_invalid := true;
    v_warnings := array_append(v_warnings, 'HEIR_SHARES_NOT_100');
  end if;

  -- 3. Causante activo sin fecha de defunción registrada
  select exists (
    select 1
      from public.case_parties cp
      join public.persons p on p.id = cp.person_id
     where cp.case_id = _case_id
       and cp.party_role = 'CAUSANTE'
       and cp.is_active = true
       and p.death_date is null
  ) into v_causante_no_death;

  if v_causante_no_death then
    v_warnings := array_append(v_warnings, 'CAUSANTE_MISSING_DEATH_DATE');
  end if;

  -- 4. Ruta por definir superada la evaluación legal (secuencia > 6 en proceso o completada)
  select exists (
    select 1
      from public.cases c
      join public.case_processes cp on cp.case_id = c.id
      join public.workflow_statuses ws on ws.id = cp.status_id
     where c.id = _case_id
       and c.route = 'POR_DEFINIR'
       and cp.sequence >= 6
       and ws.category in ('IN_PROGRESS', 'DONE')
  ) into v_route_undefined;

  if v_route_undefined then
    v_warnings := array_append(v_warnings, 'ROUTE_UNDEFINED_PAST_EVAL');
  end if;

  return jsonb_build_object(
    'has_warnings', (array_length(v_warnings, 1) is not null and array_length(v_warnings, 1) > 0),
    'warning_codes', to_jsonb(v_warnings),
    'total_confirmed_share', v_total_share
  );
end;
$$;

revoke execute on function public.get_case_semaphore_warnings(uuid) from public, anon;
grant execute on function public.get_case_semaphore_warnings(uuid) to authenticated, service_role;

commit;
