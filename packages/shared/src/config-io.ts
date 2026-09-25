import { z } from 'zod';
import { CatalogItemSchema, type CatalogItem } from './catalogs.js';
import { FeatureFlagSchema, type FeatureFlag } from './feature-flags.js';
import { SystemSettingSchema, type SystemSetting } from './settings.js';
import { CustomFieldDefinitionSchema, type CustomFieldDefinition } from './custom-fields.js';

export const ConfigBundleSchema = z.object({
  version: z.number().int().default(1),
  exported_at: z.string(),
  app_version: z.string().optional(),
  catalogs: z.array(CatalogItemSchema).default([]),
  feature_flags: z.array(FeatureFlagSchema).default([]),
  system_settings: z.array(SystemSettingSchema).default([]),
  custom_fields: z.array(CustomFieldDefinitionSchema).default([]),
});

export type ConfigBundle = z.infer<typeof ConfigBundleSchema>;

export interface DiffEntry {
  type: 'catalog_item' | 'feature_flag' | 'system_setting' | 'custom_field';
  key: string;
  action: 'create' | 'update' | 'noop';
  oldValue?: unknown;
  newValue?: unknown;
}

export interface ConfigDiff {
  totalChanges: number;
  entries: DiffEntry[];
}

/**
 * Calcula las diferencias entre la configuración actual y la importada
 */
export function computeConfigDiff(
  current: {
    catalogs: CatalogItem[];
    feature_flags: FeatureFlag[];
    system_settings: SystemSetting[];
    custom_fields: CustomFieldDefinition[];
  },
  incoming: ConfigBundle
): ConfigDiff {
  const entries: DiffEntry[] = [];

  // 1. Feature flags
  const currentFlagMap = new Map(current.feature_flags.map((f) => [f.key, f]));
  for (const incomingFlag of incoming.feature_flags) {
    const existing = currentFlagMap.get(incomingFlag.key);
    if (!existing) {
      entries.push({
        type: 'feature_flag',
        key: incomingFlag.key,
        action: 'create',
        newValue: incomingFlag.is_enabled,
      });
    } else if (existing.is_enabled !== incomingFlag.is_enabled) {
      entries.push({
        type: 'feature_flag',
        key: incomingFlag.key,
        action: 'update',
        oldValue: existing.is_enabled,
        newValue: incomingFlag.is_enabled,
      });
    }
  }

  // 2. System settings
  const currentSettingMap = new Map(current.system_settings.map((s) => [s.key, s]));
  for (const incomingSetting of incoming.system_settings) {
    const existing = currentSettingMap.get(incomingSetting.key);
    const incomingValStr = JSON.stringify(incomingSetting.value);
    const existingValStr = existing ? JSON.stringify(existing.value) : undefined;

    if (!existing) {
      entries.push({
        type: 'system_setting',
        key: incomingSetting.key,
        action: 'create',
        newValue: incomingSetting.value,
      });
    } else if (incomingValStr !== existingValStr) {
      entries.push({
        type: 'system_setting',
        key: incomingSetting.key,
        action: 'update',
        oldValue: existing.value,
        newValue: incomingSetting.value,
      });
    }
  }

  // 3. Catalog items
  const currentCatItemMap = new Map(
    current.catalogs.map((ci) => [`${ci.catalog_code}:${ci.code}`, ci])
  );
  for (const incomingItem of incoming.catalogs) {
    const key = `${incomingItem.catalog_code}:${incomingItem.code}`;
    const existing = currentCatItemMap.get(key);
    if (!existing) {
      entries.push({
        type: 'catalog_item',
        key,
        action: 'create',
        newValue: incomingItem.label,
      });
    } else if (
      existing.label !== incomingItem.label ||
      existing.is_active !== incomingItem.is_active
    ) {
      entries.push({
        type: 'catalog_item',
        key,
        action: 'update',
        oldValue: { label: existing.label, is_active: existing.is_active },
        newValue: { label: incomingItem.label, is_active: incomingItem.is_active },
      });
    }
  }

  // 4. Custom fields
  const currentFieldMap = new Map(
    current.custom_fields.map((cf) => [`${cf.entity}:${cf.code}`, cf])
  );
  for (const incomingField of incoming.custom_fields) {
    const key = `${incomingField.entity}:${incomingField.code}`;
    const existing = currentFieldMap.get(key);
    if (!existing) {
      entries.push({
        type: 'custom_field',
        key,
        action: 'create',
        newValue: incomingField.label,
      });
    } else if (
      existing.label !== incomingField.label ||
      existing.is_active !== incomingField.is_active ||
      existing.is_required !== incomingField.is_required
    ) {
      entries.push({
        type: 'custom_field',
        key,
        action: 'update',
        oldValue: { label: existing.label, is_active: existing.is_active },
        newValue: { label: incomingField.label, is_active: incomingField.is_active },
      });
    }
  }

  return {
    totalChanges: entries.length,
    entries,
  };
}
