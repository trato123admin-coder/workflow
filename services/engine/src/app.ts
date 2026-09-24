import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { randomUUID } from 'node:crypto';
import { healthRoutes } from './routes/health.js';
import { getEngineEnv } from './config/env.js';

export async function buildApp(): Promise<FastifyInstance> {
  const env = getEngineEnv();

  const fastify = Fastify({
    logger: {
      level: env.NODE_ENV === 'test' ? 'silent' : 'info',
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: req.url,
            hostname: req.hostname,
            remoteAddress: req.ip,
            requestId: req.id,
          };
        },
      },
    },
    genReqId(req) {
      const incomingId = req.headers['x-request-id'];
      if (typeof incomingId === 'string' && incomingId.trim().length > 0) {
        return incomingId;
      }
      return randomUUID();
    },
    requestIdHeader: 'x-request-id',
  });

  await fastify.register(cors, {
    origin: env.ENGINE_ALLOWED_ORIGINS === '*' ? true : env.ENGINE_ALLOWED_ORIGINS.split(','),
  });

  fastify.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  await fastify.register(healthRoutes);

  return fastify;
}
