'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { createClient } from '../../lib/supabase/client';
import { EntityModal } from '../../components/entities/EntityModal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  Building2,
  Plus,
  Search,
  MapPin,
  FileText,
  Phone,
  Mail,
  Edit2,
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
            {filteredEntities.map((ent) => {
              const contacts = Array.isArray(ent.contacts) ? ent.contacts : [];
              const entityId = ent.id || '';
              return (
                <div
                  key={entityId}
                  className={`p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col justify-between transition-all ${
                    ent.is_active ? 'border-border' : 'border-border/50 opacity-60'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                          {getTypeLabel(ent.entity_type)}
                        </span>
                        <h3 className="text-sm font-bold text-foreground mt-1.5 line-clamp-1">
                          {ent.name}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEntity(ent);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
                        title="Editar entidad"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1">
                      {ent.tax_id && (
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span>RUC: {ent.tax_id}</span>
                        </div>
                      )}
                      {(ent.city || ent.address) && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {[ent.address, ent.city].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Contactos */}
                    <div className="pt-2 border-t border-border">
                      <p className="text-[11px] font-semibold text-foreground mb-1">
                        Contactos ({contacts.length}):
                      </p>
                      {contacts.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic">
                          Sin contactos registrados
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                          {contacts.map((c, i) => (
                            <div
                              key={i}
                              className="text-[11px] p-1.5 rounded bg-muted/50 border border-border/50"
                            >
                              <div className="font-semibold text-foreground flex justify-between">
                                <span>{c.name}</span>
                                {c.role && (
                                  <span className="text-muted-foreground font-normal">
                                    {c.role}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2 text-muted-foreground mt-0.5">
                                {c.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {c.phone}
                                  </span>
                                )}
                                {c.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {c.email}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-border flex items-center justify-between">
                    <StatusBadge
                      category={ent.is_active ? 'success' : 'neutral'}
                      label={ent.is_active ? 'Activa' : 'Inactiva'}
                      size="sm"
                    />
                    {entityId && (
                      <button
                        type="button"
                        onClick={() => handleToggleActive(entityId, ent.is_active)}
                        className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                      >
                        {ent.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
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
