/**
 * jobs.ts — HTTP endpoint for background job queue tick worker execution (S8-01, S8-07).
 *
 * Routes:
 * - POST /v1/jobs/tick: Triggers tick worker cycle.
 *   Authorized exclusively via Bearer ENGINE_TICK_SECRET (constant-time comparison)
 *   or JWT bearer token with settings.manage permission.
 *
 * All other routes (GET /v1/jobs, POST /v1/jobs/:id/retry, POST /v1/jobs/enqueue) are eliminated.
 * Job monitoring is served directly via database RPC (get_monitoring_jobs) from web client.
 */

import crypto from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEngineEnv } from '../config/env.js';
import { getSupabaseServiceClient } from '../storage/index.js';
import { authenticateUser } from '../services/documents-access.js';
import { executeJobsTick } from '../services/jobs-worker.js';

const tickBodySchema = z
  .object({
    worker_id: z.string().min(1).optional(),
    batch_size: z.number().int().min(1).max(20).optional(),
    max_batches: z.number().int().min(1).max(10).optional(),
    source: z.string().optional(),
  })
  .optional();

function extractBearer(authHeader?: string): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7).trim();
  return token.length > 0 ? token : null;
}

export function safeCompareTokens(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const hashProvided = crypto.createHash('sha256').update(provided).digest();
  const hashExpected = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(hashProvided, hashExpected);
}

async function authorizeTickRequest(request: FastifyRequest): Promise<boolean> {
  const token = extractBearer(request.headers.authorization);
  if (!token) return false;

  const env = getEngineEnv();
  if (env.ENGINE_TICK_SECRET && safeCompareTokens(token, env.ENGINE_TICK_SECRET)) {
    return true;
  }

  const supabase = getSupabaseServiceClient();
  try {
    await authenticateUser(supabase, token, 'settings.manage');
    return true;
  } catch {
    return false;
  }
}

export const jobsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/v1/jobs/tick', async (request: FastifyRequest, reply: FastifyReply) => {
    const isAuthorized = await authorizeTickRequest(request);
    if (!isAuthorized) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'No autorizado: token de tick o credencial settings.manage inválida',
        statusCode: 401,
      });
    }

    const parseResult = tickBodySchema.safeParse(request.body ?? {});
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'INVALID_BODY',
        message: parseResult.error.errors[0]?.message ?? 'Cuerpo inválido',
        statusCode: 400,
      });
    }

    const body = parseResult.data ?? {};
    request.log.info({ source: body.source ?? 'manual' }, 'Ejecutando tick de cola de trabajos');

    const result = await executeJobsTick({
      workerId: body.worker_id,
      batchSize: body.batch_size,
      maxBatches: body.max_batches,
      logger: request.log,
    });

    return reply.status(200).send({ success: true, ...result });
  });
};
