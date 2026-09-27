'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase/client';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { FormField } from '../ui/FormField';
import { CalendarDays, Plus, Loader2, Info, CalendarCheck2, AlertCircle } from 'lucide-react';

interface HolidayItem {
  date: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export const HolidaysTab: React.FC = () => {
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    date: '',
    name: '',
  });

  const loadHolidays = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setHolidays(data || []);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al cargar lista de feriados');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHolidays();
  }, [loadHolidays]);

  const handleToggleActive = async (date: string, currentActive: boolean) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('holidays')
        .update({ is_active: !currentActive })
        .eq('date', date);

      if (error) throw error;
      setHolidays((prev) =>
        prev.map((h) => (h.date === date ? { ...h, is_active: !currentActive } : h)),
      );
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al actualizar estado del feriado');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('holidays').insert([
        {
          date: formData.date,
          name: formData.name.trim(),
          is_active: true,
        },
      ]);

      if (error) throw error;
      setIsModalOpen(false);
      setFormData({ date: '', name: '' });
      void loadHolidays();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al registrar feriado');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            <span>Calendario de Feriados y Cómputo de Días Útiles</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Configure los días no laborables para el cómputo de plazos legales y notariales.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar Feriado</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tarjeta explicativa sobre el cómputo de días útiles */}
      <div className="p-4 bg-muted/40 rounded-xl border border-border flex items-start gap-3">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Regla de Negocio del Cómputo Legal:</p>
          <p>
            Los plazos de trámites notariales, registrales y de workflow se calculan en{' '}
            <strong>días hábiles / útiles</strong>. La función del sistema excluye automáticamente
            sábados, domingos y los feriados marcados como <strong>activos</strong> en esta tabla.
          </p>
          <p className="text-[11px] italic">
            Nota: Si la tabla de feriados no tiene registros o está vacía, el sistema funciona
            regularmente computando de lunes a viernes sin interrupciones.
          </p>
        </div>
      </div>

      {/* Lista de Feriados */}
      {isLoading ? (
        <div className="p-12 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-xs">Cargando calendario de feriados...</p>
        </div>
      ) : holidays.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted-foreground space-y-2">
          <CalendarCheck2 className="w-8 h-8 mx-auto text-muted-foreground/60" />
          <p className="text-xs font-semibold text-foreground">Sin feriados registrados</p>
          <p className="text-[11px]">
            El sistema actualmente calcula plazos hábiles únicamente descontando fines de semana.
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Festividad / Motivo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {holidays.map((h) => (
                  <tr key={h.date} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                      {h.date}
                    </td>
                    <td className="px-4 py-3 text-foreground">{h.name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        category={h.is_active ? 'success' : 'neutral'}
                        label={h.is_active ? 'Activo' : 'Inactivo'}
                        size="sm"
                      />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(h.date, h.is_active)}
                        className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                      >
                        {h.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal para nuevo feriado */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Agregar Día No Laborable / Feriado"
        description="El día configurado no será contabilizado en el cómputo de días útiles."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <FormField id="holiday_date" label="Fecha" required>
            <input
              id="holiday_date"
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary"
            />
          </FormField>

          <FormField id="holiday_name" label="Nombre o Festividad" required>
            <input
              id="holiday_name"
              type="text"
              required
              placeholder="Ej. Fiestas Patrias, Jueves Santo"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-input bg-background text-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.date || !formData.name.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Registrar Feriado</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
