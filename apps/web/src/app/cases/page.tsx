'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/AppShell';
import { KpiCard } from '../../components/ui/KpiCard';
import { CaseWizardModal } from '../../components/cases/CaseWizardModal';
import { CaseCard } from '../../components/cases/CaseCard';
import { CasesTable } from '../../components/cases/CasesTable';
import { createClient } from '../../lib/supabase/client';
import { Briefcase, Plus, Search, CheckCircle2, Clock, LayoutGrid, List } from 'lucide-react';
import type { CaseItem } from '@workflow/shared';

export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DONE'>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const fetchCases = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('cases')
        .select(
          `
          *,
          client_person:persons!cases_client_person_id_fkey (
            id,
            person_type,
            identity_document_type,
            identity_document_number,
            first_name,
            last_name,
            legal_name
          ),
          case_assignments (
            assignment_type,
            user_id,
            profiles (
              email,
              first_name,
              last_name
            )
          )
        `,
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rawCases = data as unknown as (CaseItem & {
        case_assignments?: {
          assignment_type: string;
          user_id: string;
          profiles?: { email: string; first_name: string | null; last_name: string | null };
        }[];
      })[];

      const formatted: CaseItem[] = (rawCases || []).map((c) => {
        const respAssignment = c.case_assignments?.find((a) => a.assignment_type === 'RESPONSIBLE');
        return {
          ...c,
          current_progress: Number(c.current_progress || 0),
          responsible: respAssignment?.profiles
            ? {
                id: respAssignment.user_id,
                email: respAssignment.profiles.email,
                first_name: respAssignment.profiles.first_name,
                last_name: respAssignment.profiles.last_name,
              }
            : undefined,
        };
      });

      setCases(formatted);
    } catch (err) {
      // Handled gracefully
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const matchesSearch =
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.case_number.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'ACTIVE') {
        return c.status !== 'COMPLETED' && c.status !== 'ARCHIVED';
      }
      if (statusFilter === 'DONE') {
        return c.status === 'COMPLETED' || c.status === 'ARCHIVED';
      }
      return true;
    });
  }, [cases, searchQuery, statusFilter]);

  const totalCases = cases.length;
  const activeCases = cases.filter(
    (c) => c.status !== 'COMPLETED' && c.status !== 'ARCHIVED',
  ).length;
  const completedCases = cases.filter((c) => c.status === 'COMPLETED').length;

  return (
    <AppShell breadcrumbs={[{ label: 'Inicio', href: '/cases' }, { label: 'Casos' }]}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-primary" />
              Gestión de Casos Sucesorios
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Expedientes, procesos y avance ponderado gobernado por reglas de negocio.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsWizardOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Caso</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard title="Total Expedientes" value={totalCases} icon={<Briefcase />} />
          <KpiCard title="En Trámite" value={activeCases} icon={<Clock />} />
          <KpiCard title="Concluidos" value={completedCases} icon={<CheckCircle2 />} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 bg-card p-3 rounded-xl border border-border">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por N.º de caso o título..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs"
            />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5">
              {(['ALL', 'ACTIVE', 'DONE'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    statusFilter === filter
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {filter === 'ALL' ? 'Todos' : filter === 'ACTIVE' ? 'En Trámite' : 'Concluidos'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded text-xs ${
                  viewMode === 'table'
                    ? 'bg-card text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Vista Tabla"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded text-xs ${
                  viewMode === 'cards'
                    ? 'bg-card text-foreground shadow-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Vista Tarjetas"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'table' ? (
          <CasesTable cases={filteredCases} isLoading={isLoading} />
        ) : (
          <div>
            {isLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Cargando casos...</div>
            ) : filteredCases.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground bg-card rounded-xl border border-border">
                No hay casos registrados con los filtros aplicados.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCases.map((c) => (
                  <CaseCard key={c.id} caseItem={c} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <CaseWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onCaseCreated={(newId) => router.push(`/cases/${newId}`)}
      />
    </AppShell>
  );
}
