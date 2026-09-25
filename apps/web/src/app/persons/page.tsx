'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PersonModal } from '../../components/persons/PersonModal';
import { createClient } from '../../lib/supabase/client';
import { Users, Plus, Search, Building2, User, Phone, Mail } from 'lucide-react';
import type { PersonItem } from '@workflow/shared';

export default function PersonsPage() {
  const [persons, setPersons] = useState<PersonItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'NATURAL' | 'JURIDICA'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchPersons = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      let query = supabase.from('persons').select('*').order('created_at', { ascending: false });

      if (typeFilter !== 'ALL') {
        query = query.eq('person_type', typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPersons((data as PersonItem[]) || []);
    } catch (err) {
      // Handled gracefully
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchPersons();
  }, [fetchPersons]);

  const filteredPersons = useMemo(() => {
    if (!searchQuery.trim()) return persons;
    const q = searchQuery.toLowerCase();
    return persons.filter((p) => {
      const doc = `${p.identity_document_type} ${p.identity_document_number}`.toLowerCase();
      const name =
        `${p.first_name || ''} ${p.last_name || ''} ${p.second_last_name || ''} ${p.legal_name || ''}`.toLowerCase();
      const email = (p.email || '').toLowerCase();
      return doc.includes(q) || name.includes(q) || email.includes(q);
    });
  }, [persons, searchQuery]);

  const columns: Column<PersonItem>[] = [
    {
      id: 'document',
      header: 'Documento',
      accessorKey: 'identity_document_number',
      cell: (row) => (
        <span className="font-mono font-semibold text-foreground text-xs">
          {row.identity_document_type} {row.identity_document_number}
        </span>
      ),
    },
    {
      id: 'name',
      header: 'Nombre / Razón Social',
      accessorKey: 'last_name',
      cell: (row) => {
        const isJuridica = row.person_type === 'JURIDICA';
        const title = isJuridica
          ? row.legal_name || 'Razón social no registrada'
          : `${row.first_name || ''} ${row.last_name || ''} ${row.second_last_name || ''}`.trim();
        return (
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-muted text-muted-foreground">
              {isJuridica ? (
                <Building2 className="w-3.5 h-3.5" />
              ) : (
                <User className="w-3.5 h-3.5" />
              )}
            </div>
            <div>
              <span className="font-medium text-foreground">{title}</span>
              {row.trade_name && (
                <div className="text-[11px] text-muted-foreground">{row.trade_name}</div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: 'type',
      header: 'Tipo',
      accessorKey: 'person_type',
      cell: (row) => (
        <span
          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
            row.person_type === 'JURIDICA'
              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
          }`}
        >
          {row.person_type === 'JURIDICA' ? 'Jurídica' : 'Natural'}
        </span>
      ),
    },
    {
      id: 'contact',
      header: 'Contacto',
      accessorKey: 'email',
      cell: (row) => (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {row.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="w-3 h-3 text-muted-foreground" />
              <span>{row.email}</span>
            </div>
          )}
          {row.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-muted-foreground" />
              <span>{row.phone}</span>
            </div>
          )}
          {!row.email && !row.phone && <span>—</span>}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Estado',
      accessorKey: 'is_active',
      cell: (row) => (
        <StatusBadge
          category={row.is_active ? 'success' : 'neutral'}
          label={row.is_active ? 'Activo' : 'Inactivo'}
        />
      ),
    },
  ];

  return (
    <AppShell breadcrumbs={[{ label: 'Inicio', href: '/cases' }, { label: 'Personas' }]}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Directorio de Personas
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Registro y administración de clientes, contratantes y partes intervinientes.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Persona</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 bg-card p-3 rounded-xl border border-border">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por DNI, RUC, nombre o correo..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {(['ALL', 'NATURAL', 'JURIDICA'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  typeFilter === type
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border'
                }`}
              >
                {type === 'ALL' ? 'Todos' : type === 'NATURAL' ? 'Natural' : 'Jurídica'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <DataTable<PersonItem>
            data={filteredPersons}
            columns={columns}
            keyExtractor={(item) => item.id}
            isLoading={isLoading}
            emptyTitle="No hay personas registradas"
            emptyDescription="Comience agregando una nueva persona natural o jurídica con el botón superior."
          />
        </div>
      </div>

      <PersonModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={fetchPersons}
      />
    </AppShell>
  );
}
