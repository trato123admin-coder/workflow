import { describe, it, expect } from 'vitest';
import {
  validateDocumentTypeMetadata,
  validateFlagToggle,
  validateSettingValue,
  validateCustomData,
  calculateContrastRatio,
  isWcagAaCompliant,
  computeConfigDiff,
  usageResolvers,
  type FeatureFlag,
  type SettingDefinition,
  type CustomFieldDefinition,
} from '../index.js';

describe('Sprint 2: Catálogos y Metadatos', () => {
  it('valida estructura correcta de metadata para tipo de documento', () => {
    const validMeta = {
      pattern: '^\\d{8}$',
      min_length: 8,
      max_length: 8,
    };
    expect(validateDocumentTypeMetadata(validMeta).valid).toBe(true);

    const invalidMeta = {
      pattern: 12345, // debe ser string
      min_length: '8', // debe ser number
    };
    expect(validateDocumentTypeMetadata(invalidMeta as unknown as Record<string, unknown>).valid).toBe(false);
  });
});

describe('Sprint 2: Feature Flags y Dependencias', () => {
  const flagsMap: Record<string, FeatureFlag> = {
    'module.ai': {
      key: 'module.ai',
      module: 'ai',
      label: 'Asistente IA',
      is_enabled: false,
      is_locked: false,
      depends_on: [],
      requires_config: [],
      config: {},
    },
    'module.knowledge_base': {
      key: 'module.knowledge_base',
      module: 'ai',
      label: 'Base Conocimiento',
      is_enabled: false,
      is_locked: false,
      depends_on: ['module.ai'],
      requires_config: [],
      config: {},
    },
    'audit.enabled': {
      key: 'audit.enabled',
      module: 'security',
      label: 'Auditoría',
      is_enabled: true,
      is_locked: true,
      depends_on: [],
      requires_config: [],
      config: {},
    },
  };

  it('impide desactivar un flag bloqueado (is_locked = true)', () => {
    const auditFlag = flagsMap['audit.enabled']!;
    const result = validateFlagToggle(auditFlag, false, flagsMap);
    expect(result.canToggle).toBe(false);
    expect(result.reason).toContain('bloqueado por el núcleo');
  });

  it('impide activar un flag si su dependencia está inactiva', () => {
    const kbFlag = flagsMap['module.knowledge_base']!;
    const result = validateFlagToggle(kbFlag, true, flagsMap);
    expect(result.canToggle).toBe(false);
    expect(result.reason).toContain('Requiere que el flag');
  });

  it('permite activar flag cuando su dependencia está activa', () => {
    const flagsCopy: Record<string, FeatureFlag> = {
      ...flagsMap,
      'module.ai': { ...flagsMap['module.ai']!, is_enabled: true },
    };
    const kbFlag = flagsCopy['module.knowledge_base']!;
    const result = validateFlagToggle(kbFlag, true, flagsCopy);
    expect(result.canToggle).toBe(true);
  });
});

describe('Sprint 2: Parámetros Tipados y Validación', () => {
  const numDef: SettingDefinition = {
    key: 'test.num',
    category: 'test',
    label: 'Número de prueba',
    value_type: 'number',
    default_value: 10,
    constraints: { min: 5, max: 20 },
    edit_permission: 'settings.manage',
    sort_order: 1,
  };

  it('valida límites numéricos en parámetros', () => {
    expect(validateSettingValue(numDef, 10).valid).toBe(true);
    expect(validateSettingValue(numDef, 2).valid).toBe(false);
    expect(validateSettingValue(numDef, 50).valid).toBe(false);
    expect(validateSettingValue(numDef, 'no-number').valid).toBe(false);
  });

  const enumDef: SettingDefinition = {
    key: 'test.enum',
    category: 'test',
    label: 'Enum de prueba',
    value_type: 'enum',
    default_value: 'OPT_A',
    constraints: { options: ['OPT_A', 'OPT_B'] },
    edit_permission: 'settings.manage',
    sort_order: 2,
  };

  it('valida opciones permitidas en parámetros enum', () => {
    expect(validateSettingValue(enumDef, 'OPT_A').valid).toBe(true);
    expect(validateSettingValue(enumDef, 'OPT_B').valid).toBe(true);
    expect(validateSettingValue(enumDef, 'OPT_C').valid).toBe(false);
  });
});

describe('Sprint 2: Campos Personalizados y Validación', () => {
  const definitions: CustomFieldDefinition[] = [
    {
      entity: 'case',
      code: 'num_partida',
      label: 'N.º de Partida',
      data_type: 'TEXT',
      is_required: true,
      validation: {},
      is_active: true,
      is_system: false,
      sort_order: 1,
      applies_to: {},
    },
    {
      entity: 'case',
      code: 'monto_estimado',
      label: 'Monto Estimado',
      data_type: 'CURRENCY',
      is_required: false,
      validation: {},
      is_active: true,
      is_system: false,
      sort_order: 2,
      applies_to: {},
    },
  ];

  it('detecta campo requerido faltante', () => {
    const result = validateCustomData(definitions, {});
    expect(result.valid).toBe(false);
    expect(result.errors.num_partida).toBeDefined();
  });

  it('detecta tipo incorrecto en campo numérico/moneda', () => {
    const result = validateCustomData(definitions, {
      num_partida: '12345678',
      monto_estimado: 'no-es-numero',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.monto_estimado).toBeDefined();
  });

  it('aprueba datos completos y válidos', () => {
    const result = validateCustomData(definitions, {
      num_partida: '12345678',
      monto_estimado: 5000.5,
    });
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors).length).toBe(0);
  });
});

describe('Sprint 2: Contraste Accesible WCAG AA', () => {
  it('calcula ratio alto para blanco sobre negro o azul marino', () => {
    const ratio = calculateContrastRatio('#ffffff', '#0f172a');
    expect(ratio).toBeGreaterThan(10);
    expect(isWcagAaCompliant('#ffffff', '#0f172a').compliant).toBe(true);
  });

  it('falla cuando el contraste es insuficiente para texto regular (menor a 4.5:1)', () => {
    // Gris claro (#94a3b8) sobre blanco (#ffffff) tiene ratio ~2.4:1
    const check = isWcagAaCompliant('#94a3b8', '#ffffff');
    expect(check.compliant).toBe(false);
    expect(check.ratio).toBeLessThan(4.5);
  });
});

describe('Sprint 2: Exportación / Importación y Diff', () => {
  it('detecta diferencias correctamente entre configuraciones', () => {
    const current = {
      catalogs: [],
      feature_flags: [
        {
          key: 'module.cash',
          module: 'cash',
          label: 'Caja Chica',
          is_enabled: true,
          is_locked: false,
          depends_on: [],
          requires_config: [],
          config: {},
        },
      ],
      system_settings: [],
      custom_fields: [],
    };

    const incoming = {
      version: 1,
      exported_at: new Date().toISOString(),
      catalogs: [],
      feature_flags: [
        {
          key: 'module.cash',
          module: 'cash',
          label: 'Caja Chica',
          is_enabled: false, // modificado a false
          is_locked: false,
          depends_on: [],
          requires_config: [],
          config: {},
        },
        {
          key: 'module.quotes',
          module: 'quotes',
          label: 'Cotizaciones',
          is_enabled: true, // nuevo
          is_locked: false,
          depends_on: [],
          requires_config: [],
          config: {},
        },
      ],
      system_settings: [],
      custom_fields: [],
    };

    const diff = computeConfigDiff(current, incoming);
    expect(diff.totalChanges).toBe(2);

    const updateEntry = diff.entries.find((e) => e.key === 'module.cash');
    expect(updateEntry?.action).toBe('update');

    const createEntry = diff.entries.find((e) => e.key === 'module.quotes');
    expect(createEntry?.action).toBe('create');
  });
});

describe('Sprint 2: Resolutores de Uso', () => {
  it('registra y ejecuta resolutor para conteo de impacto', async () => {
    usageResolvers.register('test_catalog', (_cat, item) => {
      if (item === 'IN_USE') {
        return {
          count: 5,
          locations: ['cases.status'],
          canSafelyDeactivate: false,
          blockingReason: 'En uso en 5 casos abiertos',
        };
      }
      return { count: 0, locations: [], canSafelyDeactivate: true };
    });

    const used = await usageResolvers.resolveUsage('test_catalog', 'IN_USE');
    expect(used.count).toBe(5);
    expect(used.canSafelyDeactivate).toBe(false);

    const unused = await usageResolvers.resolveUsage('test_catalog', 'FREE');
    expect(unused.count).toBe(0);
    expect(unused.canSafelyDeactivate).toBe(true);
  });
});
