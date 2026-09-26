-- Script de Verificación: verify_sprint5_documents.sql
-- Ejecutar en el SQL Editor de Supabase Staging tras aplicar la migración 20260926000000_storage_and_documents_schema.sql
-- No modifica datos. Cada consulta es independiente e incluye el resultado esperado en comentarios.

-- 1. Verificar que las 6 tablas nuevas existen en public y tienen RLS activa (rowsecurity = true)
-- Resultado esperado: 6 filas con rowsecurity = true
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
   and tablename in (
     'storage_backends',
     'document_types',
     'document_alternatives',
     'case_model_documents',
     'case_documents',
     'document_versions'
   )
 order by tablename;
-- Esperado:
-- case_documents        | true
-- case_model_documents  | true
-- document_alternatives  | true
-- document_types        | true
-- document_versions     | true
-- storage_backends      | true

-- 2. Verificar que no exista ninguna tabla en public sin RLS
-- Resultado esperado: 0
select count(*) as public_tables_without_rls
  from pg_tables
 where schemaname = 'public'
   and rowsecurity = false;
-- Esperado: 0

-- 3. Verificar la clave foránea circular agregada al final (fk_case_documents_current_version)
-- Resultado esperado: 1 fila vinculando case_documents con document_versions
select tc.table_name, tc.constraint_name, ccu.table_name as references_table
  from information_schema.table_constraints tc
  join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
 where tc.table_schema = 'public'
   and tc.table_name = 'case_documents'
   and tc.constraint_name = 'fk_case_documents_current_version';
-- Esperado:
-- case_documents | fk_case_documents_current_version | document_versions

-- 4. Verificar la restricción única uq_case_model_documents sobre (version, process, sequence)
-- Resultado esperado: 1 fila con la definición que previene colisiones entre procesos
select conname, pg_get_constraintdef(c.oid) as definition
  from pg_constraint c
 where conrelid = 'public.case_model_documents'::regclass
   and conname = 'uq_case_model_documents';
-- Esperado:
-- uq_case_model_documents | UNIQUE (case_model_version_id, case_model_process_id, sequence)

-- 5. Verificar que el trigger de inmutabilidad está activo en case_model_documents
-- Resultado esperado: 1 fila
select tgname, tgrelid::regclass as table_name
  from pg_trigger
 where tgrelid = 'public.case_model_documents'::regclass
   and tgname = 'trg_guard_case_model_documents_immutability';
-- Esperado:
-- trg_guard_case_model_documents_immutability | case_model_documents

-- 6. Verificar el catálogo de tipos de documentos poblado con los 27 tipos oficiales
-- Resultado esperado: 27 o más tipos distribuidos en GENERATED (9), UPLOADED (14) y EXTERNAL (4)
select count(*) as total_document_types,
       count(*) filter (where nature = 'GENERATED') as generated_docs,
       count(*) filter (where nature = 'UPLOADED') as uploaded_docs,
       count(*) filter (where nature = 'EXTERNAL') as external_docs
  from public.document_types;
-- Esperado:
-- total_document_types >= 27 | generated_docs = 9 | uploaded_docs = 14 | external_docs = 4

-- 7. VERIFICACIÓN CRÍTICA DEL PUNTO 2:
-- Verificar que existen exactamente 2 documentos para HEREDERO en SUCESION_INTESTADA_NOTARIAL v1
-- (PARTIDA_NACIMIENTO y DNI_COPIA sin colisión de secuencia con causante)
-- Resultado esperado: 2 filas exactas
select dt.code, cmd.sequence, cmd.is_required, cmd.party_role, pd.code as process_code
  from public.case_model_documents cmd
  join public.case_model_versions cmv on cmv.id = cmd.case_model_version_id
  join public.case_models cm on cm.id = cmv.case_model_id
  join public.document_types dt on dt.id = cmd.document_type_id
  left join public.case_model_processes cmp on cmp.id = cmd.case_model_process_id
  left join public.process_definitions pd on pd.id = cmp.process_definition_id
 where cm.code = 'SUCESION_INTESTADA_NOTARIAL'
   and cmv.version = 1
   and cmd.party_role = 'HEREDERO'
 order by cmd.sequence;
-- Esperado:
-- PARTIDA_NACIMIENTO | 1 | true | HEREDERO | HEREDEROS
-- DNI_COPIA          | 2 | true | HEREDERO | HEREDEROS

-- 8. Verificar el total de asignaciones documentales del modelo principal SUCESION_INTESTADA_NOTARIAL v1
-- Resultado esperado: 22 documentos en los 11 procesos
select count(*) as total_model_documents
  from public.case_model_documents cmd
  join public.case_model_versions cmv on cmv.id = cmd.case_model_version_id
  join public.case_models cm on cm.id = cmv.case_model_id
 where cm.code = 'SUCESION_INTESTADA_NOTARIAL'
   and cmv.version = 1;
-- Esperado:
-- 22

-- 9. Verificar blindaje del bucket case-documents (privado y CERO políticas para authenticated/public)
-- Resultado esperado: public = false y 0 políticas para authenticated/public
select b.id as bucket_id, b.public,
       coalesce(count(p.policyname), 0) as auth_or_public_policies
  from storage.buckets b
  left join pg_policies p on p.schemaname = 'storage'
                         and p.tablename = 'objects'
                         and (p.roles @> '{authenticated}'::name[] or p.roles @> '{public}'::name[])
                         and p.policyname ilike '%case%'
 where b.id = 'case-documents'
 group by b.id, b.public;
-- Esperado:
-- case-documents | false | 0

-- 10. Verificar que sync_case_document_slots es SECURITY DEFINER
-- Resultado esperado: 1 fila con prosecdef = true
select p.proname, n.nspname, p.prosecdef
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where p.proname = 'sync_case_document_slots';
-- Esperado:
-- sync_case_document_slots | public | true

-- 11. Verificar que el trigger de auditoría trg_audit_case_documents está activo en case_documents
-- Resultado esperado: 1 fila
select tgname, tgrelid::regclass as table_name
  from pg_trigger
 where tgrelid = 'public.case_documents'::regclass
   and tgname = 'trg_audit_case_documents';
-- Esperado:
-- trg_audit_case_documents | case_documents
