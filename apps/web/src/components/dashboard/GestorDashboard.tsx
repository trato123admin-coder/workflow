'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  LayoutGrid,
  List,
  Search,
  Loader2,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { KpiCard } from '../ui/KpiCard';
import { CaseCard } from '../cases/CaseCard';
import { TodayTasksWidget } from './TodayTasksWidget';
import {
  computeGestorKPIs,
  type GestorKPIs,
  type KPICaseInput,
  type KPIStatusInput,
  type KPIAssignmentInput,
  type CaseItem,
} from '@workflow/shared';
import { createClient } from '../../lib/supabase/client';

export const GestorDashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [kpis, setKpis] = useState<GestorKPIs | null>(null);
  const [myCases, setMyCases] = useState<CaseItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  useEffect(() => {
    async function loadGestorData() {
      setIsLoading(true);
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const [profRes, casesRes, statusesRes, asgRes, prefsRes] = await Promise.all([
        supabase.from('profiles').select('first_name, last_name, email').eq('id', user.id).single(),
        supabase.from('cases').select(`
          id, case_number, title, route, status, priority, is_confidential, has_dispute,
          ai_allowed, current_progress, last_activity_at, created_at, updated_at,
          client_person_id, case_model_version_id, status_id, due_date,
          client_person:persons(id, person_type, identity_document_type, identity_document_number, first_name, last_name, legal_name)
        `),
        supabase.from('workflow_statuses').select('id, code, name, category, sort_order').eq('is_active', true),
        supabase.from('case_assignments').select('case_id, user_id, assignment_type, is_primary, ended_at'),
        supabase.from('user_preferences').select('value').eq('key', 'gestor_view_mode').maybeSingle(),
      ]);

      if (profRes.data) {
        const full = `${profRes.data.first_name || ''} ${profRes.data.last_name || ''}`.trim();
        setUserName(full || profRes.data.email || 'Gestor');
      }

      if (prefsRes.data?.value?.mode) {
        setViewMode(prefsRes.data.value.mode);
      }

      const allCases = (casesRes.data || []) as unknown as (CaseItem & KPICaseInput)[];
      const statuses = (statusesRes.data || []) as unknown as KPIStatusInput[];
      const assignments = (asgRes.data || []) as unknown as KPIAssignmentInput[];

      // Filtrar expedientes asignados al gestor actual
      const assignedIds = new Set(
        assignments.filter((a) => a.user_id === user.id && !a.ended_at).map((a) => a.case_id)
      );
      const assignedCases = allCases.filter((c) => assignedIds.has(c.id));
      setMyCases(assignedCases);

      // Calcular KPIs personales usando el diccionario unificado
      const calculatedKpis = computeGestorKPIs(assignedCases, assignments, user.id, statuses);
      setKpis(calculatedKpis);

      setIsLoading(false);
    }

    loadGestorData();
  }, []);

  const handleChangeViewMode = async (mode: 'cards' | 'list') => {
    setViewMode(mode);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('user_preferences').upsert({
        user_id: user.id,
        key: 'gestor_view_mode',
        value: { mode },
      });
    }
  };

  const filteredCases = myCases.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const num = (c.case_number || '').toLowerCase();
    const tit = (c.title || '').toLowerCase();
    const client = c.client_person
      ? `${c.client_person.first_name || ''} ${c.client_person.last_name || ''} ${c.client_person.legal_name || ''}`.toLowerCase()
      : '';
    return num.includes(q) || tit.includes(q) || client.includes(q);
  });

  if (isLoading || !kpis) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span>Cargando tu bandeja y expedientes asignados...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Saludo Personalizado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-foreground">Hola, {userName}</h1>
          <p className="text-xs text-muted-foreground">
            Revisa tus tareas de hoy y el progreso de los expedientes que tienes a cargo.
          </p>
        </div>
      </div>

      {/* Tarjetas de KPIs Personales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          title="Mis Expedientes"
          value={kpis.myTotalCases}
          icon={<Briefcase className="w-4 h-4" />}
          description="Casos con asignación activa"
        />
        <KpiCard
          title="En Curso"
          value={kpis.myActiveCases}
          icon={<Clock className="w-4 h-4" />}
          description="Expedientes abiertos"
        />
        <KpiCard
          title="Finalizados"
          value={kpis.myCompletedCases}
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          description="Casos concluidos"
        />
        <KpiCard
          title="Vencidos"
          value={kpis.myOverdueCases}
          icon={<AlertTriangle className="w-4 h-4 text-destructive" />}
          description="Plazo SLA superado"
          className={kpis.myOverdueCases > 0 ? 'border-destructive/30 bg-destructive/5' : ''}
        />
        <KpiCard
          title="Avance Promedio"
          value={`${kpis.myAvgProgress}%`}
          icon={<TrendingUp className="w-4 h-4 text-primary" />}
          description="En mis casos activos"
        />
      </div>

      {/* Bandeja de Tareas Prioritarias: ¿Qué Hago Hoy? */}
      <TodayTasksWidget cases={myCases as unknown as (KPICaseInput & { title: string; case_number: string })[]} />

      {/* Sección Mis Casos Asignados */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-foreground">Mis Expedientes ({myCases.length})</h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Buscador de expedientes asignados */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filtrar por n° o cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary w-48 sm:w-64"
              />
            </div>

            {/* Selector de Vista Tarjetas / Lista con persistencia */}
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => handleChangeViewMode('cards')}
                className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-card text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Vista Tarjetas"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tarjetas</span>
              </button>
              <button
                type="button"
                onClick={() => handleChangeViewMode('list')}
                className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-card text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Vista Lista"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Lista</span>
              </button>
            </div>
          </div>
        </div>

        {filteredCases.length === 0 ? (
          <div className="p-8 rounded-2xl border border-border bg-card text-center text-xs text-muted-foreground">
            No se encontraron expedientes asignados que coincidan con la búsqueda.
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCases.map((c) => (
              <CaseCard key={c.id} caseItem={c} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3">Expediente</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Vía</th>
                  <th className="p-3">Avance</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCases.map((c) => {
                  const client = c.client_person
                    ? c.client_person.person_type === 'JURIDICA'
                      ? c.client_person.legal_name || 'Empresa'
                      : `${c.client_person.first_name || ''} ${c.client_person.last_name || ''}`.trim()
                    : 'Sin cliente';
                  return (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-foreground">{c.case_number}</span>
                          {c.is_confidential && <Lock className="w-3 h-3 text-destructive" />}
                        </div>
                        <span className="text-[11px] text-muted-foreground line-clamp-1">{c.title}</span>
                      </td>
                      <td className="p-3 text-muted-foreground">{client}</td>
                      <td className="p-3 font-semibold text-primary">{c.route}</td>
                      <td className="p-3 font-mono">{Number(c.current_progress || 0).toFixed(1)}%</td>
                      <td className="p-3 text-right">
                        <Link
                          href={`/cases/${c.id}`}
                          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                        >
                          <span>Ver</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
