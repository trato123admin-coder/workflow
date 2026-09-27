import {
  RuleContext,
  RuleDefinition,
  RuleEvaluationTrace,
  RuleEngineEvaluationResult,
  RuleEngineDocumentDecision,
  RuleConflictWarning,
} from './types.js';
import { evaluateCondition } from './evaluator.js';

export interface RuleRecord {
  id: string;
  code: string;
  target_document_type_id: string;
  target_document_type_code: string;
  rule_definition: RuleDefinition;
}

export function evaluateDocumentRules(
  rules: RuleRecord[],
  context: RuleContext
): RuleEngineEvaluationResult {
  const trace: RuleEvaluationTrace[] = [];
  const matchedRules: RuleRecord[] = [];
  const matchedTraces: Record<string, RuleEvaluationTrace> = {};

  for (const rule of rules) {
    const conditionTrace = evaluateCondition(rule.rule_definition.conditions, context);

    const ruleTrace: RuleEvaluationTrace = {
      ruleId: rule.id,
      ruleCode: rule.code,
      targetDocumentTypeCode: rule.target_document_type_code,
      targetDocumentTypeId: rule.target_document_type_id,
      matched: conditionTrace.matched,
      effect: rule.rule_definition.effect,
      explanation: rule.rule_definition.explanation,
      conditionTrace,
      evaluatedFacts: {}, // Can be populated if needed to extract actual values
    };

    trace.push(ruleTrace);

    if (conditionTrace.matched) {
      matchedRules.push(rule);
      matchedTraces[rule.id] = ruleTrace;
    }
  }

  // Conflict resolution per document type
  // Priorities: smaller number = higher priority.
  // Rule: "EXCLUDE gana sobre RECOMMEND de igual o menor prioridad (número mayor)".
  // If priority(EXCLUDE) <= priority(RECOMMEND), EXCLUDE wins.
  // If priority(RECOMMEND) < priority(EXCLUDE), RECOMMEND wins.
  // REQUIRE wins over RECOMMEND always.
  // REQUIRE vs EXCLUDE: highest priority wins. If equal, EXCLUDE wins (safe default, or as required, though usually they shouldn't conflict, let's assume EXCLUDE wins ties).

  const docsMap = new Map<
    string,
    {
      docId: string;
      docCode: string;
      recommend: RuleRecord[];
      exclude: RuleRecord[];
      require: RuleRecord[];
    }
  >();

  for (const rule of matchedRules) {
    const docCode = rule.target_document_type_code;
    if (!docsMap.has(docCode)) {
      docsMap.set(docCode, {
        docId: rule.target_document_type_id,
        docCode,
        recommend: [],
        exclude: [],
        require: [],
      });
    }
    const group = docsMap.get(docCode)!;
    const effect = rule.rule_definition.effect.type;
    if (effect === 'RECOMMEND') group.recommend.push(rule);
    if (effect === 'EXCLUDE') group.exclude.push(rule);
    if (effect === 'REQUIRE') group.require.push(rule);
  }

  const recommended: RuleEngineDocumentDecision[] = [];
  const required: RuleEngineDocumentDecision[] = [];
  const excluded: RuleEngineDocumentDecision[] = [];
  const warnings: RuleConflictWarning[] = [];

  for (const [docCode, group] of docsMap.entries()) {
    const bestRequire = getHighestPriority(group.require);
    const bestExclude = getHighestPriority(group.exclude);
    const bestRecommend = getHighestPriority(group.recommend);

    let finalEffect: 'REQUIRE' | 'EXCLUDE' | 'RECOMMEND' | null = null;
    let winningRule: RuleRecord | null = null;

    // Determine winner
    // REQUIRE always wins over EXCLUDE and RECOMMEND (legal obligation cannot be overridden)
    if (bestRequire) {
      finalEffect = 'REQUIRE';
      winningRule = bestRequire;
      if (bestExclude) {
        warnings.push({
          documentTypeCode: docCode,
          requireRuleCode: bestRequire.code,
          excludeRuleCode: bestExclude.code,
          message: `Conflicto de configuración: la regla EXCLUDE '${bestExclude.code}' fue ignorada porque '${bestRequire.code}' de tipo REQUIRE tiene precedencia legal absoluta sobre este documento`,
        });
      }
    } else if (bestExclude && bestRecommend) {
      if (bestExclude.rule_definition.effect.priority <= bestRecommend.rule_definition.effect.priority) {
        finalEffect = 'EXCLUDE';
        winningRule = bestExclude;
      } else {
        finalEffect = 'RECOMMEND';
        winningRule = bestRecommend;
      }
    } else if (bestExclude) {
      finalEffect = 'EXCLUDE';
      winningRule = bestExclude;
    } else if (bestRecommend) {
      finalEffect = 'RECOMMEND';
      winningRule = bestRecommend;
    }

    if (winningRule && finalEffect) {
      const decision: RuleEngineDocumentDecision = {
        documentTypeCode: docCode,
        documentTypeId: winningRule.target_document_type_id,
        effectType: finalEffect,
        priority: winningRule.rule_definition.effect.priority,
        explanation: winningRule.rule_definition.explanation,
        matchingRuleCodes: (group[finalEffect.toLowerCase() as 'recommend' | 'exclude' | 'require']).map(
          (r: RuleRecord) => r.code
        ),
      };

      if (finalEffect === 'REQUIRE') required.push(decision);
      else if (finalEffect === 'EXCLUDE') excluded.push(decision);
      else if (finalEffect === 'RECOMMEND') recommended.push(decision);
    }
  }

  return {
    recommended,
    required,
    excluded,
    trace,
    warnings,
  };
}

function getHighestPriority(rules: RuleRecord[]): RuleRecord | null {
  if (rules.length === 0) return null;
  return rules.reduce((best, current) => {
    return current.rule_definition.effect.priority < best.rule_definition.effect.priority
      ? current
      : best;
  });
}
