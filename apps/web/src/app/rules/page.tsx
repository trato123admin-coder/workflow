'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { createClient } from '../../lib/supabase/client';
import { RulesTable } from '../../components/rules/RulesTable';
import { RuleModal, type DocumentRuleRow } from '../../components/rules/RuleModal';
import { RulesSimulator } from '../../components/rules/RulesSimulator';
import { Scale, Plus, PlayCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function RulesPage() {
  const [activeTab, setActiveTab] = useState<'RULES' | 'SIMULATOR'>('RULES');
  const [rules, setRules] = useState<DocumentRuleRow[]>([]);
  const [docTypes, setDocTypes] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<DocumentRuleRow | null>(null);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [rulesRes, docTypesRes] = await Promise.all([
        supabase
          .from('document_rules')
          .select(`
            id,
            code,
            name,
            description,
            case_model_version_id,
            process_definition_id,
            target_document_type_id,
            target_template_id,
            effect_type,
            priority,
            explanation,
            rule_definition,
            is_active,
            target_document_type:document_types (id, code, name)
          `)
          .order('priority', { ascending: true }),
        supabase
          .from('document_types')
          .select('id, code, name')
          .eq('is_active', true)
          .order('name', { ascending: true }),
      ]);

      if (rulesRes.error) throw rulesRes.error;
      if (docTypesRes.error) throw docTypesRes.error;

      setRules((rulesRes.data as unknown as DocumentRuleRow[]) || []);
      setDocTypes(docTypesRes.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al cargar datos';
      setErrorMessage(`Error al cargar datos: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateRule = () => {
    setSelectedRule(null);
    setIsModalOpen(true);
  };

  const handleEditRule = (rule: DocumentRuleRow) => {
    setSelectedRule(rule);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (rule: DocumentRuleRow) => {
    try {
      const { error } = await supabase
        .from('document_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id);

      if (error) throw error;
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      alert(`No se pudo actualizar el estado de la regla: ${msg}`);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Scale className="w-7 h-7 text-brand-primary" />
              Reglas Documentales
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Configuración de aplicabilidad y exigibilidad de documentos según el motor de reglas (DSL).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 border border-slate-300 dark:border-slate-700 rounded-md text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {activeTab === 'RULES' && (
              <button
                onClick={handleCreateRule}
                className="px-4 py-2 bg-brand-primary text-white rounded-md font-medium text-sm hover:bg-brand-primary/90 flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Nueva Regla
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 dark:border-slate-800">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('RULES')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === 'RULES'
                  ? 'border-brand-primary text-brand-primary font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Scale className="w-4 h-4" />
              Catálogo de Reglas ({rules.length})
            </button>

            <button
              onClick={() => setActiveTab('SIMULATOR')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === 'SIMULATOR'
                  ? 'border-brand-primary text-brand-primary font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <PlayCircle className="w-4 h-4" />
              Simulador de Reglas (M7)
            </button>
          </nav>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-md bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'RULES' ? (
          <RulesTable
            rules={rules}
            isLoading={isLoading}
            onEdit={handleEditRule}
            onToggleActive={handleToggleActive}
          />
        ) : (
          <RulesSimulator supabase={supabase} />
        )}

        {/* Create / Edit Modal */}
        <RuleModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSaved={loadData}
          supabase={supabase}
          rule={selectedRule}
          docTypes={docTypes}
        />
      </div>
    </AppShell>
  );
}
