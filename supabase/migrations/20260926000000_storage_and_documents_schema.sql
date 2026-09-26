-- ============================================================================
-- Migración: 20260926000000_storage_and_documents_schema.sql
-- Sprint 5: Almacenamiento, tipos de documentos, versiones, slots y sync idempotente
-- Precedencia: 00-maestro > 01-anexo (Parte B) > v2.1 > v2.0 > v1
-- ============================================================================

begin;

-- ============================================================================
-- 1. TABLA storage_backends (01-anexo B.4)
-- ============================================================================
create table if not exists public.storage_backends (
  code        text primary key,                                   -- 'supabase', 'r2', 'gdrive_backup'
  kind        text not null check (kind in ('supabase', 's3', 'gdrive')),
  is_primary  boolean not null default false,
  is_backup   boolean not null default false,
  is_active   boolean not null default true,
  config      jsonb not null default '{}',                        -- bucket, endpoint, folder_id (SIN secretos)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Un solo backend primario activo a la vez
create unique index if not exists idx_storage_backends_single_primary
  on public.storage_backends (is_primary)
  where is_primary = true;

alter table public.storage_backends enable row level security;

create trigger set_storage_backends_updated_at
  before update on public.storage_backends
  for each row execute function private.set_updated_at();

-- RLS: Lectura abierta a authenticated; configuración restringida a settings.manage
create policy storage_backends_select on public.storage_backends
  for select to authenticated
  using (true);

create policy storage_backends_manage on public.storage_backends
  for all to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));

grant select on public.storage_backends to authenticated;
grant all on public.storage_backends to service_role;

-- Semilla del almacén primario por defecto
insert into public.storage_backends (code, kind, is_primary, is_backup, is_active, config)
values ('supabase', 'supabase', true, false, true, '{"bucket": "case-documents"}'::jsonb)
on conflict (code) do update
  set is_primary = excluded.is_primary,
      is_active  = excluded.is_active;

-- ============================================================================
-- 2. TABLA document_types (00-maestro §4.3, 01-anexo A.7 #7, v1 §11)
-- ============================================================================
create table if not exists public.document_types (
  id                       uuid primary key default gen_random_uuid(),
  code                     text unique not null,
  name                     text not null,
  description              text,
  category                 text not null default 'LEGAL',
  nature                   text not null check (nature in ('GENERATED', 'UPLOADED', 'EXTERNAL')),
  scope                    text not null check (scope in ('CASO', 'PERSONA', 'BIEN')),
  party_role               text,                                  -- si scope = 'PERSONA' (p. ej. HEREDERO, CAUSANTE)
  asset_type               text,                                  -- si scope = 'BIEN' (p. ej. INMUEBLE, VEHICULO)
  applies_to_person_types  text[] not null default '{"NATURAL"}', -- NATURAL, JURIDICA o ambos
  validity_days            integer,                               -- días sugeridos de vigencia (NULL = no caduca)
  requires_template        boolean not null default false,
  is_active                boolean not null default true,
  metadata                 jsonb not null default '{}',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_document_types_code on public.document_types(code);
create index if not exists idx_document_types_nature on public.document_types(nature);
create index if not exists idx_document_types_scope on public.document_types(scope);

alter table public.document_types enable row level security;

create trigger set_document_types_updated_at
  before update on public.document_types
  for each row execute function private.set_updated_at();

-- RLS: Lectura con permiso documents.read, cases.read.all o templates.manage; gestión con templates.manage
create policy document_types_select on public.document_types
  for select to authenticated
  using (
    (select private.has_permission('documents.read'))
    or (select private.has_permission('cases.read.all'))
    or (select private.has_permission('templates.manage'))
  );

create policy document_types_manage on public.document_types
  for all to authenticated
  using ((select private.has_permission('templates.manage')))
  with check ((select private.has_permission('templates.manage')));

grant select on public.document_types to authenticated;
grant all on public.document_types to service_role;

-- ============================================================================
-- 3. TABLA document_alternatives (v1 §11, 00-maestro §4.3)
-- ============================================================================
create table if not exists public.document_alternatives (
  id                          uuid primary key default gen_random_uuid(),
  document_type_id            uuid not null references public.document_types(id) on delete cascade,
  alternative_document_type_id uuid not null references public.document_types(id) on delete cascade,
  reason                      text,
  is_active                   boolean not null default true,
  created_at                  timestamptz not null default now(),
  constraint uq_document_alternatives unique (document_type_id, alternative_document_type_id)
);

alter table public.document_alternatives enable row level security;

create policy document_alternatives_select on public.document_alternatives
  for select to authenticated
  using (true);

create policy document_alternatives_manage on public.document_alternatives
  for all to authenticated
  using ((select private.has_permission('templates.manage')))
  with check ((select private.has_permission('templates.manage')));

grant select on public.document_alternatives to authenticated;
grant all on public.document_alternatives to service_role;

-- ============================================================================
-- 4. TABLA case_model_documents (00-maestro §3.2, §4.2, v1 §11)
-- NOTA: Restricción única sobre (version, process, sequence) para evitar
-- descartar en silencio documentos con la misma secuencia en procesos distintos.
-- ============================================================================
create table if not exists public.case_model_documents (
  id                     uuid primary key default gen_random_uuid(),
  case_model_version_id  uuid not null references public.case_model_versions(id) on delete cascade,
  document_type_id       uuid not null references public.document_types(id),
  case_model_process_id  uuid references public.case_model_processes(id) on delete cascade,
  sequence               integer not null default 1,
  is_required            boolean not null default true,
  applies_to             text not null default 'CASE' check (applies_to in ('CASE', 'PARTY', 'ASSET')),
  party_role             text,
  asset_type             text,
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  constraint uq_case_model_documents unique (case_model_version_id, case_model_process_id, sequence)
);

create index if not exists idx_case_model_documents_version
  on public.case_model_documents(case_model_version_id);
create index if not exists idx_case_model_documents_process
  on public.case_model_documents(case_model_process_id);

alter table public.case_model_documents enable row level security;

create policy case_model_documents_select on public.case_model_documents
  for select to authenticated
  using (true);

create policy case_model_documents_manage on public.case_model_documents
  for all to authenticated
  using (
    (select private.has_permission('templates.manage'))
    or (select private.has_permission('models.manage'))
  )
  with check (
    (select private.has_permission('templates.manage'))
    or (select private.has_permission('models.manage'))
  );

grant select on public.case_model_documents to authenticated;
grant all on public.case_model_documents to service_role;

-- ============================================================================
-- 5. TABLA case_documents (Slots documentarios del caso) (00-maestro §3.2, v1 §14)
-- NOTA: current_version_id se define SIN FK inline para resolver dependencia circular.
-- ============================================================================
create table if not exists public.case_documents (
  id                  uuid primary key default gen_random_uuid(),
  case_id             uuid not null references public.cases(id) on delete cascade,
  case_process_id     uuid references public.case_processes(id) on delete set null,
  document_type_id    uuid not null references public.document_types(id),
  person_id           uuid references public.persons(id) on delete set null,
  asset_id            uuid references public.case_assets(id) on delete set null,
  party_id            uuid references public.case_parties(id) on delete set null,
  status              text not null default 'PENDING'
                        check (status in ('PENDING', 'UPLOADED', 'VALIDATED', 'OBSERVED')),
  is_required         boolean not null default true,
  issue_date          date,
  valid_until         date,
  current_version_id  uuid,                               -- FK añadida al final con ALTER TABLE
  notes               text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_case_documents_case on public.case_documents(case_id);
create index if not exists idx_case_documents_process on public.case_documents(case_process_id);
create index if not exists idx_case_documents_person on public.case_documents(person_id);
create index if not exists idx_case_documents_asset on public.case_documents(asset_id);
create index if not exists idx_case_documents_party on public.case_documents(party_id);
create index if not exists idx_case_documents_status on public.case_documents(status);

alter table public.case_documents enable row level security;

create trigger set_case_documents_updated_at
  before update on public.case_documents
  for each row execute function private.set_updated_at();

-- RLS de case_documents con separación estricta de permisos:
-- SELECT: Exige acceso al expediente (can_access_case) y permiso documents.read
create policy case_documents_select on public.case_documents
  for select to authenticated
  using (
    (select private.can_access_case(case_id))
    and (select private.has_permission('documents.read'))
  );

-- INSERT: Creación manual de slots exige permiso documents.upload y can_write_case
create policy case_documents_insert on public.case_documents
  for insert to authenticated
  with check (
    (select private.can_write_case(case_id))
    and (select private.has_permission('documents.upload'))
  );

-- UPDATE:
-- Cambiar a VALIDATED u OBSERVADO exige documents.approve
-- Modificar notas, fechas o metadatos de subida exige documents.upload
create policy case_documents_update on public.case_documents
  for update to authenticated
  using (
    (select private.can_write_case(case_id))
    and (
      (select private.has_permission('documents.upload'))
      or (select private.has_permission('documents.approve'))
    )
  )
  with check (
    (select private.can_write_case(case_id))
    and (
      (status in ('VALIDATED', 'OBSERVED') and (select private.has_permission('documents.approve')))
      or
      (status not in ('VALIDATED', 'OBSERVED') and (select private.has_permission('documents.upload')))
    )
  );

grant select, insert, update on public.case_documents to authenticated;
grant all on public.case_documents to service_role;

-- ============================================================================
-- 6. TABLA document_versions (Versiones físicas de archivos) (01-anexo B.4, v2 §5.3)
-- ============================================================================
create table if not exists public.document_versions (
  id              uuid primary key default gen_random_uuid(),
  case_document_id uuid not null references public.case_documents(id) on delete cascade,
  version         integer not null default 1,
  storage_backend text not null references public.storage_backends(code),
  storage_key     text not null,                         -- ruta fija generada por el servidor
  file_name       text not null,
  size_bytes      bigint not null check (size_bytes > 0),
  mime_type       text not null,
  sha256          text not null,
  change_summary  text,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  backed_up_at    timestamptz,
  backup_ref      text,
  constraint uq_document_version unique (case_document_id, version)
);

create index if not exists idx_document_versions_case_doc on public.document_versions(case_document_id);
create index if not exists idx_document_versions_sha256 on public.document_versions(sha256);

alter table public.document_versions enable row level security;

-- RLS de document_versions:
-- SELECT: Authenticated solo puede leer si can_access_case(case_id) y documents.read
create policy document_versions_select on public.document_versions
  for select to authenticated
  using (
    exists (
      select 1 from public.case_documents cd
       where cd.id = case_document_id
         and (select private.can_access_case(cd.case_id))
         and (select private.has_permission('documents.read'))
    )
  );

-- INSERT / UPDATE / DELETE: EXCLUSIVO de service_role.
-- El navegador nunca inserta directamente en document_versions ni en storage.
revoke all on public.document_versions from public, anon, authenticated;
grant select on public.document_versions to authenticated;
grant select, insert, update, delete on public.document_versions to service_role;

-- ============================================================================
-- 7. CIERRE DE CLAVE FORÁNEA CIRCULAR
-- ============================================================================
alter table public.case_documents
  drop constraint if exists fk_case_documents_current_version;

alter table public.case_documents
  add constraint fk_case_documents_current_version
  foreign key (current_version_id)
  references public.document_versions(id)
  on delete set null;

-- ============================================================================
-- 8. FUNCIÓN IDEMPOTENTE sync_case_document_slots(_case_id) (00-maestro §3.2)
-- CORRECCIÓN: Usa case_model_version_id (nombre real de la columna en cases)
-- ============================================================================
create or replace function public.sync_case_document_slots(_case_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version_id uuid;
  v_slots_count integer := 0;
  r_cmd record;
  r_party record;
  r_asset record;
  v_proc_id uuid;
begin
  -- Obtener la versión de modelo del caso desde la columna real case_model_version_id
  select case_model_version_id into v_version_id
    from public.cases
   where id = _case_id;

  if v_version_id is null then
    return 0;
  end if;

  -- Iterar sobre cada requerimiento documental configurado en la versión de modelo
  for r_cmd in
    select cmd.*
      from public.case_model_documents cmd
     where cmd.case_model_version_id = v_version_id
       and cmd.is_active = true
     order by cmd.sequence
  loop
    -- Resolver el proceso del caso correspondiente si el modelo especificaba uno
    v_proc_id := null;
    if r_cmd.case_model_process_id is not null then
      select cp.id into v_proc_id
        from public.case_processes cp
       where cp.case_id = _case_id
         and cp.case_model_process_id = r_cmd.case_model_process_id
       limit 1;
    end if;

    -- A. Ámbito CASO (un slot por caso)
    if r_cmd.applies_to = 'CASE' then
      insert into public.case_documents (
        case_id, case_process_id, document_type_id, person_id, asset_id, party_id,
        is_required, is_active
      )
      values (
        _case_id, v_proc_id, r_cmd.document_type_id, null, null, null,
        r_cmd.is_required, true
      )
      on conflict do nothing;

      -- Reactivar si existía inactivo
      update public.case_documents
         set is_active = true,
             case_process_id = coalesce(case_process_id, v_proc_id)
       where case_id = _case_id
         and document_type_id = r_cmd.document_type_id
         and person_id is null
         and asset_id is null
         and party_id is null
         and is_active = false;

      v_slots_count := v_slots_count + 1;

    -- B. Ámbito PERSONA / PARTY (un slot por cada interviniente con ese rol)
    elsif r_cmd.applies_to = 'PARTY' then
      -- 1. Crear o reactivar slots para intervinientes activos
      for r_party in
        select cp.id as party_id, cp.person_id
          from public.case_parties cp
         where cp.case_id = _case_id
           and cp.party_role = r_cmd.party_role
           and cp.is_active = true
      loop
        if not exists (
          select 1 from public.case_documents cd
           where cd.case_id = _case_id
             and cd.document_type_id = r_cmd.document_type_id
             and cd.party_id = r_party.party_id
        ) then
          insert into public.case_documents (
            case_id, case_process_id, document_type_id, person_id, asset_id, party_id,
            is_required, is_active
          )
          values (
            _case_id, v_proc_id, r_cmd.document_type_id, r_party.person_id, null, r_party.party_id,
            r_cmd.is_required, true
          );
          v_slots_count := v_slots_count + 1;
        else
          update public.case_documents
             set is_active = true,
                 case_process_id = coalesce(case_process_id, v_proc_id)
           where case_id = _case_id
             and document_type_id = r_cmd.document_type_id
             and party_id = r_party.party_id
             and is_active = false;
        end if;
      end loop;

      -- 2. Desactivar slots de intervinientes que fueron desactivados o retirados (NUNCA BORRAR)
      update public.case_documents cd
         set is_active = false
       where cd.case_id = _case_id
         and cd.document_type_id = r_cmd.document_type_id
         and cd.party_id is not null
         and cd.party_id in (
           select cp.id from public.case_parties cp
            where cp.case_id = _case_id
              and (cp.is_active = false or cp.party_role <> r_cmd.party_role)
         )
         and cd.is_active = true;

    -- C. Ámbito BIEN / ASSET (un slot por cada bien activo de ese tipo)
    elsif r_cmd.applies_to = 'ASSET' then
      -- 1. Crear o reactivar slots para bienes activos
      for r_asset in
        select ca.id as asset_id
          from public.case_assets ca
         where ca.case_id = _case_id
           and ca.asset_type = r_cmd.asset_type
           and ca.is_active = true
      loop
        if not exists (
          select 1 from public.case_documents cd
           where cd.case_id = _case_id
             and cd.document_type_id = r_cmd.document_type_id
             and cd.asset_id = r_asset.asset_id
        ) then
          insert into public.case_documents (
            case_id, case_process_id, document_type_id, person_id, asset_id, party_id,
            is_required, is_active
          )
          values (
            _case_id, v_proc_id, r_cmd.document_type_id, null, r_asset.asset_id, null,
            r_cmd.is_required, true
          );
          v_slots_count := v_slots_count + 1;
        else
          update public.case_documents
             set is_active = true,
                 case_process_id = coalesce(case_process_id, v_proc_id)
           where case_id = _case_id
             and document_type_id = r_cmd.document_type_id
             and asset_id = r_asset.asset_id
             and is_active = false;
        end if;
      end loop;

      -- 2. Desactivar slots de bienes desactivados (NUNCA BORRAR)
      update public.case_documents cd
         set is_active = false
       where cd.case_id = _case_id
         and cd.document_type_id = r_cmd.document_type_id
         and cd.asset_id is not null
         and cd.asset_id in (
           select ca.id from public.case_assets ca
            where ca.case_id = _case_id
              and (ca.is_active = false or ca.asset_type <> r_cmd.asset_type)
         )
         and cd.is_active = true;
    end if;
  end loop;

  return v_slots_count;
end;
$$;

revoke execute on function public.sync_case_document_slots(uuid) from public, anon;
grant execute on function public.sync_case_document_slots(uuid) to authenticated, service_role;

-- ============================================================================
-- 9. TRIGGERS AUTOMÁTICOS DE SINCRONIZACIÓN DE SLOTS
-- ============================================================================
create or replace function private.tg_trigger_sync_case_document_slots()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case_id uuid;
begin
  v_case_id := coalesce(new.case_id, old.case_id);
  if v_case_id is not null then
    perform public.sync_case_document_slots(v_case_id);
  end if;
  return coalesce(new, old);
end;
$$;

-- Disparador ante cambios en intervinientes
drop trigger if exists trg_case_parties_sync_doc_slots on public.case_parties;
create trigger trg_case_parties_sync_doc_slots
  after insert or update of is_active, party_role or delete on public.case_parties
  for each row execute function private.tg_trigger_sync_case_document_slots();

-- Disparador ante cambios en bienes
drop trigger if exists trg_case_assets_sync_doc_slots on public.case_assets;
create trigger trg_case_assets_sync_doc_slots
  after insert or update of is_active, asset_type or delete on public.case_assets
  for each row execute function private.tg_trigger_sync_case_document_slots();

-- Disparador al crear un caso
create or replace function private.tg_trigger_sync_new_case_doc_slots()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_case_document_slots(new.id);
  return new;
end;
$$;

drop trigger if exists trg_cases_sync_doc_slots on public.cases;
create trigger trg_cases_sync_doc_slots
  after insert on public.cases
  for each row execute function private.tg_trigger_sync_new_case_doc_slots();

-- ============================================================================
-- 10. BUCKET DE STORAGE case-documents Y RESTRICCIÓN TOTAL A SERVICE_ROLE (Punto 2)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('case-documents', 'case-documents', false)
on conflict (id) do update set public = false;

-- Asegurar que NO existan políticas públicas ni de authenticated para el bucket
drop policy if exists case_docs_read on storage.objects;
drop policy if exists case_docs_insert on storage.objects;
drop policy if exists case_docs_update on storage.objects;
drop policy if exists case_docs_delete on storage.objects;
drop policy if exists "Authenticated read case-documents" on storage.objects;
drop policy if exists "Authenticated upload case-documents" on storage.objects;

-- ============================================================================
-- 11. SEMILLAS: 27 TIPOS DE DOCUMENTOS OFICIALES (00-maestro §4.3)
-- ============================================================================
insert into public.document_types (code, name, description, nature, scope, party_role, asset_type, applies_to_person_types, requires_template, is_active)
values
  -- Generados (G)
  ('CONTRATO_SERVICIOS',          'Contrato de servicios de gestión',             'Contrato de prestación de servicios y mandato de gestión sucesoria', 'GENERATED', 'CASO', null, null, '{"NATURAL","JURIDICA"}', true, true),
  ('CARTA_SOLICITUD_DOCUMENTOS',  'Carta de solicitud de documentos al cliente',  'Requerimiento formal de recaudos y partidas al contratante',         'GENERATED', 'CASO', null, null, '{"NATURAL","JURIDICA"}', true, true),
  ('INFORME_EXPEDIENTE_ABOGADO',  'Informe del expediente para el abogado',       'Resumen consolidado de antecedentes y hechos para consulta letrada', 'GENERATED', 'CASO', null, null, '{"NATURAL"}',            true, true),
  ('INFORME_LEGAL',               'Informe legal',                                'Dictamen de abogado colegiado sobre procedencia y vía procesal',     'GENERATED', 'CASO', null, null, '{"NATURAL"}',            true, true),
  ('SOLICITUD_SUCESION_INTESTADA','Solicitud de sucesión intestada',              'Minuta y petición notarial firmada por herederos según Ley 26662',   'GENERATED', 'CASO', null, null, '{"NATURAL"}',            true, true),
  ('CARTA_NOTARIA',               'Carta a la notaría',                           'Oficio de ingreso formal y solicitud de inicio de trámite',          'GENERATED', 'CASO', null, null, '{"NATURAL"}',            true, true),
  ('PODER_REPRESENTACION',        'Poder de representación',                      'Poder especial o por escritura pública otorgado por heredero',       'GENERATED', 'PERSONA', 'HEREDERO', null, '{"NATURAL"}',   true, true),
  ('EDICTO_PUBLICACION',          'Extracto/edicto para publicación (borrador)',  'Texto de aviso para diario El Peruano y diario de circulación',      'GENERATED', 'CASO', null, null, '{"NATURAL"}',            true, true),
  ('ACTA_ENTREGA',                'Acta de entrega de expediente',                'Constancia de recepción de documentos finales y cierre del caso',    'GENERATED', 'CASO', null, null, '{"NATURAL"}',            true, true),

  -- Subidos (U)
  ('DNI_COPIA',                   'Copia de documento de identidad',              'Copia legible de DNI o documento oficial de identidad',              'UPLOADED',  'PERSONA', 'CAUSANTE', null, '{"NATURAL"}',   false, true),
  ('ACTA_DEFUNCION',              'Acta/partida de defunción',                    'Partida de defunción expedida por RENIEC o municipalidad',           'UPLOADED',  'CASO', null, null, '{"NATURAL"}',            false, true),
  ('PARTIDA_NACIMIENTO',          'Partida de nacimiento',                        'Copia certificada de partida de nacimiento para entroncamiento',     'UPLOADED',  'PERSONA', 'HEREDERO', null, '{"NATURAL"}',   false, true),
  ('PARTIDA_MATRIMONIO',          'Partida de matrimonio',                        'Partida de matrimonio para acreditar vocación hereditaria de cónyuge','UPLOADED', 'CASO', null, null, '{"NATURAL"}',            false, true),
  ('CERT_BUSQUEDA_TESTAMENTO',    'Certificado de búsqueda de testamento',        'Certificado negativo de inscripción de testamento emitido por SUNARP','UPLOADED', 'CASO', null, null, '{"NATURAL"}',            false, true),
  ('CERT_BUSQUEDA_SUCESION',      'Certificado de búsqueda de sucesión intestada','Certificado negativo de sucesión intestada emitido por SUNARP',      'UPLOADED',  'CASO', null, null, '{"NATURAL"}',            false, true),
  ('TESTAMENTO_COPIA',            'Copia del testamento',                         'Testimonio o copia certificada de testamento otorgado',              'UPLOADED',  'CASO', null, null, '{"NATURAL"}',            false, true),
  ('COPIA_LITERAL_DOMINIO',       'Copia literal de dominio',                     'Copia literal completa de la partida registral del predio (SUNARP)', 'UPLOADED',  'BIEN', null, 'INMUEBLE', '{"NATURAL","JURIDICA"}', false, true),
  ('TARJETA_PROPIEDAD',           'Tarjeta de propiedad vehicular',               'Tarjeta de identificación vehicular expedida por SUNARP',            'UPLOADED',  'BIEN', null, 'VEHICULO', '{"NATURAL"}',      false, true),
  ('CONSTANCIA_BANCARIA',         'Constancia o estado de cuenta',                'Reporte bancario que acredita saldos o depósitos del causante',      'UPLOADED',  'BIEN', null, 'CUENTA_BANCARIA', '{"NATURAL"}', false, true),
  ('CARGO_PRESENTACION',          'Cargo de presentación en notaría',             'Sello y constancia de ingreso formal del expediente en notaría',      'UPLOADED',  'CASO', null, null, '{"NATURAL"}',            false, true),
  ('EJEMPLAR_PUBLICACION',        'Ejemplar de la publicación',                   'Página completa de diario oficial o periódico con edicto publicado','UPLOADED',  'CASO', null, null, '{"NATURAL"}',            false, true),
  ('HOJA_PRESENTACION_TITULO',    'Hoja de presentación del título',              'Recibo y número de título de ingreso a registros públicos (SUNARP)', 'UPLOADED',  'CASO', null, null, '{"NATURAL"}',            false, true),
  ('ESQUELA_OBSERVACION',         'Esquela de observación',                       'Notificación registral de tacha u observación subsanable',           'UPLOADED',  'CASO', null, null, '{"NATURAL"}',            false, true),

  -- Externos (E)
  ('ACTA_SUCESION_INTESTADA',     'Acta notarial de sucesión intestada',          'Escritura o acta protocolizada que declara formalmente los herederos','EXTERNAL',  'CASO', null, null, '{"NATURAL"}',            false, true),
  ('PARTE_NOTARIAL',              'Parte notarial',                               'Instrumento notarial dirigido a SUNARP para inscripción registral',   'EXTERNAL',  'CASO', null, null, '{"NATURAL"}',            false, true),
  ('ESCRITURA_PUBLICA',           'Escritura pública',                            'Instrumento público protocolar matriz',                              'EXTERNAL',  'CASO', null, null, '{"NATURAL"}',            false, true),
  ('CERT_INSCRIPCION',            'Certificado/constancia de inscripción',        'Anotación de inscripción en el Registro de Sucesiones Intestadas',   'EXTERNAL',  'CASO', null, null, '{"NATURAL"}',            false, true)
on conflict (code) do update
  set name                    = excluded.name,
      description             = excluded.description,
      nature                  = excluded.nature,
      scope                   = excluded.scope,
      party_role              = excluded.party_role,
      asset_type              = excluded.asset_type,
      applies_to_person_types = excluded.applies_to_person_types,
      requires_template       = excluded.requires_template,
      is_active               = excluded.is_active;

-- ============================================================================
-- 12. VINCULACIÓN DE DOCUMENTOS EN MODELO PRINCIPAL (SUCESION_INTESTADA_NOTARIAL)
-- NOTA: Se ejecuta ANTES de activar el trigger de inmutabilidad para evitar
-- que la migración se bloquee a sí misma en una versión ya PUBLISHED.
-- NOTA: on conflict sobre (version, process, sequence).
-- ============================================================================
do $$
declare
  v_version_id uuid;
  v_p1 uuid; v_p2 uuid; v_p3 uuid; v_p4 uuid; v_p5 uuid;
  v_p6 uuid; v_p7 uuid; v_p8 uuid; v_p9 uuid; v_p10 uuid; v_p11 uuid;
begin
  select cmv.id into v_version_id
    from public.case_model_versions cmv
    join public.case_models cm on cm.id = cmv.case_model_id
   where cm.code = 'SUCESION_INTESTADA_NOTARIAL'
     and cmv.version = 1;

  if v_version_id is null then
    return;
  end if;

  -- Procesos 1 al 11
  select id into v_p1  from public.case_model_processes where case_model_version_id = v_version_id and sequence = 1;
  select id into v_p2  from public.case_model_processes where case_model_version_id = v_version_id and sequence = 2;
  select id into v_p3  from public.case_model_processes where case_model_version_id = v_version_id and sequence = 3;
  select id into v_p4  from public.case_model_processes where case_model_version_id = v_version_id and sequence = 4;
  select id into v_p5  from public.case_model_processes where case_model_version_id = v_version_id and sequence = 5;
  select id into v_p6  from public.case_model_processes where case_model_version_id = v_version_id and sequence = 6;
  select id into v_p7  from public.case_model_processes where case_model_version_id = v_version_id and sequence = 7;
  select id into v_p8  from public.case_model_processes where case_model_version_id = v_version_id and sequence = 8;
  select id into v_p9  from public.case_model_processes where case_model_version_id = v_version_id and sequence = 9;
  select id into v_p10 from public.case_model_processes where case_model_version_id = v_version_id and sequence = 10;
  select id into v_p11 from public.case_model_processes where case_model_version_id = v_version_id and sequence = 11;

  -- 1. APERTURA: CONTRATO_SERVICIOS (★)
  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to)
  values (v_version_id, (select id from public.document_types where code = 'CONTRATO_SERVICIOS'), v_p1, 1, true, 'CASE')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  -- 2. DOC_CAUSANTE: ACTA_DEFUNCION (★), DNI_COPIA causante (★), PARTIDA_NACIMIENTO causante (★), PARTIDA_MATRIMONIO (opcional)
  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to)
  values (v_version_id, (select id from public.document_types where code = 'ACTA_DEFUNCION'), v_p2, 1, true, 'CASE')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to, party_role)
  values (v_version_id, (select id from public.document_types where code = 'DNI_COPIA'), v_p2, 2, true, 'PARTY', 'CAUSANTE')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to, party_role)
  values (v_version_id, (select id from public.document_types where code = 'PARTIDA_NACIMIENTO'), v_p2, 3, true, 'PARTY', 'CAUSANTE')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to)
  values (v_version_id, (select id from public.document_types where code = 'PARTIDA_MATRIMONIO'), v_p2, 4, false, 'CASE')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  -- 3. HEREDEROS: Por heredero: PARTIDA_NACIMIENTO (★), DNI_COPIA (★)
  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to, party_role)
  values (v_version_id, (select id from public.document_types where code = 'PARTIDA_NACIMIENTO'), v_p3, 1, true, 'PARTY', 'HEREDERO')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to, party_role)
  values (v_version_id, (select id from public.document_types where code = 'DNI_COPIA'), v_p3, 2, true, 'PARTY', 'HEREDERO')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  -- 4. INVENTARIO: Por inmueble: COPIA_LITERAL_DOMINIO; Por vehículo: TARJETA_PROPIEDAD; Por cuenta: CONSTANCIA_BANCARIA
  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to, asset_type)
  values (v_version_id, (select id from public.document_types where code = 'COPIA_LITERAL_DOMINIO'), v_p4, 1, true, 'ASSET', 'INMUEBLE')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to, asset_type)
  values (v_version_id, (select id from public.document_types where code = 'TARJETA_PROPIEDAD'), v_p4, 2, false, 'ASSET', 'VEHICULO')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to, asset_type)
  values (v_version_id, (select id from public.document_types where code = 'CONSTANCIA_BANCARIA'), v_p4, 3, false, 'ASSET', 'CUENTA_BANCARIA')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  -- 5. BUSQUEDA_REGISTRAL: CERT_BUSQUEDA_TESTAMENTO (★), CERT_BUSQUEDA_SUCESION (★)
  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to)
  values (v_version_id, (select id from public.document_types where code = 'CERT_BUSQUEDA_TESTAMENTO'), v_p5, 1, true, 'CASE')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to)
  values (v_version_id, (select id from public.document_types where code = 'CERT_BUSQUEDA_SUCESION'), v_p5, 2, true, 'CASE')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  -- 6. EVAL_LEGAL: INFORME_LEGAL (★)
  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to)
  values (v_version_id, (select id from public.document_types where code = 'INFORME_LEGAL'), v_p6, 1, true, 'CASE')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  -- 7. SOLICITUD: SOLICITUD_SUCESION_INTESTADA (★)
  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to)
  values (v_version_id, (select id from public.document_types where code = 'SOLICITUD_SUCESION_INTESTADA'), v_p7, 1, true, 'CASE')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  -- 8. PRESENTACION: CARGO_PRESENTACION (★), EDICTO_PUBLICACION (★), EJEMPLAR_PUBLICACION (★)
  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to)
  values (v_version_id, (select id from public.document_types where code = 'CARGO_PRESENTACION'), v_p8, 1, true, 'CASE')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to)
  values (v_version_id, (select id from public.document_types where code = 'EDICTO_PUBLICACION'), v_p8, 2, true, 'CASE')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to)
  values (v_version_id, (select id from public.document_types where code = 'EJEMPLAR_PUBLICACION'), v_p8, 3, true, 'CASE')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  -- 9. SEGUIMIENTO_NOTARIAL: ACTA_SUCESION_INTESTADA (★), PARTE_NOTARIAL (★)
  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to)
  values (v_version_id, (select id from public.document_types where code = 'ACTA_SUCESION_INTESTADA'), v_p9, 1, true, 'CASE')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to)
  values (v_version_id, (select id from public.document_types where code = 'PARTE_NOTARIAL'), v_p9, 2, true, 'CASE')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  -- 10. SUNARP: HOJA_PRESENTACION_TITULO (★), CERT_INSCRIPCION (★)
  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to)
  values (v_version_id, (select id from public.document_types where code = 'HOJA_PRESENTACION_TITULO'), v_p10, 1, true, 'CASE')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to)
  values (v_version_id, (select id from public.document_types where code = 'CERT_INSCRIPCION'), v_p10, 2, true, 'CASE')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;

  -- 11. CIERRE: ACTA_ENTREGA (★)
  insert into public.case_model_documents (case_model_version_id, document_type_id, case_model_process_id, sequence, is_required, applies_to)
  values (v_version_id, (select id from public.document_types where code = 'ACTA_ENTREGA'), v_p11, 1, true, 'CASE')
  on conflict (case_model_version_id, case_model_process_id, sequence) do nothing;
end;
$$;

-- ============================================================================
-- 13. EXTENSIÓN Y ACTIVACIÓN DEL TRIGGER DE INMUTABILIDAD (Punto 1)
-- NOTA: Se ejecuta DESPUÉS de poblar las filas iniciales del modelo publicado v1.
-- A partir de este momento, cualquier INSERT/UPDATE/DELETE sobre case_model_documents
-- para una versión PUBLISHED queda terminantemente bloqueado.
-- ============================================================================
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
  elsif tg_table_name = 'case_model_documents' then
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

-- Asociar el trigger a case_model_documents
drop trigger if exists trg_guard_case_model_documents_immutability on public.case_model_documents;
create trigger trg_guard_case_model_documents_immutability
  before insert or update or delete on public.case_model_documents
  for each row execute function private.tg_guard_published_model_child();

commit;
