export type RuleOperator =
  | 'eq'
  | 'neq'
  | 'in'
  | 'not_in'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'contains'
  | 'exists'
  | 'missing'
  | 'starts_with';

export type RuleEffectType = 'RECOMMEND' | 'EXCLUDE' | 'REQUIRE';

export interface RuleEffect {
  type: RuleEffectType;
  priority: number; // 1 = máxima prioridad, 100 = menor
  explanation?: string;
  target_document_type_code?: string;
}

export interface SimpleCondition {
  fact: string;
  op: RuleOperator;
  value?: unknown;
}

export type RuleCondition =
  SimpleCondition | { all: RuleCondition[] } | { any: RuleCondition[] } | { not: RuleCondition };

export interface RuleDefinition {
  version: number;
  conditions: RuleCondition;
  effect: RuleEffect;
  explanation: string;
}

export interface RuleContext {
  client?: {
    client_type?: string;
    country?: string;
    document_type?: string;
  };
  case_model?: {
    code?: string;
  };
  case?: {
    priority?: string;
    age_days?: number;
    has_dispute?: boolean;
    route?: 'POR_DEFINIR' | 'NOTARIAL' | 'JUDICIAL' | string;
    assigned_lawyer_id?: string | null;
    custom_data?: Record<string, unknown>;
  };
  process?: {
    code?: string;
    status_code?: string;
  };
  docs?: {
    types?: string[];
    approved_types?: string[];
  };
  quote?: {
    selected_amount?: number;
  };
  parties?: {
    causante?: {
      marital_status?: string;
    };
    heirs_count?: number;
    has_minor_heir?: boolean;
    has_foreign_resident?: boolean;
  };
  assets?: {
    types?: string[];
    count?: number;
    total_estimated_value?: number;
  };
  [key: string]: unknown;
}

export interface ConditionEvaluationTrace {
  fact?: string;
  op?: RuleOperator;
  expectedValue?: unknown;
  actualValue?: unknown;
  matched: boolean;
  combinator?: 'all' | 'any' | 'not';
  children?: ConditionEvaluationTrace[];
}

export interface RuleEvaluationTrace {
  ruleId?: string;
  ruleCode: string;
  targetDocumentTypeCode?: string;
  targetDocumentTypeId?: string;
  matched: boolean;
  effect: RuleEffect;
  explanation: string;
  conditionTrace: ConditionEvaluationTrace;
  evaluatedFacts: Record<string, unknown>;
}

export interface RuleEngineDocumentDecision {
  documentTypeCode: string;
  documentTypeId?: string;
  effectType: RuleEffectType;
  priority: number;
  explanation: string;
  matchingRuleCodes: string[];
}

export interface RuleConflictWarning {
  documentTypeCode: string;
  requireRuleCode: string;
  excludeRuleCode: string;
  message: string;
}

export interface RuleEngineEvaluationResult {
  recommended: RuleEngineDocumentDecision[];
  required: RuleEngineDocumentDecision[];
  excluded: RuleEngineDocumentDecision[];
  trace: RuleEvaluationTrace[];
  warnings?: RuleConflictWarning[];
}
