'use client';

import React, { useState, useMemo } from 'react';
import {
  FileText,
  UploadCloud,
  ExternalLink,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
} from 'lucide-react';
import { CreateDocumentTypeModal } from './CreateDocumentTypeModal';

export interface DocumentTypeItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category: string;
  nature: 'GENERATED' | 'UPLOADED' | 'EXTERNAL';
  scope: 'CASO' | 'PERSONA' | 'BIEN';
  party_role?: string | null;
  asset_type?: string | null;
  applies_to_person_types?: string[] | null;
  validity_days?: number | null;
  requires_template: boolean;
  is_active: boolean;
}

interface DocumentTypeCatalogTableProps {
  types: DocumentTypeItem[];
  onToggleActive?: (id: string, current: boolean) => Promise<void>;
  onReload?: () => Promise<void> | void;
  canManage?: boolean;
}

export const DocumentTypeCatalogTable: React.FC<DocumentTypeCatalogTableProps> = ({
  types,
  onToggleActive,
  onReload,
  canManage = false,
}) => {
  const [filterTab, setFilterTab] = useState<
    'TODOS' | 'PLANTILLAS' | 'SUBIDOS' | 'EXTERNOS' | 'ACTIVOS'
  >('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filteredTypes = useMemo(() => {
    return types.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      switch (filterTab) {
        case 'PLANTILLAS':
          return item.nature === 'GENERATED';
        case 'SUBIDOS':
          return item.nature === 'UPLOADED';
        case 'EXTERNOS':
          return item.nature === 'EXTERNAL';
        case 'ACTIVOS':
          return item.is_active;
        case 'TODOS':
        default:
          return true;
      }
    });
  }, [types, filterTab, searchTerm]);

  const getNatureBadge = (nature: DocumentTypeItem['nature']) => {
    switch (nature) {
      case 'GENERATED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
            <FileText className="w-3 h-3" /> Plantilla (Generado)
          </span>
        );
      case 'UPLOADED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <UploadCloud className="w-3 h-3" /> Subido
          </span>
        );
      case 'EXTERNAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
            <ExternalLink className="w-3 h-3" /> Externo
          </span>
        );
    }
  };

  const formatApplicability = (item: DocumentTypeItem) => {
    if (item.scope === 'PERSONA') {
      const role = item.party_role ? ` (${item.party_role})` : '';
      const typesList = (item.applies_to_person_types || []).join(', ');
      return `Persona: ${typesList || 'Ambos'}${role}`;
    }
    if (item.scope === 'BIEN') {
      return `Bien: ${item.asset_type || 'General'}`;
    }
    return 'Caso General';
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros y Búsqueda */}
      <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs">
            <button
              type="button"
              onClick={() => setFilterTab('TODOS')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                filterTab === 'TODOS'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Todos ({types.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('PLANTILLAS')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                filterTab === 'PLANTILLAS'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Plantillas ({types.filter((t) => t.nature === 'GENERATED').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('SUBIDOS')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                filterTab === 'SUBIDOS'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Subidos ({types.filter((t) => t.nature === 'UPLOADED').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('EXTERNOS')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                filterTab === 'EXTERNOS'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Externos ({types.filter((t) => t.nature === 'EXTERNAL').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('ACTIVOS')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                filterTab === 'ACTIVOS'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Activos ({types.filter((t) => t.is_active).length})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar tipo o código…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {canManage && (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 flex items-center gap-1.5 transition-colors shrink-0 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Tipo</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabla de Catálogo Maestro */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase">
              <tr>
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Nombre / Categoría</th>
                <th className="py-3 px-4">Naturaleza</th>
                <th className="py-3 px-4">Ámbito y Aplicabilidad</th>
                <th className="py-3 px-4">Vigencia</th>
                <th className="py-3 px-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTypes.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-foreground">{item.code}</td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-foreground">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      Categoría: {item.category}
                    </p>
                  </td>
                  <td className="py-3 px-4">{getNatureBadge(item.nature)}</td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-foreground">{formatApplicability(item)}</span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {item.validity_days ? (
                      <span className="inline-flex items-center gap-1 text-[11px]">
                        <Clock className="w-3 h-3" /> {item.validity_days} días
                      </span>
                    ) : (
                      <span className="text-[11px]">Permanente</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {canManage && onToggleActive ? (
                      <button
                        type="button"
                        onClick={() => void onToggleActive(item.id, item.is_active)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${
                          item.is_active
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                        }`}
                        title="Hacer clic para activar o desactivar"
                      >
                        {item.is_active ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        <span>{item.is_active ? 'Activo' : 'Inactivo'}</span>
                      </button>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          item.is_active
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        {item.is_active ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        <span>{item.is_active ? 'Activo' : 'Inactivo'}</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateOpen && (
        <CreateDocumentTypeModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => {
            if (onReload) void onReload();
          }}
        />
      )}
    </div>
  );
};
