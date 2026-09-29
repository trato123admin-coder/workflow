/**
 * approval.ts — Document approval and rejection endpoints.
 *
 * Implements the legal approval flow:
 * GENERATED → IN_REVIEW → APPROVED | REJECTED
 * With optional four_eyes rule (approver ≠ requester).
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  createDocumentError,
  authenticateUser,
  verifyCaseAccess,
  type DocumentError,
} from '../services/documents.js';
import { getSupabaseServiceClient } from '../storage/index.js';

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

const docIdParamsSchema = z.object({
  id: z.string().uuid({ message: 'ID del documento generado debe ser UUID' }),
});

const rejectBodySchema = z.object({
  reason: z.string().min(1, 'El motivo del rechazo es obligatorio').max(2000),
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

export const approvalRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /v1/generated-documents/:id/approve
   * Requires `documents.approve` permission.
   * If docs.four_eyes is enabled, approver must differ from requester.
   */
  fastify.post(
    '/v1/generated-documents/:id/approve',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const paramsResult = docIdParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({
          error: 'INVALID_PARAMS',
          message: paramsResult.error.errors[0]?.message ?? 'Parámetros inválidos',
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
        const result = await approveDocument(userJwt, paramsResult.data.id, request.log);
        return reply.status(200).send({ success: true, data: result });
      } catch (err: unknown) {
        return errorResponse(reply, err);
      }
    },
  );

  /**
   * POST /v1/generated-documents/:id/reject
   * Requires `documents.approve` permission.
   */
  fastify.post(
    '/v1/generated-documents/:id/reject',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const paramsResult = docIdParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({
          error: 'INVALID_PARAMS',
          message: paramsResult.error.errors[0]?.message ?? 'Parámetros inválidos',
          statusCode: 400,
        });
      }

      const bodyResult = rejectBodySchema.safeParse(request.body);
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
        const result = await rejectDocument(
          userJwt,
          paramsResult.data.id,
          bodyResult.data.reason,
          request.log,
        );
        return reply.status(200).send({ success: true, data: result });
      } catch (err: unknown) {
        return errorResponse(reply, err);
      }
    },
  );
};

/* ------------------------------------------------------------------ */
/* Business logic                                                      */
/* ------------------------------------------------------------------ */

async function approveDocument(
  userJwt: string,
  generatedDocumentId: string,
  logger: FastifyRequest['log'],
): Promise<{ id: string; approval_status: string }> {
  const supabase = getSupabaseServiceClient();

  // 1. Autenticación y verificación estricta del permiso 'documents.approve'
  const user = await authenticateUser(supabase, userJwt, 'documents.approve');

  // 2. Obtener documento generado vinculado con su trabajo de generación para resolver el caso
  const { data: genDoc, error: gdErr } = await supabase
    .from('generated_documents')
    .select(
      `
      id,
      approval_status,
      generation_job_id,
      case_document_id,
      generation_jobs!inner (
        case_id,
        requested_by
      )
    `,
    )
    .eq('id', generatedDocumentId)
    .single();

  if (gdErr || !genDoc) {
    throw createDocumentError('Documento generado no encontrado', 404, 'NOT_FOUND');
  }

  const job = (
    genDoc as unknown as {
      generation_jobs: { case_id: string; requested_by: string };
    }
  ).generation_jobs;

  // 3. Verificación de acceso y permisos de escritura en el expediente
  await verifyCaseAccess(supabase, user, job.case_id, { requireWrite: true });

  // 4. Validación de transición de estado
  if (!['GENERATED', 'IN_REVIEW'].includes(genDoc.approval_status as string)) {
    throw createDocumentError(
      `No se puede aprobar un documento en estado ${genDoc.approval_status}`,
      409,
      'INVALID_STATUS',
    );
  }

  // 5. Regla de doble control (four_eyes): quien generó no puede aprobar
  const fourEyes = await isFourEyesEnabled(supabase);
  if (fourEyes) {
    if (job.requested_by === user.userId) {
      throw createDocumentError(
        'Regla de doble control: quien generó el documento no puede aprobarlo',
        403,
        'FOUR_EYES_VIOLATION',
      );
    }
  }

  // 6. Marcar versiones anteriores del mismo slot como SUPERSEDED
  await supersedePreviousVersions(
    supabase,
    genDoc.generation_job_id as string,
    generatedDocumentId,
  );

  const now = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabase
    .from('generated_documents')
    .update({
      approval_status: 'APPROVED',
      approved_by: user.userId,
      approved_at: now,
    })
    .eq('id', generatedDocumentId)
    .select('id, approval_status')
    .single();

  if (updateErr || !updated) {
    throw createDocumentError('Error al aprobar el documento', 500, 'APPROVAL_FAILED');
  }

  logger.info({ docId: generatedDocumentId, approvedBy: user.userId }, 'Documento aprobado');
  return { id: updated.id as string, approval_status: updated.approval_status as string };
}

async function rejectDocument(
  userJwt: string,
  generatedDocumentId: string,
  reason: string,
  logger: FastifyRequest['log'],
): Promise<{ id: string; approval_status: string }> {
  const supabase = getSupabaseServiceClient();

  // 1. Autenticación y verificación estricta del permiso 'documents.approve'
  const user = await authenticateUser(supabase, userJwt, 'documents.approve');

  // 2. Obtener documento generado vinculado con su trabajo de generación para resolver el caso
  const { data: genDoc, error: gdErr } = await supabase
    .from('generated_documents')
    .select(
      `
      id,
      approval_status,
      generation_job_id,
      case_document_id,
      generation_jobs!inner (
        case_id,
        requested_by
      )
    `,
    )
    .eq('id', generatedDocumentId)
    .single();

  if (gdErr || !genDoc) {
    throw createDocumentError('Documento generado no encontrado', 404, 'NOT_FOUND');
  }

  const job = (
    genDoc as unknown as {
      generation_jobs: { case_id: string; requested_by: string };
    }
  ).generation_jobs;

  // 3. Verificación de acceso y permisos de escritura en el expediente
  await verifyCaseAccess(supabase, user, job.case_id, { requireWrite: true });

  // 4. Validación de transición de estado
  if (!['GENERATED', 'IN_REVIEW'].includes(genDoc.approval_status as string)) {
    throw createDocumentError(
      `No se puede rechazar un documento en estado ${genDoc.approval_status}`,
      409,
      'INVALID_STATUS',
    );
  }

  const { data: updated, error: updateErr } = await supabase
    .from('generated_documents')
    .update({
      approval_status: 'REJECTED',
      rejection_reason: reason,
      approved_by: user.userId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', generatedDocumentId)
    .select('id, approval_status')
    .single();

  if (updateErr || !updated) {
    throw createDocumentError('Error al rechazar el documento', 500, 'REJECT_FAILED');
  }

  // La auditoría se realiza automáticamente mediante el trigger de BD `trg_audit_generated_documents` (private.tg_audit_log())
  logger.info({ docId: generatedDocumentId, reason }, 'Documento rechazado');
  return { id: updated.id as string, approval_status: updated.approval_status as string };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function isFourEyesEnabled(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
): Promise<boolean> {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'docs.four_eyes')
    .maybeSingle();

  if (!data?.value) return false;
  const val = data.value as Record<string, unknown>;
  return val.enabled === true;
}

async function supersedePreviousVersions(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  _jobId: string,
  currentDocId: string,
): Promise<void> {
  // Find the case_document_id from the current generated document
  const { data: currentDoc } = await supabase
    .from('generated_documents')
    .select('case_document_id')
    .eq('id', currentDocId)
    .single();

  if (!currentDoc) return;

  // Mark all previously APPROVED generated_documents for this case_document as SUPERSEDED
  await supabase
    .from('generated_documents')
    .update({ approval_status: 'SUPERSEDED' })
    .eq('case_document_id', currentDoc.case_document_id)
    .eq('approval_status', 'APPROVED')
    .neq('id', currentDocId);
}
