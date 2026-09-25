'use client';

import React from 'react';
import Link from 'next/link';
import { DataTable, Column } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import type { CaseItem } from '@workflow/shared';

interface CasesTableProps {
  cases: CaseItem[];
  isLoading: boolean;
}

export const CasesTable: React.FC<CasesTableProps> = ({ cases, isLoading }) => {
  const columns: Column<CaseItem>[] = [
    {
      id: 'case_number',
      header: 'N.º Expediente',
      accessorKey: 'case_number',
      cell: (row) => (
        <span className="font-mono text-xs font-bold text-foreground">{row.case_number}</span>
      ),
    },
    {
      id: 'title',
      header: 'Título / Materia',
      accessorKey: 'title',
      cell: (row) => (
        <div className="space-y-0.5">
          <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
            <span>{row.title}</span>
            {row.is_confidential && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                title="Caso Confidencial"
              >
                <ShieldAlert className="w-2.5 h-2.5" />
                Confidencial
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
            <span>Vía: {row.route}</span>
            <span>•</span>
            <span>Prioridad: {row.priority}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'client',
      header: 'Contratante',
      accessorKey: 'client_person_id',
      cell: (row) => (
        <div className="text-xs text-foreground">
          {row.client_person ? (
            <div>
              <div className="font-medium">
                {row.client_person.person_type === 'JURIDICA'
                  ? row.client_person.legal_name
                  : `${row.client_person.first_name || ''} ${row.client_person.last_name || ''}`}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono">
                {row.client_person.identity_document_type}:{' '}
                {row.client_person.identity_document_number}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      id: 'responsible',
      header: 'Responsable',
      accessorKey: 'responsible',
      cell: (row) => (
        <div className="text-xs">
          {row.responsible ? (
            <div>
              <div className="font-medium text-foreground">
                {row.responsible.first_name} {row.responsible.last_name}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono">
                {row.responsible.email}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </div>
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
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <DataTable<CaseItem>
        data={cases}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyTitle="No hay casos registrados"
        emptyDescription="Inicie un nuevo expediente desde el asistente guiado."
      />
    </div>
  );
};
