'use client';

import React, { useState } from 'react';
import { Download, Upload, RotateCcw, History, AlertCircle, Check } from 'lucide-react';
import type {
  ConfigBundle,
  ConfigDiff,
  SettingsHistoryItem,
  CatalogItem,
  FeatureFlag,
  SystemSetting,
  CustomFieldDefinition,
} from '@workflow/shared';
import { computeConfigDiff } from '@workflow/shared';

interface AdvancedSettingsProps {
  currentConfig: {
    catalogs: CatalogItem[];
    feature_flags: FeatureFlag[];
    system_settings: SystemSetting[];
    custom_fields: CustomFieldDefinition[];
  };
  historyItems: SettingsHistoryItem[];
  onImportConfig?: (bundle: ConfigBundle) => Promise<void>;
  onRestoreDefaults?: (category: string) => Promise<void>;
}

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  currentConfig,
  historyItems,
  onImportConfig,
  onRestoreDefaults,
}) => {
  const [activeTab, setActiveTab] = useState<'io' | 'history'>('io');
  const [importJson, setImportJson] = useState('');
  const [diffResult, setDiffResult] = useState<ConfigDiff | null>(null);
  const [importError, setImportError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Exportar configuración
  const handleExport = () => {
    const bundle: ConfigBundle = {
      version: 1,
      exported_at: new Date().toISOString(),
      app_version: '2.0.0',
      catalogs: currentConfig.catalogs,
      feature_flags: currentConfig.feature_flags,
      system_settings: currentConfig.system_settings,
      custom_fields: currentConfig.custom_fields,
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 2. Previsualizar Diff de Importación
  const handleAnalyzeImport = () => {
    setImportError('');
    setSuccessMsg('');
    try {
      const parsed = JSON.parse(importJson) as ConfigBundle;
      if (!parsed.version || !parsed.catalogs) {
        throw new Error('Estructura de archivo de configuración inválida');
      }
      const diff = computeConfigDiff(currentConfig, parsed);
      setDiffResult(diff);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Error al parsear archivo JSON');
    }
  };

  // 3. Confirmar Importación
  const handleConfirmImport = async () => {
    try {
      const parsed = JSON.parse(importJson) as ConfigBundle;
      await onImportConfig?.(parsed);
      setDiffResult(null);
      setImportJson('');
      setSuccessMsg('Configuración importada exitosamente');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Error al aplicar configuración');
    }
  };

  return (
    <div className="space-y-6">
      {/* Selector de sub-pestaña */}
      <div className="flex border-b border-border gap-4 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('io')}
          className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
            activeTab === 'io'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Download className="w-4 h-4" />
          Exportar / Importar / Restaurar
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
            activeTab === 'history'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="w-4 h-4" />
          Historial Inmutable de Cambios ({historyItems.length})
        </button>
      </div>

      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {importError && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{importError}</span>
        </div>
      )}

      {activeTab === 'io' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Exportar */}
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              <h4 className="text-xs font-bold text-foreground">Exportar Configuración</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Descarga un archivo JSON versionado con todos los catálogos, banderas de módulos,
              parámetros tipados y definiciones de campos personalizados para promover a producción.
            </p>
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              Descargar Archivo JSON
            </button>
          </div>

          {/* Restaurar valores por defecto */}
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-500" />
              <h4 className="text-xs font-bold text-foreground">Restaurar Valores por Defecto</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Restablece los parámetros de configuración a sus valores recomendados iniciales del
              sistema.
            </p>
            <div className="flex items-center gap-2">
              <select
                id="restore-category"
                className="px-3 py-1.5 text-xs rounded-lg border border-input bg-background text-foreground"
              >
                <option value="general">General</option>
                <option value="appearance">Apariencia</option>
                <option value="cases">Casos</option>
                <option value="alerts">Alertas</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  const select = document.getElementById('restore-category') as HTMLSelectElement;
                  if (confirm(`¿Restaurar valores de ${select.value}?`)) {
                    onRestoreDefaults?.(select.value);
                  }
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-input bg-background hover:bg-muted text-foreground transition-colors"
              >
                Restaurar Pestaña
              </button>
            </div>
          </div>

          {/* Importar con Diff Previo */}
          <div className="md:col-span-2 p-5 rounded-xl border border-border bg-card space-y-4">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              <h4 className="text-xs font-bold text-foreground">
                Importar Configuración con Diff Previo
              </h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Pegue el contenido JSON o cargue un paquete exportado. El sistema calculará el impacto
              y mostrará los cambios antes de aplicarlos.
            </p>

            <textarea
              rows={5}
              placeholder='Pegue aquí el contenido JSON {"version": 1, ...}'
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-input bg-background text-foreground"
            />

            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={handleAnalyzeImport}
                disabled={!importJson.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm disabled:opacity-50 transition-colors"
              >
                Analizar Diferencias (Diff)
              </button>

              {diffResult && (
                <span className="text-xs font-semibold text-foreground">
                  Cambios detectados: {diffResult.totalChanges}
                </span>
              )}
            </div>

            {/* Vista previa de Diferencias */}
            {diffResult && (
              <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                <h5 className="text-xs font-bold text-foreground">
                  Resumen de Modificaciones a Aplicar ({diffResult.totalChanges})
                </h5>

                {diffResult.entries.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No hay diferencias con la configuración actual.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs">
                    {diffResult.entries.map((entry, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded border border-border bg-card font-mono text-[11px]"
                      >
                        <span className="font-semibold text-foreground">
                          [{entry.type}] {entry.key}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                            entry.action === 'create'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {entry.action === 'create' ? '+ Nuevo' : 'Modificado'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {diffResult.totalChanges > 0 && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
                    >
                      Confirmar y Aplicar Importación
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Historial Inmutable */}
      {activeTab === 'history' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Clave</th>
                  <th className="py-3 px-4">Valor Anterior</th>
                  <th className="py-3 px-4">Nuevo Valor</th>
                  <th className="py-3 px-4">Motivo / Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historyItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No hay registros en settings_history aún.
                    </td>
                  </tr>
                ) : (
                  historyItems.map((h) => (
                    <tr key={h.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                        {new Date(h.changed_at).toLocaleString('es-PE')}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-foreground">{h.key}</td>
                      <td className="py-3 px-4 font-mono text-muted-foreground max-w-xs truncate">
                        {h.old_value !== null ? JSON.stringify(h.old_value) : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-primary max-w-xs truncate font-medium">
                        {JSON.stringify(h.new_value)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {h.reason || 'Actualización'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
