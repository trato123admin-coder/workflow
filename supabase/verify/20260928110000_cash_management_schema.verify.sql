-- ============================================================================
-- Verificación: 20260928110000_cash_management_schema.verify.sql
-- ============================================================================

do $$
declare
  v_rls_missing integer;
  v_tables text[] := array['cash_accounts', 'cash_periods', 'cash_requests', 'cash_movements', 'cash_reconciliations'];
  v_t text;
begin
  -- 1. Verificar existencia de tablas y RLS habilitada
  foreach v_t in array v_tables loop
    assert exists (
      select 1 from pg_tables where schemaname = 'public' and tablename = v_t
    ), format('VERIFY FAILED: La tabla public.%s no existe', v_t);
  end loop;

  select count(*) into v_rls_missing
  from pg_tables
  where schemaname = 'public'
    and tablename = any(v_tables)
    and rowsecurity = false;

  assert v_rls_missing = 0,
    'VERIFY FAILED: Existen tablas de caja chica sin RLS habilitada';

  -- 2. Verificar vista de saldos
  assert exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'cash_account_balances'
  ), 'VERIFY FAILED: La vista public.cash_account_balances no existe';

  -- 3. Verificar triggers críticos de negocio
  assert exists (
    select 1 from pg_trigger
    where tgname = 'trg_cash_movements_immutable' and tgrelid = 'public.cash_movements'::regclass
  ), 'VERIFY FAILED: Falta el trigger trg_cash_movements_immutable en cash_movements';

  assert exists (
    select 1 from pg_trigger
    where tgname = 'trg_cash_movements_check_period' and tgrelid = 'public.cash_movements'::regclass
  ), 'VERIFY FAILED: Falta el trigger trg_cash_movements_check_period en cash_movements';

  assert exists (
    select 1 from pg_trigger
    where tgname = 'trg_cash_movements_validate_reversal' and tgrelid = 'public.cash_movements'::regclass
  ), 'VERIFY FAILED: Falta el trigger trg_cash_movements_validate_reversal en cash_movements';

  assert exists (
    select 1 from pg_trigger
    where tgname = 'trg_cash_reconciliation_dual_control' and tgrelid = 'public.cash_reconciliations'::regclass
  ), 'VERIFY FAILED: Falta el trigger trg_cash_reconciliation_dual_control en cash_reconciliations';

  -- 4. Verificar bucket privado
  assert exists (
    select 1 from storage.buckets where id = 'cash-support' and public = false
  ), 'VERIFY FAILED: El bucket storage cash-support no existe o no es privado';

  -- 5. Verificar permisos en sistema
  assert exists (
    select 1 from public.permissions where code = 'cash.read'
  ), 'VERIFY FAILED: Permiso cash.read no registrado';

  assert exists (
    select 1 from public.permissions where code = 'cash.approve'
  ), 'VERIFY FAILED: Permiso cash.approve no registrado';

  -- 6. Verificar feature flag
  assert exists (
    select 1 from public.feature_flags where key = 'module.cash'
  ), 'VERIFY FAILED: Feature flag module.cash no registrado';

  -- 7. Verificar función de integridad
  assert exists (
    select 1 from pg_proc where proname = 'verify_cash_integrity'
  ), 'VERIFY FAILED: Función private.verify_cash_integrity no existe';

  raise notice 'VERIFICACIÓN EXITOSA: Tablas de caja chica con RLS, libro inmutable, control dual de arqueo, bucket cash-support y feature flag module.cash activos.';
end $$;
