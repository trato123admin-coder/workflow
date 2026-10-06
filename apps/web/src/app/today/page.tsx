'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CalendarCheck,
  AlertTriangle,
  AlertCircle,
  Clock,
  FileWarning,
  CheckCircle2,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { createClient } from '../../lib/supabase/client';
import { fetchTodayItems, type TodayItem, type TodaySupabaseClient } from '../../lib/today';

export default function TodayTasksPage() {
  const [items, setItems] = useState<TodayItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'FILINGS' | 'ALERTS'>('ALL');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTodayItems = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const supabase = createClient();
    try {
      const collected = await fetchTodayItems(supabase as unknown as TodaySupabaseClient);
      setItems(collected);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error inesperado al cargar las tareas del día';
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTodayItems();
  }, [loadTodayItems]);

  const filteredItems = items.filter((item) => {
    if (filter === 'CRITICAL') return item.severity === 'critical';
    if (filter === 'FILINGS') return item.category === 'FILING';
    if (filter === 'ALERTS') return item.category === 'ALERT';
    return true;
  });

  const todayDisplay = new Date().toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Lima',
  });

  return (
    <AppShell breadcrumbs={[{ label: 'Inicio', href: '/dashboard' }, { label: 'Qué Hago Hoy' }]}>
      <div className="space-y-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 rounded-2xl border border-border bg-card shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold text-foreground capitalize">{todayDisplay}</h1>
            </div>
            <p className="text-xs text-muted-foreground">
              Bandeja consolidada de trámites vencidos, alertas críticas y documentos por subsanar.
            </p>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border text-xs">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filter === 'ALL'
                  ? 'bg-card text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Todos ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('CRITICAL')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filter === 'CRITICAL'
                  ? 'bg-destructive/10 text-destructive font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Críticos ({items.filter((i) => i.severity === 'critical').length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('FILINGS')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filter === 'FILINGS'
                  ? 'bg-card text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Trámites ({items.filter((i) => i.category === 'FILING').length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('ALERTS')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filter === 'ALERTS'
                  ? 'bg-card text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Alertas ({items.filter((i) => i.category === 'ALERT').length})
            </button>
          </div>
        </div>

        {/* Lista de Tareas */}
        {loadError ? (
          <div className="p-12 rounded-2xl border border-destructive/20 bg-destructive/5 text-center space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto text-destructive mb-2" />
            <h3 className="text-sm font-bold text-destructive">Error al cargar tareas del día</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">{loadError}</p>
            <button
              type="button"
              onClick={() => loadTodayItems()}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors inline-flex items-center gap-2"
            >
              Reintentar
            </button>
          </div>
        ) : loading ? (
          <div className="p-16 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span>Consultando prioridades de tu jornada...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-16 rounded-2xl border border-border bg-card text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
            <h3 className="text-sm font-bold text-foreground">¡Todo al día en esta vista!</h3>
            <p className="text-xs text-muted-foreground">
              No tienes trámites vencidos ni alertas pendientes de atención con este filtro.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden shadow-sm">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-4 hover:bg-muted/30 transition-colors flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {item.severity === 'critical' ? (
                      <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                    ) : item.severity === 'warning' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    ) : item.category === 'OBSERVED_DOC' ? (
                      <FileWarning className="w-5 h-5 text-amber-600 shrink-0" />
                    ) : (
                      <Clock className="w-5 h-5 text-primary shrink-0" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.caseNumber && (
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {item.caseNumber}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.severity === 'critical'
                            ? 'bg-destructive/10 text-destructive'
                            : item.severity === 'warning'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {item.severity === 'critical'
                          ? 'Crítico'
                          : item.severity === 'warning'
                            ? 'Advertencia'
                            : 'Info'}
                      </span>
                      <h4 className="text-xs font-bold text-foreground">{item.title}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <Link
                  href={item.actionUrl}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0 flex items-center gap-1.5 self-center shadow-sm"
                >
                  <span>Atender</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
