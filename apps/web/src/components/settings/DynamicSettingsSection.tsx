'use client';

import React, { useState } from 'react';
import type { SettingDefinition } from '@workflow/shared';
import { validateSettingValue } from '@workflow/shared';
import { FormField } from '../ui/FormField';
import { Check, AlertCircle } from 'lucide-react';

interface DynamicSettingsSectionProps {
  title: string;
  description: string;
  definitions: SettingDefinition[];
  values: Record<string, unknown>;
  onSave?: (updates: Record<string, unknown>) => Promise<void>;
}

export const DynamicSettingsSection: React.FC<DynamicSettingsSectionProps> = ({
  title,
  description,
  definitions,
  values,
  onSave,
}) => {
  const [formState, setFormState] = useState<Record<string, unknown>>(values);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const handleChange = (key: string, val: unknown) => {
    setFormState((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    for (const def of definitions) {
      const currentVal = formState[def.key] ?? def.default_value;
      const validation = validateSettingValue(def, currentVal);
      if (!validation.valid) {
        newErrors[def.key] = validation.error || 'Valor inválido';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await onSave?.(formState);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err: unknown) {
      setErrors({ form: err instanceof Error ? err.message : 'Error al guardar configuración' });
    }
  };

  const renderControl = (def: SettingDefinition) => {
    const val = formState[def.key] !== undefined ? formState[def.key] : def.default_value;
    const id = `setting-${def.key}`;

    switch (def.value_type) {
      case 'boolean':
        return (
          <div className="flex items-center gap-2 pt-1">
            <input
              id={id}
              type="checkbox"
              checked={Boolean(val)}
              onChange={(e) => handleChange(def.key, e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
            />
            <span className="text-xs text-muted-foreground">Habilitar / Activo</span>
          </div>
        );

      case 'number':
        return (
          <input
            id={id}
            type="number"
            value={val !== undefined && val !== null ? Number(val) : ''}
            onChange={(e) => handleChange(def.key, e.target.value === '' ? null : Number(e.target.value))}
            className="w-full max-w-sm px-3 py-2 text-xs rounded-md border border-input bg-background text-foreground"
          />
        );

      case 'enum': {
        const options: string[] = Array.isArray(def.constraints.options)
          ? (def.constraints.options as string[])
          : [];
        return (
          <select
            id={id}
            value={String(val || '')}
            onChange={(e) => handleChange(def.key, e.target.value)}
            className="w-full max-w-sm px-3 py-2 text-xs rounded-md border border-input bg-background text-foreground"
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      }

      case 'color':
        return (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={String(val || '#000000')}
              onChange={(e) => handleChange(def.key, e.target.value)}
              className="w-8 h-8 rounded border border-input cursor-pointer"
            />
            <input
              id={id}
              type="text"
              value={String(val || '')}
              onChange={(e) => handleChange(def.key, e.target.value)}
              className="w-28 px-3 py-2 text-xs rounded-md border border-input bg-background text-foreground font-mono"
            />
          </div>
        );

      case 'list':
        return (
          <input
            id={id}
            type="text"
            value={Array.isArray(val) ? val.join(', ') : String(val || '')}
            onChange={(e) =>
              handleChange(
                def.key,
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
            placeholder="Valores separados por coma"
            className="w-full max-w-lg px-3 py-2 text-xs rounded-md border border-input bg-background text-foreground font-mono"
          />
        );

      case 'time':
        return (
          <input
            id={id}
            type="time"
            value={String(val || '')}
            onChange={(e) => handleChange(def.key, e.target.value)}
            className="w-36 px-3 py-2 text-xs rounded-md border border-input bg-background text-foreground font-mono"
          />
        );

      default:
        return (
          <input
            id={id}
            type="text"
            value={String(val || '')}
            onChange={(e) => handleChange(def.key, e.target.value)}
            className="w-full max-w-lg px-3 py-2 text-xs rounded-md border border-input bg-background text-foreground"
          />
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <div className="border-b border-border pb-3">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {errors.form && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errors.form}</span>
        </div>
      )}

      <div className="space-y-4">
        {definitions.map((def) => (
          <FormField
            key={def.key}
            id={`setting-${def.key}`}
            label={def.label}
            description={def.description || undefined}
            error={errors[def.key]}
          >
            {renderControl(def)}
          </FormField>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border">
        {success ? (
          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
            <Check className="w-4 h-4" /> Configuración guardada exitosamente
          </span>
        ) : <span />}

        <button
          type="submit"
          className="px-5 py-2 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors"
        >
          Guardar Cambios
        </button>
      </div>
    </form>
  );
};
