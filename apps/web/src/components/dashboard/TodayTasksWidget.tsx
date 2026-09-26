'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Clock,
  Users,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Calendar,
} from 'lucide-react';
import { createClient } from '../../lib/supabase/client';
import type { KPICaseInput } from '@workflow/shared';

export interface TodayTaskItem {
  id: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  type: 'OVERDUE' | 'DUE_SOON' | 'SEMAPHORE' | 'NO_LAWYER';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  actionUrl: string;
  dueDate?: string | null;
}

interface TodayTasksWidgetProps {
  cases: (KPICaseInput & { title?: string; case_number?: string })[];
}

export const TodayTasksWidget: React.FC<TodayTasksWidgetProps> = ({ cases }) => {
  const [tasks, setTasks] = useState<TodayTaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning'>('all');

  useEffect(() => {
    let isCancelled = false;

    async function evaluateTodayTasks() {
      setIsLoading(true);
      const supabase = createClient();
      const now = Date.now();
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      const discoveredTasks: TodayTaskItem[] = [];

      // Evaluar plazos SLA
      for (const c of cases) {
        if (c.due_date) {
          const dueTime = new Date(c.due_date).getTime();
          if (dueTime < now) {
            discoveredTasks.push({
              id: `overdue-${c.id}`,
              caseId: c.id,
              caseNumber: c.case_number || 'EXP',
              caseTitle: c.title || 'Caso sin título',
              type: 'OVERDUE',
              severity: 'critical',
              title: 'Plazo SLA Vencido',
              description: `Venció el ${new Date(c.due_date).toLocaleDateString('es-PE')}`,
              actionUrl: `/cases/${c.id}`,
              dueDate: c.due_date,
            });
          } else if (dueTime - now <= threeDaysMs) {
            discoveredTasks.push({
              id: `due-soon-${c.id}`,
              caseId: c.id,
              caseNumber: c.case_number || 'EXP',
              caseTitle: c.title || 'Caso sin título',
              type: 'DUE_SOON',
              severity: 'warning',
              title: 'Próximo a Vencer',
              description: `Vence el ${new Date(c.due_date).toLocaleDateString('es-PE')}`,
              actionUrl: `/cases/${c.id}`,
              dueDate: c.due_date,
            });
          }
        }
      }

      // Evaluar semáforos en la base de datos (S4-09, S4-03)
      const activeCases = cases.slice(0, 15); // Límite para evitar sobrecarga en vista inicial
      const semaphorePromises = activeCases.map(async (c) => {
        try {
          const { data, error } = await supabase.rpc('get_case_semaphore_warnings', {
            _case_id: c.id,
          });
          if (error || !data || !data.has_warnings) return [];

          const items: TodayTaskItem[] = [];
          const codes = (data.warning_codes as string[]) || [];

          if (codes.includes('MINOR_WITHOUT_REPRESENTATIVE')) {
            items.push({
              id: `minor-${c.id}`,
              caseId: c.id,
              caseNumber: c.case_number || 'EXP',
              caseTitle: c.title || 'Caso',
              type: 'SEMAPHORE',
              severity: 'critical',
              title: 'Heredero Menor sin Representante',
              description: 'Asignar curador o representante en Personas',
              actionUrl: `/cases/${c.id}`,
            });
          }

          if (codes.includes('HEIR_SHARES_NOT_100')) {
            items.push({
              id: `shares-${c.id}`,
              caseId: c.id,
              caseNumber: c.case_number || 'EXP',
              caseTitle: c.title || 'Caso',
              type: 'SEMAPHORE',
              severity: 'warning',
              title: 'Cuotas ≠ 100%',
              description: `Cuotas confirmadas suman ${data.total_confirmed_share || 0}%`,
              actionUrl: `/cases/${c.id}`,
            });
          }

          if (codes.includes('CAUSANTE_MISSING_DEATH_DATE')) {
            items.push({
              id: `death-${c.id}`,
              caseId: c.id,
              caseNumber: c.case_number || 'EXP',
              caseTitle: c.title || 'Caso',
              type: 'SEMAPHORE',
              severity: 'warning',
              title: 'Causante sin Fecha de Defunción',
              description: 'Completar partida de defunción en Personas',
              actionUrl: `/cases/${c.id}`,
            });
          }

          if (codes.includes('ROUTE_UNDEFINED_PAST_EVAL')) {
            items.push({
              id: `route-${c.id}`,
              caseId: c.id,
              caseNumber: c.case_number || 'EXP',
              caseTitle: c.title || 'Caso',
              type: 'SEMAPHORE',
              severity: 'critical',
              title: 'Vía Procesal sin Definir',
              description: 'Superada la evaluación legal sin elegir Notarial o Judicial',
              actionUrl: `/cases/${c.id}`,
            });
          }

          return items;
        } catch {
          return [];
        }
      });

      const semaphoreResults = await Promise.all(semaphorePromises);
      if (!isCancelled) {
        for (const resList of semaphoreResults) {
          discoveredTasks.push(...resList);
        }
        setTasks(discoveredTasks);
        setIsLoading(false);
      }
    }

    evaluateTodayTasks();
    return () => {
      isCancelled = true;
    };
  }, [cases]);

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'critical') return t.severity === 'critical';
    if (filter === 'warning') return t.severity === 'warning';
    return true;
  });

  return (
    <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold text-foreground">Bandeja: ¿Qué Hago Hoy?</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {tasks.length} {tasks.length === 1 ? 'pendiente' : 'pendientes'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
              filter === 'all'
                ? 'bg-muted text-foreground font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Todos ({tasks.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('critical')}
            className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
              filter === 'critical'
                ? 'bg-destructive/10 text-destructive font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Urgentes ({tasks.filter((t) => t.severity === 'critical').length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('warning')}
            className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
              filter === 'warning'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Atención ({tasks.filter((t) => t.severity === 'warning').length})
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Analizando plazos y semáforos del día...</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground space-y-1">
          <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500 mb-2" />
          <p className="font-semibold text-foreground">¡Todo al día por hoy!</p>
          <p className="text-[11px]">No hay plazos vencidos ni alertas bloqueantes en tus expedientes.</p>
        </div>
      ) : (
        <div className="divide-y divide-border -mx-1">
          {filteredTasks.map((task) => (
            <Link
              key={task.id}
              href={task.actionUrl}
              className="flex items-start justify-between gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors group"
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5">
                  {task.severity === 'critical' ? (
                    <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                      {task.caseNumber}
                    </span>
                    <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                      {task.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {task.caseTitle} · {task.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-primary shrink-0 self-center">
                <span>Atender</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
