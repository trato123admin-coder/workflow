-- Sprint 0 — Fundaciones: Esquema base, extensiones, esquema private y tablas base
-- Precedencia: 00-maestro > 01-anexo > v2.1 > v2.0 > v1

-- 1. Extensiones requeridas
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "unaccent" with schema "extensions";
create extension if not exists "vector" with schema "extensions";

-- 2. Esquema private para funciones de seguridad y lógica no expuesta vía PostgREST
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- 3. Funciones auxiliares en esquema private
create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;
grant execute on function private.set_updated_at() to service_role;

create or replace function private.raise_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Registro inmutable: no se permite modificacion ni eliminacion';
end;
$$;

revoke execute on function private.raise_immutable() from public, anon, authenticated;
grant execute on function private.raise_immutable() to service_role;

-- 4. Contadores de caso y función correlativa segura ante concurrencia
create table public.case_counters (
  year integer primary key,
  last_value integer not null default 0
);

-- RLS habilitada sin políticas (solo accesible mediante funciones SECURITY DEFINER o service_role)
alter table public.case_counters enable row level security;
revoke all on public.case_counters from public, anon, authenticated;
grant select, insert, update on public.case_counters to service_role;

create or replace function private.next_case_number()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year integer := extract(year from (now() at time zone 'America/Lima'));
  v_next integer;
begin
  insert into public.case_counters (year, last_value)
  values (v_year, 1)
  on conflict (year) do update
    set last_value = public.case_counters.last_value + 1
  returning last_value into v_next;

  return v_year::text || '-' || lpad(v_next::text, 6, '0');
end;
$$;

revoke execute on function private.next_case_number() from public, anon, authenticated;
grant execute on function private.next_case_number() to service_role;

-- 5. Tabla audit_logs (append-only)
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  module text,
  entity_type text,
  entity_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create trigger audit_logs_immutable
  before update or delete on public.audit_logs
  for each row execute function private.raise_immutable();

revoke all on public.audit_logs from public, anon, authenticated;
grant select, insert on public.audit_logs to service_role;

-- 6. Cola de trabajos (job_queue)
create type public.job_status as enum ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'DEAD');

create table public.job_queue (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  payload jsonb not null default '{}',
  status public.job_status not null default 'QUEUED',
  run_at timestamptz not null default now(),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.job_queue enable row level security;

create index job_queue_ready on public.job_queue (run_at) where status = 'QUEUED';

revoke all on public.job_queue from public, anon, authenticated;
grant select, insert, update, delete on public.job_queue to service_role;
