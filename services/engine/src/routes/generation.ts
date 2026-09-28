import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createDocumentError, type DocumentError } from '../services/documents.js';
import { renderDocx } from '../services/docx-renderer.js';
import { convertDocxToPdf, isLibreOfficeAvailable } from '../services/pdf-converter.js';
import { addWatermark } from '../services/watermark.js';
import { getEngineEnv } from '../config/env.js';
import { getSupabaseServiceClient } from '../storage/index.js';

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

const createJobBodySchema = z.object({
  case_id: z.string().uuid(),
  case_document_id: z.string().uuid(),
  template_id: z.string().uuid(),
  recommendation_id: z.string().uuid().optional(),
  input_data: z.record(z.unknown()),
  idempotency_key: z.string().min(1).max(255),
});

const previewBodySchema = z.object({
  template_id: z.string().uuid(),
  input_data: z.record(z.unknown()),
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function extractBearerToken(authHeader: string | undefined): string {
  if (!authHeader?.startsWith('Bearer ')) {
    throw createDocumentError(
      'Encabezado de autorización Bearer ausente o inválido',
      401,
      'UNAUTHORIZED',
    );
  }
  const token = authHeader.substring(7).trim();
  if (!token) {
    throw createDocumentError('Token JWT vacío', 401, 'UNAUTHORIZED');
  }
  return token;
}

function errorResponse(reply: FastifyReply, err: unknown): FastifyReply {
  const docErr = err as DocumentError;
  const statusCode = docErr.statusCode || 500;
  return reply.status(statusCode).send({
    error: docErr.code || 'INTERNAL_ERROR',
    message: docErr.message || 'Error interno',
    statusCode,
  });
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

export const generationRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /v1/generation-jobs — Create an async generation job (idempotent).
   * The frontend subscribes to Realtime on generation_jobs for status updates.
   */
  fastify.post('/v1/generation-jobs', async (request: FastifyRequest, reply: FastifyReply) => {
    const bodyResult = createJobBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        error: 'INVALID_BODY',
        message: bodyResult.error.errors[0]?.message ?? 'Cuerpo inválido',
        statusCode: 400,
      });
    }

    let userJwt: string;
    try {
      userJwt = extractBearerToken(request.headers.authorization);
    } catch (err: unknown) {
      return errorResponse(reply, err);
    }

    try {
      const result = await createGenerationJob(userJwt, bodyResult.data, request.log);
      return reply.status(201).send({ success: true, data: result });
    } catch (err: unknown) {
      return errorResponse(reply, err);
    }
  });

  /**
   * POST /v1/documents/preview — Generate a temporary PDF preview with
   * BORRADOR watermark. Does not create a job or permanent version.
   */
  fastify.post('/v1/documents/preview', async (request: FastifyRequest, reply: FastifyReply) => {
    const bodyResult = previewBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        error: 'INVALID_BODY',
        message: bodyResult.error.errors[0]?.message ?? 'Cuerpo inválido',
        statusCode: 400,
      });
    }

    let userJwt: string;
    try {
      userJwt = extractBearerToken(request.headers.authorization);
    } catch (err: unknown) {
      return errorResponse(reply, err);
    }

    try {
      const result = await generatePreview(userJwt, bodyResult.data, request.log);

      reply.header('content-type', result.contentType);
      reply.header('content-disposition', 'inline; filename="preview.pdf"');
      return reply.send(result.buffer);
    } catch (err: unknown) {
      return errorResponse(reply, err);
    }
  });
};

/* ------------------------------------------------------------------ */
/* Business logic                                                      */
/* ------------------------------------------------------------------ */

interface CreateJobParams {
  case_id: string;
  case_document_id: string;
  template_id: string;
  recommendation_id?: string;
  input_data: Record<string, unknown>;
  idempotency_key: string;
}

interface JobResult {
  id: string;
  status: string;
  idempotency_key: string;
  already_existed: boolean;
}

async function createGenerationJob(
  userJwt: string,
  params: CreateJobParams,
  logger: FastifyRequest['log'],
): Promise<JobResult> {
  const supabase = getSupabaseServiceClient();

  // Verify user permissions via their JWT
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser(userJwt);
  if (authErr || !user) {
    throw createDocumentError('Token inválido o sesión expirada', 401, 'UNAUTHORIZED');
  }

  // Fetch template version
  const { data: template, error: tplErr } = await supabase
    .from('templates')
    .select('id, version')
    .eq('id', params.template_id)
    .eq('is_active', true)
    .single();

  if (tplErr || !template) {
    throw createDocumentError('Plantilla no encontrada o inactiva', 404, 'TEMPLATE_NOT_FOUND');
  }

  // Idempotency check: return existing job if same key
  const { data: existing } = await supabase
    .from('generation_jobs')
    .select('id, status, idempotency_key')
    .eq('idempotency_key', params.idempotency_key)
    .maybeSingle();

  if (existing) {
    logger.info({ jobId: existing.id }, 'Trabajo de generación ya existe (idempotencia)');
    return {
      id: existing.id as string,
      status: existing.status as string,
      idempotency_key: existing.idempotency_key as string,
      already_existed: true,
    };
  }

  // Create the job (the RPC validates RLS permissions)
  const { data: job, error: insertErr } = await supabase
    .from('generation_jobs')
    .insert({
      case_id: params.case_id,
      case_document_id: params.case_document_id,
      template_id: params.template_id,
      recommendation_id: params.recommendation_id ?? null,
      input_data: params.input_data,
      template_version: template.version,
      rules_snapshot: [],
      idempotency_key: params.idempotency_key,
      status: 'QUEUED',
      requested_by: user.id,
    })
    .select('id, status, idempotency_key')
    .single();

  if (insertErr || !job) {
    logger.error({ error: insertErr }, 'Error al crear trabajo de generación');
    throw createDocumentError(
      'No se pudo crear el trabajo de generación. Verifique permisos.',
      403,
      'JOB_CREATE_FAILED',
    );
  }

  logger.info({ jobId: job.id }, 'Trabajo de generación creado');
  return {
    id: job.id as string,
    status: job.status as string,
    idempotency_key: job.idempotency_key as string,
    already_existed: false,
  };
}

/* ------------------------------------------------------------------ */
/* Preview generation                                                  */
/* ------------------------------------------------------------------ */

interface PreviewParams {
  template_id: string;
  input_data: Record<string, unknown>;
}

interface PreviewResult {
  buffer: Buffer;
  contentType: string;
}

async function generatePreview(
  userJwt: string,
  params: PreviewParams,
  logger: FastifyRequest['log'],
): Promise<PreviewResult> {
  const supabase = getSupabaseServiceClient();
  const env = getEngineEnv();

  // Verify user
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser(userJwt);
  if (authErr || !user) {
    throw createDocumentError('Token inválido o sesión expirada', 401, 'UNAUTHORIZED');
  }

  // Fetch template file from storage
  const { data: template, error: tplErr } = await supabase
    .from('templates')
    .select('id, storage_key, storage_backend')
    .eq('id', params.template_id)
    .eq('is_active', true)
    .single();

  if (tplErr || !template) {
    throw createDocumentError('Plantilla no encontrada', 404, 'TEMPLATE_NOT_FOUND');
  }

  const { data: fileData, error: dlErr } = await supabase.storage
    .from('templates')
    .download(template.storage_key as string);

  if (dlErr || !fileData) {
    throw createDocumentError('No se pudo descargar la plantilla', 500, 'TEMPLATE_DOWNLOAD_FAILED');
  }

  const templateBuffer = Buffer.from(await fileData.arrayBuffer());

  // Render DOCX
  const renderResult = await renderDocx({
    templateBuffer,
    data: params.input_data,
  });

  // If LibreOffice is available, convert to PDF + watermark
  const loAvailable = env.LIBREOFFICE_BIN
    ? await isLibreOfficeAvailable(env.LIBREOFFICE_BIN)
    : false;

  if (loAvailable) {
    const pdfBuffer = await convertDocxToPdf({
      docxBuffer: renderResult.buffer,
      jobId: `preview-${Date.now()}`,
      env,
    });

    const watermarked = await addWatermark({ pdfBuffer });
    logger.info('Vista previa PDF generada con marca de agua');

    return { buffer: watermarked, contentType: 'application/pdf' };
  }

  // Fallback: return DOCX without watermark
  logger.info('LibreOffice no disponible, devolviendo DOCX sin marca de agua');
  return {
    buffer: renderResult.buffer,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
}
