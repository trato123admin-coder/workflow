-- ============================================================================
-- Verificación: 20260929100000_job_queue_and_claim_jobs.verify.sql
-- ============================================================================

do $$
declare
  v_rls_enabled boolean;
  v_test_job_id uuid;
  v_claimed_job record;
  v_failed_job record;
  v_dead_job record;
  v_retried_job record;
begin
  -- 1. Verificar existencia de job_queue y RLS activa
  select rowsecurity into v_rls_enabled
    from pg_tables
   where schemaname = 'public' and tablename = 'job_queue';

  assert v_rls_enabled = true,
    'VERIFY FAILED: job_queue no existe o no tiene RLS habilitada';

  -- 2. Verificar índices críticos
  assert exists (
    select 1 from pg_indexes where tablename = 'job_queue' and indexname = 'idx_job_queue_claim'
  ), 'VERIFY FAILED: Falta el índice idx_job_queue_claim';

  assert exists (
    select 1 from pg_indexes where tablename = 'job_queue' and indexname = 'idx_job_queue_type'
  ), 'VERIFY FAILED: Falta el índice idx_job_queue_type';

  -- 3. Verificar política RLS para lectura de monitoreo
  assert exists (
    select 1 from pg_policies where tablename = 'job_queue' and policyname = 'job_queue_select'
  ), 'VERIFY FAILED: Falta la política RLS job_queue_select';

  -- 4. Verificar privilegios estrictos: authenticated NO debe poder ejecutar claim_jobs, complete_job ni fail_job
  assert not has_function_privilege('authenticated', 'public.claim_jobs(text, integer, integer)', 'EXECUTE'),
    'VERIFY FAILED: authenticated NO debe tener permiso de ejecución en claim_jobs';

  assert not has_function_privilege('authenticated', 'public.complete_job(uuid, jsonb)', 'EXECUTE'),
    'VERIFY FAILED: authenticated NO debe tener permiso de ejecución en complete_job';

  assert not has_function_privilege('authenticated', 'public.fail_job(uuid, text)', 'EXECUTE'),
    'VERIFY FAILED: authenticated NO debe tener permiso de ejecución en fail_job';

  assert has_function_privilege('authenticated', 'public.retry_job(uuid)', 'EXECUTE'),
    'VERIFY FAILED: authenticated DEBE tener permiso de ejecución en retry_job (validación interna por settings.manage)';

  assert has_function_privilege('service_role', 'public.claim_jobs(text, integer, integer)', 'EXECUTE'),
    'VERIFY FAILED: service_role debe tener permiso de ejecución en claim_jobs';

  -- 5. Verificar configuración platform.jobs_mode
  assert exists (
    select 1 from public.setting_definitions where key = 'platform.jobs_mode'
  ), 'VERIFY FAILED: setting_definitions platform.jobs_mode no existe';

  assert exists (
    select 1 from public.system_settings where key = 'platform.jobs_mode' and value = '"TICK"'::jsonb
  ), 'VERIFY FAILED: system_settings platform.jobs_mode no está configurado en TICK';

  -- 6. Prueba funcional completa de ciclo de vida de un trabajo (como service_role/superusuario):
  -- 6.1 Crear trabajo de prueba encolado
  insert into public.job_queue (job_type, payload, status, run_at, max_attempts)
  values ('test_verification_job', '{"test": true}'::jsonb, 'QUEUED', now() - interval '1 minute', 2)
  returning id into v_test_job_id;

  -- 6.2 Reclamar el trabajo con claim_jobs (SKIP LOCKED)
  select * into v_claimed_job
    from public.claim_jobs('verify-worker', 1, 15)
   where id = v_test_job_id;

  assert v_claimed_job.id is not null, 'VERIFY FAILED: claim_jobs no retornó el trabajo de prueba';
  assert v_claimed_job.status = 'RUNNING', 'VERIFY FAILED: El trabajo reclamado no pasó a RUNNING';
  assert v_claimed_job.locked_by = 'verify-worker', 'VERIFY FAILED: locked_by no coincide con verify-worker';
  assert v_claimed_job.attempts = 1, 'VERIFY FAILED: attempts no incrementó a 1';

  -- 6.3 Simular primer fallo (reintento con backoff exponencial)
  select * into v_failed_job from public.fail_job(v_test_job_id, 'Fallo 1 simulado');
  assert v_failed_job.status = 'QUEUED', 'VERIFY FAILED: fail_job con intentos < max no reencoló a QUEUED';
  assert v_failed_job.run_at > now(), 'VERIFY FAILED: fail_job no calculó backoff futuro para run_at';
  assert v_failed_job.last_error = 'Fallo 1 simulado', 'VERIFY FAILED: last_error no se registró';

  -- 6.4 Forzar ejecución inmediata y reclamar nuevamente (intento 2 de 2)
  update public.job_queue set run_at = now() - interval '1 second' where id = v_test_job_id;
  select * into v_claimed_job from public.claim_jobs('verify-worker-2', 1, 15) where id = v_test_job_id;
  assert v_claimed_job.attempts = 2, 'VERIFY FAILED: attempts no incrementó a 2';

  -- 6.5 Segundo fallo -> debe transicionar a DEAD (alcanzó max_attempts = 2)
  select * into v_dead_job from public.fail_job(v_test_job_id, 'Fallo definitivo 2');
  assert v_dead_job.status = 'DEAD', 'VERIFY FAILED: Trabajo no pasó a DEAD al superar max_attempts';
  assert v_dead_job.finished_at is not null, 'VERIFY FAILED: Trabajo DEAD no registró finished_at';

  -- 6.6 Probar recuperación de bloqueo huérfano
  -- Simular que un trabajo quedó en RUNNING con locked_at hace 30 minutos
  update public.job_queue
     set status = 'RUNNING',
         locked_at = now() - interval '30 minutes',
         locked_by = 'crashed-worker'
   where id = v_test_job_id;

  -- Al invocar claim_jobs, el limpiador interno de huérfanos debe detectar que superó max_attempts y marcarlo DEAD
  perform public.claim_jobs('cleanup-worker', 1, 15);

  select * into v_dead_job from public.job_queue where id = v_test_job_id;
  assert v_dead_job.status = 'DEAD', 'VERIFY FAILED: Bloqueo huérfano con attempts >= max_attempts no pasó a DEAD';

  -- Limpieza de registro de prueba
  delete from public.job_queue where id = v_test_job_id;

  raise notice 'VERIFICACIÓN EXITOSA: job_queue, claim_jobs (SKIP LOCKED, solo service_role), fail_job, complete_job, retry_job (exclusivo settings.manage) y platform.jobs_mode activos y blindados.';
end $$;
