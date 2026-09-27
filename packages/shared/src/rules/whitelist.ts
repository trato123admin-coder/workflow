export const ALLOWED_FACTS = [
  'client.client_type',
  'client.country',
  'client.document_type',
  'case_model.code',
  'case.priority',
  'case.age_days',
  'case.has_dispute',
  'case.route',
  'case.assigned_lawyer_id',
  'case.custom_data',
  'process.code',
  'process.status_code',
  'docs.types',
  'docs.approved_types',
  'quote.selected_amount',
  'parties.causante.marital_status',
  'parties.heirs_count',
  'parties.has_minor_heir',
  'parties.has_foreign_resident',
  'assets.types',
  'assets.count',
  'assets.total_estimated_value',
] as const;

export type AllowedFact = (typeof ALLOWED_FACTS)[number];

export function isFactAllowed(fact: string): boolean {
  // Allow custom_data.* dynamic paths
  if (fact.startsWith('case.custom_data.')) return true;
  return ALLOWED_FACTS.includes(fact as AllowedFact);
}
