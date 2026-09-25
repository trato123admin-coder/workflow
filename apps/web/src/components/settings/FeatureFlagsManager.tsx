'use client';

import React, { useState } from 'react';
import { Lock, ToggleLeft, ToggleRight, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { FeatureFlag } from '@workflow/shared';
import { validateFlagToggle } from '@workflow/shared';

interface FeatureFlagsManagerProps {
  flags: FeatureFlag[];
  onToggleFlag?: (key: string, nextEnabled: boolean, reason?: string) => Promise<void>;
}

export const FeatureFlagsManager: React.FC<FeatureFlagsManagerProps> = ({
  flags,
  onToggleFlag,
}) => {
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [flagsState, setFlagsState] = useState<FeatureFlag[]>(flags);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  // Estado para confirmación escrita de MFA
  const [mfaTarget, setMfaTarget] = useState<FeatureFlag | null>(null);
  const [mfaConfirmText, setMfaConfirmText] = useState('');
  const [mfaReason, setMfaReason] = useState('');

  const flagsMap = flagsState.reduce<Record<string, FeatureFlag>>((acc, f) => {
    acc[f.key] = f;
    return acc;
  }, {});

  const modules = Array.from(new Set(flagsState.map((f) => f.module)));

  const filteredFlags =
    selectedModule === 'ALL' ? flagsState : flagsState.filter((f) => f.module === selectedModule);

  const handleToggle = async (flag: FeatureFlag) => {
    setWarningMsg(null);
    const nextEnabled = !flag.is_enabled;

    // Validación de candados y dependencias con packages/shared
    const validation = validateFlagToggle(flag, nextEnabled, flagsMap);
    if (!validation.canToggle) {
      setWarningMsg(validation.reason || 'Operación no permitida');
      return;
    }

    // Regla S2-11: Apagar MFA requiere confirmación escrita
    if (!nextEnabled && (flag.key === 'security.mfa_admin' || flag.key === 'security.mfa_cash')) {
      setMfaTarget(flag);
      setMfaConfirmText('');
      setMfaReason('');
      return;
    }

    try {
      await onToggleFlag?.(flag.key, nextEnabled);
      setFlagsState((prev) =>
        prev.map((f) => (f.key === flag.key ? { ...f, is_enabled: nextEnabled } : f)),
      );
    } catch (err: unknown) {
      setWarningMsg(err instanceof Error ? err.message : 'Error al cambiar flag');
    }
  };

  const handleConfirmMfaDisable = async () => {
    if (!mfaTarget) return;
    if (mfaConfirmText.trim().toUpperCase() !== 'CONFIRMAR') {
      setWarningMsg('Debe escribir exactamente CONFIRMAR para desactivar MFA');
      return;
    }
    if (!mfaReason.trim()) {
      setWarningMsg('Debe ingresar un motivo para desactivar MFA');
      return;
    }

    try {
      await onToggleFlag?.(mfaTarget.key, false, mfaReason);
      setFlagsState((prev) =>
        prev.map((f) => (f.key === mfaTarget.key ? { ...f, is_enabled: false } : f)),
      );
      setMfaTarget(null);
    } catch (err: unknown) {
      setWarningMsg(err instanceof Error ? err.message : 'Error al desactivar MFA');
    }
  };

  return (
    <div className="space-y-6">
      {/* Alerta de validación */}
      {warningMsg && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{warningMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setWarningMsg(null)}
            className="text-xs font-bold underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Filtro por Módulo */}
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <button
          type="button"
          onClick={() => setSelectedModule('ALL')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            selectedModule === 'ALL'
              ? 'bg-primary text-primary-foreground font-semibold'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Todos ({flagsState.length})
        </button>
        {modules.map((mod) => (
          <button
            key={mod}
            type="button"
            onClick={() => setSelectedModule(mod)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
              selectedModule === mod
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {mod}
          </button>
        ))}
      </div>

      {/* Lista de Feature Flags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredFlags.map((flag) => {
          return (
            <div
              key={flag.key}
              className="p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between space-y-3"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-foreground">{flag.label}</h4>
                    {flag.is_locked && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                        <Lock className="w-2.5 h-2.5" /> Núcleo
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">{flag.module}</span>
                </div>

                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  {flag.description || 'Sin descripción'}
                </p>

                <p className="text-[10px] font-mono text-muted-foreground/80">{flag.key}</p>

                {flag.depends_on.length > 0 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    Depende de: {flag.depends_on.join(', ')}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span
                  className={`text-[11px] font-semibold ${
                    flag.is_enabled ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {flag.is_enabled ? 'Habilitado' : 'Deshabilitado'}
                </span>

                <button
                  type="button"
                  disabled={flag.is_locked}
                  onClick={() => handleToggle(flag)}
                  className={`inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={flag.is_locked ? 'Flag protegido del núcleo' : 'Cambiar estado'}
                >
                  {flag.is_enabled ? (
                    <ToggleRight className="w-6 h-6 text-primary" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal para confirmación escrita de MFA */}
      {mfaTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card text-card-foreground border border-destructive/30 w-full max-w-md rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-destructive font-bold text-sm">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>Desactivar MFA Obligatorio ({mfaTarget.label})</span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Desactivar la autenticación de dos factores para este rol sensible reduce
              drásticamente la seguridad del sistema. Esta acción queda auditada con su usuario y
              motivo.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Motivo justificado del cambio *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Explique el motivo justificado de la excepción temporal..."
                  value={mfaReason}
                  onChange={(e) => setMfaReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Escriba <span className="font-mono font-bold text-destructive">CONFIRMAR</span>{' '}
                  para proceder
                </label>
                <input
                  type="text"
                  required
                  placeholder="CONFIRMAR"
                  value={mfaConfirmText}
                  onChange={(e) => setMfaConfirmText(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setMfaTarget(null)}
                className="px-3 py-1.5 rounded-lg border border-input bg-background text-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmMfaDisable}
                disabled={mfaConfirmText.trim().toUpperCase() !== 'CONFIRMAR' || !mfaReason.trim()}
                className="px-4 py-1.5 rounded-lg bg-destructive text-destructive-foreground font-semibold hover:bg-destructive/90 disabled:opacity-50"
              >
                Confirmar y Registrar en Auditoría
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
