import type { CasePartyItem } from './case-parties.js';
import type {
  CaseAssetItem,
  CaseLiabilityItem,
  ConsolidatedEstateSummary,
} from './case-estate.js';
import type { CaseItem } from './cases.js';

export type SemaphoreWarningCode =
  | 'MINOR_WITHOUT_REPRESENTATIVE'
  | 'HEIR_SHARES_NOT_100'
  | 'CAUSANTE_MISSING_DEATH_DATE'
  | 'ROUTE_UNDEFINED_PAST_EVAL';

export interface SemaphoreWarningItem {
  code: SemaphoreWarningCode;
  title: string;
  message: string;
  severity: 'warning' | 'danger' | 'info';
}

export interface CaseSemaphoreSummary {
  hasWarnings: boolean;
  warnings: SemaphoreWarningItem[];
  totalConfirmedShare: number;
}

export function calculateAge(
  birthDate: string | Date,
  referenceDate: string | Date = new Date()
): number {
  const birth = new Date(birthDate);
  const ref = new Date(referenceDate);

  if (isNaN(birth.getTime()) || isNaN(ref.getTime())) {
    return 0;
  }

  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    age--;
  }

  return Math.max(0, age);
}

export function isMinor(
  birthDate: string | Date | null | undefined,
  referenceDate: string | Date = new Date()
): boolean {
  if (!birthDate) return false;
  return calculateAge(birthDate, referenceDate) < 18;
}

export function validateHeirQuotas(parties: CasePartyItem[]): {
  isValid: boolean;
  totalPercent: number;
  confirmedCount: number;
  diff: number;
} {
  const confirmedHeirs = parties.filter(
    (p) => p.is_active && p.party_role === 'HEREDERO' && p.heir_status === 'CONFIRMADO'
  );

  const totalPercent = confirmedHeirs.reduce(
    (sum, h) => sum + (Number(h.share_percent) || 0),
    0
  );

  const roundedTotal = Math.round(totalPercent * 10000) / 10000;
  const isValid = confirmedHeirs.length === 0 || Math.abs(roundedTotal - 100) < 0.001;

  return {
    isValid,
    totalPercent: roundedTotal,
    confirmedCount: confirmedHeirs.length,
    diff: Math.round((100 - roundedTotal) * 10000) / 10000,
  };
}

export function validateMinorRepresentation(parties: CasePartyItem[]): {
  hasUnrepresentedMinors: boolean;
  unrepresentedMinors: CasePartyItem[];
} {
  const unrepresentedMinors = parties.filter((p) => {
    if (!p.is_active || p.party_role !== 'HEREDERO') return false;
    const bDate = p.person?.birth_date;
    if (!bDate) return false;
    const minor = isMinor(bDate);
    const hasRep = Boolean(p.represented_by && p.represented_by.trim() !== '');
    return minor && !hasRep;
  });

  return {
    hasUnrepresentedMinors: unrepresentedMinors.length > 0,
    unrepresentedMinors,
  };
}

export function validateCausanteDeathDate(parties: CasePartyItem[]): {
  hasMissingDeathDate: boolean;
  causante?: CasePartyItem;
} {
  const causante = parties.find(
    (p) => p.is_active && p.party_role === 'CAUSANTE'
  );

  if (!causante) {
    return { hasMissingDeathDate: false };
  }

  const hasMissingDeathDate = !causante.person?.death_date;

  return {
    hasMissingDeathDate,
    causante,
  };
}

export function validateCaseSemaphore(
  caseItem?: Partial<CaseItem> | null,
  parties: CasePartyItem[] = []
): CaseSemaphoreSummary {
  const warnings: SemaphoreWarningItem[] = [];

  // 1. Menor sin representante
  const minorCheck = validateMinorRepresentation(parties);
  if (minorCheck.hasUnrepresentedMinors) {
    warnings.push({
      code: 'MINOR_WITHOUT_REPRESENTATIVE',
      title: 'Heredero menor sin representante',
      message: `Existe ${minorCheck.unrepresentedMinors.length} heredero(s) menor(es) de edad sin representante legal o tutor asignado.`,
      severity: 'warning',
    });
  }

  // 2. Cuotas que no suman 100%
  const quotaCheck = validateHeirQuotas(parties);
  if (!quotaCheck.isValid) {
    warnings.push({
      code: 'HEIR_SHARES_NOT_100',
      title: 'Cuotas no suman 100%',
      message: `La suma de cuotas de herederos confirmados es ${quotaCheck.totalPercent}% (diferencia de ${quotaCheck.diff}%).`,
      severity: 'warning',
    });
  }

  // 3. Causante sin fecha de defunción
  const deathCheck = validateCausanteDeathDate(parties);
  if (deathCheck.hasMissingDeathDate) {
    warnings.push({
      code: 'CAUSANTE_MISSING_DEATH_DATE',
      title: 'Fecha de defunción pendiente',
      message: 'El causante activo no tiene registrada la fecha de defunción en su ficha personal.',
      severity: 'warning',
    });
  }

  // 4. Ruta por definir
  if (caseItem?.route === 'POR_DEFINIR' && (caseItem.current_progress || 0) >= 30) {
    warnings.push({
      code: 'ROUTE_UNDEFINED_PAST_EVAL',
      title: 'Vía procesal por definir',
      message: 'El caso ha avanzado sin que el abogado haya definido la vía notarial o judicial.',
      severity: 'info',
    });
  }

  return {
    hasWarnings: warnings.length > 0,
    warnings,
    totalConfirmedShare: quotaCheck.totalPercent,
  };
}

export function calculateConsolidatedEstate(
  assets: CaseAssetItem[] = [],
  liabilities: CaseLiabilityItem[] = []
): ConsolidatedEstateSummary {
  let totalAssetsPen = 0;
  let totalAssetsUsd = 0;
  let totalLiabilitiesPen = 0;
  let totalLiabilitiesUsd = 0;

  for (const asset of assets) {
    if (!asset.is_active) continue;
    const value = (Number(asset.estimated_value) || 0) * ((Number(asset.ownership_percent) || 100) / 100);
    if (asset.currency === 'USD') {
      totalAssetsUsd += value;
    } else {
      totalAssetsPen += value;
    }
  }

  for (const liab of liabilities) {
    if (!liab.is_active) continue;
    const amount = Number(liab.amount) || 0;
    if (liab.currency === 'USD') {
      totalLiabilitiesUsd += amount;
    } else {
      totalLiabilitiesPen += amount;
    }
  }

  return {
    totalAssetsPen: Math.round(totalAssetsPen * 100) / 100,
    totalAssetsUsd: Math.round(totalAssetsUsd * 100) / 100,
    totalLiabilitiesPen: Math.round(totalLiabilitiesPen * 100) / 100,
    totalLiabilitiesUsd: Math.round(totalLiabilitiesUsd * 100) / 100,
    netEstatePen: Math.round((totalAssetsPen - totalLiabilitiesPen) * 100) / 100,
    netEstateUsd: Math.round((totalAssetsUsd - totalLiabilitiesUsd) * 100) / 100,
    assetsCount: assets.filter((a) => a.is_active).length,
    liabilitiesCount: liabilities.filter((l) => l.is_active).length,
  };
}
