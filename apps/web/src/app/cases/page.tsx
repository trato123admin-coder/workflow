'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/AppShell';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { KpiCard } from '../../components/ui/KpiCard';
import { CaseWizardModal } from '../../components/cases/CaseWizardModal';
import { createClient } from '../../lib/supabase/client';
import {
  Briefcase,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import type { CaseItem } from '@workflow/shared';

export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DONE'>('ALL');
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
        c.case_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (statusFilter === 'ACTIVE') return c.status !== 'COMPLETED' && c.status !== 'CANCELLED';
      if (statusFilter === 'DONE') return c.status === 'COMPLETED';
      return true;
    });
  }, [cases, searchQuery, statusFilter]);

  const totalCases = cases.length;
  const activeCases = cases.filter(
    (c) => c.status !== 'COMPLETED' && c.status !== 'CANCELLED',
  ).length;
  const completedCases = cases.filter((c) => c.status === 'COMPLETED').length;

  const columns: Column<CaseItem>[] = [
    {
      id: 'case_number',
      header: 'Expediente',
      accessorKey: 'case_number',
      cell: (row) => (
        <div>
          <Link
            href={`/cases/${row.id}`}
            className="font-mono font-bold text-primary hover:underline text-xs"
          >
            {row.case_number}
          </Link>
          <div className="text-[11px] text-muted-foreground">{row.route}</div>
        </div>
      ),
    },
    {
      id: 'title',
      header: 'Título y Cliente',
      accessorKey: 'title',
      cell: (row) => {
        const p = row.client_person;
        const clientName = p
          ? p.person_type === 'JURIDICA'
            ? p.legal_name
            : `${p.first_name || ''} ${p.last_name || ''}`.trim()
          : 'Cliente sin asignar';
        return (
          <div>
            <div className="font-semibold text-foreground text-xs flex items-center gap-1.5">
              <span>{row.title}</span>
              {row.is_confidential && (
                <span title="Confidencial">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">{clientName}</div>
          </div>
        );
      },
    },
    {
      id: 'responsible',
      header: 'Responsable',
      accessorKey: 'responsible',
      cell: (row) => (
        <span className="text-xs text-foreground">
          {row.responsible
            ? `${row.responsible.first_name || ''} ${row.responsible.last_name || ''}`.trim() ||
              row.responsible.email
            : 'Sin asignar'}
        </span>
      ),
    },
    {
      id: 'progress',
      header: 'Avance Ponderado',
      accessorKey: 'current_progress',
      cell: (row) => (
        <div className="w-28 space-y-1">
          <div className="flex justify-between text-[11px] font-mono">
            <span className="font-semibold text-foreground">
              {Number(row.current_progress).toFixed(2)}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, row.current_progress))}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Estado',
      accessorKey: 'status',
      cell: (row) => (
        <StatusBadge
          category={row.status === 'COMPLETED' ? 'success' : 'info'}
          label={row.status}
        />
      ),
    },
    {
      id: 'actions',
      header: 'Acción',
      accessorKey: 'id',
      cell: (row) => (
        <Link
          href={`/cases/${row.id}`}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted"
        >
          <span>Ver caso</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      ),
    },
  ];

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

          <div className="flex items-center gap-1.5 shrink-0">
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
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <DataTable<CaseItem>
            data={filteredCases}
            columns={columns}
            keyExtractor={(item) => item.id}
            isLoading={isLoading}
            emptyTitle="No hay casos registrados"
            emptyDescription="Inicie un nuevo expediente desde el asistente guiado."
          />
        </div>
      </div>

      <CaseWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onCaseCreated={(newId) => router.push(`/cases/${newId}`)}
      />
    </AppShell>
  );
}
