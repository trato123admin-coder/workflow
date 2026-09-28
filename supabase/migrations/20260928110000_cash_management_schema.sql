-- Migración: 20260928110000_cash_management_schema.sql
-- Sprint 11: Caja Chica — Libro inmutable, solicitudes, arqueo y cierre de período
-- Precedencia: 00-maestro §3.3, §4.5, v2 §9, §4.3, v2.1 §3.2, §3.5 y 01-anexo (Mockup 3)

begin;

-- ============================================================================
-- 1. TABLA cash_accounts (Cuentas y cajas de fondos)
-- ============================================================================
create table if not exists public.cash_accounts (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  account_type        text not null,
  account_type_cat    text generated always as ('cash_account_types') stored,
  currency            text not null default 'PEN',
  currency_cat        text generated always as ('currencies') stored,
  opening_balance     numeric(14,2) not null default 0.00 check (opening_balance >= 0),
  responsible_user_id uuid references public.profiles(id),
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  foreign key (account_type_cat, account_type)
    references public.catalog_items (catalog_code, code),
  foreign key (currency_cat, currency)
    references public.catalog_items (catalog_code, code)
);

create index if not exists idx_cash_accounts_active on public.cash_accounts (is_active);

alter table public.cash_accounts enable row level security;

create trigger set_cash_accounts_updated_at
  before update on public.cash_accounts
  for each row execute function private.set_updated_at();

-- ============================================================================
-- 2. TABLA cash_periods (Períodos contables por cuenta)
-- ============================================================================
create table if not exists public.cash_periods (
  id              uuid primary key default gen_random_uuid(),
  cash_account_id uuid not null references public.cash_accounts(id) on delete cascade,
  period_start    date not null,
  period_end      date not null,
  status          text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  closed_at       timestamptz,
  closed_by       uuid references public.profiles(id),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  check (period_end >= period_start)
);

create unique index if not exists one_open_period_per_account
  on public.cash_periods (cash_account_id)
  where status = 'OPEN';

create index if not exists idx_cash_periods_account on public.cash_periods (cash_account_id);
create index if not exists idx_cash_periods_dates on public.cash_periods (period_start, period_end);

alter table public.cash_periods enable row level security;

create trigger set_cash_periods_updated_at
  before update on public.cash_periods
  for each row execute function private.set_updated_at();

-- ============================================================================
-- 3. TABLA cash_requests (Solicitudes de fondos)
-- ============================================================================
create table if not exists public.cash_requests (
  id               uuid primary key default gen_random_uuid(),
  request_number   text not null unique,
  case_id          uuid references public.cases(id) on delete set null,
  requested_by     uuid not null references public.profiles(id),
  amount           numeric(14,2) not null check (amount > 0),
  currency         text not null default 'PEN',
  currency_cat     text generated always as ('currencies') stored,
  category_code    text not null,
  category_cat     text generated always as ('cash_categories') stored,
  reason           text not null,
  status           text not null default 'PENDING'
                     check (status in ('PENDING', 'APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED')),
  approved_by      uuid references public.profiles(id),
  approved_at      timestamptz,
  rejection_reason text,
  disbursed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  foreign key (currency_cat, currency)
    references public.catalog_items (catalog_code, code),
  foreign key (category_cat, category_code)
    references public.catalog_items (catalog_code, code)
);

create index if not exists idx_cash_requests_case on public.cash_requests (case_id);
create index if not exists idx_cash_requests_status on public.cash_requests (status);
create index if not exists idx_cash_requests_requested_by on public.cash_requests (requested_by);

alter table public.cash_requests enable row level security;

create trigger set_cash_requests_updated_at
  before update on public.cash_requests
  for each row execute function private.set_updated_at();

-- ============================================================================
-- 4. TABLA cash_movements (Libro diario inmutable de ingresos y egresos)
-- ============================================================================
create table if not exists public.cash_movements (
  id                    uuid primary key default gen_random_uuid(),
  movement_number       text not null unique,
  cash_account_id       uuid not null references public.cash_accounts(id),
  movement_type         text not null check (movement_type in ('INCOME', 'EXPENSE', 'ADJUSTMENT', 'REVERSAL')),
  direction             text not null check (direction in ('IN', 'OUT')),
  amount                numeric(14,2) not null check (amount > 0),
  category_code         text not null,
  category_cat          text generated always as ('cash_categories') stored,
  description           text not null,
  reference             text,
  movement_date         date not null default current_date,
  support_document_path text,
  case_id               uuid references public.cases(id) on delete set null,
  request_id            uuid references public.cash_requests(id) on delete set null,
  reversal_of           uuid references public.cash_movements(id),
  created_by            uuid not null references public.profiles(id),
  created_at            timestamptz not null default now(),

  foreign key (category_cat, category_code)
    references public.catalog_items (catalog_code, code)
);

create index if not exists idx_cash_movements_account on public.cash_movements (cash_account_id);
create index if not exists idx_cash_movements_date on public.cash_movements (movement_date);
create index if not exists idx_cash_movements_case on public.cash_movements (case_id);
create index if not exists idx_cash_movements_reversal on public.cash_movements (reversal_of);
create index if not exists idx_cash_movements_request on public.cash_movements (request_id);

alter table public.cash_movements enable row level security;

-- 4.1 Inmutabilidad estricta: trigger BEFORE UPDATE OR DELETE
create trigger trg_cash_movements_immutable
  before update or delete on public.cash_movements
  for each row execute function private.raise_immutable();

-- 4.2 Validación de período abierto
create or replace function private.tg_assert_cash_open_period()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_covered boolean;
begin
  select exists (
    select 1
      from public.cash_periods cp
     where cp.cash_account_id = new.cash_account_id
       and cp.status = 'OPEN'
       and new.movement_date between cp.period_start and cp.period_end
  ) into v_is_covered;

  if not v_is_covered then
    raise exception 'Operacion bloqueada: la fecha % no pertenece a ningun periodo abierto para la cuenta especificada',
      new.movement_date
      using errcode = 'P0403';
  end if;

  return new;
end;
$$;

revoke execute on function private.tg_assert_cash_open_period() from public, anon;
grant execute on function private.tg_assert_cash_open_period() to authenticated, service_role;

create trigger trg_cash_movements_check_period
  before insert on public.cash_movements
  for each row execute function private.tg_assert_cash_open_period();

-- 4.3 Validación de reversos contables
create or replace function private.tg_validate_cash_reversal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orig record;
  v_already_reversed boolean;
begin
  if new.movement_type = 'REVERSAL' then
    if new.reversal_of is null then
      raise exception 'Un movimiento de tipo REVERSAL debe indicar el movimiento original en reversal_of'
        using errcode = 'P0400';
    end if;

    select * into v_orig from public.cash_movements where id = new.reversal_of;
    if not found then
      raise exception 'El movimiento original a reversar no existe' using errcode = 'P0404';
    end if;

    if v_orig.movement_type = 'REVERSAL' or v_orig.reversal_of is not null then
      raise exception 'No se puede reversar un movimiento que ya es un reverso' using errcode = 'P0400';
    end if;

    select exists (
      select 1 from public.cash_movements where reversal_of = new.reversal_of and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) into v_already_reversed;

    if v_already_reversed then
      raise exception 'Este movimiento ya ha sido reversado previamente' using errcode = 'P0409';
    end if;

    if new.cash_account_id <> v_orig.cash_account_id then
      raise exception 'El reverso debe registrarse en la misma cuenta del movimiento original' using errcode = 'P0400';
    end if;

    if new.amount <> v_orig.amount then
      raise exception 'El monto del reverso (%) debe ser identico al del movimiento original (%)', new.amount, v_orig.amount
        using errcode = 'P0400';
    end if;

    -- La dirección debe ser la opuesta (si original fue OUT, reverso es IN; si fue IN, reverso es OUT)
    if (v_orig.direction = 'OUT' and new.direction <> 'IN') or (v_orig.direction = 'IN' and new.direction <> 'OUT') then
      raise exception 'La direccion del reverso debe ser opuesta a la del original' using errcode = 'P0400';
    end if;
  else
    if new.reversal_of is not null then
      raise exception 'Solo los movimientos de tipo REVERSAL pueden definir reversal_of' using errcode = 'P0400';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.tg_validate_cash_reversal() from public, anon;
grant execute on function private.tg_validate_cash_reversal() to authenticated, service_role;

create trigger trg_cash_movements_validate_reversal
  before insert on public.cash_movements
  for each row execute function private.tg_validate_cash_reversal();

-- ============================================================================
-- 5. VISTA cash_account_balances (Saldos derivados en tiempo real)
-- ============================================================================
create or replace view public.cash_account_balances as
select
  ca.id as cash_account_id,
  ca.name as account_name,
  ca.account_type,
  ca.currency,
  ca.opening_balance,
  ca.opening_balance + coalesce(sum(
    case
      when cm.direction = 'IN' then cm.amount
      when cm.direction = 'OUT' then -cm.amount
      else 0.00
    end
  ), 0.00) as current_balance,
  coalesce(sum(case when cm.direction = 'IN' then cm.amount else 0.00 end), 0.00) as total_income,
  coalesce(sum(case when cm.direction = 'OUT' then cm.amount else 0.00 end), 0.00) as total_expense,
  count(cm.id)::int as movements_count,
  ca.is_active,
  ca.created_at,
  ca.updated_at
from public.cash_accounts ca
left join public.cash_movements cm on cm.cash_account_id = ca.id
group by ca.id, ca.name, ca.account_type, ca.currency, ca.opening_balance, ca.is_active, ca.created_at, ca.updated_at;

grant select on public.cash_account_balances to authenticated, service_role;

-- ============================================================================
-- 6. TABLA cash_reconciliations (Arqueos con Control Dual)
-- ============================================================================
create table if not exists public.cash_reconciliations (
  id                  uuid primary key default gen_random_uuid(),
  cash_account_id     uuid not null references public.cash_accounts(id),
  cash_period_id      uuid references public.cash_periods(id),
  reconciliation_date date not null default current_date,
  period_start        date not null,
  period_end          date not null,
  system_balance      numeric(14,2) not null,
  counted_balance     numeric(14,2) not null check (counted_balance >= 0),
  difference          numeric(14,2) generated always as (counted_balance - system_balance) stored,
  observations        text,
  status              text not null default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  opened_by           uuid not null references public.profiles(id),
  opened_at           timestamptz not null default now(),
  approved_by         uuid references public.profiles(id),
  approved_at         timestamptz,
  rejection_reason    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Control dual estricto a nivel de restricción
  check (approved_by is null or approved_by <> opened_by)
);

create index if not exists idx_cash_reconciliations_account on public.cash_reconciliations (cash_account_id);
create index if not exists idx_cash_reconciliations_status on public.cash_reconciliations (status);

alter table public.cash_reconciliations enable row level security;

create trigger set_cash_reconciliations_updated_at
  before update on public.cash_reconciliations
  for each row execute function private.set_updated_at();

-- 6.1 Trigger de aprobación y cierre de período en arqueos
create or replace function private.tg_cash_reconciliation_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'APPROVED' and (old.status is null or old.status <> 'APPROVED') then
    -- Verificación de control dual
    if new.approved_by is null then
      raise exception 'El arqueo aprobado debe especificar approved_by' using errcode = 'P0400';
    end if;

    if new.approved_by = new.opened_by then
      raise exception 'Control dual violado: quien abre el arqueo (%) no puede aprobarlo', new.opened_by
        using errcode = 'P0403';
    end if;

    new.approved_at := coalesce(new.approved_at, now());

    -- Si hay un período asociado, se cierra de inmediato
    if new.cash_period_id is not null then
      update public.cash_periods
         set status = 'CLOSED',
             closed_at = new.approved_at,
             closed_by = new.approved_by,
             notes = coalesce(notes || ' | ', '') || 'Cerrado por aprobacion de arqueo ' || new.id::text,
             updated_at = now()
       where id = new.cash_period_id;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.tg_cash_reconciliation_approval() from public, anon;
grant execute on function private.tg_cash_reconciliation_approval() to authenticated, service_role;

create trigger trg_cash_reconciliation_dual_control
  before update on public.cash_reconciliations
  for each row execute function private.tg_cash_reconciliation_approval();

-- ============================================================================
-- 7. BUCKET DE STORAGE: cash-support
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cash-support',
  'cash-support',
  false,
  10485760, -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'];

-- Políticas de Storage para cash-support
drop policy if exists cash_support_select on storage.objects;
create policy cash_support_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cash-support'
    and (select private.feature_enabled('module.cash'))
    and (select private.has_permission('cash.read'))
  );

drop policy if exists cash_support_insert on storage.objects;
create policy cash_support_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cash-support'
    and (select private.feature_enabled('module.cash'))
    and (select private.has_permission('cash.write'))
  );

-- ============================================================================
-- 8. POLÍTICAS RLS (Gobernadas por feature_flags, permisos y verificación MFA)
-- ============================================================================

-- 8.1 cash_accounts
create policy cash_accounts_select on public.cash_accounts
  for select to authenticated
  using (
    (select private.feature_enabled('module.cash'))
    and (select private.has_permission('cash.read'))
  );

create policy cash_accounts_insert on public.cash_accounts
  for insert to authenticated
  with check (
    (select private.feature_enabled('module.cash'))
    and (select private.has_permission('settings.manage'))
  );

create policy cash_accounts_update on public.cash_accounts
  for update to authenticated
  using (
    (select private.feature_enabled('module.cash'))
    and (select private.has_permission('settings.manage'))
  )
  with check (
    (select private.feature_enabled('module.cash'))
    and (select private.has_permission('settings.manage'))
  );

-- 8.2 cash_periods
create policy cash_periods_select on public.cash_periods
  for select to authenticated
  using (
    (select private.feature_enabled('module.cash'))
    and (select private.has_permission('cash.read'))
  );

create policy cash_periods_insert on public.cash_periods
  for insert to authenticated
  with check (
    (select private.feature_enabled('module.cash'))
    and ((select private.has_permission('cash.close')) or (select private.has_permission('settings.manage')))
  );

create policy cash_periods_update on public.cash_periods
  for update to authenticated
  using (
    (select private.feature_enabled('module.cash'))
    and ((select private.has_permission('cash.close')) or (select private.has_permission('settings.manage')))
  )
  with check (
    (select private.feature_enabled('module.cash'))
    and ((select private.has_permission('cash.close')) or (select private.has_permission('settings.manage')))
  );

-- 8.3 cash_requests
create policy cash_requests_select on public.cash_requests
  for select to authenticated
  using (
    (select private.feature_enabled('module.cash'))
    and (
      (select private.has_permission('cash.read'))
      or (select private.has_permission('cash.request'))
      or requested_by = (select auth.uid())
    )
  );

create policy cash_requests_insert on public.cash_requests
  for insert to authenticated
  with check (
    (select private.feature_enabled('module.cash'))
    and (select private.has_permission('cash.request'))
  );

create policy cash_requests_update on public.cash_requests
  for update to authenticated
  using (
    (select private.feature_enabled('module.cash'))
    and (
      (select private.has_permission('cash.approve'))
      or (select private.has_permission('cash.write'))
      or ((select private.has_permission('cash.request')) and requested_by = (select auth.uid()) and status = 'PENDING')
    )
  )
  with check (
    (select private.feature_enabled('module.cash'))
    and (
      (select private.has_permission('cash.approve'))
      or (select private.has_permission('cash.write'))
      or ((select private.has_permission('cash.request')) and requested_by = (select auth.uid()))
    )
  );

-- 8.4 cash_movements (Solo SELECT e INSERT gobernado por permiso y MFA aal2 si security.mfa_cash activo)
create policy cash_movements_select on public.cash_movements
  for select to authenticated
  using (
    (select private.feature_enabled('module.cash'))
    and (select private.has_permission('cash.read'))
  );

create policy cash_movements_insert on public.cash_movements
  for insert to authenticated
  with check (
    (select private.feature_enabled('module.cash'))
    and (select private.has_permission('cash.write'))
    and (
      (not (select private.feature_enabled('security.mfa_cash')))
      or coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    )
  );

-- 8.5 cash_reconciliations
create policy cash_reconciliations_select on public.cash_reconciliations
  for select to authenticated
  using (
    (select private.feature_enabled('module.cash'))
    and (
      (select private.has_permission('cash.read'))
      or (select private.has_permission('cash.close'))
    )
  );

create policy cash_reconciliations_insert on public.cash_reconciliations
  for insert to authenticated
  with check (
    (select private.feature_enabled('module.cash'))
    and (select private.has_permission('cash.close'))
    and (
      (not (select private.feature_enabled('security.mfa_cash')))
      or coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    )
  );

create policy cash_reconciliations_update on public.cash_reconciliations
  for update to authenticated
  using (
    (select private.feature_enabled('module.cash'))
    and (
      (select private.has_permission('cash.approve'))
      or (select private.has_permission('cash.close'))
    )
    and (
      (not (select private.feature_enabled('security.mfa_cash')))
      or coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    )
  )
  with check (
    (select private.feature_enabled('module.cash'))
    and (
      (select private.has_permission('cash.approve'))
      or (select private.has_permission('cash.close'))
    )
    and (
      (not (select private.feature_enabled('security.mfa_cash')))
      or coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    )
  );

-- ============================================================================
-- 9. FUNCIÓN DE COMPROBACIÓN NOCTURNA DE INTEGRIDAD CONTABLE
-- ============================================================================
create or replace function private.verify_cash_integrity()
returns table (
  account_id uuid,
  account_name text,
  opening_balance numeric,
  derived_balance numeric,
  manual_sum_balance numeric,
  is_balanced boolean,
  discrepancy numeric
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    ca.id as account_id,
    ca.name as account_name,
    ca.opening_balance,
    cab.current_balance as derived_balance,
    ca.opening_balance + coalesce((
      select sum(case when cm.direction = 'IN' then cm.amount else -cm.amount end)
        from public.cash_movements cm
       where cm.cash_account_id = ca.id
    ), 0.00) as manual_sum_balance,
    (cab.current_balance = ca.opening_balance + coalesce((
      select sum(case when cm.direction = 'IN' then cm.amount else -cm.amount end)
        from public.cash_movements cm
       where cm.cash_account_id = ca.id
    ), 0.00)) as is_balanced,
    abs(cab.current_balance - (ca.opening_balance + coalesce((
      select sum(case when cm.direction = 'IN' then cm.amount else -cm.amount end)
        from public.cash_movements cm
       where cm.cash_account_id = ca.id
    ), 0.00))) as discrepancy
  from public.cash_accounts ca
  join public.cash_account_balances cab on cab.cash_account_id = ca.id;
end;
$$;

revoke execute on function private.verify_cash_integrity() from public, anon;
grant execute on function private.verify_cash_integrity() to authenticated, service_role;

commit;
