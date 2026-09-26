'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Download, Loader2, AlertCircle, Copy, Check, Clock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { createClient } from '../../lib/supabase/client';
import { requestDocumentDownloadUrl } from '../../lib/engine-client';

interface DocumentVersionsModalProps {
  caseDocumentId: string | null;
  documentTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

interface VersionWithProfile {
  id: string;
  version: number;
  file_name: string;
  size_bytes: number;
  mime_type: string;
  sha256: string;
  change_summary?: string | null;
  created_at?: string;
  created_by?: string | null;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

export const DocumentVersionsModal: React.FC<DocumentVersionsModalProps> = ({
  caseDocumentId,
  documentTitle,
  isOpen,
  onClose,
}) => {
  const [versions, setVersions] = useState<VersionWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isColdStarting, setIsColdStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    if (!caseDocumentId) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('document_versions')
        .select(
          `
          id, version, file_name, size_bytes, mime_type, sha256,
          change_summary, created_at, created_by,
          profiles (first_name, last_name, email)
        `,
        )
        .eq('case_document_id', caseDocumentId)
        .order('version', { ascending: false });

      if (error) throw error;
      setVersions((data as unknown as VersionWithProfile[]) || []);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al cargar versiones');
    } finally {
      setIsLoading(false);
    }
  }, [caseDocumentId]);

  useEffect(() => {
    if (isOpen && caseDocumentId) {
      void loadVersions();
    } else {
      setVersions([]);
      setErrorMessage(null);
    }
  }, [isOpen, caseDocumentId, loadVersions]);

  const handleDownload = async (versionId: string) => {
    setDownloadingId(versionId);
    setErrorMessage(null);
    try {
      const result = await requestDocumentDownloadUrl(versionId, (waking) =>
        setIsColdStarting(waking),
      );
      window.open(result.download_url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al generar enlace de descarga');
    } finally {
      setDownloadingId(null);
      setIsColdStarting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedSha(text);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Historial de Versiones: ${documentTitle}`}
      description="Todas las versiones subidas para este documento con su huella criptográfica SHA256."
      maxWidth="lg"
    >
      <div className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isColdStarting && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span>Generando enlace seguro con el servicio de almacenamiento…</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Cargando versiones…</span>
          </div>
        ) : versions.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No se han registrado versiones aún para este documento.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
            {versions.map((ver) => {
              const uploaderName = ver.profiles
                ? `${ver.profiles.first_name || ''} ${ver.profiles.last_name || ''}`.trim() ||
                  ver.profiles.email
                : 'Sistema';

              return (
                <div
                  key={ver.id}
                  className="p-3 rounded-xl border border-border bg-surface hover:border-primary/30 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-lg text-[11px]">
                        v{ver.version}
                      </span>
                      <span className="font-medium text-foreground truncate">{ver.file_name}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        ({formatBytes(ver.size_bytes)})
                      </span>
                    </div>

                    {ver.change_summary && (
                      <p className="text-[11px] text-muted-foreground italic">
                        &quot;{ver.change_summary}&quot;
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {ver.created_at ? new Date(ver.created_at).toLocaleString('es-PE') : '—'}
                      </span>
                      <span>•</span>
                      <span>Por: {uploaderName}</span>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(ver.sha256)}
                        className="inline-flex items-center gap-1 hover:text-foreground text-[10px] font-mono bg-muted/60 px-1.5 py-0.5 rounded"
                        title="Copiar hash SHA256"
                      >
                        {copiedSha === ver.sha256 ? (
                          <Check className="w-2.5 h-2.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-2.5 h-2.5" />
                        )}
                        <span>{ver.sha256.substring(0, 10)}…</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownload(ver.id)}
                    disabled={downloadingId === ver.id}
                    className="p-2 rounded-xl border border-input text-foreground hover:bg-muted disabled:opacity-50 shrink-0 flex items-center gap-1 text-xs font-semibold"
                    title="Descargar versión auditada"
                  >
                    {downloadingId === ver.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Descargar</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
