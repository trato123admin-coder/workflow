'use client';

import React, { useState } from 'react';
import { Lock, Plus, ToggleLeft, ToggleRight, AlertCircle, Database } from 'lucide-react';
import type { Catalog, CatalogItem } from '@workflow/shared';
import { ConfirmImpactDialog } from '../ui/ConfirmImpactDialog';
import { usageResolvers } from '@workflow/shared';

interface CatalogEditorProps {
  catalogs: Catalog[];
  items: CatalogItem[];
  onToggleActive?: (catalogCode: string, itemCode: string, nextActive: boolean) => Promise<void>;
  onCreateItem?: (item: {
    catalog_code: string;
    code: string;
    label: string;
    description?: string;
  }) => Promise<void>;
}

export const CatalogEditor: React.FC<CatalogEditorProps> = ({
  catalogs,
  items,
  onToggleActive,
  onCreateItem,
}) => {
  const [selectedCatalogCode, setSelectedCatalogCode] = useState<string>(
    catalogs[0]?.code || 'identity_document_types',
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Estado para ConfirmImpactDialog
  const [impactTarget, setImpactTarget] = useState<CatalogItem | null>(null);
  const [impactUsage, setImpactUsage] = useState<{
    count: number;
    locations: string[];
    canSafelyDeactivate: boolean;
    blockingReason?: string;
  }>({ count: 0, locations: [], canSafelyDeactivate: true });

  const selectedCatalog = catalogs.find((c) => c.code === selectedCatalogCode);
  const catalogItems = items.filter((i) => i.catalog_code === selectedCatalogCode);

  const handleToggleClick = async (item: CatalogItem) => {
    if (item.is_active) {
      // Va a desactivar -> Consultar resolutor de uso y abrir diálogo de impacto
      const usage = await usageResolvers.resolveUsage(item.catalog_code, item.code);
      setImpactUsage(usage);
      setImpactTarget(item);
    } else {
      // Va a activar directamente
      await onToggleActive?.(item.catalog_code, item.code, true);
    }
  };

  const handleConfirmDeactivation = async () => {
    if (impactTarget) {
      await onToggleActive?.(impactTarget.catalog_code, impactTarget.code, false);
      setImpactTarget(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!newCode.trim() || !newLabel.trim()) {
      setErrorMsg('El código y la etiqueta son requeridos');
      return;
    }

    try {
      await onCreateItem?.({
        catalog_code: selectedCatalogCode,
        code: newCode.trim().toUpperCase(),
        label: newLabel.trim(),
        description: newDesc.trim() || undefined,
      });
      setIsModalOpen(false);
      setNewCode('');
      setNewLabel('');
      setNewDesc('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al crear elemento');
    }
  };

  return (
    <div className="space-y-6">
      {/* Selector de Catálogo */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-primary" />
          <div>
            <label htmlFor="catalog-select" className="text-xs font-semibold text-foreground block">
              Catálogo Activo
            </label>
            <p className="text-[11px] text-muted-foreground">
              {selectedCatalog?.description ||
                'Seleccione un catálogo para gestionar sus elementos'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            id="catalog-select"
            value={selectedCatalogCode}
            onChange={(e) => setSelectedCatalogCode(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-input bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-64"
          >
            {catalogs.map((cat) => (
              <option key={cat.code} value={cat.code}>
                {cat.name} ({cat.module})
              </option>
            ))}
          </select>

          {selectedCatalog?.allow_new_items && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shrink-0 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Elementos */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Etiqueta</th>
                <th className="py-3 px-4">Descripción</th>
                <th className="py-3 px-4 text-center">Protección</th>
                <th className="py-3 px-4 text-center">En Uso</th>
                <th className="py-3 px-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {catalogItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No hay elementos registrados en este catálogo
                  </td>
                </tr>
              ) : (
                catalogItems.map((item) => (
                  <tr key={item.code} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-foreground">
                      {item.code}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">{item.label}</td>
                    <td className="py-3 px-4 text-muted-foreground">{item.description || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      {item.is_system ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                          <Lock className="w-3 h-3" /> Sistema
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Personalizado</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-muted text-muted-foreground">
                        En uso (0)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleClick(item)}
                        className="inline-flex items-center gap-1 text-xs font-medium cursor-pointer"
                        title={item.is_active ? 'Desactivar elemento' : 'Activar elemento'}
                      >
                        {item.is_active ? (
                          <ToggleRight className="w-6 h-6 text-primary" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-muted-foreground" />
                        )}
                        <span
                          className={
                            item.is_active ? 'text-primary font-semibold' : 'text-muted-foreground'
                          }
                        >
                          {item.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Crear Elemento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card text-card-foreground border border-border w-full max-w-md rounded-xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-foreground">
              Agregar Elemento a: {selectedCatalog?.name}
            </h3>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Código (Inmutable) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="EJEMPLO_CODIGO"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Etiqueta *</label>
                <input
                  type="text"
                  required
                  placeholder="Nombre visible para usuarios"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-input bg-background text-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                >
                  Guardar Elemento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Diálogo de Impacto */}
      {impactTarget && (
        <ConfirmImpactDialog
          isOpen={Boolean(impactTarget)}
          onClose={() => setImpactTarget(null)}
          onConfirm={handleConfirmDeactivation}
          title="Desactivar Elemento de Catálogo"
          itemName={impactTarget.label}
          itemCode={impactTarget.code}
          usage={impactUsage}
          isDeactivating={true}
        />
      )}
    </div>
  );
};
