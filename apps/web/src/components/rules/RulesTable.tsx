'use client';

import React from 'react';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { Scale, Edit2, ToggleLeft, ToggleRight } from 'lucide-react';
import type { DocumentRuleRow } from './RuleModal';

interface RulesTableProps {
  rules: DocumentRuleRow[];
  isLoading: boolean;
  onEdit: (rule: DocumentRuleRow) => void;
  onToggleActive: (rule: DocumentRuleRow) => void;
}

export const RulesTable: React.FC<RulesTableProps> = ({
  rules,
  isLoading,
  onEdit,
  onToggleActive,
}) => {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500 animate-pulse">
        Cargando catálogo de reglas documentales...
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <EmptyState
        icon={<Scale className="w-10 h-10 text-slate-400" />}
        title="No hay reglas configuradas"
        description="No se encontraron reglas documentales activas para este criterio de búsqueda."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
        <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
          <tr>
            <th className="px-4 py-3">Código</th>
            <th className="px-4 py-3">Nombre y Explicación</th>
            <th className="px-4 py-3">Doc. Objetivo</th>
            <th className="px-4 py-3 text-center">Efecto</th>
            <th className="px-4 py-3 text-center">Prioridad</th>
            <th className="px-4 py-3 text-center">Estado</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rules.map((rule) => {
            const effectCategory =
              rule.effect_type === 'REQUIRE'
                ? 'danger'
                : rule.effect_type === 'RECOMMEND'
                ? 'success'
                : 'neutral';

            return (
              <tr
                key={rule.id}
                className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-slate-100 text-xs">
                  {rule.code}
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {rule.name}
                  </div>
                  <div className="text-xs text-slate-500 truncate" title={rule.explanation}>
                    {rule.explanation}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-800 dark:text-slate-200">
                    {rule.target_document_type?.code || 'N/A'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge category={effectCategory} label={rule.effect_type} size="sm" />
                </td>
                <td className="px-4 py-3 text-center font-mono font-semibold text-xs">
                  {rule.priority}
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge
                    category={rule.is_active ? 'success' : 'neutral'}
                    label={rule.is_active ? 'Activa' : 'Inactiva'}
                    size="sm"
                  />
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => onToggleActive(rule)}
                    title={rule.is_active ? 'Desactivar regla' : 'Activar regla'}
                    className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                  >
                    {rule.is_active ? (
                      <ToggleRight className="w-5 h-5 text-emerald-600 inline" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-slate-400 inline" />
                    )}
                  </button>
                  <button
                    onClick={() => onEdit(rule)}
                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                    title="Editar regla"
                  >
                    <Edit2 className="w-4 h-4 inline" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
