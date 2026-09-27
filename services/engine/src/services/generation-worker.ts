/**
 * generation-worker.ts — Processes generation_jobs asynchronously.
 *
 * Pipeline:
 * 1. Claim a QUEUED job
 * 2. Render DOCX from template + input_data
 * 3. Optionally convert to PDF (if docs.pdf_generation enabled)
 * 4. Upload to Storage, create document_versions + generated_documents
 * 5. Mark job as GENERATED
 * 6. On error: retry with backoff or mark as FAILED
 */

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineEnv } from '@workflow/shared';
import { renderDocx } from './docx-renderer.js';
import { convertDocxToPdf, isLibreOfficeAvailable } from './pdf-converter.js';
import { getSupabaseServiceClient, getStorageProvider } from '../storage/index.js';
import { getEngineEnv } from '../config/env.js';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface GenerationJob {
  id: string;
  case_id: string;
  case_document_id: string;
  template_id: string;
  input_data: Record<string, unknown>;
  template_version: number;
  rules_snapshot: unknown[];
  idempotency_key: string;
  attempts: number;
  max_attempts: number;
  requested_by: string;
}

interface ProcessResult {
  jobId: string;
  success: boolean;
  error?: string;
  docxVersionId?: string;
  pdfVersionId?: string;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Process a single generation job by ID.
 * Called by the job tick endpoint or a polling loop.
 */
export async function processGenerationJob(jobId: string): Promise<ProcessResult> {
  const supabase = getSupabaseServiceClient();
  const env = getEngineEnv();

  const job = await claimJob(supabase, jobId);
  if (!job) {
    return { jobId, success: false, error: 'Trabajo no encontrado o ya en proceso' };
  }

  try {
    const result = await executeJob(supabase, env, job);
    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    await handleJobError(supabase, job, message);
    return { jobId, success: false, error: message };
  }
}

/**
 * Process all QUEUED jobs (batch). Returns count of processed jobs.
 */
export async function processQueuedJobs(limit = 5): Promise<number> {
  const supabase = getSupabaseServiceClient();

  const { data: jobs } = await supabase
    .from('generation_jobs')
    .select('id')
    .eq('status', 'QUEUED')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!jobs?.length) return 0;

  let processed = 0;
  for (const job of jobs) {
    const result = await processGenerationJob(job.id as string);
    if (result.success) processed++;
  }

  return processed;
}

/* ------------------------------------------------------------------ */
/* Job lifecycle                                                       */
/* ------------------------------------------------------------------ */

async function claimJob(
  supabase: SupabaseClient,
  jobId: string,
): Promise<GenerationJob | null> {
  const { data, error } = await supabase
    .from('generation_jobs')
    .update({ status: 'GENERATING', started_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('status', 'QUEUED')
    .select('*')
    .single();

  if (error || !data) return null;
  return data as unknown as GenerationJob;
}

async function executeJob(
  supabase: SupabaseClient,
  env: EngineEnv,
  job: GenerationJob,
): Promise<ProcessResult> {
  // 1. Fetch the template file from storage
  const templateBuffer = await fetchTemplate(supabase, job.template_id);

  // 2. Render DOCX
  const { buffer: docxBuffer } = await renderDocx({
    templateBuffer,
    data: job.input_data,
  });

  // 3. Upload DOCX version
  const docxResult = await uploadVersion(supabase, job, docxBuffer, 'DOCX');

  // 4. Optionally convert to PDF
  let pdfVersionId: string | undefined;
  const pdfEnabled = await isPdfEnabled(supabase);
  const loAvailable = env.LIBREOFFICE_BIN
    ? await isLibreOfficeAvailable(env.LIBREOFFICE_BIN)
    : false;

  if (pdfEnabled && loAvailable) {
    const pdfBuffer = await convertDocxToPdf({
      docxBuffer,
      jobId: job.id,
      env,
    });
    const pdfResult = await uploadVersion(supabase, job, pdfBuffer, 'PDF');
    pdfVersionId = pdfResult.versionId;
  }

  // 5. Mark job as GENERATED
  await supabase
    .from('generation_jobs')
    .update({
      status: 'GENERATED',
      finished_at: new Date().toISOString(),
    })
    .eq('id', job.id);

  return {
    jobId: job.id,
    success: true,
    docxVersionId: docxResult.versionId,
    pdfVersionId,
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function fetchTemplate(
  supabase: SupabaseClient,
  templateId: string,
): Promise<Buffer> {
  const { data: template } = await supabase
    .from('templates')
    .select('storage_key')
    .eq('id', templateId)
    .single();

  if (!template?.storage_key) {
    throw new Error(`Plantilla ${templateId} no encontrada o sin archivo`);
  }

  const { data, error } = await supabase.storage
    .from('templates')
    .download(template.storage_key as string);

  if (error || !data) {
    throw new Error(`No se pudo descargar la plantilla: ${error?.message}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

function computeSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

interface UploadResult {
  versionId: string;
  sha256: string;
}

async function uploadVersion(
  supabase: SupabaseClient,
  job: GenerationJob,
  fileBuffer: Buffer,
  format: 'DOCX' | 'PDF',
): Promise<UploadResult> {
  const sha256 = computeSha256(fileBuffer);
  const ext = format.toLowerCase();
  const mime = format === 'PDF'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  // Get current max version for this case_document
  const { data: versions } = await supabase
    .from('document_versions')
    .select('version')
    .eq('case_document_id', job.case_document_id)
    .order('version', { ascending: false })
    .limit(1);

  const nextVersion = ((versions?.[0]?.version as number) ?? 0) + 1;

  // Upload to storage
  const storageKey = `generated/${job.case_id}/${job.case_document_id}/v${nextVersion}.${ext}`;
  const provider = getStorageProvider();
  await provider.put(storageKey, fileBuffer, { mime, sha256, size: fileBuffer.length });

  // Create document_version record
  const { data: version, error: vErr } = await supabase
    .from('document_versions')
    .insert({
      case_document_id: job.case_document_id,
      version: nextVersion,
      storage_backend: provider.code,
      storage_key: storageKey,
      file_name: `documento_v${nextVersion}.${ext}`,
      size_bytes: fileBuffer.length,
      mime_type: mime,
      sha256,
      change_summary: `Generado automáticamente (job ${job.id})`,
      created_by: job.requested_by,
    })
    .select('id')
    .single();

  if (vErr || !version) {
    throw new Error(`Error al crear versión de documento: ${vErr?.message}`);
  }

  // Create generated_document record
  await supabase.from('generated_documents').insert({
    generation_job_id: job.id,
    case_document_id: job.case_document_id,
    case_document_version_id: version.id,
    input_snapshot: job.input_data,
    template_version: job.template_version,
    rules_snapshot: job.rules_snapshot,
    sha256,
    format,
    approval_status: 'GENERATED',
  });

  // Update case_documents.current_version_id
  await supabase
    .from('case_documents')
    .update({ current_version_id: version.id, status: 'UPLOADED' })
    .eq('id', job.case_document_id);

  return { versionId: version.id as string, sha256 };
}

async function isPdfEnabled(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'docs.pdf_generation')
    .maybeSingle();

  if (!data?.value) return false;
  const val = data.value as Record<string, unknown>;
  return val.enabled === true;
}

async function handleJobError(
  supabase: SupabaseClient,
  job: GenerationJob,
  errorMessage: string,
): Promise<void> {
  const newAttempts = job.attempts + 1;
  const isFinal = newAttempts >= job.max_attempts;

  await supabase
    .from('generation_jobs')
    .update({
      status: isFinal ? 'FAILED' : 'QUEUED',
      error: errorMessage,
      attempts: newAttempts,
      finished_at: isFinal ? new Date().toISOString() : null,
    })
    .eq('id', job.id);
}
