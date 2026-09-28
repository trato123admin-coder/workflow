'use client';

import { useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  evaluateDocumentRules,
  calculateRecommendationScore,
  type RuleRecord,
  type RuleContext,
} from '@workflow/shared';
import { buildRuleContextFromCase } from '../../lib/rules-context-builder';
import {
  getHistoricalAcceptanceRate,
  calculateCompletenessAndMissingFields,
  recordOrReuseRecommendation,
} from '../../lib/recommendations-stats';
import type { EvaluatedCandidate } from './types';

interface RawDbRule {
  id: string;
  code: string;
  name: string;
  explanation: string;
  priority: number;
  rule_definition: RuleRecord['rule_definition'];
  target_document_type_id: string;
  target_document_type?: { id: string; code: string; name: string } | null;
}

interface TemplateRecord {
  id: string;
  name: string;
  version: number;
  mime_type: string;
  estimated_manual_minutes: number;
}

export function useAssistantEvaluation(supabase: SupabaseClient) {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<EvaluatedCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<EvaluatedCandidate | null>(null);

  const evaluateCase = useCallback(
    async (caseId: string) => {
      setIsEvaluating(true);
      setEvaluationError(null);
      setCandidates([]);
      setSelectedCandidate(null);

      try {
        // 1. Build RuleContext safely
        const context = await buildRuleContextFromCase(supabase, caseId);

        // 2. Fetch case model version
        const { data: caseRow } = await supabase
          .from('cases')
          .select('case_model_version_id')
          .eq('id', caseId)
          .single();

        const modelVersionId = caseRow?.case_model_version_id;

        // 3. Fetch active rules for model + global
        let query = supabase
          .from('document_rules')
          .select(
            `
            id,
            code,
            name,
            explanation,
            priority,
            rule_definition,
            target_document_type_id,
            target_document_type:document_types (id, code, name)
          `,
          )
          .eq('is_active', true);

        if (modelVersionId) {
          query = query.or(
            `case_model_version_id.eq.${modelVersionId},case_model_version_id.is.null`,
          );
        } else {
          query = query.is('case_model_version_id', null);
        }

        const { data: dbRules, error: rulesError } = await query;
        if (rulesError) throw rulesError;

        const typedRules = (dbRules || []) as unknown as RawDbRule[];
        const ruleRecords: RuleRecord[] = typedRules.map((r) => ({
          id: r.id,
          code: r.code,
          target_document_type_id: r.target_document_type_id,
          target_document_type_code: r.target_document_type?.code || 'UNKNOWN',
          rule_definition: r.rule_definition,
        }));

        // 4. Run deterministic rules engine
        const evalResult = evaluateDocumentRules(ruleRecords, context);

        // 5. Gather candidates with effect REQUIRE or RECOMMEND
        const approvedDecisions = [...evalResult.required, ...evalResult.recommended];

        if (approvedDecisions.length === 0) {
          setCandidates([]);
          return;
        }

        // 6. Evaluate scoring for each candidate
        const evaluatedList: EvaluatedCandidate[] = [];

        for (const decision of approvedDecisions) {
          const matchingRuleRows = typedRules.filter((r) =>
            decision.matchingRuleCodes.includes(r.code),
          );

          const firstRule = matchingRuleRows[0];
          const docTypeId = decision.documentTypeId || firstRule?.target_document_type_id || '';
          const docTypeName = firstRule?.target_document_type?.name || decision.documentTypeCode;
          const priority = decision.priority;

          // Fetch active template
          const { data: templates } = await supabase
            .from('templates')
            .select('id, name, version, mime_type, estimated_manual_minutes')
            .eq('document_type_id', docTypeId)
            .eq('is_active', true)
            .order('version', { ascending: false })
            .limit(1);

          const activeTemplate = (templates?.[0] as TemplateRecord) || null;

          // Laplace historical rate
          const histStats = await getHistoricalAcceptanceRate(supabase, docTypeId);

          // Data completeness
          const compResult = activeTemplate
            ? await calculateCompletenessAndMissingFields(supabase, activeTemplate.id, context)
            : { completeness: 1.0, missingFields: [], fields: [] };

          // Composite score
          const score = calculateRecommendationScore(priority, histStats, compResult.completeness);

          const reasons = matchingRuleRows
            .map((r) => r.explanation || r.name)
            .filter((exp): exp is string => Boolean(exp));

          evaluatedList.push({
            documentTypeId: docTypeId,
            documentTypeCode: decision.documentTypeCode,
            documentTypeName: docTypeName,
            effect: decision.effectType,
            priority,
            reasons,
            matchingRules: matchingRuleRows.map((r) => ({
              id: r.id,
              code: r.code,
              name: r.name,
              explanation: r.explanation,
              priority: r.priority,
            })),
            template: activeTemplate,
            completeness: compResult.completeness,
            missingFields: compResult.missingFields,
            fields: compResult.fields,
            historicalStats: histStats,
            score,
            recommendationId: null,
          });
        }

        // 7. Sort by score descending
        evaluatedList.sort((a, b) => b.score - a.score);

        // 8. Record or reuse recommendation for EVERY candidate idempotently
        // This ensures every shown candidate gets a valid recommendationId and counts towards historical Laplace stats
        for (let i = 0; i < evaluatedList.length; i++) {
          const cand = evaluatedList[i];
          const otherAlternatives = evaluatedList
            .filter((_, idx) => idx !== i)
            .map((alt) => ({
              document_type_id: alt.documentTypeId,
              code: alt.documentTypeCode,
              name: alt.documentTypeName,
              score: alt.score,
            }));

          const recId = await recordOrReuseRecommendation(supabase, {
            caseId,
            documentTypeId: cand.documentTypeId,
            templateId: cand.template?.id || null,
            score: cand.score,
            reasons: cand.reasons,
            missingFields: cand.missingFields,
            alternatives: otherAlternatives,
            rulesTriggered: cand.matchingRules,
          });
          cand.recommendationId = recId;
        }

        setCandidates(evaluatedList);
        setSelectedCandidate(evaluatedList[0] || null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error durante la evaluación de reglas';
        setEvaluationError(msg);
      } finally {
        setIsEvaluating(false);
      }
    },
    [supabase],
  );

  return {
    isEvaluating,
    evaluationError,
    candidates,
    selectedCandidate,
    setSelectedCandidate,
    evaluateCase,
  };
}
