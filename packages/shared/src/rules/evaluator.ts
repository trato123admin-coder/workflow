import { RuleCondition, RuleContext, ConditionEvaluationTrace, SimpleCondition } from './types.js';

function getFactValue(context: RuleContext, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = context;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function evaluateSimpleCondition(
  condition: SimpleCondition,
  context: RuleContext,
): ConditionEvaluationTrace {
  const actualValue = getFactValue(context, condition.fact);
  let matched = false;

  switch (condition.op) {
    case 'eq':
      matched = actualValue === condition.value;
      break;
    case 'neq':
      matched = actualValue !== condition.value;
      break;
    case 'in':
      matched = Array.isArray(condition.value) && condition.value.includes(actualValue);
      break;
    case 'not_in':
      matched = Array.isArray(condition.value) && !condition.value.includes(actualValue);
      break;
    case 'gt':
      matched =
        typeof actualValue === 'number' &&
        typeof condition.value === 'number' &&
        actualValue > condition.value;
      break;
    case 'gte':
      matched =
        typeof actualValue === 'number' &&
        typeof condition.value === 'number' &&
        actualValue >= condition.value;
      break;
    case 'lt':
      matched =
        typeof actualValue === 'number' &&
        typeof condition.value === 'number' &&
        actualValue < condition.value;
      break;
    case 'lte':
      matched =
        typeof actualValue === 'number' &&
        typeof condition.value === 'number' &&
        actualValue <= condition.value;
      break;
    case 'between':
      if (Array.isArray(condition.value) && condition.value.length === 2) {
        const [min, max] = condition.value;
        matched =
          typeof actualValue === 'number' &&
          typeof min === 'number' &&
          typeof max === 'number' &&
          actualValue >= min &&
          actualValue <= max;
      }
      break;
    case 'contains':
      if (Array.isArray(actualValue)) {
        matched = actualValue.includes(condition.value);
      } else if (typeof actualValue === 'string' && typeof condition.value === 'string') {
        matched = actualValue.includes(condition.value);
      }
      break;
    case 'exists':
      matched = actualValue !== undefined && actualValue !== null;
      // If value is explicitly passed as boolean, evaluate against that boolean
      if (typeof condition.value === 'boolean') {
        matched = matched === condition.value;
      }
      break;
    case 'missing':
      matched = actualValue === undefined || actualValue === null;
      if (typeof condition.value === 'boolean') {
        matched = matched === condition.value;
      }
      break;
    case 'starts_with':
      matched =
        typeof actualValue === 'string' &&
        typeof condition.value === 'string' &&
        actualValue.startsWith(condition.value);
      break;
  }

  return {
    fact: condition.fact,
    op: condition.op,
    expectedValue: condition.value,
    actualValue,
    matched,
  };
}

export function evaluateCondition(
  condition: RuleCondition,
  context: RuleContext,
): ConditionEvaluationTrace {
  if ('all' in condition) {
    const children = condition.all.map((c) => evaluateCondition(c, context));
    const matched = children.every((c) => c.matched);
    return {
      matched,
      combinator: 'all',
      children,
    };
  }

  if ('any' in condition) {
    if (condition.any.length === 0) {
      return { matched: false, combinator: 'any', children: [] };
    }
    const children = condition.any.map((c) => evaluateCondition(c, context));
    const matched = children.some((c) => c.matched);
    return {
      matched,
      combinator: 'any',
      children,
    };
  }

  if ('not' in condition) {
    const child = evaluateCondition(condition.not, context);
    return {
      matched: !child.matched,
      combinator: 'not',
      children: [child],
    };
  }

  return evaluateSimpleCondition(condition as SimpleCondition, context);
}
