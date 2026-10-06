'use client';

import React, { useState, useEffect } from 'react';
import {
  evaluateDocumentRules,
  type RuleEngineEvaluationResult,
  type RuleContext,
  type RuleEvaluationTrace,
  type RuleConflictWarning,
  type RuleEngineDocumentDecision,
  type RuleRecord,
} from '@workflow/shared';
import { buildRuleContextFromCase } from '../../lib/rules-context-builder';
import {
  Play,
  AlertTriangle,
  FileCheck,
  FileX,
  FileText,
  ChevronDown,
  ChevronRight,
  Info,
  CheckCircle2,
  XCircle,
  Database,
  Cpu,
} from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';

interface CaseOption {
  id: string;
  case_number: string;
  title: string;
  case_model_version_id: string;
  created_at: string;
}

interface RulesSimulatorProps {
  supabase: SupabaseClient;
}

export const RulesSimulator: React.FC<RulesSimulatorProps> = ({ supabase }) => {
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [isLoadingCases, setIsLoadingCases] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<RuleEngineEvaluationResult | null>(null);
  const [extractedContext, setExtractedContext] = useState<RuleContext | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedTraces, setExpandedTraces] = useState<Record<string, boolean>>({});
  const [showJsonContext, setShowJsonContext] = useState(false);

  // Load accessible cases for the selector
  useEffect(() => {
    async function loadCases() {
      setIsLoadingCases(true);
      try {
        const { data, error } = await supabase
          .from('cases')
          .select('id, case_number, title, case_model_version_id, created_at')
          .order('created_at', { ascending: false })
          .limit(30);

        if (error) throw error;
        setCases(data || []);
        if (data && data.length > 0) {
          setSelectedCaseId(data[0].id);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error desconocido al cargar expedientes';
        setErrorMessage(`Error al cargar expedientes: ${msg}`);
      } finally {
        setIsLoadingCases(false);
      }
    }
    loadCases();
  }, [supabase]);

  const handleRunSimulation = async () => {
    if (!selectedCaseId) return;

    setIsSimulating(true);
    setErrorMessage(null);
    setSimulationResult(null);
    setExtractedContext(null);

    try {
      // 1. Build RuleContext safely from DB
      const context = await buildRuleContextFromCase(supabase, selectedCaseId);
      setExtractedContext(context);

      // Find selected case to get its model version
      const currentCase = cases.find((c) => c.id === selectedCaseId);
      const modelVersionId = currentCase?.case_model_version_id;

      // 2. Fetch active rules for this case model version + global rules (where case_model_version_id is null)
      let query = supabase
        .from('document_rules')
        .select(
          `
          id,
          code,
          name,
          explanation,
          priority,
          effect_type,
          rule_definition,
          target_document_type_id,
          target_document_type:document_types (id, code, name)
        `,
        )
        .eq('is_active', true);

      if (modelVersionId) {
        query = query.or(
          `case_model_version_id.eq.${modelVersionId},case_model_version_id.is.null`,
        );
      } else {
        query = query.is('case_model_version_id', null);
      }

      const { data: dbRules, error: rulesError } = await query;
      if (rulesError) throw rulesError;

      // Map to RuleRecord format for pure engine
      const ruleRecords: RuleRecord[] = (dbRules || []).map((r) => {
        const item = r as unknown as {
          id: string;
          code: string;
          target_document_type_id: string;
          target_document_type?: { code?: string } | null;
          rule_definition: RuleRecord['rule_definition'];
        };
        return {
          id: item.id,
          code: item.code,
          target_document_type_id: item.target_document_type_id,
          target_document_type_code: item.target_document_type?.code || 'UNKNOWN',
          rule_definition: item.rule_definition,
        };
      });

      // 3. Execute pure engine evaluation
      const result = evaluateDocumentRules(ruleRecords, context);
      setSimulationResult(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error durante la simulación de reglas';
      setErrorMessage(msg);
    } finally {
      setIsSimulating(false);
    }
  };

  const toggleTrace = (ruleCode: string) => {
    setExpandedTraces((prev) => ({
      ...prev,
      [ruleCode]: !prev[ruleCode],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Simulation Header and Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-brand-primary" />
              Simulador de Reglas Documentales (M7)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Evalúa las reglas activas contra los hechos reales de un expediente para verificar qué
              documentos se exigen, recomiendan o descartan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <Info className="w-3.5 h-3.5" />
              Simulación de solo lectura — no se guarda ni afecta el expediente
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Seleccionar Expediente Real
            </label>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              disabled={isLoadingCases || isSimulating}
              className="w-full px-3 py-2 border rounded-md bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_number} — {c.title}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={isSimulating || !selectedCaseId}
            className="sm:self-end px-5 py-2.5 bg-brand-primary text-white rounded-md font-medium text-sm hover:bg-brand-primary/90 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            {isSimulating ? 'Simulando...' : 'Ejecutar Simulación'}
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Conflict Warning Banner (REQUIRE vs EXCLUDE) */}
      {simulationResult?.warnings && simulationResult.warnings.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 rounded-lg p-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Conflicto de Configuración Detectado
              </h3>
              <div className="mt-2 space-y-2 text-xs text-amber-800 dark:text-amber-300">
                {simulationResult.warnings.map((w: RuleConflictWarning, idx: number) => (
                  <div
                    key={idx}
                    className="bg-white/60 dark:bg-slate-900/60 p-2.5 rounded border border-amber-200 dark:border-amber-800"
                  >
                    <p className="font-semibold">{w.message}</p>
                    <p className="mt-1 text-slate-600 dark:text-slate-400">
                      <strong>Acción del sistema:</strong> El documento{' '}
                      <code className="font-mono text-slate-800 dark:text-slate-200 bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">
                        {w.documentTypeCode}
                      </code>{' '}
                      se marcó como <strong>OBLIGATORIO (REQUIRE)</strong> y la regla EXCLUDE fue
                      ignorada conforme a la regla de precedencia legal incondicional.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decision Summary Columns */}
      {simulationResult && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. Required Documents */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-rose-600" />
                Obligatorios (REQUIRE)
              </span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                {simulationResult.required.length}
              </span>
            </div>

            <div className="mt-3 space-y-2.5 flex-1">
              {simulationResult.required.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">
                  Ningún documento marcado como obligatorio.
                </p>
              ) : (
                simulationResult.required.map((doc: RuleEngineDocumentDecision) => (
                  <div
                    key={doc.documentTypeCode}
                    className="p-2.5 rounded border border-rose-100 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-rose-900 dark:text-rose-200">
                        {doc.documentTypeCode}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100">
                        Prioridad {doc.priority}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">{doc.explanation}</p>
                    <div className="mt-1 text-[11px] text-slate-500 font-mono">
                      Regla: {doc.matchingRuleCodes.join(', ')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. Excluded Documents */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <FileX className="w-4 h-4 text-slate-500" />
                Descartados (EXCLUDE)
              </span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                {simulationResult.excluded.length}
              </span>
            </div>

            <div className="mt-3 space-y-2.5 flex-1">
              {simulationResult.excluded.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">Ningún documento descartado.</p>
              ) : (
                simulationResult.excluded.map((doc: RuleEngineDocumentDecision) => (
                  <div
                    key={doc.documentTypeCode}
                    className="p-2.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-300">
                        {doc.documentTypeCode}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        Prioridad {doc.priority}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">{doc.explanation}</p>
                    <div className="mt-1 text-[11px] text-slate-500 font-mono">
                      Regla: {doc.matchingRuleCodes.join(', ')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 3. Recommended Documents */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600" />
                Sugeridos (RECOMMEND)
              </span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                {simulationResult.recommended.length}
              </span>
            </div>

            <div className="mt-3 space-y-2.5 flex-1">
              {simulationResult.recommended.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">Ningún documento sugerido.</p>
              ) : (
                simulationResult.recommended.map((doc: RuleEngineDocumentDecision) => (
                  <div
                    key={doc.documentTypeCode}
                    className="p-2.5 rounded border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-emerald-900 dark:text-emerald-200">
                        {doc.documentTypeCode}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100">
                        Prioridad {doc.priority}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">{doc.explanation}</p>
                    <div className="mt-1 text-[11px] text-slate-500 font-mono">
                      Regla: {doc.matchingRuleCodes.join(', ')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Condition Trace Explorer */}
      {simulationResult && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Traza de Evaluación de Reglas ({simulationResult.trace.length} evaluadas)
            </h3>
            <button
              onClick={() => setShowJsonContext(!showJsonContext)}
              className="text-xs text-brand-primary hover:underline flex items-center gap-1 font-medium"
            >
              <Database className="w-3.5 h-3.5" />
              {showJsonContext ? 'Ocultar Contexto JSON' : 'Ver Contexto Extraído (JSON)'}
            </button>
          </div>

          {showJsonContext && extractedContext && (
            <pre className="p-3 bg-slate-950 text-slate-200 rounded-md font-mono text-xs overflow-x-auto max-h-60 border border-slate-800">
              {JSON.stringify(extractedContext, null, 2)}
            </pre>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 pt-2">
            {simulationResult.trace.map((t: RuleEvaluationTrace) => {
              const isExpanded = !!expandedTraces[t.ruleCode];
              return (
                <div key={t.ruleCode} className="py-2.5 text-xs">
                  <div
                    onClick={() => toggleTrace(t.ruleCode)}
                    className="flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 p-1.5 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {t.ruleCode}
                      </span>
                      <span className="text-slate-500">→ {t.targetDocumentTypeCode}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-slate-500">
                        {t.effect.type} (P{t.effect.priority})
                      </span>
                      {t.matched ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3 h-3" /> Coincidió
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                          <XCircle className="w-3 h-3" /> No coincidió
                        </span>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 ml-6 p-3 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700 space-y-1 font-mono text-[11px]">
                      <p className="text-slate-700 dark:text-slate-300 font-sans text-xs mb-2">
                        {t.explanation}
                      </p>
                      <div className="text-slate-500">
                        <strong>Condición evaluada:</strong>{' '}
                        {t.conditionTrace.combinator
                          ? `Combinador [${t.conditionTrace.combinator.toUpperCase()}] con ${t.conditionTrace.children?.length} subcondiciones`
                          : `${t.conditionTrace.fact} ${t.conditionTrace.op} ${JSON.stringify(t.conditionTrace.expectedValue)}`}
                      </div>
                      {t.conditionTrace.fact && (
                        <div className="text-slate-600 dark:text-slate-400">
                          <strong>Valor real encontrado en el caso:</strong>{' '}
                          <code className="text-brand-primary">
                            {JSON.stringify(t.conditionTrace.actualValue)}
                          </code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
