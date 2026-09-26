-- ============================================================================
-- Migración: 20260926010000_case_documents_audit_trigger.sql
-- Sprint: 5 (Auditoría de case_documents)
-- Propósito:
--   Conectar el trigger automático tg_audit_log a public.case_documents
--   (AFTER INSERT OR UPDATE) para registrar cualquier cambio de estado
--   (VALIDATED, OBSERVED, UPLOADED) o modificación de notas y metadatos
--   en la tabla append-only public.audit_logs.
-- ============================================================================

drop trigger if exists trg_audit_case_documents on public.case_documents;
create trigger trg_audit_case_documents
  after insert or update on public.case_documents
  for each row execute function private.tg_audit_log();
