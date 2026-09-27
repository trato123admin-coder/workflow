-- ============================================================================
-- Migración: 20260926020000_external_filings_and_templates_schema.sql
-- Sprint: 6 (Trámites externos, Días útiles y Plantillas DOCX)
-- ============================================================================

-- 1. Extensiones requeridas para restricciones de exclusión
create extension if not exists "btree_gist";

-- 2. Bucket privado para plantillas DOCX (arquitectura StorageProvider sin acceso directo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'templates',
  'templates',
  false,
  10485760, -- 10 MB (techo físico de infraestructura)
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

-- 3. Entidades externas (Notarías, SUNARP, Bancos, Estudios)
create table if not exists public.external_entities (
  id                  uuid primary key default gen_random_uuid(),
  entity_type_cat     text not null default 'external_entity_types',
  entity_type         text not null,
  name                text not null,
  tax_id              text,
  address             text,
  city                text,
  phone               text,
  email               text,
  contacts            jsonb not null default '[]'::jsonb,
  custom_data         jsonb not null default '{}'::jsonb,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint fk_external_entities_type foreign key (entity_type_cat, entity_type)
    references public.catalog_items (catalog_code, code)
);

alter table public.external_entities enable row level security;

create trigger set_external_entities_updated_at
  before update on public.external_entities
  for each row execute function private.set_updated_at();

-- 4. Trámites externos del caso
create table if not exists public.case_filings (
  id                  uuid primary key default gen_random_uuid(),
  case_id             uuid not null references public.cases(id) on delete cascade,
  case_process_id     uuid references public.case_processes(id) on delete set null,
  entity_id           uuid references public.external_entities(id) on delete restrict,
  filing_kind_cat     text not null default 'filing_kinds',
  filing_kind         text not null,
  reference_number    text,
  filed_at            date,
  status_cat          text not null default 'filing_statuses',
  status              text not null default 'PENDIENTE',
  response_due_date   date,
  completed_at        date,
  responsible_user    uuid references public.profiles(id),
  notes               text,
  custom_data         jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint fk_case_filings_kind foreign key (filing_kind_cat, filing_kind)
    references public.catalog_items (catalog_code, code),
  constraint fk_case_filings_status foreign key (status_cat, status)
    references public.catalog_items (catalog_code, code)
);

alter table public.case_filings enable row level security;

create trigger set_case_filings_updated_at
  before update on public.case_filings
  for each row execute function private.set_updated_at();

create trigger trg_audit_case_filings
  after insert or update on public.case_filings
  for each row execute function private.tg_audit_log();

-- 5. Catálogo de campos sustituibles en documentos (lista blanca)
create table if not exists public.document_fields (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique not null,
  label               text not null,
  data_type           text not null,
  source_type         text not null,
  source_path         text not null,
  is_required         boolean not null default false,
  default_value       text,
  validation          jsonb not null default '{}'::jsonb,
  description         text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint chk_document_fields_data_type check (
    data_type in ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'CURRENCY', 'SELECT', 'MULTISELECT', 'TEXTAREA')
  ),
  constraint chk_document_fields_source_path check (
    source_path ~ '^(case|client|parties|estate|liabilities|system|custom)\.[a-zA-Z0-9_.]+$'
  )
);

alter table public.document_fields enable row level security;

create trigger set_document_fields_updated_at
  before update on public.document_fields
  for each row execute function private.set_updated_at();

-- 6. Plantillas documentales (con exclusión de vigencias solapadas y bucket privado)
create table if not exists public.templates (
  id                        uuid primary key default gen_random_uuid(),
  document_type_id          uuid not null references public.document_types(id) on delete cascade,
  name                      text not null,
  version                   integer not null default 1,
  storage_backend           text not null default 'SUPABASE',
  storage_key               text not null,
  mime_type                 text not null default 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  checksum                  text,
  valid_from                date not null default current_date,
  valid_until               date,
  estimated_manual_minutes  integer not null default 0,
  is_active                 boolean not null default true,
  metadata                  jsonb not null default '{}'::jsonb,
  created_by                uuid references public.profiles(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint chk_templates_dates check (valid_until is null or valid_until >= valid_from),
  constraint chk_templates_mime check (
    mime_type in ('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  ),
  constraint no_overlapping_template_validity exclude using gist (
    document_type_id with =,
    daterange(valid_from, valid_until, '[]') with &&
  ) where (is_active = true)
);

alter table public.templates enable row level security;

create trigger set_templates_updated_at
  before update on public.templates
  for each row execute function private.set_updated_at();

-- 7. Campos asociados a cada plantilla
create table if not exists public.template_fields (
  id                  uuid primary key default gen_random_uuid(),
  template_id         uuid not null references public.templates(id) on delete cascade,
  document_field_id   uuid not null references public.document_fields(id) on delete cascade,
  placeholder         text not null,
  position_data       jsonb not null default '{}'::jsonb,
  is_required         boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint uq_template_fields_placeholder unique (template_id, placeholder)
);

alter table public.template_fields enable row level security;

create trigger set_template_fields_updated_at
  before update on public.template_fields
  for each row execute function private.set_updated_at();

-- 8. Función para sumar días útiles (excluye fines de semana y feriados activos)
create or replace function public.add_business_days(_from_date date, _days int)
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  _cur date := _from_date;
  _added int := 0;
  _dow int;
  _is_holiday boolean;
begin
  if _from_date is null then
    return null;
  end if;
  if _days is null or _days <= 0 then
    return _from_date;
  end if;

  while _added < _days loop
    _cur := _cur + interval '1 day';
    _dow := extract(isodow from _cur); -- 1 = Lunes, 7 = Domingo

    if _dow between 1 and 5 then
      select exists(
        select 1 from public.holidays
        where date = _cur and is_active = true
      ) into _is_holiday;

      if not _is_holiday then
        _added := _added + 1;
      end if;
    end if;
  end loop;

  return _cur;
end;
$$;

revoke execute on function public.add_business_days(date, int) from public, anon;
grant execute on function public.add_business_days(date, int) to authenticated, service_role;

-- 9. Políticas RLS

-- 9.1 external_entities
create policy external_entities_select on public.external_entities
  for select to authenticated
  using (
    (select private.feature_enabled('module.external_filings'))
    and (select private.has_permission('entities.read'))
  );

create policy external_entities_insert on public.external_entities
  for insert to authenticated
  with check (
    (select private.feature_enabled('module.external_filings'))
    and (select private.has_permission('entities.manage'))
  );

create policy external_entities_update on public.external_entities
  for update to authenticated
  using (
    (select private.feature_enabled('module.external_filings'))
    and (select private.has_permission('entities.manage'))
  )
  with check (
    (select private.feature_enabled('module.external_filings'))
    and (select private.has_permission('entities.manage'))
  );

create policy external_entities_delete on public.external_entities
  for delete to authenticated
  using (
    (select private.feature_enabled('module.external_filings'))
    and (select private.has_permission('entities.manage'))
  );

-- 9.2 case_filings (reutiliza can_access_case y can_write_case)
create policy case_filings_select on public.case_filings
  for select to authenticated
  using (
    (select private.feature_enabled('module.external_filings'))
    and (select private.has_permission('filings.read'))
    and (select private.can_access_case(case_id))
  );

create policy case_filings_insert on public.case_filings
  for insert to authenticated
  with check (
    (select private.feature_enabled('module.external_filings'))
    and (select private.has_permission('filings.write'))
    and (select private.can_write_case(case_id))
  );

create policy case_filings_update on public.case_filings
  for update to authenticated
  using (
    (select private.feature_enabled('module.external_filings'))
    and (select private.has_permission('filings.write'))
    and (select private.can_write_case(case_id))
  )
  with check (
    (select private.feature_enabled('module.external_filings'))
    and (select private.has_permission('filings.write'))
    and (select private.can_write_case(case_id))
  );

create policy case_filings_delete on public.case_filings
  for delete to authenticated
  using (
    (select private.feature_enabled('module.external_filings'))
    and (select private.has_permission('filings.write'))
    and (select private.can_write_case(case_id))
  );

-- 9.3 document_fields (catálogo de campos: lectura general, edición exclusiva templates.manage)
create policy document_fields_select on public.document_fields
  for select to authenticated
  using (
    (select private.has_permission('documents.read'))
    or (select private.has_permission('templates.manage'))
    or (select private.has_permission('cases.read.all'))
  );

create policy document_fields_insert on public.document_fields
  for insert to authenticated
  with check ((select private.has_permission('templates.manage')));

create policy document_fields_update on public.document_fields
  for update to authenticated
  using ((select private.has_permission('templates.manage')))
  with check ((select private.has_permission('templates.manage')));

create policy document_fields_delete on public.document_fields
  for delete to authenticated
  using ((select private.has_permission('templates.manage')));

-- 9.4 templates (LECTURA: permitida según permisos; ESCRITURA: CERO políticas authenticated, exclusiva service_role)
create policy templates_select on public.templates
  for select to authenticated
  using (
    (select private.has_permission('documents.read'))
    or (select private.has_permission('templates.manage'))
    or (select private.has_permission('cases.read.all'))
  );

-- 9.5 template_fields (LECTURA: permitida según permisos; ESCRITURA: CERO políticas authenticated, exclusiva service_role)
create policy template_fields_select on public.template_fields
  for select to authenticated
  using (
    (select private.has_permission('documents.read'))
    or (select private.has_permission('templates.manage'))
    or (select private.has_permission('cases.read.all'))
  );

-- 10. Permisos de tabla (Grants y Revokes estrictos)
grant select, insert, update, delete on public.external_entities to authenticated, service_role;
grant select, insert, update, delete on public.case_filings to authenticated, service_role;
grant select, insert, update, delete on public.document_fields to authenticated, service_role;

-- templates: Escritura revocada de authenticated y anon; solo lectura para authenticated; todo para service_role
revoke all on public.templates from public, anon, authenticated;
grant select on public.templates to authenticated;
grant select, insert, update, delete on public.templates to service_role;

-- template_fields: Escritura revocada de authenticated y anon; solo lectura para authenticated; todo para service_role
revoke all on public.template_fields from public, anon, authenticated;
grant select on public.template_fields to authenticated;
grant select, insert, update, delete on public.template_fields to service_role;

-- 11. Semillas de configuración y campos de sustitución iniciales
insert into public.setting_definitions (
  key, category, label, description, value_type, default_value, constraints, requires_flag, sort_order
)
values (
  'filings.publication_wait_business_days',
  'filings',
  'Días Útiles de Espera para Publicación',
  'Plazo en días hábiles para el cálculo automático de vencimiento de edictos y publicaciones notariales',
  'number',
  '15'::jsonb,
  '{"min": 1, "max": 90}'::jsonb,
  'module.external_filings',
  1
)
on conflict (key) do update
  set label = excluded.label,
      description = excluded.description,
      default_value = excluded.default_value,
      constraints = excluded.constraints;

insert into public.system_settings (key, value)
values ('filings.publication_wait_business_days', '15'::jsonb)
on conflict (key) do nothing;

insert into public.document_fields (code, label, data_type, source_type, source_path, description)
values
  ('case.number', 'Número de Expediente', 'TEXT', 'CASE', 'case.case_number', 'Código identificador único del caso'),
  ('case.title', 'Título del Caso', 'TEXT', 'CASE', 'case.title', 'Título o carátula del trámite'),
  ('client.name', 'Nombre del Contratante', 'TEXT', 'PERSON', 'client.full_name', 'Nombre completo o razón social del contratante'),
  ('client.doc_number', 'Documento del Contratante', 'TEXT', 'PERSON', 'client.identity_document_number', 'Número de DNI/RUC del contratante'),
  ('causante.name', 'Nombre del Causante', 'TEXT', 'PARTY', 'parties.causante.full_name', 'Nombre completo de la persona fallecida'),
  ('causante.death_date', 'Fecha de Defunción', 'DATE', 'PARTY', 'parties.causante.death_date', 'Fecha del fallecimiento'),
  ('estate.summary', 'Resumen de Patrimonio', 'TEXTAREA', 'ESTATE', 'estate.inventory_summary', 'Detalle de activos y bienes inventariados')
on conflict (code) do nothing;
