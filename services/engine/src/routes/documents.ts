import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  uploadDocumentVersion,
  getAuditedDownloadUrl,
  createDocumentError,
  type DocumentError,
} from '../services/documents.js';

const uploadParamsSchema = z.object({
  id: z.string().uuid({ message: 'El ID del documento debe ser un UUID válido' }),
});

const downloadParamsSchema = z.object({
  versionId: z.string().uuid({ message: 'El ID de la versión debe ser un UUID válido' }),
});

function extractBearerToken(authHeader: string | undefined): string {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
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

export const documentRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Endpoint de SUBIDA de versiones de documentos (Paso 3 / S5-10).
   * POST /v1/documents/case-documents/:id/versions
   */
  fastify.post(
    '/v1/documents/case-documents/:id/versions',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const paramsResult = uploadParamsSchema.safeParse(request.params);
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
        const docErr = err as DocumentError;
        return reply.status(docErr.statusCode || 401).send({
          error: docErr.code || 'UNAUTHORIZED',
          message: docErr.message,
          statusCode: docErr.statusCode || 401,
        });
      }

      if (!request.isMultipart()) {
        return reply.status(400).send({
          error: 'INVALID_CONTENT_TYPE',
          message: 'Content-Type debe ser multipart/form-data',
          statusCode: 400,
        });
      }

      try {
        const part = await request.file();
        if (!part) {
          return reply.status(400).send({
            error: 'MISSING_FILE',
            message: 'No se envió ningún archivo en la petición multipart',
            statusCode: 400,
          });
        }

        const fileBuffer = await part.toBuffer();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fields = (part as any).fields ?? {};

        const result = await uploadDocumentVersion({
          userJwt,
          caseDocumentId: paramsResult.data.id,
          fileBuffer,
          originalFilename: part.filename || 'documento',
          claimedMime: part.mimetype,
          changeSummary: fields.change_summary?.value as string | undefined,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        });

        return reply.status(201).send({ success: true, data: result });
      } catch (err: unknown) {
        const docErr = err as DocumentError;
        const statusCode = docErr.statusCode || 500;
        return reply.status(statusCode).send({
          error: docErr.code || 'INTERNAL_ERROR',
          message: docErr.message || 'Error interno al procesar el archivo',
          statusCode,
        });
      }
    },
  );

  /**
   * Endpoint de DESCARGA AUDITADA con URL firmada (Paso 4 / S5-05).
   * GET /v1/downloads/:versionId
   */
  fastify.get('/v1/downloads/:versionId', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsResult = downloadParamsSchema.safeParse(request.params);
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
      const docErr = err as DocumentError;
      return reply.status(docErr.statusCode || 401).send({
        error: docErr.code || 'UNAUTHORIZED',
        message: docErr.message,
        statusCode: docErr.statusCode || 401,
      });
    }

    try {
      const result = await getAuditedDownloadUrl({
        userJwt,
        versionId: paramsResult.data.versionId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.status(200).send({ success: true, data: result });
    } catch (err: unknown) {
      const docErr = err as DocumentError;
      const statusCode = docErr.statusCode || 500;
      return reply.status(statusCode).send({
        error: docErr.code || 'INTERNAL_ERROR',
        message: docErr.message || 'Error interno al generar descarga',
        statusCode,
      });
    }
  });
};
