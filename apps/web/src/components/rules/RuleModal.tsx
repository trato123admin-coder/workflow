'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { ruleDefinitionSchema } from '@workflow/shared';
import { AlertCircle, CheckCircle2, Code2 } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DocumentRuleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  case_model_version_id: string | null;
  process_definition_id: string | null;
  target_document_type_id: string;
  target_template_id: string | null;
  effect_type: 'RECOMMEND' | 'EXCLUDE' | 'REQUIRE';
  priority: number;
  explanation: string;
  rule_definition: Record<string, unknown>;
  is_active: boolean;
  target_document_type?: { id: string; code: string; name: string } | null;
}

interface RuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  supabase: SupabaseClient;
  rule: DocumentRuleRow | null;
  docTypes: Array<{ id: string; code: string; name: string }>;
}

export const RuleModal: React.FC<RuleModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  supabase,
  rule,
  docTypes,
}) => {
  const isEditing = !!rule;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [effectType, setEffectType] = useState<'RECOMMEND' | 'EXCLUDE' | 'REQUIRE'>('RECOMMEND');
  const [priority, setPriority] = useState<number>(50);
  const [targetDocTypeId, setTargetDocTypeId] = useState('');
  const [explanation, setExplanation] = useState('');
  const [definitionJson, setDefinitionJson] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (rule) {
      setCode(rule.code);
      setName(rule.name);
      setDescription(rule.description || '');
      setEffectType(rule.effect_type);
      setPriority(rule.priority);
      setTargetDocTypeId(rule.target_document_type_id);
      setExplanation(rule.explanation);
      setDefinitionJson(JSON.stringify(rule.rule_definition, null, 2));
    } else {
      setCode('');
      setName('');
      setDescription('');
      setEffectType('RECOMMEND');
      setPriority(50);
      setTargetDocTypeId(docTypes[0]?.id || '');
      setExplanation('');
      setDefinitionJson(
        JSON.stringify(
          {
            version: 1,
            conditions: {
              fact: 'case.route',
              op: 'eq',
              value: 'NOTARIAL',
            },
            effect: {
              type: 'RECOMMEND',
              priority: 50,
            },
            explanation: 'Sugerido para trámite notarial',
          },
          null,
          2
        )
      );
    }
    setValidationError(null);
  }, [rule, docTypes, isOpen]);

  const handleValidateJson = () => {
    try {
      const parsed = JSON.parse(definitionJson);
      const res = ruleDefinitionSchema.safeParse(parsed);
      if (!res.success) {
        setValidationError(
          res.error.errors
            .map((e: { path: (string | number)[]; message: string }) => `${e.path.join('.')}: ${e.message}`)
            .join('; ')
        );
        return false;
      }
      setValidationError(null);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de formato';
      setValidationError(`JSON no válido: ${msg}`);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handleValidateJson()) return;

    setIsSubmitting(true);
    try {
      const parsedDefinition = JSON.parse(definitionJson);
      const payload = {
        code,
        name,
        description: description || null,
        effect_type: effectType,
        priority,
        target_document_type_id: targetDocTypeId,
        explanation,
        rule_definition: parsedDefinition,
      };

      if (isEditing && rule) {
        const { error } = await supabase
          .from('document_rules')
          .update(payload)
          .eq('id', rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('document_rules')
          .insert(payload);
        if (error) throw error;
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar la regla';
      setValidationError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Editar Regla: ${rule.code}` : 'Nueva Regla Documental'}
      description="Define las condiciones de aplicabilidad del documento según el DSL de reglas."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {validationError && (
          <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">{validationError}</div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Código Único *
            </label>
            <input
              type="text"
              required
              disabled={isEditing}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="RULE_DOC_..."
              className="w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nombre de la Regla *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Requerir Copia Literal con Inmuebles"
              className="w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Documento Objetivo *
            </label>
            <select
              required
              value={targetDocTypeId}
              onChange={(e) => setTargetDocTypeId(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
            >
              {docTypes.map((dt) => (
                <option key={dt.id} value={dt.id}>
                  {dt.code} — {dt.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Efecto *
            </label>
            <select
              required
              value={effectType}
              onChange={(e) => setEffectType(e.target.value as 'RECOMMEND' | 'EXCLUDE' | 'REQUIRE')}
              className="w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            >
              <option value="RECOMMEND">RECOMMEND (Recomendar)</option>
              <option value="EXCLUDE">EXCLUDE (Excluir/Descartar)</option>
              <option value="REQUIRE">REQUIRE (Obligatorio Legal)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Prioridad (1 = Máx, 100 = Mín) *
            </label>
            <input
              type="number"
              min={1}
              max={100}
              required
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value, 10) || 50)}
              className="w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Explicación para el usuario / abogado *
          </label>
          <input
            type="text"
            required
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Motivo legal o de negocio de esta regla"
            className="w-full px-3 py-2 border rounded-md bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5" />
              Definición DSL (JSON validado por Zod) *
            </label>
            <button
              type="button"
              onClick={handleValidateJson}
              className="text-xs text-brand-primary hover:underline font-medium"
            >
              Validar sintaxis
            </button>
          </div>
          <textarea
            rows={8}
            required
            value={definitionJson}
            onChange={(e) => setDefinitionJson(e.target.value)}
            className="w-full font-mono text-xs px-3 py-2 border rounded-md bg-slate-950 text-slate-100 border-slate-800 focus:ring-1 focus:ring-brand-primary"
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-brand-primary text-white rounded-md font-medium hover:bg-brand-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Regla'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
