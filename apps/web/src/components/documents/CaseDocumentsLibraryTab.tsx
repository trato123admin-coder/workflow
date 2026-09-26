'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { createClient } from '../../lib/supabase/client';
import { DocumentVersionsModal } from './DocumentVersionsModal';
import { DocumentLibraryTable, type LibraryDocumentItem } from './DocumentLibraryTable';
import { requestDocumentDownloadUrl } from '../../lib/engine-client';
import type { CaseDocumentStatus } from '@workflow/shared';

interface RawDocLibraryRow {
  id: string;
  case_id: string;
  status: CaseDocumentStatus;
  is_required: boolean;
  notes?: string | null;
  current_version_id?: string | null;
  cases?: { id: string; case_number: string; title: string } | null;
  document_types?: {
    code: string;
    name: string;
    scope: 'CASO' | 'PERSONA' | 'BIEN';
    nature: string;
  } | null;
  persons?: {
    first_name?: string | null;
    last_name?: string | null;
    legal_name?: string | null;
  } | null;
  case_assets?: {
    asset_type: string;
    registry_ref?: string | null;
    description?: string | null;
  } | null;
  current_version?: { id: string; version: number; file_name: string; size_bytes: number } | null;
}

export const CaseDocumentsLibraryTab: React.FC = () => {
  const [documents, setDocuments] = useState<LibraryDocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedScope, setSelectedScope] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const [historyDocId, setHistoryDocId] = useState<string | null>(null);
  const [historyDocTitle, setHistoryDocTitle] = useState('');

  const loadLibrary = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('case_documents')
        .select(
          `
          id, case_id, status, is_required, notes, current_version_id,
          cases!inner ( id, case_number, title ),
          document_types!inner ( code, name, scope, nature ),
          persons ( first_name, last_name, legal_name ),
          case_assets ( asset_type, registry_ref, description ),
          current_version:document_versions!fk_case_documents_current_version (
            id, version, file_name, size_bytes
          )
        `,
        )
        .eq('is_active', true)
        .order('id', { ascending: false });

      if (error) throw error;

      const rawRows = (data || []) as unknown as RawDocLibraryRow[];
      const mapped: LibraryDocumentItem[] = rawRows.map((row) => {
        let assignedTo: string | null = null;
        if (row.persons) {
          assignedTo =
            row.persons.legal_name ||
            `${row.persons.first_name || ''} ${row.persons.last_name || ''}`.trim();
        } else if (row.case_assets) {
          assignedTo =
            row.case_assets.registry_ref ||
            row.case_assets.description ||
            row.case_assets.asset_type;
        }

        return {
          id: row.id,
          case_id: row.case_id,
          status: row.status,
          is_required: row.is_required,
          notes: row.notes,
          current_version_id: row.current_version_id,
          case_number: row.cases?.case_number || '—',
          case_title: row.cases?.title || '—',
          document_name: row.document_types?.name || 'Documento',
          document_code: row.document_types?.code || 'DOC',
          scope: row.document_types?.scope || 'CASO',
          nature: row.document_types?.nature || 'UPLOADED',
          assigned_to: assignedTo,
          version_number: row.current_version?.version || null,
          file_name: row.current_version?.file_name || null,
          size_bytes: row.current_version?.size_bytes || null,
        };
      });

      setDocuments(mapped);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al cargar documentos');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const handleDownload = async (versionId: string) => {
    try {
      const result = await requestDocumentDownloadUrl(versionId);
      window.open(result.download_url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al generar enlace de descarga');
    }
  };

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        doc.document_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.case_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.file_name && doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesScope = selectedScope === 'ALL' || doc.scope === selectedScope;
      const matchesStatus = selectedStatus === 'ALL' || doc.status === selectedStatus;

      return matchesSearch && matchesScope && matchesStatus;
    });
  }, [documents, searchTerm, selectedScope, selectedStatus]);

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Barra de Filtros y Búsqueda */}
      <div className="p-4 rounded-2xl border border-border bg-card space-y-3 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por documento, n.º de expediente o archivo…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-input bg-surface text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-input bg-surface text-foreground focus:outline-none"
            >
              <option value="ALL">Ámbito: Todos</option>
              <option value="CASO">Caso General</option>
              <option value="PERSONA">Por Persona</option>
              <option value="BIEN">Por Bien</option>
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-input bg-surface text-foreground focus:outline-none"
            >
              <option value="ALL">Estado: Todos</option>
              <option value="PENDING">🔴 Pendientes</option>
              <option value="UPLOADED">🟡 Subidos</option>
              <option value="VALIDATED">🟢 Validados</option>
              <option value="OBSERVED">🟣 Observados</option>
            </select>

            <button
              type="button"
              onClick={loadLibrary}
              disabled={isLoading}
              className="p-2 rounded-xl border border-input text-foreground hover:bg-muted shrink-0"
              title="Actualizar listado"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de Documentos en Casos */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Cargando documentos de expedientes…</span>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-card text-xs text-muted-foreground">
          No se encontraron documentos en casos que coincidan con los filtros aplicados.
        </div>
      ) : (
        <DocumentLibraryTable
          documents={filteredDocs}
          onDownload={handleDownload}
          onOpenHistory={(id, name) => {
            setHistoryDocId(id);
            setHistoryDocTitle(name);
          }}
        />
      )}

      {/* Modal de Historial de Versiones */}
      {historyDocId && (
        <DocumentVersionsModal
          caseDocumentId={historyDocId}
          documentTitle={historyDocTitle}
          isOpen={Boolean(historyDocId)}
          onClose={() => setHistoryDocId(null)}
        />
      )}
    </div>
  );
};
