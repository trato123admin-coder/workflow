-- pgTAP Tests: Sprint 11 — Caja Chica: Libro inmutable, solicitudes, arqueo y cierre
-- Archivo: supabase/tests/database/11_cash_management.test.sql

create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(24);

-- ============================================================================
-- 1. ESTRUCTURA: Tablas, vista y bucket de caja existen (6 tests)
-- ============================================================================
select has_table('public', 'cash_accounts', 'Existe tabla cash_accounts');
select has_table('public', 'cash_periods', 'Existe tabla cash_periods');
select has_table('public', 'cash_requests', 'Existe tabla cash_requests');
select has_table('public', 'cash_movements', 'Existe tabla cash_movements');
select has_table('public', 'cash_reconciliations', 'Existe tabla cash_reconciliations');
select has_view('public', 'cash_account_balances', 'Existe vista cash_account_balances');

-- ============================================================================
-- 2. RLS habilitada en todas las tablas (5 tests)
-- ============================================================================
select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'cash_accounts'),
  'cash_accounts tiene RLS habilitada'
);
select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'cash_periods'),
  'cash_periods tiene RLS habilitada'
);
select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'cash_requests'),
  'cash_requests tiene RLS habilitada'
);
select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'cash_movements'),
  'cash_movements tiene RLS habilitada'
);
select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'cash_reconciliations'),
  'cash_reconciliations tiene RLS habilitada'
);

-- ============================================================================
-- 3. SETUP: Usuarios, roles y datos de prueba
-- ============================================================================
insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'admin_cash@test.pe'),
  ('a2222222-2222-2222-2222-222222222222', 'cashier_user@test.pe'),
  ('a3333333-3333-3333-3333-333333333333', 'analyst_cash@test.pe')
on conflict (id) do nothing;

insert into public.profiles (id, email, first_name, last_name, is_active) values
  ('a1111111-1111-1111-1111-111111111111', 'admin_cash@test.pe', 'Admin', 'Cash', true),
  ('a2222222-2222-2222-2222-222222222222', 'cashier_user@test.pe', 'Cajero', 'Test', true),
  ('a3333333-3333-3333-3333-333333333333', 'analyst_cash@test.pe', 'Gestor', 'Test', true)
on conflict (id) do update set is_active = true;

insert into public.user_roles (user_id, role_id)
select 'a1111111-1111-1111-1111-111111111111', id from public.roles where code = 'ADMIN'
on conflict (user_id, role_id) do nothing;

insert into public.user_roles (user_id, role_id)
select 'a2222222-2222-2222-2222-222222222222', id from public.roles where code = 'CASHIER'
on conflict (user_id, role_id) do nothing;

insert into public.user_roles (user_id, role_id)
select 'a3333333-3333-3333-3333-333333333333', id from public.roles where code = 'ANALYST'
on conflict (user_id, role_id) do nothing;

-- Crear una cuenta de caja chica de prueba
insert into public.cash_accounts (id, name, account_type, currency, opening_balance)
values ('c0000000-0000-0000-0000-000000000001', 'Caja Notarial Prueba', 'CASH', 'PEN', 1000.00)
on conflict (id) do nothing;

-- Crear un período OPEN para el mes actual
insert into public.cash_periods (id, cash_account_id, period_start, period_end, status)
values (
  'b0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  '2026-09-01',
  '2026-09-30',
  'OPEN'
)
on conflict (id) do nothing;

-- ============================================================================
-- 4. TEST INMUTABILIDAD ESTRICTA EN cash_movements (2 tests: 12 y 13)
-- ============================================================================
insert into public.cash_movements (
  id,
  movement_number,
  cash_account_id,
  movement_type,
  direction,
  amount,
  category_code,
  description,
  movement_date,
  created_by
)
values (
  'd0000000-0000-0000-0000-000000000001',
  'MOV-2026-0001',
  'c0000000-0000-0000-0000-000000000001',
  'EXPENSE',
  'OUT',
  150.00,
  'GASTOS_NOTARIALES',
  'Pago minuta notarial',
  '2026-09-15',
  'a2222222-2222-2222-2222-222222222222'
)
on conflict (id) do nothing;

-- Intento de UPDATE directo en cash_movements debe fallar por trigger raise_immutable
select throws_ok(
  $$
    update public.cash_movements
       set amount = 200.00
     where id = 'd0000000-0000-0000-0000-000000000001'
  $$,
  'UPDATE sobre cash_movements es rechazado estrictamente'
);

-- Intento de DELETE directo en cash_movements debe fallar por trigger raise_immutable
select throws_ok(
  $$
    delete from public.cash_movements
     where id = 'd0000000-0000-0000-0000-000000000001'
  $$,
  'DELETE sobre cash_movements es rechazado estrictamente'
);

-- ============================================================================
-- 5. TEST: Bloqueo de movimientos en fecha sin período abierto (1 test: 14)
-- ============================================================================
select throws_ok(
  $$
    insert into public.cash_movements (
      movement_number,
      cash_account_id,
      movement_type,
      direction,
      amount,
      category_code,
      description,
      movement_date,
      created_by
    )
    values (
      'MOV-2026-0002',
      'c0000000-0000-0000-0000-000000000001',
      'EXPENSE',
      'OUT',
      50.00,
      'GASTOS_NOTARIALES',
      'Gasto fuera de fecha',
      '2026-08-15', -- Fecha no cubierta por el período OPEN de septiembre
      'a2222222-2222-2222-2222-222222222222'
    )
  $$,
  'No se puede insertar movimiento fuera del periodo contable abierto'
);

-- ============================================================================
-- 6. TEST: Reglas de reversos contables (2 tests: 15 y 16)
-- ============================================================================
-- Registrar reverso legítimo
insert into public.cash_movements (
  id,
  movement_number,
  cash_account_id,
  movement_type,
  direction,
  amount,
  category_code,
  description,
  movement_date,
  reversal_of,
  created_by
)
values (
  'd0000000-0000-0000-0000-000000000002',
  'MOV-2026-0003',
  'c0000000-0000-0000-0000-000000000001',
  'REVERSAL',
  'IN', -- Opuesto a OUT
  150.00, -- Mismo monto
  'GASTOS_NOTARIALES',
  'Reverso por error en comprobante de minuta',
  '2026-09-16',
  'd0000000-0000-0000-0000-000000000001',
  'a2222222-2222-2222-2222-222222222222'
)
on conflict (id) do nothing;

-- Intento de reversar el reverso debe fallar
select throws_ok(
  $$
    insert into public.cash_movements (
      movement_number,
      cash_account_id,
      movement_type,
      direction,
      amount,
      category_code,
      description,
      movement_date,
      reversal_of,
      created_by
    )
    values (
      'MOV-2026-0004',
      'c0000000-0000-0000-0000-000000000001',
      'REVERSAL',
      'OUT',
      150.00,
      'GASTOS_NOTARIALES',
      'Intento de reversar un reverso',
      '2026-09-17',
      'd0000000-0000-0000-0000-000000000002',
      'a2222222-2222-2222-2222-222222222222'
    )
  $$,
  'No se puede reversar un movimiento que ya es de tipo REVERSAL'
);

-- Intento de reversar por segunda vez el movimiento original debe fallar
select throws_ok(
  $$
    insert into public.cash_movements (
      movement_number,
      cash_account_id,
      movement_type,
      direction,
      amount,
      category_code,
      description,
      movement_date,
      reversal_of,
      created_by
    )
    values (
      'MOV-2026-0005',
      'c0000000-0000-0000-0000-000000000001',
      'REVERSAL',
      'IN',
      150.00,
      'GASTOS_NOTARIALES',
      'Intento de doble reverso',
      '2026-09-18',
      'd0000000-0000-0000-0000-000000000001',
      'a2222222-2222-2222-2222-222222222222'
    )
  $$,
  'No se permite registrar un segundo reverso para el mismo movimiento original'
);

-- ============================================================================
-- 7. TEST: Vista cash_account_balances calcula apertura + IN - OUT (1 test: 17)
-- ============================================================================
-- Apertura: 1000.00. Movimientos: OUT 150.00, IN 150.00 (reverso). Saldo resultante = 1000.00
select results_eq(
  $$
    select current_balance, total_income, total_expense, movements_count
      from public.cash_account_balances
     where cash_account_id = 'c0000000-0000-0000-0000-000000000001'
  $$,
  $$
    values (1000.00::numeric, 150.00::numeric, 150.00::numeric, 2)
  $$,
  'cash_account_balances refleja saldo exacto tras movimiento y su reverso'
);

-- ============================================================================
-- 8. TEST: Control Dual en arqueos de cierre (2 tests: 18 y 19)
-- ============================================================================
insert into public.cash_reconciliations (
  id,
  cash_account_id,
  cash_period_id,
  reconciliation_date,
  period_start,
  period_end,
  system_balance,
  counted_balance,
  observations,
  status,
  opened_by
)
values (
  'e0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  '2026-09-28',
  '2026-09-01',
  '2026-09-30',
  1000.00,
  1000.00,
  'Conteo cuadrado conforme',
  'SUBMITTED',
  'a2222222-2222-2222-2222-222222222222' -- Cajero abrió
)
on conflict (id) do nothing;

-- Cajero intenta auto-aprobarse el arqueo: debe fallar por restricción de control dual
select throws_ok(
  $$
    update public.cash_reconciliations
       set status = 'APPROVED',
           approved_by = 'a2222222-2222-2222-2222-222222222222'
     where id = 'e0000000-0000-0000-0000-000000000001'
  $$,
  'Control dual: quien abre el arqueo no puede auto-aprobarlo'
);

-- Administrador aprueba el arqueo: debe cerrar automáticamente el período contable
update public.cash_reconciliations
   set status = 'APPROVED',
       approved_by = 'a1111111-1111-1111-1111-111111111111'
 where id = 'e0000000-0000-0000-0000-000000000001';

select results_eq(
  $$
    select status, closed_by
      from public.cash_periods
     where id = 'b0000000-0000-0000-0000-000000000001'
  $$,
  $$
    values ('CLOSED'::text, 'a1111111-1111-1111-1111-111111111111'::uuid)
  $$,
  'La aprobacion del arqueo cierra de forma automatica el periodo contable asociado'
);

-- ============================================================================
-- 9. TEST: Aislamiento de CASHIER (no ve casos ni documentos) (2 tests: 20 y 21)
-- ============================================================================
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "a2222222-2222-2222-2222-222222222222", "role": "authenticated", "aal": "aal2"}';

select is_empty(
  $$ select id from public.cases $$,
  'CASHIER no tiene permiso para consultar casos (aislamiento de dominio)'
);

select is_empty(
  $$ select id from public.case_documents $$,
  'CASHIER no tiene permiso para consultar documentos del expediente'
);

-- ============================================================================
-- 10. TEST: RLS gobernada por module.cash toggle (2 tests: 22 y 23)
-- ============================================================================
reset role;
update public.feature_flags set is_enabled = false where key = 'module.cash';

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "a1111111-1111-1111-1111-111111111111", "role": "authenticated", "aal": "aal2"}';

select is_empty(
  $$ select id from public.cash_accounts $$,
  'Con module.cash apagado, RLS bloquea consulta de cuentas incluso a ADMIN'
);

select is_empty(
  $$ select id from public.cash_movements $$,
  'Con module.cash apagado, RLS bloquea consulta de movimientos incluso a ADMIN'
);

-- ============================================================================
-- 11. TEST: Bucket de almacenamiento cash-support privado (1 test: 24)
-- ============================================================================
reset role;
select ok(
  exists (select 1 from storage.buckets where id = 'cash-support' and public = false),
  'Bucket storage cash-support existe y es privado'
);

select * from finish();
rollback;
