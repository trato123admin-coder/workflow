import type { FastifyPluginAsync } from 'fastify';
import { getStorageProvider } from '../storage/index.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/healthz', async (_request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  fastify.get('/readyz', async (_request, reply) => {
    let storageStatus = 'unconfigured';
    try {
      const storage = getStorageProvider();
      if (storage.healthCheck) {
        const isStorageOk = await storage.healthCheck();
        storageStatus = isStorageOk ? 'ok' : 'degraded';
      } else {
        storageStatus = 'ok';
      }
    } catch {
      storageStatus = 'unavailable';
    }

    return reply.status(200).send({
      status: 'ready',
      storage: storageStatus,
      timestamp: new Date().toISOString(),
    });
  });
};
