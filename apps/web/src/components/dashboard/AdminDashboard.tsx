'use client';

import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserX,
  TrendingUp,
  Settings2,
  Loader2,
} from 'lucide-react';
import { KpiCard } from '../ui/KpiCard';
import { StatusDonutChart } from './StatusDonutChart';
import { ProcessFunnelWidget, type FunnelStage } from './ProcessFunnelWidget';
import { AnalystWorkloadWidget } from './AnalystWorkloadWidget';
import { TodayTasksWidget } from './TodayTasksWidget';
import {
  computeDashboardKPIs,
  computeWorkloadByAnalyst,
  type DashboardKPIs,
  type AnalystWorkload,
  type KPICaseInput,
  type KPIStatusInput,
  type KPIAssignmentInput,
  type KPIProfileInput,
} from '@workflow/shared';
import { createClient } from '../../lib/supabase/client';

interface AdminDashboardLayoutPrefs {
  showDonut: boolean;
  showFunnel: boolean;
  showWorkload: boolean;
  showTodayTasks: boolean;
}

const DEFAULT_PREFS: AdminDashboardLayoutPrefs = {
  showDonut: true,
  showFunnel: true,
  showWorkload: true,
  showTodayTasks: true,
};

export const AdminDashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [workloads, setWorkloads] = useState<AnalystWorkload[]>([]);
  const [funnelStages, setFunnelStages] = useState<FunnelStage[]>([]);
  const [rawCases, setRawCases] = useState<(KPICaseInput & { title: string; case_number: string })[]>([]);
  const [prefs, setPrefs] = useState<AdminDashboardLayoutPrefs>(DEFAULT_PREFS);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const supabase = createClient();

      const [casesRes, statusesRes, asgRes, profRes, procRes, prefsRes] = await Promise.all([
        supabase.from('cases').select('id, case_number, title, created_at, due_date, current_progress, status_id, is_confidential'),
        supabase.from('workflow_statuses').select('id, code, name, category, sort_order').eq('is_active', true).order('sort_order', { ascending: true }),
        supabase.from('case_assignments').select('case_id, user_id, assignment_type, is_primary, ended_at'),
        supabase.from('profiles').select('id, first_name, last_name, email').eq('is_active', true),
        supabase.from('case_processes').select('sequence, name, definition_id, status_id'),
        supabase.from('user_preferences').select('value').eq('key', 'admin_dashboard_layout').maybeSingle(),
      ]);

      if (prefsRes.data?.value) {
        setPrefs({ ...DEFAULT_PREFS, ...(prefsRes.data.value as Partial<AdminDashboardLayoutPrefs>) });
      }

      const cases = (casesRes.data || []) as unknown as (KPICaseInput & { title: string; case_number: string })[];
      const statuses = (statusesRes.data || []) as unknown as KPIStatusInput[];
      const assignments = (asgRes.data || []) as unknown as KPIAssignmentInput[];
      const profiles = (profRes.data || []) as unknown as KPIProfileInput[];
      const processes = (procRes.data || []) as { sequence: number; name: string; definition_id: string; status_id: string }[];

      setRawCases(cases);

      // 1. Calcular KPIs principales (A.7 #4 con diccionario unificado)
      const calculatedKpis = computeDashboardKPIs(cases, assignments, statuses);
      setKpis(calculatedKpis);

      // 2. Calcular Carga de Trabajo de Analistas
      const calculatedWorkloads = computeWorkloadByAnalyst(cases, assignments, profiles, statuses);
      setWorkloads(calculatedWorkloads);

      // 3. Calcular Embudo de Procesos
      const stageCountMap = new Map<string, { sequence: number; name: string; count: number }>();
      for (const p of processes) {
        const key = p.name || `Paso ${p.sequence}`;
        const current = stageCountMap.get(key) || { sequence: p.sequence, name: key, count: 0 };
        current.count++;
        stageCountMap.set(key, current);
      }
      const stages: FunnelStage[] = Array.from(stageCountMap.entries())
        .map(([code, data]) => ({ code, sequence: data.sequence, name: data.name, count: data.count }))
        .sort((a, b) => a.sequence - b.sequence);
      setFunnelStages(stages);

      setIsLoading(false);
    }

    loadData();
  }, []);

  const savePrefToggle = async (key: keyof AdminDashboardLayoutPrefs) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('user_preferences').upsert({
        user_id: user.id,
        key: 'admin_dashboard_layout',
        value: updated,
      });
    }
  };

  if (isLoading || !kpis) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span>Cargando métricas y distribución del estudio...</span>
      </div>
    );
  }

  const monthlyChange = kpis.monthlyVariation;

  return (
    <div className="space-y-6">
      {/* Barra Superior con Selector de Configuración de Layout */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Tablero General del Estudio</h1>
          <p className="text-xs text-muted-foreground">
            Métricas operativas consolidadas conforme al Diccionario de KPIs Único.
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Configurar Vista</span>
          </button>
          {showConfig && (
            <div className="absolute right-0 mt-2 w-56 p-3 rounded-2xl border border-border bg-card shadow-lg z-20 space-y-2 text-xs">
              <p className="font-bold text-foreground mb-1">Widgets Visibles</p>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Dona de Estados</span>
                <input type="checkbox" checked={prefs.showDonut} onChange={() => savePrefToggle('showDonut')} className="rounded text-primary" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Embudo de Procesos</span>
                <input type="checkbox" checked={prefs.showFunnel} onChange={() => savePrefToggle('showFunnel')} className="rounded text-primary" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Carga de Analistas</span>
                <input type="checkbox" checked={prefs.showWorkload} onChange={() => savePrefToggle('showWorkload')} className="rounded text-primary" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span>Bandeja &quot;Qué Hago Hoy&quot;</span>
                <input type="checkbox" checked={prefs.showTodayTasks} onChange={() => savePrefToggle('showTodayTasks')} className="rounded text-primary" />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Grid de Tarjetas KPI con Variación Mensual */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          title="Total Casos"
          value={kpis.totalCases}
          icon={<Briefcase className="w-4 h-4" />}
          change={{
            value: `${monthlyChange.percentChange >= 0 ? '+' : ''}${monthlyChange.percentChange}%`,
            trend: monthlyChange.percentChange >= 0 ? 'up' : 'down',
            label: 'vs mes anterior',
          }}
        />
        <KpiCard
          title="En Proceso"
          value={kpis.activeCases}
          icon={<Clock className="w-4 h-4" />}
          description="Casos no finalizados"
        />
        <KpiCard
          title="Finalizados"
          value={kpis.completedCases}
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          description="Sucesiones concluidas"
        />
        <KpiCard
          title="Vencidos"
          value={kpis.overdueCases}
          icon={<AlertTriangle className="w-4 h-4 text-destructive" />}
          description="Con fecha SLA superada"
          className={kpis.overdueCases > 0 ? 'border-destructive/30 bg-destructive/5' : ''}
        />
        <KpiCard
          title="Sin Abogado"
          value={kpis.casesWithoutLawyer}
          icon={<UserX className="w-4 h-4 text-amber-500" />}
          description="Casos sin letrado asignado"
          className={kpis.casesWithoutLawyer > 0 ? 'border-amber-500/30 bg-amber-500/5' : ''}
        />
        <KpiCard
          title="Avance Prom."
          value={`${kpis.avgProgress}%`}
          icon={<TrendingUp className="w-4 h-4 text-primary" />}
          description="Ponderado por trigger"
        />
      </div>

      {/* Bandeja Qué Hago Hoy para alertas de alto impacto */}
      {prefs.showTodayTasks && <TodayTasksWidget cases={rawCases} />}

      {/* Widgets Inferiores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {prefs.showDonut && <StatusDonutChart distribution={kpis.distribution} />}
        {prefs.showFunnel && <ProcessFunnelWidget stages={funnelStages} totalActiveCases={kpis.activeCases} />}
      </div>

      {prefs.showWorkload && (
        <div>
          <AnalystWorkloadWidget workloads={workloads} />
        </div>
      )}
    </div>
  );
};
