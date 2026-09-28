import { describe, it, expect } from 'vitest';
import { evaluateCondition } from '../rules/evaluator.js';
import { evaluateDocumentRules, RuleRecord } from '../rules/engine.js';
import { calculateRecommendationScore } from '../rules/scoring.js';
import { ruleDefinitionSchema } from '../rules/schema.js';
import { isFactAllowed } from '../rules/whitelist.js';
import { RuleContext } from '../rules/types.js';

describe('Rules DSL Evaluator', () => {
  const context: RuleContext = {
    case: {
      priority: 'HIGH',
      age_days: 15,
      has_dispute: true,
      route: 'NOTARIAL',
    },
    client: {
      client_type: 'PERSONA_NATURAL',
      country: 'PE',
    },
    parties: {
      causante: {
        marital_status: 'CASADO',
      },
      heirs_count: 3,
      has_minor_heir: false,
    },
    assets: {
      types: ['INMUEBLE', 'VEHICULO'],
      count: 2,
    },
    docs: {
      types: ['DNI', 'PARTIDA_DEFUNCION'],
    },
  };

  // 1-13: Simple operators
  it('1. eq operator matches exactly', () => {
    const result = evaluateCondition({ fact: 'case.priority', op: 'eq', value: 'HIGH' }, context);
    expect(result.matched).toBe(true);
  });
  it('2. eq operator fails on mismatch', () => {
    const result = evaluateCondition({ fact: 'case.priority', op: 'eq', value: 'LOW' }, context);
    expect(result.matched).toBe(false);
  });
  it('3. neq operator matches when different', () => {
    const result = evaluateCondition({ fact: 'case.route', op: 'neq', value: 'JUDICIAL' }, context);
    expect(result.matched).toBe(true);
  });
  it('4. in operator matches if in array', () => {
    const result = evaluateCondition(
      { fact: 'client.country', op: 'in', value: ['PE', 'CL', 'CO'] },
      context,
    );
    expect(result.matched).toBe(true);
  });
  it('5. not_in operator matches if not in array', () => {
    const result = evaluateCondition(
      { fact: 'client.country', op: 'not_in', value: ['US', 'EU'] },
      context,
    );
    expect(result.matched).toBe(true);
  });
  it('6. gt operator matches strictly greater', () => {
    const result = evaluateCondition({ fact: 'case.age_days', op: 'gt', value: 10 }, context);
    expect(result.matched).toBe(true);
  });
  it('7. gte operator matches greater or equal', () => {
    const result = evaluateCondition({ fact: 'parties.heirs_count', op: 'gte', value: 3 }, context);
    expect(result.matched).toBe(true);
  });
  it('8. lt operator matches strictly less', () => {
    const result = evaluateCondition({ fact: 'parties.heirs_count', op: 'lt', value: 5 }, context);
    expect(result.matched).toBe(true);
  });
  it('9. lte operator matches less or equal', () => {
    const result = evaluateCondition({ fact: 'case.age_days', op: 'lte', value: 15 }, context);
    expect(result.matched).toBe(true);
  });
  it('10. between operator matches inclusive range', () => {
    const result = evaluateCondition(
      { fact: 'case.age_days', op: 'between', value: [10, 20] },
      context,
    );
    expect(result.matched).toBe(true);
  });
  it('11. contains operator matches array elements', () => {
    const result = evaluateCondition(
      { fact: 'assets.types', op: 'contains', value: 'VEHICULO' },
      context,
    );
    expect(result.matched).toBe(true);
  });
  it('12. exists operator matches non-null', () => {
    const result = evaluateCondition({ fact: 'case.priority', op: 'exists', value: true }, context);
    expect(result.matched).toBe(true);
  });
  it('13. missing operator matches null or undefined', () => {
    const result = evaluateCondition(
      { fact: 'case.assigned_lawyer_id', op: 'missing', value: true },
      context,
    );
    expect(result.matched).toBe(true);
  });
  it('14. starts_with matches string prefix', () => {
    const result = evaluateCondition(
      { fact: 'client.client_type', op: 'starts_with', value: 'PERSONA' },
      context,
    );
    expect(result.matched).toBe(true);
  });

  // 15-20: Combinators
  it('15. all combinator matches if all conditions match', () => {
    const result = evaluateCondition(
      {
        all: [
          { fact: 'case.has_dispute', op: 'eq', value: true },
          { fact: 'parties.heirs_count', op: 'gt', value: 2 },
        ],
      },
      context,
    );
    expect(result.matched).toBe(true);
  });
  it('16. all combinator fails if one condition fails', () => {
    const result = evaluateCondition(
      {
        all: [
          { fact: 'case.has_dispute', op: 'eq', value: true },
          { fact: 'parties.heirs_count', op: 'lt', value: 2 },
        ],
      },
      context,
    );
    expect(result.matched).toBe(false);
  });
  it('17. any combinator matches if at least one matches', () => {
    const result = evaluateCondition(
      {
        any: [
          { fact: 'parties.heirs_count', op: 'lt', value: 2 },
          { fact: 'client.country', op: 'eq', value: 'PE' },
        ],
      },
      context,
    );
    expect(result.matched).toBe(true);
  });
  it('18. any combinator fails if none match', () => {
    const result = evaluateCondition(
      {
        any: [
          { fact: 'parties.heirs_count', op: 'lt', value: 2 },
          { fact: 'client.country', op: 'eq', value: 'US' },
        ],
      },
      context,
    );
    expect(result.matched).toBe(false);
  });
  it('19. not combinator negates match', () => {
    const result = evaluateCondition(
      {
        not: { fact: 'parties.has_minor_heir', op: 'eq', value: true },
      },
      context,
    );
    expect(result.matched).toBe(true);
  });
  it('20. complex nested combinators', () => {
    const result = evaluateCondition(
      {
        all: [
          {
            any: [
              { fact: 'case.route', op: 'eq', value: 'NOTARIAL' },
              { fact: 'case.route', op: 'eq', value: 'JUDICIAL' },
            ],
          },
          { not: { fact: 'parties.has_minor_heir', op: 'eq', value: true } },
        ],
      },
      context,
    );
    expect(result.matched).toBe(true);
  });

  // 21-25: Null / Undefined handling
  it('21. missing fact evaluated as missing', () => {
    const result = evaluateCondition(
      { fact: 'case.non_existent', op: 'missing', value: true },
      context,
    );
    expect(result.matched).toBe(true);
  });
  it('22. eq null on missing fact', () => {
    const result = evaluateCondition(
      { fact: 'case.assigned_lawyer_id', op: 'eq', value: null },
      context,
    );
    // getFactValue returns undefined for missing or null values in path chain
    // Actually our mock has it completely absent, so it returns undefined. value is null.
    // eq strict comparison means undefined !== null, but let's test how exists works.
    expect(result.matched).toBe(false);
  });
  it('23. lt on missing fact returns false', () => {
    const result = evaluateCondition(
      { fact: 'quote.selected_amount', op: 'lt', value: 1000 },
      context,
    );
    expect(result.matched).toBe(false);
  });
  it('24. contains on missing fact returns false', () => {
    const result = evaluateCondition(
      { fact: 'docs.approved_types', op: 'contains', value: 'DNI' },
      context,
    );
    expect(result.matched).toBe(false);
  });
  it('25. between on missing fact returns false', () => {
    const result = evaluateCondition(
      { fact: 'assets.total_estimated_value', op: 'between', value: [0, 100] },
      context,
    );
    expect(result.matched).toBe(false);
  });

  // 26-28: Whitelist and Schema validation
  it('26. isFactAllowed validates whitelist correctly', () => {
    expect(isFactAllowed('case.priority')).toBe(true);
    expect(isFactAllowed('case.custom_data.some_field')).toBe(true);
    expect(isFactAllowed('invalid.path')).toBe(false);
  });
  it('27. Zod schema validates valid rule', () => {
    const validRule = {
      version: 1,
      conditions: { fact: 'case.priority', op: 'eq', value: 'HIGH' },
      effect: { type: 'RECOMMEND', priority: 1, explanation: 'Test' },
      explanation: 'Test rule',
    };
    expect(() => ruleDefinitionSchema.parse(validRule)).not.toThrow();
  });
  it('28. Zod schema rejects invalid fact', () => {
    const invalidRule = {
      version: 1,
      conditions: { fact: 'invalid.fact', op: 'eq', value: 'HIGH' },
      effect: { type: 'RECOMMEND', priority: 1, explanation: 'Test' },
      explanation: 'Test rule',
    };
    expect(() => ruleDefinitionSchema.parse(invalidRule)).toThrow();
  });

  // 29-32: Scoring logic
  it('29. calculateRecommendationScore computes correctly', () => {
    const score = calculateRecommendationScore(1, { accepted: 8, shown: 10 }, 1.0);
    expect(score).toBeGreaterThan(0);
  });
  it('30. lower priority (higher number) yields lower score', () => {
    const s1 = calculateRecommendationScore(1, { accepted: 5, shown: 10 }, 1.0);
    const s2 = calculateRecommendationScore(10, { accepted: 5, shown: 10 }, 1.0);
    expect(s1).toBeGreaterThan(s2);
  });
  it('31. higher acceptance rate yields higher score', () => {
    const s1 = calculateRecommendationScore(1, { accepted: 9, shown: 10 }, 1.0);
    const s2 = calculateRecommendationScore(1, { accepted: 1, shown: 10 }, 1.0);
    expect(s1).toBeGreaterThan(s2);
  });
  it('32. completeness scales correctly', () => {
    const s1 = calculateRecommendationScore(1, { accepted: 5, shown: 10 }, 1.0);
    const s2 = calculateRecommendationScore(1, { accepted: 5, shown: 10 }, 0.5);
    expect(s1).toBeGreaterThan(s2);
  });

  // 33-41: Engine Conflict Resolution
  it('33. Conflict: RECOMMEND priority 1 beats EXCLUDE priority 3', () => {
    const rules: RuleRecord[] = [
      {
        id: 'r1',
        code: 'REC_1',
        target_document_type_id: 'd1',
        target_document_type_code: 'DOC_A',
        rule_definition: {
          version: 1,
          conditions: { fact: 'case.priority', op: 'eq', value: 'HIGH' },
          effect: { type: 'RECOMMEND', priority: 1, explanation: 'Should recommend' },
          explanation: '',
        },
      },
      {
        id: 'r2',
        code: 'EXC_3',
        target_document_type_id: 'd1',
        target_document_type_code: 'DOC_A',
        rule_definition: {
          version: 1,
          conditions: { fact: 'case.priority', op: 'eq', value: 'HIGH' },
          effect: { type: 'EXCLUDE', priority: 3, explanation: 'Should NOT exclude' },
          explanation: '',
        },
      },
    ];
    const result = evaluateDocumentRules(rules, context);
    expect(result.recommended).toHaveLength(1);
    expect(result.excluded).toHaveLength(0);
    expect(result.recommended[0]!.matchingRuleCodes).toContain('REC_1');
  });

  it('34. Conflict: EXCLUDE priority 2 beats RECOMMEND priority 2', () => {
    const rules: RuleRecord[] = [
      {
        id: 'r1',
        code: 'REC_2',
        target_document_type_id: 'd1',
        target_document_type_code: 'DOC_B',
        rule_definition: {
          version: 1,
          conditions: { fact: 'case.priority', op: 'eq', value: 'HIGH' },
          effect: { type: 'RECOMMEND', priority: 2, explanation: 'Try recommend' },
          explanation: '',
        },
      },
      {
        id: 'r2',
        code: 'EXC_2',
        target_document_type_id: 'd1',
        target_document_type_code: 'DOC_B',
        rule_definition: {
          version: 1,
          conditions: { fact: 'case.priority', op: 'eq', value: 'HIGH' },
          effect: { type: 'EXCLUDE', priority: 2, explanation: 'Exclude wins tie' },
          explanation: '',
        },
      },
    ];
    const result = evaluateDocumentRules(rules, context);
    expect(result.excluded).toHaveLength(1);
    expect(result.recommended).toHaveLength(0);
    expect(result.excluded[0]!.matchingRuleCodes).toContain('EXC_2');
  });

  it('35. REQUIRE always wins over EXCLUDE regardless of priority (legal obligation cannot be excluded by configuration)', () => {
    const rules: RuleRecord[] = [
      {
        id: 'r1',
        code: 'REQ_2',
        target_document_type_id: 'd1',
        target_document_type_code: 'DOC_C',
        rule_definition: {
          version: 1,
          conditions: { fact: 'case.priority', op: 'eq', value: 'HIGH' },
          effect: { type: 'REQUIRE', priority: 2, explanation: 'Legal obligation' },
          explanation: '',
        },
      },
      {
        id: 'r2',
        code: 'EXC_1',
        target_document_type_id: 'd1',
        target_document_type_code: 'DOC_C',
        rule_definition: {
          version: 1,
          conditions: { fact: 'case.priority', op: 'eq', value: 'HIGH' },
          effect: { type: 'EXCLUDE', priority: 1, explanation: 'Attempted exclusion' },
          explanation: '',
        },
      },
    ];
    const result = evaluateDocumentRules(rules, context);
    expect(result.required).toHaveLength(1);
    expect(result.excluded).toHaveLength(0);
    expect(result.recommended).toHaveLength(0);
    expect(result.required[0]!.documentTypeCode).toBe('DOC_C');
    expect(result.required[0]!.matchingRuleCodes).toContain('REQ_2');
    expect(result.warnings).toBeDefined();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings![0]!.message).toContain(
      "Conflicto de configuración: la regla EXCLUDE 'EXC_1' fue ignorada porque 'REQ_2' de tipo REQUIRE tiene precedencia legal absoluta",
    );
  });

  it('36. Conflict: EXCLUDE priority 1 beats RECOMMEND priority 2', () => {
    const rules: RuleRecord[] = [
      {
        id: 'r1',
        code: 'REC_2',
        target_document_type_id: 'd1',
        target_document_type_code: 'DOC_D',
        rule_definition: {
          version: 1,
          conditions: { fact: 'case.priority', op: 'eq', value: 'HIGH' },
          effect: { type: 'RECOMMEND', priority: 2, explanation: '' },
          explanation: '',
        },
      },
      {
        id: 'r2',
        code: 'EXC_1',
        target_document_type_id: 'd1',
        target_document_type_code: 'DOC_D',
        rule_definition: {
          version: 1,
          conditions: { fact: 'case.priority', op: 'eq', value: 'HIGH' },
          effect: { type: 'EXCLUDE', priority: 1, explanation: '' },
          explanation: '',
        },
      },
    ];
    const result = evaluateDocumentRules(rules, context);
    expect(result.excluded).toHaveLength(1);
    expect(result.recommended).toHaveLength(0);
  });

  it('37. REQUIRE always beats RECOMMEND', () => {
    const rules: RuleRecord[] = [
      {
        id: 'r1',
        code: 'REC_1',
        target_document_type_id: 'd1',
        target_document_type_code: 'DOC_E',
        rule_definition: {
          version: 1,
          conditions: { fact: 'case.priority', op: 'eq', value: 'HIGH' },
          effect: { type: 'RECOMMEND', priority: 1, explanation: '' },
          explanation: '',
        },
      },
      {
        id: 'r2',
        code: 'REQ_10',
        target_document_type_id: 'd1',
        target_document_type_code: 'DOC_E',
        rule_definition: {
          version: 1,
          conditions: { fact: 'case.priority', op: 'eq', value: 'HIGH' },
          effect: { type: 'REQUIRE', priority: 10, explanation: '' },
          explanation: '',
        },
      },
    ];
    const result = evaluateDocumentRules(rules, context);
    expect(result.required).toHaveLength(1);
    expect(result.recommended).toHaveLength(0);
  });

  it('38. Unmatched rules do not affect outcome', () => {
    const rules: RuleRecord[] = [
      {
        id: 'r1',
        code: 'REC_1',
        target_document_type_id: 'd1',
        target_document_type_code: 'DOC_F',
        rule_definition: {
          version: 1,
          conditions: { fact: 'case.priority', op: 'eq', value: 'LOW' },
          effect: { type: 'RECOMMEND', priority: 1, explanation: '' },
          explanation: '',
        },
      },
    ];
    const result = evaluateDocumentRules(rules, context);
    expect(result.recommended).toHaveLength(0);
  });

  it('39. Multiple doc types evaluated independently', () => {
    const rules: RuleRecord[] = [
      {
        id: 'r1',
        code: 'REC_DOC1',
        target_document_type_id: 'd1',
        target_document_type_code: 'DOC_1',
        rule_definition: {
          version: 1,
          conditions: { fact: 'case.priority', op: 'eq', value: 'HIGH' },
          effect: { type: 'RECOMMEND', priority: 1, explanation: '' },
          explanation: '',
        },
      },
      {
        id: 'r2',
        code: 'REQ_DOC2',
        target_document_type_id: 'd2',
        target_document_type_code: 'DOC_2',
        rule_definition: {
          version: 1,
          conditions: { fact: 'case.priority', op: 'eq', value: 'HIGH' },
          effect: { type: 'REQUIRE', priority: 1, explanation: '' },
          explanation: '',
        },
      },
    ];
    const result = evaluateDocumentRules(rules, context);
    expect(result.recommended).toHaveLength(1);
    expect(result.required).toHaveLength(1);
    expect(result.recommended[0]!.documentTypeCode).toBe('DOC_1');
    expect(result.required[0]!.documentTypeCode).toBe('DOC_2');
  });

  it('40. Rule trace tracks matching correctly', () => {
    const rules: RuleRecord[] = [
      {
        id: 'r1',
        code: 'REC_1',
        target_document_type_id: 'd1',
        target_document_type_code: 'DOC_G',
        rule_definition: {
          version: 1,
          conditions: { fact: 'case.priority', op: 'eq', value: 'HIGH' },
          effect: { type: 'RECOMMEND', priority: 1, explanation: '' },
          explanation: '',
        },
      },
    ];
    const result = evaluateDocumentRules(rules, context);
    expect(result.trace).toHaveLength(1);
    expect(result.trace[0]!.matched).toBe(true);
    expect(result.trace[0]!.conditionTrace.actualValue).toBe('HIGH');
  });

  it('41. exists checks boolean flag properly', () => {
    const result = evaluateCondition(
      { fact: 'case.priority', op: 'exists', value: false },
      context,
    );
    expect(result.matched).toBe(false);
  });
});
