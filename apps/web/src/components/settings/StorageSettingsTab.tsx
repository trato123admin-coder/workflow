'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Save,
  Loader2,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { createClient } from '../../lib/supabase/client';
import { StorageBackendCards, type BackendInfo } from './StorageBackendCards';

interface StorageUsage {
  totalVersions: number;
  totalBytes: number;
}

export const StorageSettingsTab: React.FC = () => {
  const [backends, setBackends] = useState<BackendInfo[]>([]);
  const [usage, setUsage] = useState<StorageUsage>({ totalVersions: 0, totalBytes: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parámetros de Settings
  const [maxFileMb, setMaxFileMb] = useState<number>(10);
  const [imageMaxPx, setImageMaxPx] = useState<number>(2000);
  const [warnPercent, setWarnPercent] = useState<number>(80);
  const [compressUploads, setCompressUploads] = useState<boolean>(true);

  const loadStorageData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();

      const { data: bData, error: bErr } = await supabase
        .from('storage_backends')
        .select('*')
        .order('is_primary', { ascending: false });

      if (bErr) throw bErr;
      setBackends((bData as BackendInfo[]) || []);

      const { data: vData, error: vErr } = await supabase
        .from('document_versions')
        .select('size_bytes');

      if (!vErr && vData) {
        const totalBytes = vData.reduce((acc, row) => acc + Number(row.size_bytes || 0), 0);
        setUsage({ totalVersions: vData.length, totalBytes });
      }

      const { data: sData } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [
          'storage.max_file_mb',
          'documents.max_file_mb',
          'storage.image_max_px',
          'storage.usage_warn_percent',
          'storage.compress_uploads',
        ]);

      if (sData) {
        for (const item of sData) {
          if (
            (item.key === 'storage.max_file_mb' || item.key === 'documents.max_file_mb') &&
            typeof item.value === 'number'
          ) {
            setMaxFileMb(item.value);
          }
          if (item.key === 'storage.image_max_px' && typeof item.value === 'number') {
            setImageMaxPx(item.value);
          }
          if (item.key === 'storage.usage_warn_percent' && typeof item.value === 'number') {
            setWarnPercent(item.value);
          }
          if (item.key === 'storage.compress_uploads' && typeof item.value === 'boolean') {
            setCompressUploads(item.value);
          }
        }
      }
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al cargar datos de almacenamiento');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStorageData();
  }, [loadStorageData]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const supabase = createClient();
      const updates = [
        { key: 'storage.max_file_mb', value: maxFileMb },
        { key: 'storage.image_max_px', value: imageMaxPx },
        { key: 'storage.usage_warn_percent', value: warnPercent },
        { key: 'storage.compress_uploads', value: compressUploads },
      ];

      for (const item of updates) {
        const { error } = await supabase
          .from('system_settings')
          .update({ value: item.value })
          .eq('key', item.key);
        if (error) throw error;
      }

      setSuccessMessage('Parámetros de almacenamiento actualizados con éxito.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al guardar parámetros');
    } finally {
      setIsSaving(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const quotaBytes = 1024 * 1024 * 1024;
  const usedPercent = Math.min(100, (usage.totalBytes / quotaBytes) * 100);
  const isWarning = usedPercent >= warnPercent;

  return (
    <div className="space-y-6 text-xs">
      <div className="border-b border-border pb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Almacenamiento de Archivos (S5-09)</h3>
          <p className="text-muted-foreground">
            Métricas de ocupación, proveedores físicos activos y políticas de retención.
          </p>
        </div>
        <button
          type="button"
          onClick={loadStorageData}
          disabled={isLoading}
          className="p-1.5 rounded-lg border border-input text-foreground hover:bg-muted"
          title="Recargar datos"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Tarjeta de Cuota y Uso */}
      <div className="p-5 rounded-2xl border border-border bg-card space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">Ocupación del Almacén Principal</p>
              <p className="text-muted-foreground">Supabase Storage (Cuota: 1 GB libre)</p>
            </div>
          </div>
          <div className="text-right">
            <span className="font-bold text-foreground text-base">
              {formatBytes(usage.totalBytes)}
            </span>
            <span className="text-muted-foreground"> / 1.00 GB</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isWarning ? 'bg-amber-500' : 'bg-primary'
              }`}
              style={{ width: `${Math.max(2, usedPercent)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{usedPercent.toFixed(2)}% utilizado</span>
            <span>{usage.totalVersions} versiones registradas</span>
          </div>
        </div>

        {isWarning && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Ha superado el umbral de advertencia ({warnPercent}%).</span>
          </div>
        )}
      </div>

      {/* Proveedores registrados */}
      <StorageBackendCards backends={backends} />

      {/* Formulario de Parámetros de Almacenamiento */}
      <div className="p-5 rounded-2xl border border-border bg-card space-y-4 shadow-sm">
        <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span>Políticas de Subida y Optimización</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="max-file-mb" className="block font-semibold text-foreground mb-1">
              Tamaño Máximo por Archivo (MB)
            </label>
            <input
              id="max-file-mb"
              type="number"
              min={1}
              max={50}
              value={maxFileMb}
              onChange={(e) => setMaxFileMb(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-input bg-surface text-foreground"
            />
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Tope para PDF y documentos. Inicial: 10 MB.
            </p>
          </div>

          <div>
            <label htmlFor="image-max-px" className="block font-semibold text-foreground mb-1">
              Dimensión Máxima de Imágenes (px)
            </label>
            <input
              id="image-max-px"
              type="number"
              min={800}
              max={4000}
              value={imageMaxPx}
              onChange={(e) => setImageMaxPx(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-input bg-surface text-foreground"
            />
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Resolución tope antes de subida (inicial 2000px).
            </p>
          </div>

          <div>
            <label htmlFor="warn-percent" className="block font-semibold text-foreground mb-1">
              Umbral de Advertencia de Ocupación (%)
            </label>
            <input
              id="warn-percent"
              type="number"
              min={50}
              max={95}
              value={warnPercent}
              onChange={(e) => setWarnPercent(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-input bg-surface text-foreground"
            />
          </div>

          <div className="flex items-center gap-3 pt-4">
            <input
              id="compress-toggle"
              type="checkbox"
              checked={compressUploads}
              onChange={(e) => setCompressUploads(e.target.checked)}
              className="w-4 h-4 rounded text-primary border-input focus:ring-primary"
            />
            <label htmlFor="compress-toggle" className="font-semibold text-foreground">
              Comprimir imágenes en el cliente antes de transferir
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center gap-1.5 hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Guardar Parámetros</span>
          </button>
        </div>
      </div>
    </div>
  );
};
