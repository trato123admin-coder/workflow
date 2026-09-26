'use client';

import React from 'react';
import {
  UploadCloud,
  History,
  CheckCircle2,
  AlertTriangle,
  Download,
  FileText,
  Clock,
  AlertCircle,
  Eye,
} from 'lucide-react';
import type { CaseDocumentStatus } from '@workflow/shared';

export interface EnrichedCaseDocument {
  id: string;
  case_id: string;
  status: CaseDocumentStatus;
  is_required: boolean;
  is_active: boolean;
  notes?: string | null;
  current_version_id?: string | null;
  document_type: {
    code: string;
    name: string;
    category?: string | null;
    scope: 'CASO' | 'PERSONA' | 'BIEN';
    party_role?: string | null;
    asset_type?: string | null;
  };
  person?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    legal_name?: string | null;
  } | null;
  asset?: {
    id: string;
    asset_type: string;
    identifier?: string | null;
    description?: string | null;
  } | null;
  current_version?: {
    id: string;
    version: number;
    file_name: string;
    size_bytes: number;
    mime_type: string;
  } | null;
}

export interface RawDocRow {
  id: string;
  case_id: string;
  status: EnrichedCaseDocument['status'];
  is_required: boolean;
  is_active: boolean;
  notes?: string | null;
  current_version_id?: string | null;
  document_types: EnrichedCaseDocument['document_type'];
  persons?: EnrichedCaseDocument['person'];
  case_assets?: EnrichedCaseDocument['asset'];
  current_version?: EnrichedCaseDocument['current_version'];
}

export interface RolePermCheck {
  roles?: {
    is_superuser?: boolean;
    is_active?: boolean;
    role_permissions?: Array<{ permissions?: { code?: string } | null }>;
  } | null;
}

interface CaseDocumentItemRowProps {
  doc: EnrichedCaseDocument;
  onOpenUpload: (doc: EnrichedCaseDocument) => void;
  onOpenHistory: (doc: EnrichedCaseDocument) => void;
  onOpenStatusModal: (doc: EnrichedCaseDocument, status: 'VALIDATED' | 'OBSERVED') => void;
  onDownload: (versionId: string) => void;
  canApprove: boolean;
}

export const CaseDocumentItemRow: React.FC<CaseDocumentItemRowProps> = ({
  doc,
  onOpenUpload,
  onOpenHistory,
  onOpenStatusModal,
  onDownload,
  canApprove,
}) => {
  const getStatusBadge = (status: CaseDocumentStatus, isRequired: boolean) => {
    switch (status) {
      case 'VALIDATED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>Validado</span>
          </span>
        );
      case 'OBSERVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
            <AlertCircle className="w-3 h-3" />
            <span>Observado</span>
          </span>
        );
      case 'UPLOADED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            <span>Subido (en revisión)</span>
          </span>
        );
      case 'PENDING':
      default:
        return isRequired ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" />
            <span>Pendiente</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
            <span>Opcional</span>
          </span>
        );
    }
  };

  return (
    <div className="p-3.5 rounded-xl border border-border bg-surface hover:border-primary/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground text-sm">{doc.document_type.name}</span>
          {getStatusBadge(doc.status, doc.is_required)}
          {doc.is_required && (
            <span className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wide">
              Requerido
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {doc.person && (
            <span className="bg-muted/70 px-2 py-0.5 rounded text-foreground font-medium">
              Persona:{' '}
              {doc.person.legal_name ||
                `${doc.person.first_name || ''} ${doc.person.last_name || ''}`.trim()}
            </span>
          )}
          {doc.asset && (
            <span className="bg-muted/70 px-2 py-0.5 rounded text-foreground font-medium">
              Bien: {doc.asset.identifier || doc.asset.description || doc.asset.asset_type}
            </span>
          )}
          {doc.current_version && (
            <span className="text-primary font-medium flex items-center gap-1">
              <FileText className="w-3 h-3" />
              v{doc.current_version.version} ({doc.current_version.file_name})
            </span>
          )}
        </div>

        {doc.notes && (
          <div className="text-[11px] p-2 rounded-lg bg-muted/60 text-foreground border border-border/50">
            <span className="font-semibold">Observación: </span>
            <span>{doc.notes}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
        {doc.current_version_id && (
          <button
            type="button"
            onClick={() => onDownload(doc.current_version_id!)}
            className="p-1.5 rounded-lg border border-input text-foreground hover:bg-muted text-xs flex items-center gap-1 font-medium"
            title="Descargar versión vigente (auditada)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Descargar</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onOpenHistory(doc)}
          className="p-1.5 rounded-lg border border-input text-foreground hover:bg-muted text-xs flex items-center gap-1 font-medium"
          title="Ver historial de versiones"
        >
          <History className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Versiones</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenUpload(doc)}
          className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 flex items-center gap-1"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>{doc.current_version_id ? 'Nueva Versión' : 'Subir'}</span>
        </button>

        {canApprove && doc.status === 'UPLOADED' && (
          <>
            <button
              type="button"
              onClick={() => onOpenStatusModal(doc, 'VALIDATED')}
              className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-medium"
              title="Aprobar / Validar documento"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onOpenStatusModal(doc, 'OBSERVED')}
              className="p-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 text-xs font-medium"
              title="Observar documento"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
