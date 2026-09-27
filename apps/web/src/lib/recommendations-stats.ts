import type { SupabaseClient } from '@supabase/supabase-js';
import type { RuleContext } from '@workflow/shared';

export interface HistoricalStats {
  accepted: number;
  shown: number;
  rate: number; // Laplace smoothing: (accepted + 1) / (shown + 2)
}

export interface FieldItem {
  id: string;
  code: string;
  label: string;
  source_path: string;
  is_required: boolean;
  current_value: unknown;
  is_missing: boolean;
}

export interface CompletenessResult {
  completeness: number; // 0.0 to 1.0
  missingFields: string[]; // labels or codes
  fields: FieldItem[];
}

/**
 * 1. Single query for historical acceptance rate with Laplace smoothing.
 * Reads only the boolean column was_accepted for this document type in one query.
 */
export async function getHistoricalAcceptanceRate(
  supabase: SupabaseClient,
  documentTypeId: string
): Promise<HistoricalStats> {
  const { data, error } = await supabase
    .from('ai_recommendations')
    .select('was_accepted')
    .eq('recommended_document_type_id', documentTypeId);

  if (error || !data || data.length === 0) {
    // Zero observations: Laplace baseline is (0 + 1) / (0 + 2) = 0.50
    return { accepted: 0, shown: 0, rate: 0.5 };
  }

  const shown = data.length;
  const accepted = data.filter((r) => r.was_accepted === true).length;
  const rate = (accepted + 1) / (shown + 2);

  return { accepted, shown, rate };
}

/**
 * Extracts a value from a dotted path on an object (e.g. "client.country", "parties.causante.marital_status")
 */
function extractValueFromPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * 2. Data completeness calculation for a given template against the extracted RuleContext.
 */
export async function calculateCompletenessAndMissingFields(
  supabase: SupabaseClient,
  templateId: string,
  context: RuleContext
): Promise<CompletenessResult> {
  const { data: templateFields, error } = await supabase
    .from('template_fields')
    .select(`
      id,
      is_required,
      placeholder,
      document_field:document_fields (
        id,
        code,
        label,
        source_path,
        is_required
      )
    `)
    .eq('template_id', templateId);

  if (error || !templateFields || templateFields.length === 0) {
    return {
      completeness: 1.0,
      missingFields: [],
      fields: [],
    };
  }

  const fields: FieldItem[] = [];
  const missingFields: string[] = [];
  let requiredCount = 0;
  let presentRequiredCount = 0;

  for (const tf of templateFields) {
    const df = tf.document_field as unknown as {
      id?: string;
      code?: string;
      label?: string;
      source_path?: string;
      is_required?: boolean;
    } | null;

    if (!df) continue;

    const sourcePath = df.source_path || '';
    const isRequired = tf.is_required || df.is_required || false;
    const value = sourcePath ? extractValueFromPath(context, sourcePath) : undefined;
    const isMissing = value === undefined || value === null || value === '';

    if (isRequired) {
      requiredCount++;
      if (!isMissing) {
        presentRequiredCount++;
      } else {
        missingFields.push(df.label || df.code || tf.placeholder);
      }
    }

    fields.push({
      id: tf.id,
      code: df.code || tf.placeholder,
      label: df.label || tf.placeholder,
      source_path: sourcePath,
      is_required: isRequired,
      current_value: value,
      is_missing: isMissing,
    });
  }

  const completeness =
    requiredCount > 0 ? presentRequiredCount / requiredCount : 1.0;

  return {
    completeness,
    missingFields,
    fields,
  };
}

export interface RecordRecommendationParams {
  caseId: string;
  processId?: string | null;
  documentTypeId: string;
  templateId: string | null;
  score: number;
  reasons: string[];
  missingFields: string[];
  alternatives: unknown[];
  rulesTriggered: unknown[];
}

/**
 * 3. Idempotent recommendation recording:
 * Checks if an open recommendation (was_accepted IS NULL) already exists for this case + doc_type.
 * If yes, REUSES and updates it instead of creating duplicate impressions on reload.
 */
export async function recordOrReuseRecommendation(
  supabase: SupabaseClient,
  params: RecordRecommendationParams
): Promise<string> {
  // Check for existing pending recommendation
  let query = supabase
    .from('ai_recommendations')
    .select('id')
    .eq('case_id', params.caseId)
    .eq('recommended_document_type_id', params.documentTypeId)
    .is('was_accepted', null);

  if (params.processId) {
    query = query.eq('process_id', params.processId);
  } else {
    query = query.is('process_id', null);
  }

  const { data: existing } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    case_id: params.caseId,
    process_id: params.processId ?? null,
    model_provider: 'RULES_ONLY',
    prompt_version: 'v1',
    recommended_document_type_id: params.documentTypeId,
    recommended_template_id: params.templateId,
    score: Math.min(1, Math.max(0, Number(params.score.toFixed(4)))),
    reasons: params.reasons,
    missing_fields: params.missingFields,
    alternatives: params.alternatives,
    rules_triggered: params.rulesTriggered,
  };

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('ai_recommendations')
      .update(payload)
      .eq('id', existing.id);

    if (updateError) throw updateError;
    return existing.id;
  }

  // Insert new pending recommendation
  const { data: inserted, error: insertError } = await supabase
    .from('ai_recommendations')
    .insert({
      ...payload,
      was_accepted: null,
    })
    .select('id')
    .single();

  if (insertError) throw insertError;
  return inserted.id;
}

/**
 * Updates user decision: ACCEPT (was_accepted = true) or DISMISS (was_accepted = false).
 */
export async function updateRecommendationDecision(
  supabase: SupabaseClient,
  recommendationId: string,
  wasAccepted: boolean
): Promise<void> {
  const updateData: Record<string, unknown> = {
    was_accepted: wasAccepted,
  };
  if (wasAccepted) {
    updateData.accepted_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('ai_recommendations')
    .update(updateData)
    .eq('id', recommendationId);

  if (error) throw error;
}
