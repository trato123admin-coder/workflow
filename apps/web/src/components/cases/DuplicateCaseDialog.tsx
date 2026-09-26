'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Loader2, Users, Building, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { createClient } from '../../lib/supabase/client';

interface DuplicateCaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  currentTitle: string;
}

export const DuplicateCaseDialog: React.FC<DuplicateCaseDialogProps> = ({
  isOpen,
  onClose,
  caseId,
  currentTitle,
}) => {
  const router = useRouter();
  const [title, setTitle] = useState(`${currentTitle} (Copia)`);
  const [includeParties, setIncludeParties] = useState(true);
  const [includeAssets, setIncludeAssets] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDuplicate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('duplicate_case', {
        _source_case_id: caseId,
        _new_title: title.trim(),
        _include_parties: includeParties,
        _include_assets: includeAssets,
      });

      if (error) {
        setErrorMessage(error.message);
        setIsSubmitting(false);
        return;
      }

      onClose();
      if (data) {
        router.push(`/cases/${data}`);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error inesperado al duplicar');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Duplicar Expediente (Mejora M8)"
      description="Crea un nuevo caso derivado con sus procesos reiniciados en 0% de avance."
      maxWidth="md"
    >
      <form onSubmit={handleDuplicate} className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Título del nuevo expediente *
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="space-y-2.5 pt-1">
          {/* Toggle Intervinientes */}
          <label className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors">
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs font-semibold text-foreground">Copiar intervinientes</p>
                <p className="text-[11px] text-muted-foreground">
                  Clona causante, herederos y representantes con sus cuotas registradas.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={includeParties}
              onChange={(e) => setIncludeParties(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary"
            />
          </label>

          {/* Toggle Bienes */}
          <label className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors">
            <div className="flex items-center gap-2.5">
              <Building className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-xs font-semibold text-foreground">Copiar inventario de bienes</p>
                <p className="text-[11px] text-muted-foreground">
                  Reutiliza inmuebles y vehículos con estado inicial &ldquo;IDENTIFICADO&rdquo;.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={includeAssets}
              onChange={(e) => setIncludeAssets(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary"
            />
          </label>
        </div>

        <div className="p-3 rounded-xl bg-muted/40 border border-border text-[11px] text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Reglas de negocio aplicadas:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Las deudas y pasivos <strong>nunca se arrastran</strong> a casos derivados.</li>
            <li>No se copian documentos ni expedientes notariales previos.</li>
            <li>Se asigna automáticamente un nuevo número correlativo.</li>
          </ul>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-muted text-foreground"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !title.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Duplicando...</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Confirmar duplicación</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
