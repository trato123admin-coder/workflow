import { describe, it, expect } from 'vitest';
import {
  computeStatusDistribution,
  computeDashboardKPIs,
  computeGestorKPIs,
  computeWorkloadByAnalyst,
  computeMonthlyVariation,
  isCaseOverdue,
  KPICaseInput,
  KPIStatusInput,
  KPIAssignmentInput,
  KPIProfileInput,
} from '../kpis.js';

describe('Diccionario de KPIs Único (S4-06 / A.7 #4)', () => {
  const statuses: KPIStatusInput[] = [
    { id: 'st-1', code: 'APERTURA', name: 'Apertura', category: 'NOT_STARTED', sort_order: 1 },
    { id: 'st-2', code: 'EN_TRAMITE', name: 'En Trámite', category: 'IN_PROGRESS', sort_order: 2 },
    {
      id: 'st-3',
      code: 'ESPERA_NOTARIA',
      name: 'Espera Notaría',
      category: 'WAITING',
      sort_order: 3,
    },
    { id: 'st-4', code: 'OBSERVADO', name: 'Observado', category: 'REWORK', sort_order: 4 },
    { id: 'st-5', code: 'INSCRITO', name: 'Inscrito', category: 'DONE', sort_order: 5 },
  ];

  const now = new Date('2026-09-25T12:00:00Z');
  const pastDate = '2026-09-20T12:00:00Z';
  const futureDate = '2026-09-30T12:00:00Z';

  it('1. computeStatusDistribution garantiza consistencia matemática total (A.7 #4)', () => {
    const cases: KPICaseInput[] = [
      { id: 'c1', status_id: 'st-1', created_at: pastDate },
      { id: 'c2', status_id: 'st-2', created_at: pastDate },
      { id: 'c3', status_id: 'st-2', created_at: pastDate },
      { id: 'c4', status_id: 'st-3', created_at: pastDate },
      { id: 'c5', status_id: 'st-5', created_at: pastDate },
    ];

    const dist = computeStatusDistribution(cases, statuses);

    expect(dist.total).toBe(5);
    expect(dist.byCategory.NOT_STARTED).toBe(1);
    expect(dist.byCategory.IN_PROGRESS).toBe(2);
    expect(dist.byCategory.WAITING).toBe(1);
    expect(dist.byCategory.DONE).toBe(1);
    expect(dist.byCategory.REWORK).toBe(0);

    const sumCounts = dist.categories.reduce((acc, cat) => acc + cat.count, 0);
    expect(sumCounts).toBe(5);

    const sumPercentages = dist.categories.reduce((acc, cat) => acc + cat.percentage, 0);
    expect(Math.round(sumPercentages)).toBe(100);
  });

  it('2. isCaseOverdue detecta vencimientos solo en casos no completados', () => {
    const activeOverdue: KPICaseInput = {
      id: 'c1',
      status_id: 'st-2',
      due_date: pastDate,
      created_at: pastDate,
    };
    const activeFuture: KPICaseInput = {
      id: 'c2',
      status_id: 'st-2',
      due_date: futureDate,
      created_at: pastDate,
    };
    const doneOverdue: KPICaseInput = {
      id: 'c3',
      status_id: 'st-5',
      due_date: pastDate,
      created_at: pastDate,
    };

    expect(isCaseOverdue(activeOverdue, 'IN_PROGRESS', now)).toBe(true);
    expect(isCaseOverdue(activeFuture, 'IN_PROGRESS', now)).toBe(false);
    expect(isCaseOverdue(doneOverdue, 'DONE', now)).toBe(false);
  });

  it('3. computeDashboardKPIs calcula métricas globales consistentes para Admin', () => {
    const cases: KPICaseInput[] = [
      { id: 'c1', status_id: 'st-1', progress: 0, created_at: '2026-09-01T00:00:00Z' },
      {
        id: 'c2',
        status_id: 'st-2',
        progress: 50,
        due_date: pastDate,
        created_at: '2026-09-02T00:00:00Z',
      },
      {
        id: 'c3',
        status_id: 'st-5',
        progress: 100,
        due_date: pastDate,
        created_at: '2026-08-15T00:00:00Z',
      },
    ];

    const assignments: KPIAssignmentInput[] = [
      { case_id: 'c1', user_id: 'u1', assignment_type: 'RESPONSIBLE' },
      { case_id: 'c2', user_id: 'u2', assignment_type: 'RESPONSIBLE' },
      { case_id: 'c2', user_id: 'u3', assignment_type: 'LAWYER' },
    ];

    const kpis = computeDashboardKPIs(cases, assignments, statuses, now);

    expect(kpis.totalCases).toBe(3);
    expect(kpis.activeCases).toBe(2);
    expect(kpis.completedCases).toBe(1);
    expect(kpis.overdueCases).toBe(1); // c2
    expect(kpis.casesWithoutLawyer).toBe(1); // c1 no tiene LAWYER
    expect(kpis.avgProgress).toBe(25); // (0 + 50) / 2
    expect(kpis.distribution.byCategory.DONE).toBe(1);
    expect(kpis.monthlyVariation.currentMonthCount).toBe(2);
    expect(kpis.monthlyVariation.previousMonthCount).toBe(1);
    expect(kpis.monthlyVariation.percentChange).toBe(100);
  });

  it('4. computeGestorKPIs aísla métricas personales para el analista en sesión', () => {
    const cases: KPICaseInput[] = [
      { id: 'c1', status_id: 'st-2', progress: 40, created_at: pastDate },
      { id: 'c2', status_id: 'st-2', progress: 60, due_date: pastDate, created_at: pastDate },
      { id: 'c3', status_id: 'st-5', progress: 100, created_at: pastDate },
    ];

    const assignments: KPIAssignmentInput[] = [
      { case_id: 'c1', user_id: 'gestor-1', assignment_type: 'RESPONSIBLE' },
      { case_id: 'c2', user_id: 'gestor-1', assignment_type: 'RESPONSIBLE' },
      { case_id: 'c3', user_id: 'gestor-2', assignment_type: 'RESPONSIBLE' },
      { case_id: 'c3', user_id: 'gestor-1', assignment_type: 'RESPONSIBLE', ended_at: pastDate }, // Finalizado
    ];

    const gestorKpis = computeGestorKPIs(cases, assignments, 'gestor-1', statuses, now);

    expect(gestorKpis.myTotalCases).toBe(2);
    expect(gestorKpis.myActiveCases).toBe(2);
    expect(gestorKpis.myCompletedCases).toBe(0);
    expect(gestorKpis.myOverdueCases).toBe(1); // c2
    expect(gestorKpis.myAvgProgress).toBe(50); // (40 + 60) / 2
  });

  it('5. computeMonthlyVariation calcula porcentajes de incremento y decremento', () => {
    const monthlyCases: KPICaseInput[] = [
      { id: 'c1', status_id: 'st-1', created_at: '2026-09-01T00:00:00Z' },
      { id: 'c2', status_id: 'st-2', created_at: '2026-09-10T00:00:00Z' },
      { id: 'c3', status_id: 'st-2', created_at: '2026-08-10T00:00:00Z' },
    ];

    const variation = computeMonthlyVariation(monthlyCases, now);
    expect(variation.currentMonthCount).toBe(2);
    expect(variation.previousMonthCount).toBe(1);
    expect(variation.percentChange).toBe(100);
  });

  it('6. computeWorkloadByAnalyst agrupa expedientes por gestor asignado', () => {
    const cases: KPICaseInput[] = [
      { id: 'c1', status_id: 'st-2', created_at: pastDate },
      { id: 'c2', status_id: 'st-2', due_date: pastDate, created_at: pastDate },
      { id: 'c3', status_id: 'st-5', created_at: pastDate },
    ];

    const assignments: KPIAssignmentInput[] = [
      { case_id: 'c1', user_id: 'u1', assignment_type: 'RESPONSIBLE' },
      { case_id: 'c2', user_id: 'u1', assignment_type: 'RESPONSIBLE' },
      { case_id: 'c3', user_id: 'u1', assignment_type: 'COLLABORATOR' },
    ];

    const profiles: KPIProfileInput[] = [
      { id: 'u1', first_name: 'Ana', last_name: 'Gestora', email: 'ana@workflow.pe' },
      { id: 'u2', first_name: 'Beto', last_name: 'Gestor', email: 'beto@workflow.pe' },
    ];

    const workload = computeWorkloadByAnalyst(cases, assignments, profiles, statuses, now);

    expect(workload).toHaveLength(2);
    const u1Workload = workload.find((w) => w.userId === 'u1');
    const u2Workload = workload.find((w) => w.userId === 'u2');

    expect(u1Workload).toBeDefined();
    expect(u1Workload?.activeCases).toBe(2);
    expect(u1Workload?.completedCases).toBe(1);
    expect(u1Workload?.overdueCases).toBe(1);

    expect(u2Workload).toBeDefined();
    expect(u2Workload?.activeCases).toBe(0);
  });
});
