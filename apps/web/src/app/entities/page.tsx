'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { createClient } from '../../lib/supabase/client';
import { EntityModal } from '../../components/entities/EntityModal';
import { EntityCard } from '../../components/entities/EntityCard';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  Building2,
  Plus,
  Search,
  Loader2,
} from 'lucide-react';
import type { ExternalEntity } from '@workflow/shared';

interface CatalogTypeItem {
  code: string;
  label: string;
}

export default function EntitiesDirectoryPage() {
  const [entities, setEntities] = useState<ExternalEntity[]>([]);
  const [entityTypes, setEntityTypes] = useState<CatalogTypeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<ExternalEntity | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();

      const [typesRes, entitiesRes] = await Promise.all([
        supabase
          .from('catalog_items')
          .select('code, label')
          .eq('catalog_code', 'external_entity_types')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('external_entities')
          .select('*')
          .order('name', { ascending: true }),
      ]);

      if (typesRes.error) throw typesRes.error;
      if (entitiesRes.error) throw entitiesRes.error;

      setEntityTypes((typesRes.data as CatalogTypeItem[]) || []);
      setEntities((entitiesRes.data as ExternalEntity[]) || []);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al cargar directorio de entidades');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('external_entities')
        .update({ is_active: !current })
        .eq('id', id);

      if (error) throw error;
      setEntities((prev) =>
        prev.map((e) => (e.id === id ? { ...e, is_active: !current } : e)),
      );
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al cambiar estado de la entidad');
    }
  };

  const filteredEntities = entities.filter((e) => {
    const matchesType = selectedType === 'ALL' || e.entity_type === selectedType;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      query === '' ||
      e.name.toLowerCase().includes(query) ||
      (e.city && e.city.toLowerCase().includes(query)) ||
      (e.tax_id && e.tax_id.includes(query));
    return matchesType && matchesSearch;
  });

  const getTypeLabel = (code: string) => {
    return entityTypes.find((t) => t.code === code)?.label || code;
  };

  return (
    <AppShell
      breadcrumbs={[{ label: 'Inicio', href: '/dashboard' }, { label: 'Directorio de Entidades' }]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <span>Directorio de Entidades Externas</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Notarías, oficinas de SUNARP, estudios jurídicos y bancos vinculados a trámites sucesorios.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingEntity(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Entidad</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs">
            {errorMessage}
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nombre, RUC o ciudad..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-input bg-card text-foreground focus:ring-1 focus:ring-primary shadow-sm"
            />
          </div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-input bg-card text-foreground focus:ring-1 focus:ring-primary shadow-sm"
          >
            <option value="ALL">Todos los tipos ({entities.length})</option>
            {entityTypes.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Grid de Entidades */}
        {isLoading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs">Cargando directorio...</p>
          </div>
        ) : filteredEntities.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-8 h-8 text-muted-foreground" />}
            title="No se encontraron entidades"
            description={
              searchQuery
                ? 'No hay entidades que coincidan con los criterios de búsqueda.'
                : 'Aún no se han registrado entidades externas. Registre la primera con el botón superior.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEntities.map((ent) => (
              <EntityCard
                key={ent.id || ent.name}
                entity={ent}
                typeLabel={getTypeLabel(ent.entity_type)}
                onEdit={() => {
                  setEditingEntity(ent);
                  setIsModalOpen(true);
                }}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>
        )}

        <EntityModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingEntity(null);
          }}
          onSuccess={loadData}
          entity={editingEntity}
          entityTypes={entityTypes}
        />
      </div>
    </AppShell>
  );
}
