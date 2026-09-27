import type { FieldItem, HistoricalStats } from '../../lib/recommendations-stats';
import type { RuleEffectType } from '@workflow/shared';

export interface EvaluatedCandidate {
  documentTypeId: string;
  documentTypeCode: string;
  documentTypeName: string;
  effect: RuleEffectType;
  priority: number;
  reasons: string[];
  matchingRules: Array<{
    id: string;
    code: string;
    name?: string;
    explanation?: string;
    priority: number;
  }>;
  template: {
    id: string;
    name: string;
    version: number;
    estimated_manual_minutes: number;
    mime_type: string;
  } | null;
  completeness: number; // 0 to 1
  missingFields: string[];
  fields: FieldItem[];
  historicalStats: HistoricalStats;
  score: number; // 0 to 1
  recommendationId: string | null;
}

export interface CaseOption {
  id: string;
  case_number: string;
  title: string;
  case_model_version_id: string;
  process_type?: string;
  created_at: string;
}
