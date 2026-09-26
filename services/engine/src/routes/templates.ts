import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { getSupabaseServiceClient, getTemplatesStorageProvider } from '../storage/index.js';
import { lintDocxBuffer, uploadTemplate } from '../services/templates-service.js';
import { authenticateUser } from '../services/documents-access.js';
import { createDocumentError, type DocumentError } from '../services/documents-types.js';

function extractBearerToken(authHeader: string | undefined): string {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createDocumentError(
      'Encabezado de autorización Bearer ausente o inválido',
      401,
      'UNAUTHORIZED'
    );
  }
  const token = authHeader.substring(7).trim();
  if (!token) {
    throw createDocumentError('Token JWT vacío', 401, 'UNAUTHORIZED');
  }
  return token;
}

export const templateRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Endpoint para inspección y lint previo de una plantilla DOCX.
   * Exige autenticación de usuario activo para no filtrar campos internos a usuarios no identificados.
   * POST /v1/templates/lint
   */
  fastify.post('/v1/templates/lint', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userJwt = extractBearerToken(request.headers.authorization);
      const supabase = getSupabaseServiceClient();
      await authenticateUser(supabase, userJwt);

      if (!request.isMultipart()) {
        return reply.status(400).send({
          error: 'NO_FILE',
          message: 'La solicitud debe ser multipart/form-data con un archivo adjunto',
          statusCode: 400,
        });
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          error: 'NO_FILE',
          message: 'No se envió ningún archivo para inspección',
          statusCode: 400,
        });
      }

      const fileBuffer = await data.toBuffer();
      const filename = data.filename || 'plantilla.docx';

      // Obtener campos autorizados de la base de datos
      const { data: fields } = await supabase
        .from('document_fields')
        .select('code')
        .eq('is_active', true);

      const validPlaceholders = (fields ?? []).map((f) => f.code);
      const lint = lintDocxBuffer(fileBuffer, validPlaceholders, filename);

      return reply.status(200).send({
        lint,
        filename,
        size: fileBuffer.length,
      });
    } catch (err: unknown) {
      request.log.error(err, 'Error al ejecutar lint de plantilla');
      const docErr = err as DocumentError;
      return reply.status(docErr.statusCode || 500).send({
        error: docErr.code || 'INTERNAL_ERROR',
        message: docErr.message || 'Error interno al procesar el archivo',
        statusCode: docErr.statusCode || 500,
      });
    }
  });

  /**
   * Endpoint para registrar y subir una nueva versión de plantilla DOCX.
   * POST /v1/templates/upload
   */
  fastify.post('/v1/templates/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userJwt = extractBearerToken(request.headers.authorization);
      const parts = request.parts();

      let fileBuffer: Buffer | null = null;
      let filename = 'plantilla.docx';
      const fields: Record<string, string> = {};

      for await (const part of parts) {
        if (part.type === 'file') {
          fileBuffer = await part.toBuffer();
          filename = part.filename;
        } else {
          fields[part.fieldname] = String(part.value ?? '');
        }
      }

      if (!fileBuffer) {
        return reply.status(400).send({
          error: 'NO_FILE',
          message: 'Debe adjuntar el archivo DOCX de la plantilla',
          statusCode: 400,
        });
      }

      const documentTypeId = fields.document_type_id;
      const name = fields.name;
      const validFrom = fields.valid_from || new Date().toISOString().slice(0, 10);
      const validUntil = fields.valid_until || null;
      const estimatedManualMinutes = fields.estimated_manual_minutes
        ? parseInt(fields.estimated_manual_minutes, 10)
        : 0;

      if (!documentTypeId || !name) {
        return reply.status(400).send({
          error: 'MISSING_FIELDS',
          message: 'document_type_id y name son obligatorios',
          statusCode: 400,
        });
      }

      const supabase = getSupabaseServiceClient();
      const result = await uploadTemplate(supabase, {
        userJwt,
        documentTypeId,
        name,
        fileBuffer,
        filename,
        validFrom,
        validUntil,
        estimatedManualMinutes,
      });

      return reply.status(201).send(result);
    } catch (err: unknown) {
      request.log.error(err, 'Error al subir plantilla');
      const docErr = err as DocumentError;
      return reply.status(docErr.statusCode || 500).send({
        error: docErr.code || 'INTERNAL_ERROR',
        message: docErr.message || 'Error interno al subir la plantilla',
        statusCode: docErr.statusCode || 500,
      });
    }
  });

  /**
   * Endpoint para generar URL firmada de descarga de una plantilla DOCX.
   * Exige autenticación y permisos de lectura (documents.read o templates.manage).
   * GET /v1/templates/:id/download
   */
  fastify.get('/v1/templates/:id/download', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userJwt = extractBearerToken(request.headers.authorization);
      const supabase = getSupabaseServiceClient();
      await authenticateUser(supabase, userJwt, ['documents.read', 'templates.manage']);

      const { id } = request.params as { id: string };

      const { data: template, error } = await supabase
        .from('templates')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !template) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Plantilla no encontrada',
          statusCode: 404,
        });
      }

      const storage = getTemplatesStorageProvider();
      const signedUrl = await storage.signedUrl(template.storage_key, 60);

      return reply.status(200).send({
        downloadUrl: signedUrl,
        expiresIn: 60,
      });
    } catch (err: unknown) {
      const docErr = err as DocumentError;
      return reply.status(docErr.statusCode || 500).send({
        error: docErr.code || 'INTERNAL_ERROR',
        message: docErr.message,
        statusCode: docErr.statusCode || 500,
      });
    }
  });
};
