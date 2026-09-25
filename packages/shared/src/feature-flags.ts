import { z } from 'zod';

export const FeatureFlagKeySchema = z.enum([
  'module.cash',
  'module.quotes',
  'module.ai',
  'module.knowledge_base',
  'module.telegram',
  'module.recurring_cases',
  'module.kanban',
  'module.case_parties',
  'module.estate_inventory',
  'module.external_filings',
  'module.monitoring',
  'module.reports_export',
  'clients.external_lookup',
  'clients.mask_identity',
  'cases.closing_gates',
  'cases.confidential',
  'cases.stagnation_alerts',
  'docs.pdf_generation',
  'docs.require_approval',
  'docs.four_eyes',
  'docs.draft_watermark',
  'security.mfa_admin',
  'security.mfa_cash',
  'ai.rules_only_mode',
  'ui.user_theme_choice',
  'audit.enabled',
  'rls.enforced',
  'storage.compress_uploads',
]);

export type FeatureFlagKey = z.infer<typeof FeatureFlagKeySchema>;

export const FeatureFlagSchema = z.object({
  key: z.string().min(2),
  module: z.string().min(2),
  label: z.string().min(2),
  description: z.string().nullable().optional(),
  is_enabled: z.boolean().default(false),
  is_locked: z.boolean().default(false),
  depends_on: z.array(z.string()).default([]),
  requires_config: z.array(z.string()).default([]),
  config: z.record(z.unknown()).default({}),
  updated_by: z.string().uuid().nullable().optional(),
  updated_at: z.string().optional(),
});

export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;

export interface ToggleValidationResult {
  canToggle: boolean;
  reason?: string;
}

/**
 * Valida si un flag puede ser activado o desactivado según dependencias y candado is_locked.
 */
export function validateFlagToggle(
  flag: FeatureFlag,
  targetEnabled: boolean,
  allFlags: Record<string, FeatureFlag>
): ToggleValidationResult {
  if (flag.is_locked && flag.is_enabled && !targetEnabled) {
    return {
      canToggle: false,
      reason: `El flag "${flag.label}" (${flag.key}) está bloqueado por el núcleo y no puede desactivarse`,
    };
  }

  if (targetEnabled && flag.depends_on.length > 0) {
    for (const depKey of flag.depends_on) {
      const dep = allFlags[depKey];
      if (!dep || !dep.is_enabled) {
        return {
          canToggle: false,
          reason: `Requiere que el flag "${dep?.label || depKey}" esté habilitado previamente`,
        };
      }
    }
  }

  // Si intentamos desactivar y otros flags dependen de este
  if (!targetEnabled) {
    const dependentFlags = Object.values(allFlags).filter(
      (f) => f.is_enabled && f.depends_on.includes(flag.key)
    );
    if (dependentFlags.length > 0) {
      const names = dependentFlags.map((f) => f.label).join(', ');
      return {
        canToggle: false,
        reason: `No se puede desactivar porque los siguientes módulos activos dependen de él: ${names}`,
      };
    }
  }

  return { canToggle: true };
}
