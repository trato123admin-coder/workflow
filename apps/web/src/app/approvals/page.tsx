'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileCheck2,
  CheckCircle,
  XCircle,
  Download,
  AlertCircle,
  Loader2,
  FileText,
} from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { createClient } from '../../lib/supabase/client';
import {
  approveGeneratedDocument,
  rejectGeneratedDocument,
  requestDocumentDownloadUrl,
} from '../../lib/engine-client';

interface PendingApprovalDoc {
  id: string;
  approval_status: string;
  case_document_id: string;
  case_document_version_id: string;
  format: string;
  created_at: string;
  case_id: string;
  case_number: string;
  case_title: string;
  document_name: string;
  version: number;
}

export default function ApprovalsQueuePage() {
  const [docs, setDocs] = useState<PendingApprovalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [rejectModalDoc, setRejectModalDoc] = useState<PendingApprovalDoc | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadPendingDocs = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('generated_documents')
        .select(
          `
          id, approval_status, case_document_id, case_document_version_id, format, created_at,
          case_documents!inner (case_id, document_types (name), cases!inner (id, case_number, title)),
          document_versions!inner (version)
        `,
        )
        .in('approval_status', ['GENERATED', 'IN_REVIEW'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formatted: PendingApprovalDoc[] = ((data as any[]) ?? []).map((row) => ({
        id: row.id,
        approval_status: row.approval_status,
        case_document_id: row.case_document_id,
        case_document_version_id: row.case_document_version_id,
        format: row.format,
        created_at: row.created_at,
        case_id: row.case_documents?.case_id || '',
        case_number: row.case_documents?.cases?.case_number || 'EXP',
        case_title: row.case_documents?.cases?.title || '',
        document_name: row.case_documents?.document_types?.name || 'Documento Generado',
        version: row.document_versions?.version || 1,
      }));

      setDocs(formatted);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Error al consultar documentos pendientes: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingDocs();
  }, [loadPendingDocs]);

  const handleApprove = async (doc: PendingApprovalDoc) => {
    setProcessingId(doc.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await approveGeneratedDocument(doc.id);
      setSuccessMsg(`Documento "${doc.document_name}" aprobado exitosamente.`);
      await loadPendingDocs();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalDoc || !rejectReason.trim()) return;
    setProcessingId(rejectModalDoc.id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await rejectGeneratedDocument(rejectModalDoc.id, rejectReason.trim());
      setSuccessMsg(`Documento "${rejectModalDoc.document_name}" rechazado.`);
      setRejectModalDoc(null);
      setRejectReason('');
      await loadPendingDocs();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handleDownload = async (doc: PendingApprovalDoc) => {
    try {
      const res = await requestDocumentDownloadUrl(doc.case_document_version_id);
      window.open(res.download_url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      setErrorMsg(
        `No se pudo descargar el documento: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Inicio', href: '/dashboard' },
        { label: 'Aprobaciones Documentales' },
      ]}
    >
      <div className="space-y-6">
        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold text-foreground">
                Cola de Aprobaciones Documentales
              </h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                {docs.length} {docs.length === 1 ? 'pendiente' : 'pendientes'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Revisión legal de documentos generados (Regla 4 Ojos).
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="p-16 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span>Cargando documentos en revisión legal...</span>
          </div>
        ) : docs.length === 0 ? (
          <div className="p-16 rounded-2xl border border-border bg-card text-center space-y-2">
            <CheckCircle className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
            <h3 className="text-sm font-bold text-foreground">¡Cola al día!</h3>
            <p className="text-xs text-muted-foreground">
              No hay documentos pendientes de aprobación en este momento.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="p-4 hover:bg-muted/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {doc.case_number}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        v{doc.version} · {doc.format}
                      </span>
                      <h3 className="text-xs font-bold text-foreground">{doc.document_name}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Expediente:{' '}
                      <Link
                        href={`/cases/${doc.case_id}`}
                        className="hover:underline font-medium text-foreground"
                      >
                        {doc.case_title}
                      </Link>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleDownload(doc)}
                    className="p-2 text-xs font-semibold rounded-xl border border-border text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
                    title="Descargar documento para revisión"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Revisar</span>
                  </button>
                  <button
                    type="button"
                    disabled={processingId === doc.id}
                    onClick={() => setRejectModalDoc(doc)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Rechazar</span>
                  </button>
                  <button
                    type="button"
                    disabled={processingId === doc.id}
                    onClick={() => handleApprove(doc)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {processingId === doc.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                    <span>Aprobar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal de Rechazo */}
        {rejectModalDoc && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-card rounded-2xl border border-border p-5 shadow-2xl space-y-4">
              <h3 className="text-sm font-bold text-foreground">Rechazar documento generado</h3>
              <p className="text-xs text-muted-foreground">
                Indica el motivo del rechazo para corregir datos o plantilla.
              </p>
              <textarea
                rows={3}
                placeholder="Escribe el motivo del rechazo (obligatorio)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-destructive resize-none"
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectModalDoc(null);
                    setRejectReason('');
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-xl border border-border hover:bg-muted text-muted-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!rejectReason.trim() || processingId === rejectModalDoc.id}
                  onClick={handleConfirmReject}
                  className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  Confirmar Rechazo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
