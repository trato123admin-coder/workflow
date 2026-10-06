'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  User,
  Building,
  Loader2,
} from 'lucide-react';
import { createClient } from '../../lib/supabase/client';
import { checkM1ClosingGates } from '@workflow/shared';
import {
  CaseDocumentItemRow,
  type EnrichedCaseDocument,
  type RawDocRow,
  type RolePermCheck,
} from '../documents/CaseDocumentItemRow';
import { FileUploader } from '../documents/FileUploader';
import { DocumentVersionsModal } from '../documents/DocumentVersionsModal';
import { DocumentStatusModal } from '../documents/DocumentStatusModal';
import { requestDocumentDownloadUrl } from '../../lib/engine-client';

interface CaseDocumentsTabProps {
  caseId: string;
}

export const CaseDocumentsTab: React.FC<CaseDocumentsTabProps> = ({ caseId }) => {
  const [documents, setDocuments] = useState<EnrichedCaseDocument[]>([]);
  const [activeScope, setActiveScope] = useState<'CASO' | 'PERSONA' | 'BIEN'>('CASO');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canApprove, setCanApprove] = useState(false);

  // Modales
  const [selectedUploadDoc, setSelectedUploadDoc] = useState<EnrichedCaseDocument | null>(null);
  const [selectedHistoryDoc, setSelectedHistoryDoc] = useState<EnrichedCaseDocument | null>(null);
  const [statusModalDoc, setStatusModalDoc] = useState<EnrichedCaseDocument | null>(null);
  const [targetStatus, setTargetStatus] = useState<'VALIDATED' | 'OBSERVED' | null>(null);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();

      // Verificar permiso documents.approve del usuario (is_superuser o permiso explícito)
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('roles(is_superuser, is_active, role_permissions(permissions(code)))')
          .eq('user_id', userData.user.id);

        const roleList = (userRoles || []) as unknown as RolePermCheck[];
        const hasApprove = roleList.some((ur) => {
          const r = ur.roles;
          if (!r?.is_active) return false;
          if (r.is_superuser) return true;
          return r.role_permissions?.some((rp) => rp.permissions?.code === 'documents.approve');
        });
        setCanApprove(Boolean(hasApprove));
      }

      // Cargar slots de documentos del expediente
      const { data, error } = await supabase
        .from('case_documents')
        .select(
          `
          id, case_id, status, is_required, notes, current_version_id, is_active,
          document_types!inner (code, name, category, scope, party_role, asset_type),
          persons (id, first_name, last_name, legal_name),
          case_assets (id, asset_type, registry_ref, description),
          current_version:document_versions!fk_case_documents_current_version (id, version, file_name, size_bytes, mime_type)
        `,
        )
        .eq('case_id', caseId)
        .eq('is_active', true)
        .order('id');

      if (error) throw error;

      const mapped: EnrichedCaseDocument[] = ((data || []) as unknown as RawDocRow[]).map(
        (row) => ({
          id: row.id,
          case_id: row.case_id,
          status: row.status,
          is_required: row.is_required,
          is_active: Boolean(row.is_active),
          notes: row.notes,
          current_version_id: row.current_version_id,
          document_type: row.document_types,
          person: row.persons,
          asset: row.case_assets,
          current_version: row.current_version,
        }),
      );

      setDocuments(mapped);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al cargar documentos del caso');
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleSyncSlots = async () => {
    setIsSyncing(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('sync_case_document_slots', { _case_id: caseId });
      if (error) throw error;
      await loadDocuments();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al sincronizar slots');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownload = async (versionId: string) => {
    try {
      const result = await requestDocumentDownloadUrl(versionId);
      window.open(result.download_url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al iniciar descarga');
    }
  };

  const m1Status = checkM1ClosingGates(documents);
  const filteredDocs = documents.filter((d) => d.document_type.scope === activeScope);

  const scopeCounts = {
    CASO: documents.filter((d) => d.document_type.scope === 'CASO').length,
    PERSONA: documents.filter((d) => d.document_type.scope === 'PERSONA').length,
    BIEN: documents.filter((d) => d.document_type.scope === 'BIEN').length,
  };

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Barra de compuertas M1 y sincronización */}
      <div className="p-4 rounded-2xl border border-border bg-surface flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground">
              Compuertas de Cierre Documentario (M1):
            </span>
            {m1Status.canClose ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Requisitos obligatorios cumplidos</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Documentos pendientes bloquean el avance/cierre</span>
              </span>
            )}
          </div>
          {!m1Status.canClose && (
            <p className="text-[11px] text-muted-foreground">
              {m1Status.blockingReasons.join('. ')}. Todos los documentos requeridos deben estar en
              estado Validado.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSyncSlots}
          disabled={isSyncing || isLoading}
          className="px-3.5 py-2 rounded-xl border border-input text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 flex items-center gap-1.5 self-start md:self-auto shrink-0"
          title="Sincronizar slots según partes y bienes registrados"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>Sincronizar Slots</span>
        </button>
      </div>

      {/* Pestañas de Ámbito: Caso, Persona, Bien */}
      <div className="flex items-center gap-2 border-b border-border pb-2 text-xs">
        <button
          type="button"
          onClick={() => setActiveScope('CASO')}
          className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-colors ${
            activeScope === 'CASO'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Caso ({scopeCounts.CASO})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveScope('PERSONA')}
          className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-colors ${
            activeScope === 'PERSONA'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Por Persona ({scopeCounts.PERSONA})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveScope('BIEN')}
          className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-colors ${
            activeScope === 'BIEN'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Por Bien ({scopeCounts.BIEN})</span>
        </button>
      </div>

      {/* Lista de documentos */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Cargando checklist documentario…</span>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-surface text-xs text-muted-foreground">
          No hay documentos asignados en el ámbito {activeScope.toLowerCase()}. Si acaba de añadir
          personas o bienes, haga clic en &quot;Sincronizar Slots&quot;.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredDocs.map((doc) => (
            <CaseDocumentItemRow
              key={doc.id}
              doc={doc}
              onOpenUpload={(d) => setSelectedUploadDoc(d)}
              onOpenHistory={(d) => setSelectedHistoryDoc(d)}
              onOpenStatusModal={(d, s) => {
                setStatusModalDoc(d);
                setTargetStatus(s);
              }}
              onDownload={handleDownload}
              canApprove={canApprove}
            />
          ))}
        </div>
      )}

      {/* Modales */}
      {selectedUploadDoc && (
        <FileUploader
          caseDocumentId={selectedUploadDoc.id}
          documentTitle={selectedUploadDoc.document_type.name}
          isOpen={Boolean(selectedUploadDoc)}
          onClose={() => setSelectedUploadDoc(null)}
          onSuccess={() => void loadDocuments()}
        />
      )}

      {selectedHistoryDoc && (
        <DocumentVersionsModal
          caseDocumentId={selectedHistoryDoc.id}
          documentTitle={selectedHistoryDoc.document_type.name}
          isOpen={Boolean(selectedHistoryDoc)}
          onClose={() => setSelectedHistoryDoc(null)}
        />
      )}

      {statusModalDoc && targetStatus && (
        <DocumentStatusModal
          caseDocumentId={statusModalDoc.id}
          documentTitle={statusModalDoc.document_type.name}
          targetStatus={targetStatus}
          isOpen={Boolean(statusModalDoc)}
          onClose={() => {
            setStatusModalDoc(null);
            setTargetStatus(null);
          }}
          onSuccess={() => void loadDocuments()}
        />
      )}
    </div>
  );
};
