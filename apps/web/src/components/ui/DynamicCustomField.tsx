'use client';

import React from 'react';
import type { CustomFieldDefinition } from '@workflow/shared';
import { FormField } from './FormField';

interface DynamicCustomFieldProps {
  definition: CustomFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
}

export const DynamicCustomField: React.FC<DynamicCustomFieldProps> = ({
  definition,
  value,
  onChange,
  error,
  disabled = false,
}) => {
  const { code, label, help_text, data_type, is_required, options } = definition;
  const id = `custom-field-${code}`;

  const renderControl = () => {
    switch (data_type) {
      case 'TEXT':
        return (
          <input
            id={id}
            type="text"
            disabled={disabled}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
          />
        );

      case 'TEXTAREA':
        return (
          <textarea
            id={id}
            rows={3}
            disabled={disabled}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
          />
        );

      case 'NUMBER':
        return (
          <input
            id={id}
            type="number"
            disabled={disabled}
            value={value !== undefined && value !== null ? Number(value) : ''}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
            className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
          />
        );

      case 'CURRENCY':
        return (
          <div className="relative rounded-md shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <span className="text-muted-foreground text-sm font-semibold">S/</span>
            </div>
            <input
              id={id}
              type="number"
              step="0.01"
              disabled={disabled}
              value={value !== undefined && value !== null ? Number(value) : ''}
              onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-input bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
            />
          </div>
        );

      case 'DATE':
        return (
          <input
            id={id}
            type="date"
            disabled={disabled}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
          />
        );

      case 'BOOLEAN':
        return (
          <div className="flex items-center gap-2 pt-1">
            <input
              id={id}
              type="checkbox"
              disabled={disabled}
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary focus:ring-primary disabled:opacity-50"
            />
            <span className="text-xs text-muted-foreground">Marcar si aplica</span>
          </div>
        );

      case 'SELECT':
        return (
          <select
            id={id}
            disabled={disabled}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50"
          >
            <option value="">-- Seleccionar --</option>
            {options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case 'MULTISELECT': {
        const selectedList: string[] = Array.isArray(value) ? (value as string[]) : [];
        return (
          <div className="space-y-1.5 pt-1">
            {options?.map((opt) => {
              const isChecked = selectedList.includes(opt);
              return (
                <label
                  key={opt}
                  className="flex items-center gap-2 text-xs text-foreground cursor-pointer"
                >
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onChange([...selectedList, opt]);
                      } else {
                        onChange(selectedList.filter((item) => item !== opt));
                      }
                    }}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary disabled:opacity-50"
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
        );
      }

      default:
        return (
          <input
            id={id}
            type="text"
            disabled={disabled}
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground shadow-sm"
          />
        );
    }
  };

  return (
    <FormField
      id={id}
      label={label}
      error={error}
      description={help_text || undefined}
      required={is_required}
    >
      {renderControl()}
    </FormField>
  );
};
