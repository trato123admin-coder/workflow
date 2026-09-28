import type { SupabaseClient } from '@supabase/supabase-js';
import type { RuleContext } from '@workflow/shared';

/**
 * Builds the typed RuleContext from an existing case in Supabase.
 * Respects RLS: if the user lacks access to the case or it does not exist,
 * throws an explicit error rather than silently returning an empty context.
 */
export async function buildRuleContextFromCase(
  supabase: SupabaseClient,
  caseId: string,
): Promise<RuleContext> {
  // 1. Fetch case with client person and model version
  const { data: caseRow, error: caseError } = await supabase
    .from('cases')
    .select(
      `
      id,
      case_number,
      title,
      priority,
      route,
      has_dispute,
      created_at,
      custom_data,
      case_model_version_id,
      case_model_version:case_model_versions (
        id,
        version,
        case_model:case_models (code, name)
      ),
      client:persons!cases_client_person_id_fkey (
        person_type,
        country,
        identity_document_type
      )
    `,
    )
    .eq('id', caseId)
    .maybeSingle();

  if (caseError || !caseRow) {
    throw new Error('Expediente no encontrado o no tiene permisos para acceder a él.');
  }

  // 2. Fetch active parties (causante, heirs, etc.)
  const { data: parties, error: partiesError } = await supabase
    .from('case_parties')
    .select(
      `
      party_role,
      is_active,
      person:persons (
        birth_date,
        marital_status,
        country
      )
    `,
    )
    .eq('case_id', caseId)
    .eq('is_active', true);

  if (partiesError) {
    throw new Error(`Error al consultar intervinientes: ${partiesError.message}`);
  }

  // 3. Fetch active assets (case_assets)
  const { data: assets, error: assetsError } = await supabase
    .from('case_assets')
    .select('asset_type, estimated_value, is_active')
    .eq('case_id', caseId)
    .eq('is_active', true);

  if (assetsError) {
    throw new Error(`Error al consultar inventario de bienes: ${assetsError.message}`);
  }

  // 4. Fetch active case documents
  const { data: docs, error: docsError } = await supabase
    .from('case_documents')
    .select(
      `
      status,
      is_active,
      document_type:document_types (code)
    `,
    )
    .eq('case_id', caseId)
    .eq('is_active', true);

  if (docsError) {
    throw new Error(`Error al consultar documentos del expediente: ${docsError.message}`);
  }

  // 5. Extract causante and heirs data safely (without exposing minor PII)
  type PersonInfo = {
    birth_date?: string | null;
    marital_status?: string | null;
    country?: string | null;
  };
  const causanteParty = parties?.find((p) => p.party_role === 'CAUSANTE');
  const causantePerson = causanteParty?.person as PersonInfo | undefined;

  const heirs = parties?.filter((p) => p.party_role === 'HEREDERO') || [];

  const now = new Date();
  const hasMinorHeir = heirs.some((h) => {
    const person = h.person as PersonInfo | undefined;
    if (!person?.birth_date) return false;
    const birth = new Date(person.birth_date);
    const ageDiffMs = now.getTime() - birth.getTime();
    const ageYears = ageDiffMs / (1000 * 60 * 60 * 24 * 365.25);
    return ageYears < 18;
  });

  const hasForeignResident = heirs.some((h) => {
    const person = h.person as PersonInfo | undefined;
    return person?.country && person.country.toUpperCase() !== 'PE';
  });

  // Calculate age_days: strict elapsed days since case creation
  const createdDate = new Date(caseRow.created_at);
  const ageDays = Math.max(
    0,
    Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const clientPerson = caseRow.client as
    { person_type?: string; country?: string; identity_document_type?: string } | undefined;
  const modelVersion = caseRow.case_model_version as { case_model?: { code?: string } } | undefined;

  const docCodes: string[] = [];
  const approvedDocCodes: string[] = [];

  if (docs) {
    for (const d of docs) {
      const dt = d.document_type as { code?: string } | undefined;
      if (dt?.code) {
        docCodes.push(dt.code);
        if (d.status === 'VALIDATED') {
          approvedDocCodes.push(dt.code);
        }
      }
    }
  }

  const assetTypes = Array.from(
    new Set(assets?.map((a) => a.asset_type).filter(Boolean) as string[]),
  );
  const totalEstimatedValue =
    assets?.reduce((sum, a) => sum + (Number(a.estimated_value) || 0), 0) || 0;

  return {
    client: {
      client_type: clientPerson?.person_type,
      country: clientPerson?.country,
      document_type: clientPerson?.identity_document_type,
    },
    case_model: {
      code: modelVersion?.case_model?.code,
    },
    case: {
      priority: caseRow.priority,
      age_days: ageDays,
      has_dispute: caseRow.has_dispute,
      route: caseRow.route,
      custom_data: (caseRow.custom_data as Record<string, unknown>) || {},
    },
    parties: {
      causante: {
        marital_status: causantePerson?.marital_status || undefined,
      },
      heirs_count: heirs.length,
      has_minor_heir: hasMinorHeir,
      has_foreign_resident: hasForeignResident,
    },
    assets: {
      types: assetTypes,
      count: assets?.length || 0,
      total_estimated_value: totalEstimatedValue,
    },
    docs: {
      types: docCodes,
      approved_types: approvedDocCodes,
    },
  };
}
