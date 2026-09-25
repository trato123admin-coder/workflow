import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/healthz', async (_request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  fastify.get('/readyz', async (_request, reply) => {
    return reply.status(200).send({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  });
};
