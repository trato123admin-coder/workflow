-- ============================================================================
-- Migración: 20260925140000_case_comments_and_search_schema.sql
-- Sprint: 4b (Ítems S4-07, S4-08)
-- Contenido:
--   1. Tabla case_comments (M4): Comentarios de expedientes con menciones,
--      disparador de auditoría a case_events y actualización de last_activity_at.
--   2. Políticas RLS de case_comments: Validación de can_access_case/can_write_case
--      y private.is_superuser() para borrado y edición (sin nombres de rol).
--   3. Función public.duplicate_case (M8): Duplicación atómica de expediente con
--      procesos en estado inicial, clonación opcional de intervinientes y bienes,
--      y exclusión intencional de pasivos y deudas.
--   4. Función public.global_search (S4-07, M5): Búsqueda full-text Ctrl+K en
--      español (unaccent, trigram), filtrada estrictamente por private.can_access_case
--      y private.can_access_person + clients.read.
-- ============================================================================

begin;

-- ============================================================================
-- 1. TABLA case_comments (S4-08, Mejora M4)
-- ============================================================================

create table if not exists public.case_comments (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references public.cases(id) on delete cascade,
  user_id      uuid not null references public.profiles(id),
  comment_text text not null check (trim(comment_text) != ''),
  mentions     jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_case_comments_case_date
  on public.case_comments (case_id, created_at desc);

create index if not exists idx_case_comments_user
  on public.case_comments (user_id);

alter table public.case_comments enable row level security;

-- Disparador de actualización automática de updated_at
create trigger set_case_comments_updated_at
  before update on public.case_comments
  for each row execute function private.set_updated_at();

-- Función disparadora para auditar comentarios en case_events y refrescar last_activity_at
create or replace function private.tg_case_comments_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Registrar evento de dominio en case_events
  insert into public.case_events (
    case_id,
    event_type,
    actor_id,
    title,
    description,
    metadata
  ) values (
    new.case_id,
    'COMMENT_ADDED',
    new.user_id,
    'Comentario agregado',
    case
      when length(new.comment_text) > 80 then left(new.comment_text, 77) || '...'
      else new.comment_text
    end,
    jsonb_build_object(
      'comment_id', new.id,
      'mentions', new.mentions
    )
  );

  -- Actualizar última actividad del expediente
  update public.cases
     set last_activity_at = now()
   where id = new.case_id;

  return new;
end;
$$;

create trigger trg_case_comments_audit
  after insert on public.case_comments
  for each row execute function private.tg_case_comments_audit();

-- ============================================================================
-- 2. POLÍTICAS RLS PARA case_comments (S4-08)
-- ============================================================================

-- Lectura: usuario con acceso al caso y permiso de lectura de casos
create policy case_comments_select on public.case_comments
  for select to authenticated
  using (
    (select private.can_access_case(case_id))
    and (
      (select private.has_permission('cases.read.assigned'))
      or (select private.has_permission('cases.read.all'))
    )
  );

-- Inserción: usuario con permiso de escritura en el caso y como autor
create policy case_comments_insert on public.case_comments
  for insert to authenticated
  with check (
    (select private.can_write_case(case_id))
    and user_id = auth.uid()
  );

-- Actualización: autor del comentario o superusuario
create policy case_comments_update on public.case_comments
  for update to authenticated
  using (
    user_id = auth.uid()
    or (select private.is_superuser())
  )
  with check (
    user_id = auth.uid()
    or (select private.is_superuser())
  );

-- Eliminación: autor del comentario o superusuario
create policy case_comments_delete on public.case_comments
  for delete to authenticated
  using (
    user_id = auth.uid()
    or (select private.is_superuser())
  );

-- ============================================================================
-- 3. FUNCIÓN public.duplicate_case (S4-08, Mejora M8)
-- ============================================================================

create or replace function public.duplicate_case(
  _source_case_id  uuid,
  _new_title       text default null,
  _include_parties boolean default true,
  _include_assets  boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_case       record;
  v_new_case_id       uuid;
  v_new_case_number   text;
  v_initial_status_id uuid;
  v_actor_id          uuid := auth.uid();
begin
  -- 1. Verificación de Seguridad y Permisos
  if not private.can_access_case(_source_case_id) then
    raise exception 'No tiene acceso al expediente de origen';
  end if;

  if not (
    (select private.has_permission('cases.create'))
    and (select private.can_write_case(_source_case_id))
  ) then
    raise exception 'No tiene permisos para duplicar este expediente';
  end if;

  -- 2. Obtener datos del caso origen
  select * into v_source_case
    from public.cases
   where id = _source_case_id;

  if not found then
    raise exception 'Expediente de origen no encontrado';
  end if;

  -- 3. Generar nuevo número de caso correlativo y seguro ante concurrencia
  v_new_case_number := private.next_case_number();

  -- 4. Obtener estado inicial del flujo (categoría NOT_STARTED)
  select id into v_initial_status_id
    from public.workflow_statuses
   where category = 'NOT_STARTED'
     and is_active = true
   order by sort_order asc
   limit 1;

  if v_initial_status_id is null then
    select status_id into v_initial_status_id
      from public.cases
     where id = _source_case_id;
  end if;

  -- 5. Insertar nuevo caso (reinicio en estado inicial, 0.00% de avance)
  insert into public.cases (
    case_number,
    title,
    description,
    case_model_version_id,
    client_person_id,
    parent_case_id,
    status_id,
    route,
    priority,
    has_dispute,
    ai_allowed,
    is_confidential,
    progress,
    created_by
  ) values (
    v_new_case_number,
    coalesce(trim(_new_title), v_source_case.title || ' (Copia)'),
    v_source_case.description,
    v_source_case.case_model_version_id,
    v_source_case.client_person_id,
    v_source_case.id,
    v_initial_status_id,
    v_source_case.route,
    v_source_case.priority,
    v_source_case.has_dispute,
    v_source_case.ai_allowed,
    v_source_case.is_confidential,
    0.00,
    v_actor_id
  ) returning id into v_new_case_id;

  -- 6. Copiar asignaciones activas del caso de origen
  insert into public.case_assignments (
    case_id,
    user_id,
    assignment_type,
    is_primary
  )
  select
    v_new_case_id,
    ca.user_id,
    ca.assignment_type,
    ca.is_primary
  from public.case_assignments ca
  where ca.case_id = _source_case_id
    and ca.ended_at is null;

  -- Asegurar que el usuario que ejecuta la duplicación quede asignado como RESPONSIBLE
  if not exists (
    select 1 from public.case_assignments
     where case_id = v_new_case_id
       and user_id = v_actor_id
       and ended_at is null
  ) then
    insert into public.case_assignments (case_id, user_id, assignment_type, is_primary)
    values (v_new_case_id, v_actor_id, 'RESPONSIBLE', true);
  end if;

  -- 7. Inicializar procesos limpios a partir de la versión del modelo
  insert into public.case_processes (
    case_id,
    process_definition_id,
    case_model_process_id,
    status_id,
    sequence,
    weight,
    sla_days,
    is_applicable,
    progress
  )
  select
    v_new_case_id,
    cmp.process_definition_id,
    cmp.id,
    v_initial_status_id,
    cmp.sequence,
    cmp.weight,
    cmp.sla_days,
    true,
    0.00
  from public.case_model_processes cmp
  where cmp.case_model_version_id = v_source_case.case_model_version_id
  order by cmp.sequence asc;

  -- 8. Clonar intervinientes si _include_parties = true (sin recalcular derechos)
  if _include_parties then
    insert into public.case_parties (
      case_id,
      person_id,
      party_role,
      relationship_to_deceased,
      heir_status,
      share_percent,
      represented_by,
      notes,
      custom_data,
      is_active
    )
    select
      v_new_case_id,
      cp.person_id,
      cp.party_role,
      cp.relationship_to_deceased,
      cp.heir_status,
      cp.share_percent,
      cp.represented_by,
      cp.notes,
      cp.custom_data,
      true
    from public.case_parties cp
    where cp.case_id = _source_case_id
      and cp.is_active = true;
  end if;

  -- 9. Clonar bienes si _include_assets = true (reiniciando estado a IDENTIFICADO)
  if _include_assets then
    insert into public.case_assets (
      case_id,
      asset_type,
      description,
      registry_office,
      registry_ref,
      ownership_percent,
      estimated_value,
      currency,
      status,
      custom_data,
      is_active
    )
    select
      v_new_case_id,
      ca.asset_type,
      ca.description,
      ca.registry_office,
      ca.registry_ref,
      ca.ownership_percent,
      ca.estimated_value,
      ca.currency,
      'IDENTIFICADO',
      ca.custom_data,
      true
    from public.case_assets ca
    where ca.case_id = _source_case_id
      and ca.is_active = true;
  end if;

  -- NOTA DE DISEÑO DEL DOMINIO:
  -- case_liabilities (deudas/pasivos) NUNCA se clona en una duplicación.
  -- Las deudas son obligaciones contingentes ligadas al estado de cuenta del proceso
  -- original y no deben trasladarse automáticamente a expedientes derivados.

  -- 10. Registrar evento de dominio en case_events
  insert into public.case_events (
    case_id,
    event_type,
    actor_id,
    title,
    description,
    metadata
  ) values (
    v_new_case_id,
    'CASE_DUPLICATED',
    v_actor_id,
    'Expediente creado por duplicación',
    'Expediente derivado y duplicado a partir del caso ' || coalesce(v_source_case.case_number, v_source_case.id::text),
    jsonb_build_object(
      'source_case_id', _source_case_id,
      'source_case_number', v_source_case.case_number,
      'include_parties', _include_parties,
      'include_assets', _include_assets
    )
  );

  return v_new_case_id;
end;
$$;

revoke execute on function public.duplicate_case(uuid, text, boolean, boolean) from public, anon;
grant execute on function public.duplicate_case(uuid, text, boolean, boolean) to authenticated, service_role;

-- ============================================================================
-- 4. FUNCIÓN public.global_search (S4-07, Mejora M5)
-- ============================================================================

create or replace function public.global_search(
  _query text,
  _limit int default 20
)
returns table (
  entity_type text,
  entity_id   uuid,
  title       text,
  subtitle    text,
  badge       text,
  route_url   text,
  metadata    jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cleaned_query text := trim(coalesce(_query, ''));
  v_limit         int := least(greatest(coalesce(_limit, 20), 1), 50);
begin
  if length(v_cleaned_query) < 2 then
    return;
  end if;

  return query
  with accessible_cases as (
    select
      'CASE'::text as entity_type,
      c.id as entity_id,
      coalesce(c.case_number, 'SIN NÚMERO') || ' - ' || c.title as title,
      case
        when client.person_type = 'JURIDICA' then coalesce(client.legal_name, 'Persona Jurídica')
        else trim(coalesce(client.first_name, '') || ' ' || coalesce(client.last_name, ''))
      end as subtitle,
      coalesce(ws.name, 'Pendiente') as badge,
      '/cases/' || c.id::text as route_url,
      jsonb_build_object(
        'case_number', c.case_number,
        'is_confidential', c.is_confidential,
        'status_category', ws.category,
        'created_at', c.created_at
      ) as metadata,
      case
        when c.case_number ilike v_cleaned_query || '%' then 1.0::real
        when extensions.unaccent(lower(c.title)) ilike '%' || extensions.unaccent(lower(v_cleaned_query)) || '%' then 0.8::real
        else extensions.similarity(c.title, v_cleaned_query)
      end as score
    from public.cases c
    left join public.workflow_statuses ws on ws.id = c.status_id
    left join public.persons client on client.id = c.client_person_id
    where private.can_access_case(c.id)
      and (
        c.case_number ilike '%' || v_cleaned_query || '%'
        or extensions.unaccent(lower(c.title)) ilike '%' || extensions.unaccent(lower(v_cleaned_query)) || '%'
        or (c.description is not null and extensions.unaccent(lower(c.description)) ilike '%' || extensions.unaccent(lower(v_cleaned_query)) || '%')
        or extensions.similarity(c.title, v_cleaned_query) > 0.25
      )
  ),
  accessible_persons as (
    select
      'PERSON'::text as entity_type,
      p.id as entity_id,
      case
        when p.person_type = 'JURIDICA' then coalesce(p.legal_name, p.trade_name, 'Persona Jurídica')
        else trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '') || ' ' || coalesce(p.second_last_name, ''))
      end as title,
      coalesce(p.identity_document_type, 'DOC') || ': ' || coalesce(p.identity_document_number, 'S/N') as subtitle,
      case when p.person_type = 'JURIDICA' then 'Jurídica' else 'Natural' end as badge,
      '/persons/' || p.id::text as route_url,
      jsonb_build_object(
        'document_type', p.identity_document_type,
        'document_number', p.identity_document_number,
        'person_type', p.person_type,
        'email', p.email,
        'phone', p.phone
      ) as metadata,
      case
        when p.identity_document_number ilike v_cleaned_query || '%' then 1.0::real
        when p.identity_document_number ilike '%' || v_cleaned_query || '%' then 0.9::real
        when extensions.unaccent(lower(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))) ilike '%' || extensions.unaccent(lower(v_cleaned_query)) || '%' then 0.8::real
        else 0.5::real
      end as score
    from public.persons p
    where p.is_active = true
      and (select private.has_permission('clients.read'))
      and private.can_access_person(p.id)
      and (
        p.identity_document_number ilike '%' || v_cleaned_query || '%'
        or extensions.unaccent(lower(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '') || ' ' || coalesce(p.second_last_name, ''))) ilike '%' || extensions.unaccent(lower(v_cleaned_query)) || '%'
        or (p.legal_name is not null and extensions.unaccent(lower(p.legal_name)) ilike '%' || extensions.unaccent(lower(v_cleaned_query)) || '%')
        or (p.trade_name is not null and extensions.unaccent(lower(p.trade_name)) ilike '%' || extensions.unaccent(lower(v_cleaned_query)) || '%')
        or (p.email is not null and p.email ilike '%' || v_cleaned_query || '%')
      )
  ),
  combined_results as (
    select * from accessible_cases
    union all
    select * from accessible_persons
  )
  select
    cr.entity_type,
    cr.entity_id,
    cr.title,
    cr.subtitle,
    cr.badge,
    cr.route_url,
    cr.metadata
  from combined_results cr
  order by cr.score desc, cr.title asc
  limit v_limit;
end;
$$;

revoke execute on function public.global_search(text, int) from public, anon;
grant execute on function public.global_search(text, int) to authenticated, service_role;

commit;
