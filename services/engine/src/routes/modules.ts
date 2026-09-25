import type { FastifyPluginAsync } from 'fastify';
import { requireFeature } from '../middleware/feature-flag.js';

export const moduleRoutes: FastifyPluginAsync = async (fastify) => {
  // Ruta de demostración de Caja Chica, protegida por el flag module.cash
  fastify.get(
    '/v1/cash/summary',
    {
      preHandler: [requireFeature('module.cash')],
    },
    async () => {
      return {
        module: 'cash',
        status: 'active',
        balance: 9300.0,
        currency: 'PEN',
      };
    },
  );

  // Ruta de demostración de Cotizaciones, protegida por el flag module.quotes
  fastify.get(
    '/v1/quotes/summary',
    {
      preHandler: [requireFeature('module.quotes')],
    },
    async () => {
      return {
        module: 'quotes',
        status: 'active',
        activeQuotes: 12,
      };
    },
  );

  // Ruta de demostración de IA, protegida por el flag module.ai
  fastify.get(
    '/v1/ai/recommendations',
    {
      preHandler: [requireFeature('module.ai')],
    },
    async () => {
      return {
        module: 'ai',
        status: 'active',
        recommendations: [],
      };
    },
  );
};
