-- pgTAP Tests: Sprint 8 — Seguridad, Privilegios y Privacidad en Notificaciones
-- Archivo: supabase/tests/database/13_notifications_security.test.sql

create extension if not exists pgtap with schema extensions;

begin;
set local search_path = public, extensions;

select plan(14);

-- ============================================================================
-- 1. ESTRUCTURA Y RLS
-- ============================================================================
select has_table('public', 'notifications', 'Existe tabla public.notifications');
select has_table('public', 'notification_preferences', 'Existe tabla public.notification_preferences');

select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'notifications'),
  'notifications tiene RLS habilitada'
);

select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'notification_preferences'),
  'notification_preferences tiene RLS habilitada'
);

-- ============================================================================
-- 2. PRIVILEGIOS DML EN notifications
-- authenticated solo tiene SELECT y UPDATE (para marcar leída), NUNCA INSERT directo
-- ============================================================================
select ok(
  has_table_privilege('authenticated', 'public.notifications', 'SELECT'),
  'authenticated tiene privilegio SELECT en notifications (gobernado por RLS)'
);

select ok(
  has_table_privilege('authenticated', 'public.notifications', 'UPDATE'),
  'authenticated tiene privilegio UPDATE en notifications'
);

select ok(
  not has_table_privilege('authenticated', 'public.notifications', 'INSERT'),
  'authenticated NO tiene privilegio INSERT directo en notifications'
);

select ok(
  not has_table_privilege('authenticated', 'public.notifications', 'DELETE'),
  'authenticated NO tiene privilegio DELETE directo en notifications'
);

-- ============================================================================
-- 3. PRIVILEGIOS DE create_notification: EXCLUSIVA PARA service_role
-- ============================================================================
select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_notification(uuid, text, text, text, text, uuid, uuid, text, text, text, text, jsonb)',
    'EXECUTE'
  ),
  'Catálogo: authenticated NO tiene privilegio EXECUTE en create_notification'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.create_notification(uuid, text, text, text, text, uuid, uuid, text, text, text, text, jsonb)',
    'EXECUTE'
  ),
  'Catálogo: service_role SI tiene privilegio EXECUTE en create_notification'
);

-- ============================================================================
-- 4. PRUEBA DE EJECUCIÓN REAL: authenticated ES RECHAZADO CON 42501
-- ============================================================================
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000099", "role": "authenticated", "email": "usuario@workflow.pe"}';

select throws_ok(
  format(
    'select public.create_notification(%L::uuid, %L, %L, %L)',
    '00000000-0000-0000-0000-000000000099',
    'TEST',
    'Titulo',
    'Mensaje'
  ),
  '42501',
  null,
  'Ejecución real: authenticated recibe 42501 al intentar ejecutar create_notification'
);

-- Restablecer a rol con privilegios para probar validación interna de privacidad
reset role;

-- ============================================================================
-- 5. VALIDACIÓN DE PRIVACIDAD DEL DESTINATARIO (Regla e)
-- Si p_case_id no es nulo, el destinatario DEBE tener acceso al caso
-- ============================================================================
-- 5.1 Destinatario ficticio sin perfil activo ni acceso
-- Intentar enviarle alerta de expediente DEBE FALLAR con P0404
select throws_ok(
  format(
    'select public.create_notification(%L::uuid, %L, %L, %L, %L, %L::uuid, %L::uuid)',
    '00000000-0000-0000-0000-000000000099',
    'FILING_OVERDUE',
    'Alerta caso',
    'Detalle confidencial',
    'case',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001'
  ),
  'P0404',
  null,
  'create_notification rechaza con P0404 si el DESTINATARIO no existe o esta inactivo'
);

-- ============================================================================
-- 6. AISLAMIENTO RLS ENTRE USUARIOS
-- ============================================================================
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000099", "role": "authenticated", "email": "usuario@workflow.pe"}';

select is_empty(
  'select id from public.notifications where user_id = ''00000000-0000-0000-0000-000000000001''::uuid',
  'RLS: Usuario autenticado no puede consultar notificaciones de otros usuarios'
);

select is_empty(
  'select id from public.notification_preferences where user_id = ''00000000-0000-0000-0000-000000000001''::uuid',
  'RLS: Usuario autenticado no puede consultar preferencias de otros usuarios'
);

select * from finish();
rollback;
