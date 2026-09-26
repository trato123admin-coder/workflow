'use client';

import React from 'react';
import Link from 'next/link';
import {
  Download,
  History,
  CheckCircle2,
  AlertTriangle,
  Clock,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type { CaseDocumentStatus } from '@workflow/shared';

export interface LibraryDocumentItem {
  id: string;
  case_id: string;
  status: CaseDocumentStatus;
  is_required: boolean;
  notes?: string | null;
  current_version_id?: string | null;
  case_number: string;
  case_title: string;
  document_name: string;
  document_code: string;
  scope: 'CASO' | 'PERSONA' | 'BIEN';
  nature: string;
  assigned_to?: string | null;
  version_number?: number | null;
  file_name?: string | null;
  size_bytes?: number | null;
}

interface DocumentLibraryTableProps {
  documents: LibraryDocumentItem[];
  onDownload: (versionId: string) => void;
  onOpenHistory: (docId: string, docName: string) => void;
}

export const DocumentLibraryTable: React.FC<DocumentLibraryTableProps> = ({
  documents,
  onDownload,
  onOpenHistory,
}) => {
  const getStatusBadge = (status: CaseDocumentStatus) => {
    switch (status) {
      case 'VALIDATED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> Validado
          </span>
        );
      case 'OBSERVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-400">
            <AlertCircle className="w-3 h-3" /> Observado
          </span>
        );
      case 'UPLOADED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <Clock className="w-3 h-3" /> Subido
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400">
            <AlertTriangle className="w-3 h-3" /> Pendiente
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase">
            <tr>
              <th className="py-3 px-4">Expediente</th>
              <th className="py-3 px-4">Documento</th>
              <th className="py-3 px-4">Ámbito / Asignado</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4">Versión</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-muted/20 transition-colors">
                <td className="py-3 px-4 font-semibold text-foreground">
                  <Link
                    href={`/cases/${doc.case_id}`}
                    className="hover:underline text-primary flex items-center gap-1"
                  >
                    <span>{doc.case_number}</span>
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </Link>
                  <p className="text-[11px] text-muted-foreground font-normal truncate max-w-[140px]">
                    {doc.case_title}
                  </p>
                </td>
                <td className="py-3 px-4">
                  <p className="font-semibold text-foreground">{doc.document_name}</p>
                  <p className="text-[11px] text-muted-foreground">{doc.document_code}</p>
                </td>
                <td className="py-3 px-4">
                  <span className="font-medium text-foreground">{doc.scope}</span>
                  {doc.assigned_to && (
                    <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                      {doc.assigned_to}
                    </p>
                  )}
                </td>
                <td className="py-3 px-4">{getStatusBadge(doc.status)}</td>
                <td className="py-3 px-4">
                  {doc.version_number ? (
                    <span className="font-semibold text-primary">v{doc.version_number}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right space-x-1">
                  {doc.current_version_id && (
                    <button
                      type="button"
                      onClick={() => onDownload(doc.current_version_id!)}
                      className="p-1.5 rounded-lg border border-input text-foreground hover:bg-muted inline-flex items-center"
                      title="Descarga auditada"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenHistory(doc.id, doc.document_name)}
                    className="p-1.5 rounded-lg border border-input text-foreground hover:bg-muted inline-flex items-center"
                    title="Historial de versiones"
                  >
                    <History className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
