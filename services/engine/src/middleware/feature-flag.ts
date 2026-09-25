import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import type { FeatureFlagKey } from '@workflow/shared';

// En memoria / caché local de flags para el engine
let flagStatusProvider: (key: string) => Promise<boolean> | boolean = () => true;

export function setFlagStatusProvider(provider: (key: string) => Promise<boolean> | boolean): void {
  flagStatusProvider = provider;
}

/**
 * Hook preHandler para verificar si una función o módulo está habilitado en feature_flags.
 * Si está deshabilitado, responde 403 feature_disabled.
 */
export function requireFeature(flagKey: FeatureFlagKey): preHandlerHookHandler {
  return async (_request: FastifyRequest, reply: FastifyReply) => {
    const isEnabled = await flagStatusProvider(flagKey);

    if (!isEnabled) {
      return reply.status(403).send({
        error: 'feature_disabled',
        message: `El módulo o función '${flagKey}' está deshabilitado por configuración`,
        statusCode: 403,
      });
    }
  };
}
