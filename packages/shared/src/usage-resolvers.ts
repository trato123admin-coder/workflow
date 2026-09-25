/**
 * Registro de Resolutores de Uso (S2-09)
 * Permite a cada módulo registrar la lógica o consulta para contar dónde se utiliza un elemento
 * antes de permitir su desactivación en ConfirmImpactDialog.
 */

export interface UsageCountResult {
  count: number;
  locations: string[];
  canSafelyDeactivate: boolean;
  blockingReason?: string;
}

export type UsageResolverFn = (
  catalogCode: string,
  itemCode: string
) => Promise<UsageCountResult> | UsageCountResult;

class UsageResolverRegistry {
  private resolvers: Map<string, UsageResolverFn> = new Map();

  /**
   * Registra un resolutor para un catálogo específico o global
   */
  register(catalogCode: string, resolver: UsageResolverFn): void {
    this.resolvers.set(catalogCode, resolver);
  }

  /**
   * Resuelve el conteo de uso para un elemento de catálogo dado
   */
  async resolveUsage(catalogCode: string, itemCode: string): Promise<UsageCountResult> {
    const resolver = this.resolvers.get(catalogCode);
    if (resolver) {
      return resolver(catalogCode, itemCode);
    }
    // Resolutor por defecto: sin registros conocidos
    return {
      count: 0,
      locations: [],
      canSafelyDeactivate: true,
    };
  }
}

export const usageResolvers = new UsageResolverRegistry();
