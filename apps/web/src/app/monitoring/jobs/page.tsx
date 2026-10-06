'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity,
  RefreshCw,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertOctagon,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AppShell } from '../../../components/layout/AppShell';
import { createClient } from '../../../lib/supabase/client';
import { triggerJobsTick, retryJob } from '../../../lib/engine-jobs-client';
import type { JobQueueItem, JobStatus } from '@workflow/shared';

function StatusBadge({ status }: { status: JobStatus }) {
  switch (status) {
    case 'DONE':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" /> DONE
        </span>
      );
    case 'RUNNING':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
          <Loader2 className="w-3 h-3 animate-spin" /> RUNNING
        </span>
      );
    case 'QUEUED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
          <Clock className="w-3 h-3" /> QUEUED
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-600 border border-orange-500/20">
          <AlertTriangle className="w-3 h-3" /> FAILED
        </span>
      );
    case 'DEAD':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/10 text-destructive border border-destructive/20">
          <AlertOctagon className="w-3 h-3" /> DEAD
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
          {status}
        </span>
      );
  }
}

export default function JobMonitoringPage() {
  const [jobs, setJobs] = useState<JobQueueItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | JobStatus>('ALL');
  const [jobsMode, setJobsMode] = useState<string>('TICK');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedPayloads, setExpandedPayloads] = useState<Set<string>>(new Set());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const loadJobsData = useCallback(async () => {
    try {
      const supabase = createClient();
      let query = supabase
        .from('job_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (statusFilter !== 'ALL') query = query.eq('status', statusFilter);

      const [jobsRes, settingRes] = await Promise.all([
        query,
        supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'platform.jobs_mode')
          .maybeSingle(),
      ]);

      if (jobsRes.error) {
        setErrorMessage(`Error al consultar cola de trabajos: ${jobsRes.error.message}`);
      } else if (jobsRes.data) {
        setErrorMessage(null);
        setJobs(jobsRes.data as unknown as JobQueueItem[]);
      }

      if (settingRes.data?.value) {
        setJobsMode(String(settingRes.data.value).replace(/"/g, ''));
      }
    } catch (err: unknown) {
      setErrorMessage(
        `Error de red al consultar trabajos: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadJobsData();
    if (autoRefresh) {
      timerRef.current = setInterval(loadJobsData, 10000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadJobsData, autoRefresh]);

  const handleManualTick = async () => {
    setActionLoading(true);
    setFeedback(null);
    setErrorMessage(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await triggerJobsTick('monitoring_ui');
      setFeedback(
        `Tick ejecutado: ${res.processed ?? 0} procesados (${res.succeeded ?? 0} exitosos, ${res.failed ?? 0} fallidos).`,
      );
      await loadJobsData();
    } catch (err: unknown) {
      setErrorMessage(
        `Error al ejecutar tick: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    setActionLoading(true);
    setFeedback(null);
    setErrorMessage(null);
    try {
      await retryJob(jobId);
      setFeedback('Trabajo reencolado exitosamente para nuevo procesamiento.');
      await loadJobsData();
    } catch (err: unknown) {
      setErrorMessage(
        `Error al reintentar trabajo: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setActionLoading(false);
    }
  };

  const togglePayload = (id: string) => {
    setExpandedPayloads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AppShell
      breadcrumbs={[{ label: 'Inicio', href: '/dashboard' }, { label: 'Cola de Trabajos' }]}
    >
      <div className="space-y-6">
        {/* Header Controls */}
        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold text-foreground">Monitoreo de Cola de Trabajos</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Modo: {jobsMode}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Cola transaccional SKIP LOCKED procesada por el Fastify Engine (pg_cron + TICK).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none mr-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary w-3.5 h-3.5"
              />
              <span>Auto (10s)</span>
            </label>

            <button
              type="button"
              onClick={() => loadJobsData()}
              disabled={loading}
              className="p-2 text-xs font-semibold rounded-xl border border-border hover:bg-muted text-foreground transition-colors flex items-center gap-1"
              title="Refrescar lista"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refrescar</span>
            </button>

            <button
              type="button"
              disabled={actionLoading}
              onClick={handleManualTick}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Ejecutar Tick Manual</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 text-primary text-xs flex items-center justify-between gap-2 animate-in fade-in">
            <span>{feedback}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive text-xs flex items-center justify-between gap-2 animate-in fade-in">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="hover:opacity-75"
            >
              ✕
            </button>
          </div>
        )}

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 bg-muted/40 p-1.5 rounded-xl border border-border text-xs flex-wrap">
          {(['ALL', 'QUEUED', 'RUNNING', 'DONE', 'FAILED', 'DEAD'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                statusFilter === st
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Table View */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-16 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span>Cargando cola de trabajos...</span>
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-16 text-center space-y-1">
              <p className="text-sm font-semibold text-foreground">No hay trabajos en la cola</p>
              <p className="text-xs text-muted-foreground">
                La cola se encuentra limpia con el filtro seleccionado.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Tipo de Trabajo</th>
                    <th className="p-3">Intentos</th>
                    <th className="p-3">Programado Para</th>
                    <th className="p-3">Último Error / Worker</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {jobs.map((job) => {
                    const isExpanded = expandedPayloads.has(job.id);
                    const canRetry = job.status === 'DEAD' || job.status === 'FAILED';

                    return (
                      <React.Fragment key={job.id}>
                        <tr className="hover:bg-muted/20 transition-colors">
                          <td className="p-3 whitespace-nowrap">
                            <StatusBadge status={job.status} />
                          </td>
                          <td className="p-3 font-semibold text-foreground">
                            <div className="flex items-center gap-1.5">
                              <span>{job.job_type}</span>
                              <button
                                type="button"
                                onClick={() => togglePayload(job.id)}
                                className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                                title="Ver payload"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-normal block truncate max-w-xs">
                              {job.id}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="font-semibold text-foreground">{job.attempts}</span>
                            <span className="text-muted-foreground"> / {job.max_attempts}</span>
                          </td>
                          <td className="p-3 whitespace-nowrap text-muted-foreground">
                            {new Date(job.run_at).toLocaleString('es-PE', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </td>
                          <td className="p-3 max-w-xs truncate text-muted-foreground">
                            {job.last_error ? (
                              <span
                                className="text-destructive font-sans font-medium"
                                title={job.last_error}
                              >
                                {job.last_error}
                              </span>
                            ) : job.locked_by ? (
                              <span className="text-primary font-sans">{job.locked_by}</span>
                            ) : (
                              <span className="text-muted-foreground italic font-sans">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap font-sans">
                            {canRetry && (
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleRetryJob(job.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-border hover:bg-muted text-foreground transition-colors disabled:opacity-50"
                                title="Reintentar trabajo manualmente"
                              >
                                <RotateCcw className="w-3 h-3 text-primary" />
                                <span>Reintentar</span>
                              </button>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-muted/10">
                            <td colSpan={6} className="p-3.5 border-t border-dashed border-border">
                              <div className="space-y-1">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                                  Payload & Dedupe Key:
                                </span>
                                <pre className="p-2.5 rounded-lg bg-background border border-border text-[11px] text-muted-foreground overflow-x-auto max-h-48 font-mono">
                                  {JSON.stringify(
                                    { dedupe_key: job.dedupe_key, payload: job.payload },
                                    null,
                                    2,
                                  )}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
