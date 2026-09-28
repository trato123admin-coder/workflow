import { z } from 'zod';
import { isFactAllowed } from './whitelist.js';

export const ruleOperatorSchema = z.enum([
  'eq',
  'neq',
  'in',
  'not_in',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
  'contains',
  'exists',
  'missing',
  'starts_with',
]);

export const ruleEffectTypeSchema = z.enum(['RECOMMEND', 'EXCLUDE', 'REQUIRE']);

export const ruleEffectSchema = z.object({
  type: ruleEffectTypeSchema,
  priority: z.number().int().min(1).max(100),
  explanation: z.string().optional(),
  target_document_type_code: z.string().optional(),
});

const baseConditionSchema = z.object({
  fact: z.string().refine((fact) => isFactAllowed(fact), {
    message: 'Fact is not in the allowed whitelist',
  }),
  op: ruleOperatorSchema,
  value: z.unknown().optional(),
});

import type { RuleCondition } from './types.js';

// To handle recursive schemas in Zod
export const ruleConditionSchema: z.ZodType<RuleCondition> = z.lazy(() =>
  z.union([
    baseConditionSchema,
    z.object({ all: z.array(ruleConditionSchema) }),
    z.object({ any: z.array(ruleConditionSchema) }),
    z.object({ not: ruleConditionSchema }),
  ]),
);

export const ruleDefinitionSchema = z.object({
  version: z.number().int().min(1),
  conditions: ruleConditionSchema,
  effect: ruleEffectSchema,
  explanation: z.string().min(1),
});
