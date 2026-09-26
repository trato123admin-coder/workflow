// ============================================================================
// Diccionario de KPIs Único (S4-06, Docs 01-Anexo A.7 #4)
// Fuente única de verdad matemática para tarjetas KPI, gráficos de dona,
// embudos de proceso y cargas de trabajo en Dashboards Admin y Gestor.
// ============================================================================

export type WorkflowStatusCategory = 'NOT_STARTED' | 'IN_PROGRESS' | 'WAITING' | 'REWORK' | 'DONE';

export interface KPICaseInput {
  id: string;
  status_id: string;
  created_at: string;
  due_date?: string | null;
  progress?: number | null;
  is_confidential?: boolean;
}

export interface KPIStatusInput {
  id: string;
  code: string;
  name: string;
  category: WorkflowStatusCategory;
  sort_order?: number;
}

export interface KPIAssignmentInput {
  case_id: string;
  user_id: string;
  assignment_type: 'RESPONSIBLE' | 'COLLABORATOR' | 'LAWYER' | 'VIEWER';
  is_primary?: boolean;
  ended_at?: string | null;
}

export interface KPIProfileInput {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

export interface CategoryCount {
  category: WorkflowStatusCategory;
  label: string;
  count: number;
  percentage: number;
}

export interface StatusDistribution {
  byCategory: Record<WorkflowStatusCategory, number>;
  categories: CategoryCount[];
  total: number;
}

export interface MonthlyVariation {
  currentMonthCount: number;
  previousMonthCount: number;
  percentChange: number;
}

export interface DashboardKPIs {
  totalCases: number;
  activeCases: number;
  completedCases: number;
  overdueCases: number;
  casesWithoutLawyer: number;
  avgProgress: number;
  distribution: StatusDistribution;
  monthlyVariation: MonthlyVariation;
}

export interface GestorKPIs {
  myTotalCases: number;
  myActiveCases: number;
  myCompletedCases: number;
  myOverdueCases: number;
  myAvgProgress: number;
  distribution: StatusDistribution;
}

export interface AnalystWorkload {
  userId: string;
  name: string;
  email: string;
  activeCases: number;
  completedCases: number;
  overdueCases: number;
}

export interface ProcessFunnelStep {
  sequence: number;
  code: string;
  name: string;
  activeCases: number;
}

const CATEGORY_LABELS: Record<WorkflowStatusCategory, string> = {
  NOT_STARTED: 'Sin iniciar',
  IN_PROGRESS: 'En proceso',
  WAITING: 'En espera',
  REWORK: 'En revisión',
  DONE: 'Finalizado',
};

// 1. Distribución porcentual y conteo por categoría semántica (Consistencia A.7 #4)
export function computeStatusDistribution(
  cases: KPICaseInput[],
  statuses: KPIStatusInput[],
): StatusDistribution {
  const statusMap = new Map(statuses.map((s) => [s.id, s.category]));
  const counts: Record<WorkflowStatusCategory, number> = {
    NOT_STARTED: 0,
    IN_PROGRESS: 0,
    WAITING: 0,
    REWORK: 0,
    DONE: 0,
  };

  for (const c of cases) {
    const category = statusMap.get(c.status_id) || 'NOT_STARTED';
    counts[category] = (counts[category] || 0) + 1;
  }

  const total = cases.length;
  const categories: CategoryCount[] = (Object.keys(counts) as WorkflowStatusCategory[]).map(
    (cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat] || cat,
      count: counts[cat],
      percentage: total > 0 ? Number(((counts[cat] / total) * 100).toFixed(2)) : 0,
    }),
  );

  return { byCategory: counts, categories, total };
}

// 2. Cálculo de variación mes actual vs mes anterior
export function computeMonthlyVariation(cases: KPICaseInput[], now = new Date()): MonthlyVariation {
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();

  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  let currentCount = 0;
  let previousCount = 0;

  for (const c of cases) {
    const d = new Date(c.created_at);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    if (y === currentYear && m === currentMonth) {
      currentCount++;
    } else if (y === prevYear && m === prevMonth) {
      previousCount++;
    }
  }

  const percentChange =
    previousCount === 0
      ? currentCount > 0
        ? 100
        : 0
      : Number((((currentCount - previousCount) / previousCount) * 100).toFixed(1));

  return {
    currentMonthCount: currentCount,
    previousMonthCount: previousCount,
    percentChange,
  };
}

// 3. Indicador de caso vencido
export function isCaseOverdue(
  c: KPICaseInput,
  category: WorkflowStatusCategory,
  now = new Date(),
): boolean {
  if (category === 'DONE' || !c.due_date) return false;
  return new Date(c.due_date).getTime() < now.getTime();
}

// 4. KPIs Principales para el Dashboard del Administrador (Mockup 1)
export function computeDashboardKPIs(
  cases: KPICaseInput[],
  assignments: KPIAssignmentInput[],
  statuses: KPIStatusInput[],
  now = new Date(),
): DashboardKPIs {
  const statusMap = new Map(statuses.map((s) => [s.id, s.category]));
  const distribution = computeStatusDistribution(cases, statuses);

  const activeCasesMap = new Set<string>();
  let overdueCount = 0;
  let progressSum = 0;
  let activeCount = 0;

  for (const c of cases) {
    const cat = statusMap.get(c.status_id) || 'NOT_STARTED';
    if (cat !== 'DONE') {
      activeCasesMap.add(c.id);
      activeCount++;
      progressSum += Number(c.progress || 0);
      if (isCaseOverdue(c, cat, now)) {
        overdueCount++;
      }
    }
  }

  // Casos activos que no tienen ningún abogado asignado
  const activeCasesWithLawyer = new Set(
    assignments.filter((a) => a.assignment_type === 'LAWYER' && !a.ended_at).map((a) => a.case_id),
  );

  let withoutLawyerCount = 0;
  for (const caseId of activeCasesMap) {
    if (!activeCasesWithLawyer.has(caseId)) {
      withoutLawyerCount++;
    }
  }

  return {
    totalCases: cases.length,
    activeCases: activeCount,
    completedCases: distribution.byCategory.DONE || 0,
    overdueCases: overdueCount,
    casesWithoutLawyer: withoutLawyerCount,
    avgProgress: activeCount > 0 ? Number((progressSum / activeCount).toFixed(2)) : 0,
    distribution,
    monthlyVariation: computeMonthlyVariation(cases, now),
  };
}

// 5. KPIs Personales para el Dashboard del Gestor (Mockup 2)
export function computeGestorKPIs(
  cases: KPICaseInput[],
  assignments: KPIAssignmentInput[],
  userId: string,
  statuses: KPIStatusInput[],
  now = new Date(),
): GestorKPIs {
  const assignedCaseIds = new Set(
    assignments.filter((a) => a.user_id === userId && !a.ended_at).map((a) => a.case_id),
  );

  const myCases = cases.filter((c) => assignedCaseIds.has(c.id));
  const statusMap = new Map(statuses.map((s) => [s.id, s.category]));
  const distribution = computeStatusDistribution(myCases, statuses);

  let myActive = 0;
  let myOverdue = 0;
  let progressSum = 0;

  for (const c of myCases) {
    const cat = statusMap.get(c.status_id) || 'NOT_STARTED';
    if (cat !== 'DONE') {
      myActive++;
      progressSum += Number(c.progress || 0);
      if (isCaseOverdue(c, cat, now)) {
        myOverdue++;
      }
    }
  }

  return {
    myTotalCases: myCases.length,
    myActiveCases: myActive,
    myCompletedCases: distribution.byCategory.DONE || 0,
    myOverdueCases: myOverdue,
    myAvgProgress: myActive > 0 ? Number((progressSum / myActive).toFixed(2)) : 0,
    distribution,
  };
}

// 6. Carga de trabajo por Gestor / Analista
export function computeWorkloadByAnalyst(
  cases: KPICaseInput[],
  assignments: KPIAssignmentInput[],
  profiles: KPIProfileInput[],
  statuses: KPIStatusInput[],
  now = new Date(),
): AnalystWorkload[] {
  const statusMap = new Map(statuses.map((s) => [s.id, s.category]));
  const casesMap = new Map(cases.map((c) => [c.id, c]));

  const userAssignments = new Map<string, KPIAssignmentInput[]>();
  for (const a of assignments) {
    if (
      !a.ended_at &&
      (a.assignment_type === 'RESPONSIBLE' || a.assignment_type === 'COLLABORATOR')
    ) {
      const list = userAssignments.get(a.user_id) || [];
      list.push(a);
      userAssignments.set(a.user_id, list);
    }
  }

  return profiles.map((p) => {
    const userAsg = userAssignments.get(p.id) || [];
    let active = 0;
    let completed = 0;
    let overdue = 0;

    for (const a of userAsg) {
      const c = casesMap.get(a.case_id);
      if (!c) continue;
      const cat = statusMap.get(c.status_id) || 'NOT_STARTED';
      if (cat === 'DONE') {
        completed++;
      } else {
        active++;
        if (isCaseOverdue(c, cat, now)) overdue++;
      }
    }

    const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || 'Sin nombre';
    return {
      userId: p.id,
      name,
      email: p.email || '',
      activeCases: active,
      completedCases: completed,
      overdueCases: overdue,
    };
  });
}
