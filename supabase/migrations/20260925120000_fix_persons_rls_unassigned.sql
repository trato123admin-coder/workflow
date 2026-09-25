-- Migración: 20260925120000_fix_persons_rls_unassigned.sql
-- Sprint 3: Directorio compartido de personas sin casos asociados y trazabilidad de registro
-- Precedencia y reglas: AGENTS.md, 00-maestro §3.3, v2.1 §3.1

begin;

-- ============================================================================
-- 1. AGREGAR COLUMNA created_by PARA TRAZABILIDAD (NO CONDICIONA LECTURA RLS)
-- ============================================================================
alter table public.persons
  add column if not exists created_by uuid references public.profiles(id);

create index if not exists idx_persons_created_by
  on public.persons (created_by);

-- ============================================================================
-- 2. ACTUALIZAR FUNCIÓN: private.can_access_person(_person_id)
-- ============================================================================
-- Regla de Negocio (Opción A):
-- a) El usuario tiene permiso global 'cases.read.all' (ADMIN, COORDINATOR)
-- b) La persona no está vinculada a ningún caso aún (directorio general de prospectos)
-- c) La persona está vinculada a un caso al que el usuario tiene acceso vía private.can_access_case()
create or replace function private.can_access_person(_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_permission('cases.read.all'))
      or not exists (
        select 1 from public.cases c
         where c.client_person_id = _person_id
      )
      or exists (
        select 1 from public.cases c
         where c.client_person_id = _person_id
           and private.can_access_case(c.id)
      );
$$;

revoke execute on function private.can_access_person(uuid) from public, anon;
grant execute on function private.can_access_person(uuid) to authenticated, service_role;

commit;
